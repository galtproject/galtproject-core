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
import "./interfaces/IProposalManager.sol";


contract ModifyThresholdProposalManager is IProposalManager, AbstractProposalManager {
  using Counter for Counter.Counter;
  using ArraySet for ArraySet.AddressSet;
  using ArraySet for ArraySet.Uint256Set;

  event NewProposal(uint256 proposalId, address proposee);
  event Approved(uint256 ayeShare, uint256 threshold);
  event Rejected(uint256 nayShare, uint256 threshold);

  struct Proposal {
    bytes32 key;
    uint256 value;
    string description;
  }

  mapping(uint256 => Proposal) private _proposals;

  constructor(
    ArbitrationConfig _arbitrationConfig
  )
    public
    AbstractProposalManager(_arbitrationConfig)
  {
  }

  function propose(bytes32 _key, uint256 _value, string calldata _description) external {
    uint256 id = idCounter.next();

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

  // Should be implemented inside descendant
  function _execute(uint256 _proposalId) internal {
    Proposal storage p = _proposals[_proposalId];

    arbitrationConfig.setThreshold(
      p.key,
      p.value
    );
  }

  function getThreshold() public view returns (uint256) {
    return arbitrationConfig.thresholds(arbitrationConfig.SET_THRESHOLD_THRESHOLD());
  }
}
