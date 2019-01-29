/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster),
 * [Valery Litvin](https://github.com/litvintech) by
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and
 * Galt•Space Society Construction and Terraforming Company by
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

pragma solidity 0.5.3;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/ISpaceToken.sol";
import "./interfaces/ISpaceLocker.sol";
import "./interfaces/ISRA.sol";
import "./registries/interfaces/ISpaceLockerRegistry.sol";


contract LiquidReputationAccounting is ISRA, Permissionable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  IERC721 internal spaceToken;
  ISpaceLockerRegistry internal spaceLockerRegistry;

  // Delegate => balance
  mapping(address => uint256) internal _balances;

  // Owner => totalMinted
  mapping(address => uint256) internal _ownedBalances;

  // Reputation Owner => (Delegate => balance))
  mapping(address => mapping(address => uint256)) internal _delegatedBalances;

  // Delegate => locked amount
  mapping(address => uint256) internal _locks;

  mapping(address => ArraySet.AddressSet) internal _delegations;

  mapping(uint256 => bool) public reputationMinted;

  // L0
  uint256 internal totalStakedSpace;

  constructor(
    IERC721 _spaceToken,
    ISpaceLockerRegistry _spaceLockerRegistry
  )
    public
  {
    spaceToken = _spaceToken;
    spaceLockerRegistry = _spaceLockerRegistry;
  }

  modifier onlySpaceTokenOwner(uint256 _spaceTokenId, ISpaceLocker _spaceLocker) {
    require(address(_spaceLocker) == spaceToken.ownerOf(_spaceTokenId), "Invalid sender. Token owner expected.");
    require(msg.sender == _spaceLocker.owner(), "Not SpaceLocker owner");
    spaceLockerRegistry.requireValidLocker(_spaceLocker);
    _;
  }

  // MODIFIERS

  // @dev Mints reputation for given token to the owner account
  function mint(
    ISpaceLocker _spaceLocker
  )
    public
  {
    spaceLockerRegistry.requireValidLocker(_spaceLocker);

    address owner = _spaceLocker.owner();
    require(msg.sender == owner, "Not owner of the locker");

    uint256 spaceTokenId = _spaceLocker.spaceTokenId();
    require(reputationMinted[spaceTokenId] == false, "Reputation already minted");

    uint256 reputation = _spaceLocker.reputation();

    _mint(owner, reputation, spaceTokenId);
  }

  // Burn space token total reputation
  // Owner should revoke all delegated reputation back to his account before performing this action
  function approveBurn(
    ISpaceLocker _spaceLocker
  )
    public
  {
    spaceLockerRegistry.requireValidLocker(_spaceLocker);

    address owner = _spaceLocker.owner();

    require(msg.sender == owner, "Not owner of the locker");

    uint256 reputation = _spaceLocker.reputation();

    uint256 spaceTokenId = _spaceLocker.spaceTokenId();

    require(reputationMinted[spaceTokenId] == true, "Reputation doesn't minted");
    require(_balances[owner] >= reputation, "Not enough funds to burn");
    require(_delegatedBalances[owner][owner] >= reputation, "Not enough funds to burn");
    require(_ownedBalances[owner] >= reputation, "Not enough funds to burn");

    totalStakedSpace -= reputation;

    _balances[owner] -= reputation;
    _delegatedBalances[owner][owner] -= reputation;
    _ownedBalances[owner] -= reputation;

    if (_delegatedBalances[owner][owner] == 0) {
      _delegations[owner].remove(owner);
    }

    reputationMinted[spaceTokenId] = false;
  }

  // @dev Transfer owned reputation
  // PermissionED
  function delegate(address _to, address _owner, uint256 _amount) public {
    require(_balances[msg.sender] >= _amount, "Not enough funds");
    require(_delegatedBalances[_owner][msg.sender] >= _amount, "Not enough funds");

    _delegate(_to, msg.sender, _owner, _amount);
  }

  // PermissionED
  function revoke(address _from, uint256 _amount) public {
    require(_balances[_from] >= _amount, "Not enough funds");
    require(_delegatedBalances[msg.sender][_from] >= _amount, "Not enough funds");

    _balances[_from] -= _amount;
    _delegatedBalances[msg.sender][_from] -= _amount;

    if (_delegatedBalances[msg.sender][_from] == 0) {
      _delegations[msg.sender].remove(_from);
    }

    assert(_balances[_from] >= 0);
    assert(_delegatedBalances[msg.sender][_from] >= 0);

    _balances[msg.sender] += _amount;
    _delegatedBalances[msg.sender][msg.sender] += _amount;
    _delegations[msg.sender].addSilent(msg.sender);
  }

  // INTERNAL

  function _mint(address _beneficiary, uint256 _amount, uint256 _spaceTokenId) internal {
    totalStakedSpace += _amount;

    _balances[_beneficiary] += _amount;
    _delegatedBalances[_beneficiary][_beneficiary] += _amount;
    _ownedBalances[_beneficiary] += _amount;
    _delegations[_beneficiary].addSilent(_beneficiary);
    reputationMinted[_spaceTokenId] = true;
  }

  function _delegate(address _to, address _from, address _owner, uint256 _amount) internal {
    // TODO: check space owner

    _balances[_from] -= _amount;
    _delegatedBalances[_owner][_from] -= _amount;

    if (_delegatedBalances[_owner][_from] == 0) {
      _delegations[_owner].remove(_from);
    }

    assert(_balances[_from] >= 0);
    assert(_delegatedBalances[_owner][_from] >= 0);

    _balances[_to] += _amount;
    _delegatedBalances[_owner][_to] += _amount;

    _delegations[_owner].addSilent(_to);
  }

  // GETTERS

  // ERC20 compatible
  function balanceOf(address _owner) public view returns (uint256) {
    return _balances[_owner];
  }

  function ownedBalanceOf(address _owner) public view returns (uint256) {
    return _ownedBalances[_owner];
  }

  function delegatedBalanceOf(address __delegate, address _owner) public view returns (uint256) {
    return _delegatedBalances[_owner][__delegate];
  }

  function delegations(address _owner) public view returns (address[] memory) {
    return _delegations[_owner].elements();
  }

  // ERC20 compatible
  function totalSupply() public view returns (uint256) {
    return totalStakedSpace;
  }

  // Ping-Pong Handshake
  function ping() public pure returns (bytes32) {
    return bytes32("pong");
  }
}
