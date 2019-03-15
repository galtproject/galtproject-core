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
import "./multisig/ArbitratorVoting.sol";
import "./registries/interfaces/ISpaceLockerRegistry.sol";
import "./registries/interfaces/IMultiSigRegistry.sol";
import "./registries/GaltGlobalRegistry.sol";
import "./LiquidReputationAccounting.sol";


// TODO: rename to ASRA
contract SpaceReputationAccounting is LiquidReputationAccounting {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  GaltGlobalRegistry _ggr;

  // Delegate => (MultiSig => locked amount)
  mapping(address => mapping(address => uint256)) private _locks;
  mapping(address => uint256) _totalLocked;

  // L0
  uint256 private totalStakedSpace;

  constructor(
    GaltGlobalRegistry _ggr
  )
    public
    LiquidReputationAccounting(_ggr)
  {
  }

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

    arbitratorVoting(_multiSig)
      .onDelegateReputationChanged(_delegate, _locks[_delegate][_multiSig]);
  }

  // PermissionED
  function lockReputation(address _multiSig, uint256 _amount) external {
    require((balanceOf(msg.sender) - _totalLocked[msg.sender]) >= _amount, "Insufficient amount to lock");

    _totalLocked[msg.sender] += _amount;
    _locks[msg.sender][_multiSig] += _amount;

    arbitratorVoting(_multiSig)
      .onDelegateReputationChanged(msg.sender, _locks[msg.sender][_multiSig]);
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

    arbitratorVoting(_multiSig)
      .onDelegateReputationChanged(msg.sender, afterUnlock);
  }

  function arbitratorVoting(address _multiSig) internal returns (IArbitratorVoting) {
    return IMultiSigRegistry(ggr.getMultiSigRegistryAddress())
      .getArbitrationConfig(_multiSig)
      .getArbitratorVoting();
  }

  // GETTERS
  function lockedBalanceOf(address _owner) public view returns (uint256) {
    return _totalLocked[_owner];
  }

  function lockedMultiSigBalanceOf(address _owner, address _multiSig) public view returns (uint256) {
    return _locks[_owner][_multiSig];
  }
}
