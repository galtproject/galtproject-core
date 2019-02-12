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


contract AbstractProposalManager is Permissionable {
  using Counter for Counter.Counter;
  using ArraySet for ArraySet.AddressSet;
  using ArraySet for ArraySet.Uint256Set;

  event NewProposal(uint256 proposalId, address proposee);
  event Approved(uint256 ayeShare, uint256 threshold);
  event Rejected(uint256 nayShare, uint256 threshold);

  Counter.Counter idCounter;

  ArbitrationConfig arbitrationConfig;

  ArraySet.Uint256Set private _activeProposals;
  uint256[] private _approvedProposals;
  uint256[] private _rejectedProposals;

//  string public constant RSRA_CONTRACT = "rsra_contract";

  mapping(uint256 => ProposalVoting) internal _proposalVotings;

  enum ProposalStatus {
    NULL,
    ACTIVE,
    APPROVED,
    REJECTED
  }

  enum Choice {
    PENDING,
    AYE,
    NAY
  }

  struct ProposalVoting {
    ProposalStatus status;
    mapping(address => Choice) participants;
    ArraySet.AddressSet ayes;
    ArraySet.AddressSet nays;
  }

  constructor(ArbitrationConfig _arbitrationConfig) public {
    arbitrationConfig = _arbitrationConfig;
  }

  modifier onlyMember() {
    // TODO: define
//    require(rsra.balanceOf(msg.sender) > 0, "Not valid member");

    _;
  }

  // Should be implemented inside descendant
  function _execute(uint256 _proposalId) internal;
  function getThreshold() public view returns (uint256);

  function aye(uint256 _proposalId) external onlyMember {
    require(_proposalVotings[_proposalId].status == ProposalStatus.ACTIVE, "Proposal isn't active");

    _aye(_proposalId, msg.sender);
  }

  function nay(uint256 _proposalId) external onlyMember {
    require(_proposalVotings[_proposalId].status == ProposalStatus.ACTIVE, "Proposal isn't active");

    _nay(_proposalId, msg.sender);
  }

  // permissionLESS
  function triggerApprove(uint256 _proposalId) external {
    ProposalVoting storage proposalVoting = _proposalVotings[_proposalId];
    require(proposalVoting.status == ProposalStatus.ACTIVE, "Proposal isn't active");

    uint256 threshold = getThreshold();
    uint256 ayeShare = getAyeShare(_proposalId);

    require(ayeShare >= threshold, "Threshold doesn't reached yet");

    proposalVoting.status = ProposalStatus.APPROVED;

    _activeProposals.remove(_proposalId);
    _approvedProposals.push(_proposalId);

    _execute(_proposalId);

    emit Approved(ayeShare, threshold);
  }

  // permissionLESS
  function triggerReject(uint256 _proposalId) external {
    ProposalVoting storage proposalVoting = _proposalVotings[_proposalId];
    require(proposalVoting.status == ProposalStatus.ACTIVE, "Proposal isn't active");

    uint256 threshold = getThreshold();
    uint256 nayShare = getNayShare(_proposalId);

    require(nayShare >= threshold, "Threshold doesn't reached yet");

    proposalVoting.status = ProposalStatus.REJECTED;
    _activeProposals.remove(_proposalId);
    _rejectedProposals.push(_proposalId);

    emit Rejected(nayShare, threshold);
  }

  // INTERNAL
  function _aye(uint256 _proposalId, address _voter) internal {
    if (_proposalVotings[_proposalId].participants[_voter] == Choice.NAY) {
      _proposalVotings[_proposalId].nays.remove(_voter);
    }

    _proposalVotings[_proposalId].participants[_voter] = Choice.AYE;
    _proposalVotings[_proposalId].ayes.add(_voter);
  }

  function _nay(uint256 _proposalId, address _voter) internal {
    if (_proposalVotings[_proposalId].participants[_voter] == Choice.AYE) {
      _proposalVotings[_proposalId].ayes.remove(_voter);
    }

    _proposalVotings[_proposalId].participants[msg.sender] = Choice.NAY;
    _proposalVotings[_proposalId].nays.add(msg.sender);
  }

  function _onNewProposal(uint256 _proposalId) internal {
    _activeProposals.add(_proposalId);
  }

  // GETTERS

  function getAyeShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    return arbitrationConfig
      .getArbitratorVoting()
      .getShare(_proposalVotings[_proposalId].ayes.elements());
  }

  function getNayShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    return arbitrationConfig
      .getArbitratorVoting()
      .getShare(_proposalVotings[_proposalId].nays.elements());
  }

  function getActiveProposals() public view returns (uint256[] memory) {
    return _activeProposals.elements();
  }

  function getApprovedProposals() public view returns (uint256[] memory) {
    return _approvedProposals;
  }

  function getRejectedProposals() public view returns (uint256[] memory) {
    return _rejectedProposals;
  }

  function getProposalVoting(
    uint256 _proposalId
  )
    external
    view
    returns (
      ProposalStatus status,
      address[] memory ayes,
      address[] memory nays
    )
  {
    ProposalVoting storage p = _proposalVotings[_proposalId];

    return (p.status, p.ayes.elements(), p.nays.elements());
  }
}
