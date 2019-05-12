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
import "../ArbitrationConfig.sol";
import "./AbstractArbitrationProposalManager.sol";
import "./interfaces/IProposalManager.sol";


contract ModifyApplicationConfigProposalManager is IProposalManager, AbstractArbitrationProposalManager {
  struct Proposal {
    bytes32 key;
    bytes32 value;
    string description;
  }

  mapping(uint256 => Proposal) private _proposals;

  constructor(
    ArbitrationConfig _arbitrationConfig
  )
    public
    AbstractArbitrationProposalManager(_arbitrationConfig)
  {
  }

  function propose(bytes32 _key, bytes32 _value, string calldata _description) external {
    idCounter.increment();
    uint256 id = idCounter.current();

    _proposals[id] = Proposal({
      key: _key,
      value: _value,
      description: _description
    });

    emit NewProposal(id, msg.sender);
    _onNewProposal(id);

    ProposalVoting storage proposalVoting = _proposalVotings[id];

    proposalVoting.status = ProposalStatus.ACTIVE;
  }

  function _execute(uint256 _proposalId) internal {
    Proposal storage p = _proposals[_proposalId];

    arbitrationConfig.setApplicationConfigValue(
      p.key,
      p.value
    );
  }

  function getThreshold() public view returns (uint256) {
    return arbitrationConfig.thresholds(arbitrationConfig.APPLICATION_CONFIG_THRESHOLD());
  }

  function getProposal(uint256 _id) external view returns (bytes32 key, bytes32 value, string memory description) {
    Proposal storage p = _proposals[_id];
    return (p.key, p.value, p.description);
  }
}
