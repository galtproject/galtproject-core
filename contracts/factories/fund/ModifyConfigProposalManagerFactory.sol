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

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

// This contract will be included into the current one
import "../../fund/proposals/ModifyConfigProposalManager.sol";
import "../../fund/FundStorage.sol";
import "../../interfaces/IRSRA.sol";


contract ModifyConfigProposalManagerFactory is Ownable {
  function build(IRSRA _rsra, FundStorage _fundStorage)
    external
    returns (ModifyConfigProposalManager)
  {
    ModifyConfigProposalManager modifyConfigProposalManager = new ModifyConfigProposalManager(_rsra, _fundStorage);

    modifyConfigProposalManager.addRoleTo(msg.sender, "role_manager");
    modifyConfigProposalManager.removeRoleFrom(address(this), "role_manager");

    return modifyConfigProposalManager;
  }
}