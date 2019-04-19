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
import "openzeppelin-solidity/contracts/drafts/Counter.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "../ArbitrationConfig.sol";
import "./AbstractProposalManager.sol";


contract AbstractArbitrationProposalManager is AbstractProposalManager {
  ArbitrationConfig public arbitrationConfig;

  constructor(ArbitrationConfig _arbitrationConfig) public {
    arbitrationConfig = _arbitrationConfig;
  }

  // GETTERS

  function getAyeShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    return arbitrationConfig
      .getArbitrationCandidateTop()
      .getHolderWeights(_proposalVotings[_proposalId].ayes.elements());
  }

  function getNayShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    return arbitrationConfig
      .getArbitrationCandidateTop()
      .getHolderWeights(_proposalVotings[_proposalId].nays.elements());
  }
}
