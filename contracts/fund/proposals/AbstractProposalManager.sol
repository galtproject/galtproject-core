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
import "../../collections/ArraySet.sol";
import "../../LiquidReputationAccounting.sol";
import "../../traits/Permissionable.sol";
import "../FundStorage.sol";
import "./IProposalManager.sol";


contract AbstractProposalManager is IProposalManager, Permissionable {
  // TODO: receive balance changed callback
  // TODO: make proposal
  // TODO: vote for proposal

  FundStorage fundStorage;

  string public constant RSRA_CONTRACT = "rsra_contract";

  mapping(address => uint256) internal balances;

  function onLockChanged(
    address _delegate,
    uint256 _newLockedBalance
  )
    external
    onlyRole(RSRA_CONTRACT)
  {
    balances[_delegate] = _newLockedBalance;

    // TODO: perform some logic in case when delegate participating in some proposal
    // TODO: there could be many proposals at a time, so it's not possible to change percent of delegate there
  }
}
