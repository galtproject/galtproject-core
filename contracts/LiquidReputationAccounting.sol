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
  using ArraySet for ArraySet.Uint256Set;

  IERC721 internal spaceToken;
  ISpaceLockerRegistry internal spaceLockerRegistry;

  // Delegate => balance
  mapping(address => uint256) private _balances;

  // Owner => totalMinted
  mapping(address => uint256) private _ownedBalances;

  // Reputation Owner => (Delegate => balance))
  mapping(address => mapping(address => uint256)) private _delegatedBalances;

  // Delegate => locked amount
  mapping(address => uint256) private _locks;

  mapping(address => ArraySet.AddressSet) private _delegations;

  ArraySet.AddressSet private _spaceTokenOwners;

  mapping(address => ArraySet.Uint256Set) private _spaceTokensByOwner;

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

    _debitAccount(owner, owner, reputation);

    _ownedBalances[owner] -= reputation;

    _spaceTokensByOwner[owner].remove(spaceTokenId);
    if (_spaceTokensByOwner[owner].size() == 0) {
      _spaceTokenOwners.remove(owner);
    }

    reputationMinted[spaceTokenId] = false;
  }

  // @dev Transfer owned reputation
  // PermissionED
  function delegate(address _to, address _owner, uint256 _amount) public {
    require(_spaceTokenOwners.has(_to), "Beneficiary isn't a space token owner");

    _transfer(msg.sender, _to, _owner, _amount);
  }

  // PermissionED
  function revoke(address _from, uint256 _amount) public {
    _debitAccount(_from, msg.sender, _amount);
    _creditAccount(msg.sender, msg.sender, _amount);
  }

  // INTERNAL

  function _mint(address _beneficiary, uint256 _amount, uint256 _spaceTokenId) internal {
    totalStakedSpace += _amount;

    _creditAccount(_beneficiary, _beneficiary, _amount);

    _ownedBalances[_beneficiary] += _amount;
    _spaceTokensByOwner[_beneficiary].add(_spaceTokenId);
    _spaceTokenOwners.addSilent(_beneficiary);

    reputationMinted[_spaceTokenId] = true;
  }

  function _transfer(address _from, address _to, address _owner, uint256 _amount) internal {
    _debitAccount(_from, _owner, _amount);
    _creditAccount(_to, _owner, _amount);
  }

  function _creditAccount(address _account, address _owner, uint256 _amount) internal {
    _balances[_account] += _amount;
    _delegatedBalances[_owner][_account] += _amount;

    _delegations[_owner].addSilent(_account);
  }

  function _debitAccount(address _account, address _owner, uint256 _amount) internal {
    require(_balances[_account] >= _amount, "Not enough funds");
    require(_delegatedBalances[_owner][_account] >= _amount, "Not enough funds");

    _balances[_account] -= _amount;
    _delegatedBalances[_owner][_account] -= _amount;

    if (_delegatedBalances[_owner][_account] == 0) {
      _delegations[_owner].remove(_account);
    }
  }

  function _revokeDelegated(address _account, uint _amount) internal {
    require(_delegatedBalances[msg.sender][_account] >= _amount, "Not enough funds");

    _balances[_account] -= _amount;
    _delegatedBalances[msg.sender][_account] -= _amount;

    if (_delegatedBalances[msg.sender][_account] == 0) {
      _delegations[msg.sender].remove(_account);
    }

    _creditAccount(msg.sender, msg.sender, _amount);
  }

  // GETTERS

  // ERC20 compatible
  function balanceOf(address _owner) public view returns (uint256) {
    return _balances[_owner];
  }

  function ownedBalanceOf(address _owner) public view returns (uint256) {
    return _ownedBalances[_owner];
  }

  function delegatedBalanceOf(address _delegate, address _owner) public view returns (uint256) {
    return _delegatedBalances[_owner][_delegate];
  }

  function delegations(address _owner) public view returns (address[] memory) {
    return _delegations[_owner].elements();
  }

  function delegationCount(address _owner) public view returns (uint256) {
    return _delegations[_owner].size();
  }

  function spaceTokenOwners() public view returns (address[] memory) {
    return _spaceTokenOwners.elements();
  }

  function spaceTokenOwnersCount() public view returns (uint256) {
    return _spaceTokenOwners.size();
  }

  function spaceTokensByOwner(address _owner) public view returns (uint256[] memory) {
    return _spaceTokensByOwner[_owner].elements();
  }

  // TODO: fix name to spaceTokensByOwnerCount
  function spaceTokenOwnersCount(address _owner) public view returns (uint256) {
    return _spaceTokensByOwner[_owner].size();
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
