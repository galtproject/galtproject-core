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
import "./registries/MultiSigRegistry.sol";
import "./registries/SpaceLockerRegistry.sol";


contract SpaceReputationAccounting is Permissionable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  string public constant ROLE_SPACE_TOKEN = "space_token";

  SpaceToken spaceToken;
  MultiSigRegistry multiSigRegistry;
  SpaceLockerRegistry spaceLockerRegistry;

  // Delegate => balance
  mapping(address => uint256) private _balances;

  // Reputation Owner => (Delegate => balance))
  mapping(address => mapping(address => uint256)) private _delegations;

  // Delegate => (MultiSig => locked amount)
  mapping(address => mapping(address => uint256)) private _locks;

  // Token #ID => minted amount
  mapping(uint256 => uint256) public mintedReputation;

  // L0
  uint256 private totalStakedSpace;

  constructor(
    SpaceToken _spaceToken,
    MultiSigRegistry _multiSigRegistry,
    SpaceLockerRegistry _spaceLockerRegistry
  )
    public
  {
    _addRoleTo(address(_spaceToken), ROLE_SPACE_TOKEN);
    spaceToken = _spaceToken;
    multiSigRegistry = _multiSigRegistry;
    spaceLockerRegistry = _spaceLockerRegistry;
  }

  modifier onlySpaceTokenContract() {
    require(msg.sender == address(spaceToken), "Invalid sender. SpaceToken contract expected");
    _;
  }

  modifier onlySpaceTokenOwner(uint256 _spaceTokenId, SpaceLocker _spaceLocker) {
    require(_spaceLocker == spaceToken.ownerOf(_spaceTokenId), "Invalid sender. Token owner expected.");
    require(msg.sender == _spaceLocker.owner(), "Not SpaceLocker owner");
    spaceLockerRegistry.requireValidLocker(_spaceLocker);
    _;
  }

  // MODIFIERS

  // @dev Mints reputation for given token in case when 'reputation < minted'
  // PermissionED
  function mint(
    uint256 _spaceTokenId,
    SpaceLocker _spaceLocker
  )
    external
    onlySpaceTokenOwner(_spaceTokenId, _spaceLocker)
  {
    uint256 newReputation = _spaceLocker.reputation();
    uint256 diff = newReputation - mintedReputation[_spaceTokenId];
    require(diff > 0, "No reputation to mint");

    totalStakedSpace += diff;

    _balances[msg.sender] += diff;
    _delegations[msg.sender][msg.sender] += diff;
    mintedReputation[_spaceTokenId] += diff;
  }

  // PermissionLESS
  function burn(
    uint256 _spaceTokenId,
    SpaceLocker _spaceLocker,
    address _delegate,
    uint256 _amount
  )
    external
  {
    spaceLockerRegistry.requireValidLocker(_spaceLocker);
    // TODO: it is possible to burn reputation of token A while providing a locker contract for a token B

    address owner = _spaceLocker.owner();

    uint256 newReputation = _spaceLocker.reputation();
    uint256 diff = mintedReputation[_spaceTokenId] - newReputation;
    require(diff > 0, "No reputation to burn");
    require(_amount <= diff, "Amount to burn is too big");

    require(_balances[_delegate] >= _amount, "Not enough funds to burn");
    require(_delegations[owner][_delegate] >= _amount, "Not enough funds to burn");

    totalStakedSpace -= _amount;

    _balances[_delegate] -= _amount;
    _delegations[owner][_delegate] -= _amount;

    mintedReputation[_spaceTokenId] -= _amount;
  }

  // PermissionLESS
  function burnLocked(
    uint256 _spaceTokenId,
    SpaceLocker _spaceLocker,
    address _delegate,
    address _multiSig,
    uint256 _amount
  )
    external
  {
    spaceLockerRegistry.requireValidLocker(_spaceLocker);
    // TODO: it is possible to burn reputation of token A while providing a locker contract for a token B

    address owner = _spaceLocker.owner();

    uint256 newReputation = _spaceLocker.reputation();
    uint256 diff = mintedReputation[_spaceTokenId] - newReputation;
    require(diff > 0, "No reputation to burn");
    require(_amount <= diff, "Amount to burn is too big");

    require(_delegations[owner][_delegate] >= _amount, "Not enough delegated funds");
    require(_locks[_delegate][_multiSig] >= _amount, "Not enough locked funds");

    _delegations[owner][_delegate] -= _amount;
    _locks[_delegate][_multiSig] -= _amount;

    mintedReputation[_spaceTokenId] -= _amount;

    multiSigRegistry
      .getArbitratorVoting(_multiSig)
      .onDelegateReputationChanged(_delegate, _locks[_delegate][_multiSig]);
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

  // PermissionED
  function revokeLocked(address _delegate, address _multiSig, uint256 _amount) external {
    require(_delegations[msg.sender][_delegate] >= _amount, "Not enough funds");
    require(_locks[_delegate][_multiSig] >= _amount, "Not enough funds");

    _delegations[msg.sender][_delegate] -= _amount;
    _locks[_delegate][_multiSig] -= _amount;
    _delegations[msg.sender][msg.sender] += _amount;
    _balances[msg.sender] += _amount;

    multiSigRegistry
      .getArbitratorVoting(_multiSig)
      .onDelegateReputationChanged(_delegate, _locks[_delegate][_multiSig]);
  }

  // PermissionED
  function lockReputation(address _multiSig, uint256 _amount) external {
    require(_balances[msg.sender] >= _amount, "Insufficient amount to lock");

    _balances[msg.sender] -= _amount;
    _locks[msg.sender][_multiSig] += _amount;

    multiSigRegistry
      .getArbitratorVoting(_multiSig)
      .onDelegateReputationChanged(msg.sender, _locks[msg.sender][_multiSig]);
  }

  // PermissionED
  function unlockReputation(address _multiSig, uint256 _amount) external {
    uint256 beforeUnlock = _locks[msg.sender][_multiSig];
    uint256 afterUnlock = _locks[msg.sender][_multiSig] - _amount;

    require(beforeUnlock >= _amount, "Insufficient amount to lock");
    require(afterUnlock >= 0, "Insufficient amount to lock");
    require(afterUnlock < _locks[msg.sender][_multiSig], "Insufficient amount to lock");

    _locks[msg.sender][_multiSig] -= _amount;
    _balances[msg.sender] += _amount;

    multiSigRegistry
      .getArbitratorVoting(_multiSig)
      .onDelegateReputationChanged(msg.sender, afterUnlock);
  }

  // GETTERS

  function lockedBalanceOf(address _owner, address _multiSig) public view returns (uint256) {
    return _locks[_owner][_multiSig];
  }

  // ERC20 compatible
  function balanceOf(address owner) public view returns (uint256) {
    return _balances[owner];
  }

  // ERC20 compatible
  function totalSupply() public returns (uint256) {
    return totalStakedSpace;
  }
}
