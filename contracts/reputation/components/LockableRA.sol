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

pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../../registries/interfaces/IPGGRegistry.sol";
import "../interfaces/ILockableRA.sol";
import "./LiquidRA.sol";

// LiquidRA - base class
// SpaceInputRA - space input
// GaltInputRA - galt input
// LockableRA - lockable output
// SharableRA - share calculation output

// GaltRA  = LiquidRA + (GaltInputRA  + LockableRA)
// SpaceRA = LiquidRA + (SpaceInputRA + LockableRA)
// FundRA  = LiquidRA + (SpaceInputRA + SharableRA)


contract LockableRA is ILockableRA, LiquidRA {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  event Revoke(address indexed delegate, address indexed owner, uint256 amount);
  event RevokeLocked(address indexed delegate, address indexed owner, address indexed pgg, uint256 amount);
  event LockReputation(address indexed delegate, address indexed pgg, uint256 amount);
  event UnlockReputation(address indexed delegate, address indexed pgg, uint256 amount);

  // Delegate => (PGG => locked amount)
  mapping(address => mapping(address => uint256)) internal _locks;
  // Delegate => lockedAmount
  mapping(address => uint256) internal _totalLocked;
  // PGG => lockedAmount
  mapping(address => uint256) internal _pggLocks;

  function onDelegateReputationChanged(address _pgg, address _delegate, uint256 _amount) internal;

  function revoke(address _from, uint256 _amount) public {
    require((delegatedBalanceOf(_from, msg.sender) - _totalLocked[_from]) >= _amount, "Insufficient amount to revoke");

    _debitAccount(_from, msg.sender, _amount);
    _creditAccount(msg.sender, msg.sender, _amount);

    emit Revoke(_from, msg.sender, _amount);
  }

  // PermissionED
  function revokeLocked(address _delegate, address _pgg, uint256 _amount) external {
    require(_locks[_delegate][_pgg] >= _amount, "Not enough funds");

    // _totalLocked[_delegate] -= _amount;
    _totalLocked[_delegate] = _totalLocked[_delegate].sub(_amount);
    // _locks[_delegate][_pgg] -= _amount;
    _locks[_delegate][_pgg] = _locks[_delegate][_pgg].sub(_amount);
    // _pggLocks[_pgg] -= _amount;
    _pggLocks[_pgg] = _pggLocks[_pgg].sub(_amount);

    _revokeDelegated(_delegate, _amount);

    onDelegateReputationChanged(_pgg, _delegate, _locks[_delegate][_pgg]);

    emit RevokeLocked(_delegate, msg.sender, _pgg, _amount);
  }

  // PermissionED
  function lockReputation(address _pgg, uint256 _amount) external {
    require((balanceOf(msg.sender) - _totalLocked[msg.sender]) >= _amount, "Insufficient amount to lock");

    // _totalLocked[msg.sender] += _amount;
    _totalLocked[msg.sender] = _totalLocked[msg.sender].add(_amount);
    // _locks[msg.sender][_pgg] += _amount;
    _locks[msg.sender][_pgg] = _locks[msg.sender][_pgg].add(_amount);
    // _pggLocks[_pgg] += _amount;
    _pggLocks[_pgg] = _pggLocks[_pgg].add(_amount);

    onDelegateReputationChanged(_pgg, msg.sender, _locks[msg.sender][_pgg]);

    emit LockReputation(msg.sender, _pgg, _amount);
  }

  // PermissionED
  function unlockReputation(address _pgg, uint256 _amount) external {
    uint256 beforeUnlock = _locks[msg.sender][_pgg];
    uint256 afterUnlock = _locks[msg.sender][_pgg] - _amount;

    require(beforeUnlock >= _amount, "Insufficient amount to lock");
    require(afterUnlock >= 0, "Insufficient amount to lock");
    require(afterUnlock < _locks[msg.sender][_pgg], "Insufficient amount to lock");
    assert(_totalLocked[msg.sender] > _amount);

    // _locks[msg.sender][_pgg] -= _amount;
    _locks[msg.sender][_pgg] = _locks[msg.sender][_pgg].sub(_amount);
    // _totalLocked[msg.sender] -= _amount;
    _totalLocked[msg.sender] = _totalLocked[msg.sender].sub(_amount);
    // _pggLocks[_pgg] -= _amount;
    _pggLocks[_pgg] = _pggLocks[_pgg].sub(_amount);

    onDelegateReputationChanged(_pgg, msg.sender, afterUnlock);

    emit UnlockReputation(msg.sender, _pgg, _amount);
  }

  function pggConfig(address _pgg) internal returns (IPGGConfig) {
    return IPGGRegistry(ggr.getPggRegistryAddress())
      .getPggConfig(_pgg);
  }

  // GETTERS
  function lockedBalanceOf(address _owner) public view returns (uint256) {
    return _totalLocked[_owner];
  }

  function lockedPggBalance(address _pgg) public view returns (uint256) {
    return _pggLocks[_pgg];
  }

  function lockedPggBalanceOf(address _owner, address _pgg) public view returns (uint256) {
    return _locks[_owner][_pgg];
  }

  function lockedPggBalances(address[] calldata _pggs) external view returns (uint256) {
    uint256 len = _pggs.length;
    uint256 total = 0;

    for (uint256 i = 0; i < len; i++) {
      // total += _pggLocks[_pggs[i]];
      total = total.add(_pggLocks[_pggs[i]]);
    }

    return total;
  }
}
