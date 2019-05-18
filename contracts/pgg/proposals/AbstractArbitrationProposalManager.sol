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

import "../PGGConfig.sol";
import "./AbstractProposalManager.sol";


contract AbstractArbitrationProposalManager is AbstractProposalManager {
  PGGConfig public governanceConfig;

  constructor(PGGConfig _governanceConfig) public {
    governanceConfig = _governanceConfig;
  }

  // GETTERS

  function getAyeShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    return governanceConfig
      .getArbitrationCandidateTop()
      .getHolderWeights(_proposalVotings[_proposalId].ayes.elements());
  }

  function getNayShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    return governanceConfig
      .getArbitrationCandidateTop()
      .getHolderWeights(_proposalVotings[_proposalId].nays.elements());
  }
}
