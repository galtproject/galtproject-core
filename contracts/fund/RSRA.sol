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
import "./FundStorage.sol";
import "./proposals/IProposalManager.sol";


contract RSRA is LiquidReputationAccounting {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  event LockedBalanceChanged(address delegate, uint256 balanceAfter);

  FundStorage fundStorage;

  // Delegate => locked amount
  mapping(address => uint256) private _locks;

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

  // PermissionED
  function revokeLocked(address _delegate, uint256 _amount) external {
    require(_delegations[msg.sender][_delegate] >= _amount, "Not enough funds");
    require(_locks[_delegate] >= _amount, "Not enough funds");

    _delegations[msg.sender][_delegate] -= _amount;
    _locks[_delegate] -= _amount;
    _delegations[msg.sender][msg.sender] += _amount;
    _balances[msg.sender] += _amount;

    _notifyLockedBalanceChanged(_delegate);
  }

  // PermissionED
  function lockReputation(uint256 _amount) external {
    require(_balances[msg.sender] >= _amount, "Insufficient amount to lock");

    _balances[msg.sender] -= _amount;
    _locks[msg.sender] += _amount;

    _notifyLockedBalanceChanged(msg.sender);
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

    _notifyLockedBalanceChanged(msg.sender);
  }

  function _notifyLockedBalanceChanged(address _delegate) internal {
    uint256 newBalance = _locks[_delegate];

    address[] memory contractsToNotify = fundStorage.getWhiteListedContracts();

    for (uint256 i = 0; i < contractsToNotify.length; i++) {
      IProposalManager(contractsToNotify[i]).onLockChanged(_delegate, newBalance);
    }

    emit LockedBalanceChanged(_delegate, newBalance);
  }

  // GETTERS

  function lockedBalanceOf(address _owner) public view returns (uint256) {
    return _locks[_owner];
  }
}
