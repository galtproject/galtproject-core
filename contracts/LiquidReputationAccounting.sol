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

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./collections/ArraySet.sol";
import "./traits/Permissionable.sol";
import "./SpaceToken.sol";
import "./multisig/ArbitratorVoting.sol";
import "./registries/SpaceLockerRegistry.sol";


contract LiquidReputationAccounting is Permissionable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  SpaceToken internal spaceToken;
  SpaceLockerRegistry internal spaceLockerRegistry;

  // Delegate => balance
  mapping(address => uint256) internal _balances;

  // Reputation Owner => (Delegate => balance))
  mapping(address => mapping(address => uint256)) internal _delegations;

  // Delegate => locked amount
  mapping(address => uint256) internal _locks;

  mapping(uint256 => bool) public reputationMinted;

  // L0
  uint256 internal totalStakedSpace;

  constructor(
    SpaceToken _spaceToken,
    SpaceLockerRegistry _spaceLockerRegistry
  )
    public
  {
    spaceToken = _spaceToken;
    spaceLockerRegistry = _spaceLockerRegistry;
  }

  modifier onlySpaceTokenOwner(uint256 _spaceTokenId, SpaceLocker _spaceLocker) {
    require(_spaceLocker == spaceToken.ownerOf(_spaceTokenId), "Invalid sender. Token owner expected.");
    require(msg.sender == _spaceLocker.owner(), "Not SpaceLocker owner");
    spaceLockerRegistry.requireValidLocker(_spaceLocker);
    _;
  }

  // MODIFIERS

  // @dev Mints reputation for given token to the owner account
  function mint(
    SpaceLocker _spaceLocker
  )
    external
  {
    spaceLockerRegistry.requireValidLocker(_spaceLocker);

    address owner = _spaceLocker.owner();

    require(msg.sender == owner, "Not owner of the locker");

    uint256 spaceTokenId = _spaceLocker.spaceTokenId();

    require(reputationMinted[spaceTokenId] == false, "Reputation already minted");

    uint256 reputation = _spaceLocker.reputation();

    totalStakedSpace += reputation;

    _balances[msg.sender] += reputation;
    _delegations[msg.sender][msg.sender] += reputation;
    reputationMinted[spaceTokenId] = true;
  }

  // Burn space token total reputation
  // Owner should revoke all delegated reputation back to his account before performing this action
  function approveBurn(
    SpaceLocker _spaceLocker
  )
    external
  {
    spaceLockerRegistry.requireValidLocker(_spaceLocker);

    address owner = _spaceLocker.owner();

    require(msg.sender == owner, "Not owner of the locker");

    uint256 reputation = _spaceLocker.reputation();

    uint256 spaceTokenId = _spaceLocker.spaceTokenId();

    require(reputationMinted[spaceTokenId] == true, "Reputation doesn't minted");
    require(_balances[owner] >= reputation, "Not enough funds to burn");
    require(_delegations[owner][owner] >= reputation, "Not enough funds to burn");

    totalStakedSpace -= reputation;

    _balances[owner] -= reputation;
    _delegations[owner][owner] -= reputation;

    reputationMinted[spaceTokenId] = false;
  }

  // @dev Transfer owned reputation
  // PermissionED
  function delegate(address _to, address _owner, uint256 _amount) external {
    require(_balances[msg.sender] >= _amount, "Not enough funds");
    require(_delegations[_owner][msg.sender] >= _amount, "Not enough funds");
    // TODO: check space owner

    _balances[msg.sender] -= _amount;
    _delegations[_owner][msg.sender] -= _amount;

    assert(_balances[msg.sender] >= 0);
    assert(_delegations[_owner][msg.sender] >= 0);

    _balances[_to] += _amount;
    _delegations[_owner][_to] += _amount;
  }

  // PermissionED
  function revoke(address _from, uint256 _amount) external {
    require(_balances[_from] >= _amount, "Not enough funds");
    require(_delegations[msg.sender][_from] >= _amount, "Not enough funds");

    _balances[_from] -= _amount;
    _delegations[msg.sender][_from] -= _amount;

    assert(_balances[_from] >= 0);
    assert(_delegations[msg.sender][_from] >= 0);

    _balances[msg.sender] += _amount;
    _delegations[msg.sender][msg.sender] += _amount;
  }

  // GETTERS

  // ERC20 compatible
  function balanceOf(address owner) public view returns (uint256) {
    return _balances[owner];
  }

  // ERC20 compatible
  function totalSupply() public returns (uint256) {
    return totalStakedSpace;
  }

  // Ping-Pong Handshake
  function ping() public returns (bytes32) {
    return bytes32("pong");
  }
}
