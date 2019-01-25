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
import "./registries/MultiSigRegistry.sol";
import "./registries/interfaces/ISpaceLockerRegistry.sol";
import "./LiquidReputationAccounting.sol";


// TODO: rename to ASRA
contract SpaceReputationAccounting is LiquidReputationAccounting {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  MultiSigRegistry multiSigRegistry;

  // Delegate => (MultiSig => locked amount)
  mapping(address => mapping(address => uint256)) private _locks;

  // L0
  uint256 private totalStakedSpace;

  constructor(
    IERC721 _spaceToken,
    MultiSigRegistry _multiSigRegistry,
    ISpaceLockerRegistry _spaceLockerRegistry
  )
    public
    LiquidReputationAccounting(_spaceToken, _spaceLockerRegistry)
  {
    multiSigRegistry = _multiSigRegistry;
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
}
