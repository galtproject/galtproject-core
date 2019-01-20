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
import "../collections/ArraySet.sol";
import "../LiquidReputationAccounting.sol";
import "../interfaces/IRSRA.sol";
import "./FundStorage.sol";
import "./proposals/IProposalManager.sol";


contract RSRA is LiquidReputationAccounting, IRSRA {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  event LockedBalanceChanged(address delegate, uint256 balanceAfter);

  FundStorage fundStorage;

  uint256 _totalLockedSupply;

  // Delegate => locked amount
  mapping(address => uint256) internal _locks;

  mapping(uint256 => bool) internal _tokensToExpel;

  constructor(
    SpaceToken _spaceToken,
    SpaceLockerRegistry _spaceLockerRegistry,
    FundStorage _fundStorage
  )
    public
    LiquidReputationAccounting(_spaceToken, _spaceLockerRegistry)
  {
    fundStorage = _fundStorage;
  }

  function mint(
    SpaceLocker _spaceLocker
  )
    public
  {
    uint256 spaceTokenId = _spaceLocker.spaceTokenId();
    require(fundStorage.isMintApproved(spaceTokenId), "No mint permissions");
    super.mint(_spaceLocker);
  }

  function approveBurn(
    SpaceLocker _spaceLocker
  )
    public
  {
    require(fundStorage.getFineAmount(_spaceLocker.spaceTokenId()) == 0, "There are pending fines");
    super.approveBurn(_spaceLocker);
  }

  // PermissionED
  function revokeLocked(address _delegate, uint256 _amount) external {
    require(_delegations[msg.sender][_delegate] >= _amount, "Not enough funds");
    require(_locks[_delegate] >= _amount, "Not enough funds");

    _delegations[msg.sender][_delegate] -= _amount;
    _locks[_delegate] -= _amount;
    _delegations[msg.sender][msg.sender] += _amount;
    _balances[msg.sender] += _amount;
    _totalLockedSupply -= _amount;
  }

  function burnExpelled(uint256 _spaceTokenId, address _delegate, address _owner, uint256 _amount) external {
    require(_delegations[_owner][_delegate] >= _amount, "Not enough funds");
    require(_balances[_delegate] >= _amount, "Not enough funds");

    bool completelyBurned = fundStorage.decrementExpelledTokenReputation(_spaceTokenId, _amount);

    _delegations[_owner][_delegate] -= _amount;
    _balances[_delegate] -= _amount;
    totalStakedSpace -= _amount;

    if (completelyBurned) {
      reputationMinted[_spaceTokenId] = false;
    }
  }

  function burnExpelledAndLocked(uint256 _spaceTokenId, address _delegate, address _owner, uint256 _amount) external {
    require(_delegations[_owner][_delegate] >= _amount, "Not enough funds");
    require(_locks[_delegate] >= _amount, "Not enough funds");

    bool completelyBurned = fundStorage.decrementExpelledTokenReputation(_spaceTokenId, _amount);

    _delegations[_owner][_delegate] -= _amount;
    _locks[_delegate] -= _amount;
    _totalLockedSupply -= _amount;
    totalStakedSpace -= _amount;

    if (completelyBurned) {
      reputationMinted[_spaceTokenId] = false;
    }
  }

  // PermissionED
  function lockReputation(uint256 _amount) external {
    require(_balances[msg.sender] >= _amount, "Insufficient amount to lock");

    _lockReputation(msg.sender, _amount);
  }

  // PermissionED
  function unlockReputation(uint256 _amount) external {
    uint256 beforeUnlock = _locks[msg.sender];
    uint256 afterUnlock = _locks[msg.sender] - _amount;

    require(beforeUnlock >= _amount, "Insufficient amount to lock");
    require(afterUnlock >= 0, "Insufficient amount to lock");
    require(afterUnlock < _locks[msg.sender], "Insufficient amount to lock");

    _locks[msg.sender] -= _amount;
    _balances[msg.sender] += _amount;
    _totalLockedSupply -= _amount;
  }

  // INTERNAL

  function _lockReputation(address _locker, uint256 _amount) internal {

    _balances[_locker] -= _amount;
    _locks[_locker] += _amount;
    _totalLockedSupply += _amount;
  }

  // GETTERS

  function getShare(address[] _addresses) external view returns (uint256) {
    uint256 aggregator = 0;

    for (uint256 i = 0; i < _addresses.length; i++) {
      aggregator += _locks[_addresses[i]];
    }

    return aggregator * 100 / _totalLockedSupply;
  }

  function lockedBalanceOf(address _owner) external view returns (uint256) {
    return _locks[_owner];
  }

  function totalLockedSupply() external view returns (uint256) {
    return _totalLockedSupply;
  }
}
