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
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../../registries/interfaces/IMultiSigRegistry.sol";
import "./LiquidRA.sol";

// LiquidRA - base class
// SpaceInputRA - space input
// GaltInputRA - galt input
// LockableRA - lockable output
// SharableRA - share calculation output

// GaltRA  = LiquidRA + (GaltInputRA  + LockableRA)
// SpaceRA = LiquidRA + (SpaceInputRA + LockableRA)
// FundRA  = LiquidRA + (SpaceInputRA + SharableRA)


contract LockableRA is LiquidRA {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  // Delegate => (MultiSig => locked amount)
  // WARNING: name collision with parent class
  mapping(address => mapping(address => uint256)) private _locks;
  mapping(address => uint256) _totalLocked;

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
    _revokeDelegated(_delegate, _amount);

    onDelegateReputationChanged(_multiSig, _delegate, _locks[_delegate][_multiSig]);
  }

  // PermissionED
  function lockReputation(address _multiSig, uint256 _amount) external {
    require((balanceOf(msg.sender) - _totalLocked[msg.sender]) >= _amount, "Insufficient amount to lock");

    _totalLocked[msg.sender] += _amount;
    _locks[msg.sender][_multiSig] += _amount;

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

    onDelegateReputationChanged(_multiSig, msg.sender, afterUnlock);
  }

  function arbitrationConfig(address _multiSig) internal returns (IArbitrationConfig) {
    return IMultiSigRegistry(ggr.getMultiSigRegistryAddress())
      .getArbitrationConfig(_multiSig);
  }

  // GETTERS
  function lockedBalanceOf(address _owner) public view returns (uint256) {
    return _totalLocked[_owner];
  }

  function lockedMultiSigBalanceOf(address _owner, address _multiSig) public view returns (uint256) {
    return _locks[_owner][_multiSig];
  }
}
