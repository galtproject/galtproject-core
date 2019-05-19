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

pragma solidity 0.5.7;

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

  // Delegate => (PGG => locked amount)
  mapping(address => mapping(address => uint256)) private _locks;
  // Delegate => lockedAmount
  mapping(address => uint256) private _totalLocked;
  // PGG => lockedAmount
  mapping(address => uint256) private _pggLocks;

  function onDelegateReputationChanged(address _multiSig, address _delegate, uint256 _amount) internal;

  function revoke(address _from, uint256 _amount) public {
    require((delegatedBalanceOf(_from, msg.sender) - _totalLocked[_from]) >= _amount, "Insufficient amount to revoke");

    _debitAccount(_from, msg.sender, _amount);
    _creditAccount(msg.sender, msg.sender, _amount);
  }

  // PermissionED
  function revokeLocked(address _delegate, address _multiSig, uint256 _amount) external {
    require(_locks[_delegate][_multiSig] >= _amount, "Not enough funds");

    _totalLocked[_delegate] -= _amount;
    _locks[_delegate][_multiSig] -= _amount;
    _pggLocks[_multiSig] -= _amount;
    _revokeDelegated(_delegate, _amount);

    onDelegateReputationChanged(_multiSig, _delegate, _locks[_delegate][_multiSig]);
  }

  // PermissionED
  function lockReputation(address _multiSig, uint256 _amount) external {
    require((balanceOf(msg.sender) - _totalLocked[msg.sender]) >= _amount, "Insufficient amount to lock");

    _totalLocked[msg.sender] += _amount;
    _locks[msg.sender][_multiSig] += _amount;
    _pggLocks[_multiSig] += _amount;

    onDelegateReputationChanged(_multiSig, msg.sender, _locks[msg.sender][_multiSig]);
  }

  // PermissionED
  function unlockReputation(address _multiSig, uint256 _amount) external {
    uint256 beforeUnlock = _locks[msg.sender][_multiSig];
    uint256 afterUnlock = _locks[msg.sender][_multiSig] - _amount;

    require(beforeUnlock >= _amount, "Insufficient amount to lock");
    require(afterUnlock >= 0, "Insufficient amount to lock");
    require(afterUnlock < _locks[msg.sender][_multiSig], "Insufficient amount to lock");
    assert(_totalLocked[msg.sender] > _amount);

    _locks[msg.sender][_multiSig] -= _amount;
    _totalLocked[msg.sender] -= _amount;
    _pggLocks[_multiSig] -= _amount;

    onDelegateReputationChanged(_multiSig, msg.sender, afterUnlock);
  }

  function pggConfig(address _multiSig) internal returns (IPGGConfig) {
    return IPGGRegistry(ggr.getPggRegistryAddress())
      .getPggConfig(_multiSig);
  }

  // GETTERS
  function lockedBalanceOf(address _owner) public view returns (uint256) {
    return _totalLocked[_owner];
  }

  function lockedPggBalance(address _multiSig) public view returns (uint256) {
    return _pggLocks[_multiSig];
  }

  function lockedPggBalanceOf(address _owner, address _multiSig) public view returns (uint256) {
    return _locks[_owner][_multiSig];
  }

  function lockedPggBalances(address[] calldata _multiSigs) external view returns (uint256) {
    uint256 len = _multiSigs.length;
    uint256 total = 0;

    for (uint256 i = 0; i < len; i++) {
      total += _pggLocks[_multiSigs[i]];
    }

    return total;
  }
}
