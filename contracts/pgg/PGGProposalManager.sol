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
import "openzeppelin-solidity/contracts/drafts/Counters.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./PGGConfig.sol";


contract PGGProposalManager is IPGGProposalManager {
  using Counters for Counters.Counter;
  using ArraySet for ArraySet.AddressSet;
  using ArraySet for ArraySet.Uint256Set;

  uint256 public constant DECIMALS = 10**6;

  event NewProposal(uint256 proposalId, address indexed creator, address indexed destination, bytes32 marker);
  event Approve(uint256 ayeShare, uint256 threshold);
  event Reject(uint256 nayShare, uint256 threshold);

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

  struct Proposal {
    ProposalStatus status;
    address creator;
    address destination;
    uint256 value;
    bytes32 marker;
    bytes data;
    string description;
    bool executed;
    bytes response;
  }

  uint256 public defaultThreshold;

  Counters.Counter internal idCounter;

  uint256[] private _approvedProposals;
  uint256[] private _rejectedProposals;

  mapping(uint256 => Proposal) public proposals;
  mapping(uint256 => ProposalVoting) internal _proposalVotings;
  PGGConfig public pggConfig;

  // Cache
  ArraySet.Uint256Set private _activeProposals;
  mapping(address => ArraySet.Uint256Set) private _activeProposalsBySender;
  mapping(uint256 => address) private _proposalToSender;

  modifier onlyMember() {
    // TODO: define
    //    require(rsra.balanceOf(msg.sender) > 0, "Not valid member");

    _;
  }

  constructor(PGGConfig _pggConfig) public {
    pggConfig = _pggConfig;
    defaultThreshold = 100 * DECIMALS / 100;
  }

  function getMarker(address _destination, bytes memory _data) public pure returns(bytes32 marker) {
    bytes32 methodName;

    assembly {
      methodName := and(mload(add(_data, 0x20)), 0xffffffff00000000000000000000000000000000000000000000000000000000)
    }

    return keccak256(abi.encode(_destination, methodName));
  }

  function propose(
    address _destination,
    uint256 _value,
    bytes calldata _data,
    string calldata _description
  )
    external
    returns(uint256)
  {
    idCounter.increment();
    uint256 id = idCounter.current();

    Proposal storage p = proposals[id];

    p.creator = msg.sender;
    p.destination = _destination;
    p.value = _value;
    p.data = _data;
    p.description = _description;
    p.marker = getMarker(_destination, _data);

    _activeProposals.add(id);
    _activeProposalsBySender[msg.sender].add(id);
    _proposalToSender[id] = msg.sender;

    _proposalVotings[id].status = ProposalStatus.ACTIVE;

    emit NewProposal(id, msg.sender, _destination, p.marker);

    return id;
  }

  function aye(uint256 _proposalId) external onlyMember {
    require(_proposalVotings[_proposalId].status == ProposalStatus.ACTIVE, "Proposal isn't active");

    _aye(_proposalId, msg.sender);
  }

  function nay(uint256 _proposalId) external onlyMember {
    require(_proposalVotings[_proposalId].status == ProposalStatus.ACTIVE, "Proposal isn't active");

    _nay(_proposalId, msg.sender);
  }

  function triggerApprove(uint256 _proposalId) external {
    ProposalVoting storage proposalVoting = _proposalVotings[_proposalId];
    require(proposalVoting.status == ProposalStatus.ACTIVE, "Proposal isn't active");

    uint256 support = getAyeShare(_proposalId);
    assert(support <= DECIMALS);

    Proposal storage p = proposals[_proposalId];

    uint256 threshold = pggConfig.thresholds(p.marker);
    if (threshold > 0) {
      require(support >= threshold, "Threshold doesn't reached yet");
    } else {
      require(support >= defaultThreshold, "Threshold doesn't reached yet");
    }

    proposalVoting.status = ProposalStatus.APPROVED;

    _activeProposals.remove(_proposalId);
    _activeProposalsBySender[_proposalToSender[_proposalId]].remove(_proposalId);
    _approvedProposals.push(_proposalId);

    _execute(_proposalId);
  }

  function triggerReject(uint256 _proposalId) external {
    ProposalVoting storage proposalVoting = _proposalVotings[_proposalId];
    Proposal storage p = proposals[_proposalId];

    require(proposalVoting.status == ProposalStatus.ACTIVE, "Proposal isn't active");

    uint256 threshold = pggConfig.thresholds(p.marker);
    uint256 nayShare = getNayShare(_proposalId);
    assert(nayShare <= DECIMALS);

    if (threshold > 0) {
      require(nayShare >= threshold, "Threshold doesn't reached yet");
    } else {
      require(nayShare >= threshold, "Threshold doesn't reached yet");
    }

    proposalVoting.status = ProposalStatus.REJECTED;
    _activeProposals.remove(_proposalId);
    _activeProposalsBySender[_proposalToSender[_proposalId]].remove(_proposalId);
    _rejectedProposals.push(_proposalId);

    emit Reject(nayShare, threshold);
  }

  // INTERNAL

  function _execute(uint256 _proposalId) internal {
    Proposal storage p = proposals[_proposalId];

    require(p.executed == false, "Already executed");

    (bool x, bytes memory response) = address(p.destination)
      .call
      .value(p.value)
      .gas(gasleft() - 50000)(p.data);

    p.executed = x;
    p.response = response;
  }

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
    _activeProposalsBySender[msg.sender].add(_proposalId);
    _proposalToSender[_proposalId] = msg.sender;
  }

  // GETTERS
  function getThreshold(uint256 _proposalId) public view returns (uint256) {
    return pggConfig.thresholds(proposals[_proposalId].marker);
  }

  function getAyeShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    return pggConfig
      .getMultiSigCandidateTop()
      .getHolderWeights(_proposalVotings[_proposalId].ayes.elements());
  }

  function getNayShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    return pggConfig
      .getMultiSigCandidateTop()
      .getHolderWeights(_proposalVotings[_proposalId].nays.elements());
  }

  function getActiveProposals() public view returns (uint256[] memory) {
    return _activeProposals.elements();
  }

  function getActiveProposalsCount() public view returns (uint256) {
    return _activeProposals.size();
  }

  function getActiveProposalsBySender(address _sender) external view returns (uint256[] memory) {
    return _activeProposalsBySender[_sender].elements();
  }

  function getActiveProposalsBySenderCount(address _sender) external view returns (uint256) {
    return _activeProposalsBySender[_sender].size();
  }

  function getApprovedProposals() public view returns (uint256[] memory) {
    return _approvedProposals;
  }

  function getApprovedProposalsCount() public view returns (uint256) {
    return _approvedProposals.length;
  }

  function getRejectedProposals() public view returns (uint256[] memory) {
    return _rejectedProposals;
  }

  function getRejectedProposalsCount() public view returns (uint256) {
    return _rejectedProposals.length;
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

  function getProposalStatus(
    uint256 _proposalId
  )
    external
    view
    returns (
      ProposalStatus status,
      uint256 ayesCount,
      uint256 naysCount
    )
  {
    ProposalVoting storage p = _proposalVotings[_proposalId];

    return (p.status, p.ayes.size(), p.nays.size());
  }

  function getParticipantProposalChoice(uint256 _proposalId, address _participant) external view returns (Choice) {
    return _proposalVotings[_proposalId].participants[_participant];
  }
}
