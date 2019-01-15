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

pragma solidity ^0.4.24;

import "../../fund/proposals/ModifyConfigProposalManager.sol";
import "../../interfaces/IRSRA.sol";


contract MockModifyConfigProposalManager is ModifyConfigProposalManager {
  constructor(IRSRA _rsra, FundStorage _fundStorage) public ModifyConfigProposalManager(_rsra, _fundStorage) {
  }

  function ayeHack(uint256 _votingId, address _voter) external {
    _aye(_votingId, _voter);
  }

  function ayeAllHack(uint256 _votingId, address[] _voters) external {
    for (uint256 i = 0; i < _voters.length; i++) {
      _aye(_votingId, _voters[i]);
    }
  }
}
