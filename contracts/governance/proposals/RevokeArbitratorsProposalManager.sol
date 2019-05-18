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
import "../GovernanceConfig.sol";
import "./AbstractArbitrationProposalManager.sol";
import "./interfaces/IProposalManager.sol";


contract RevokeArbitratorsProposalManager is IProposalManager, AbstractArbitrationProposalManager {
  struct Proposal {
    string description;
  }

  mapping(uint256 => Proposal) private _proposals;

  constructor(
    GovernanceConfig _governanceConfig
  )
    public
    AbstractArbitrationProposalManager(_governanceConfig)
  {
  }

  function propose(string calldata _description) external {
    idCounter.increment();
    uint256 id = idCounter.current();

    _proposals[id] = Proposal({
      description: _description
    });

    emit NewProposal(id, msg.sender);
    _onNewProposal(id);

    ProposalVoting storage proposalVoting = _proposalVotings[id];

    proposalVoting.status = ProposalStatus.ACTIVE;
  }

  function _execute(uint256 _proposalId) internal {
    governanceConfig.getMultiSig().revokeArbitrators();
  }

  function getThreshold() public view returns (uint256) {
    return governanceConfig.thresholds(governanceConfig.REVOKE_ARBITRATORS_THRESHOLD());
  }

  function getProposal(uint256 _id) external view returns (string memory description) {
    Proposal storage p = _proposals[_id];
    return (p.description);
  }
}
