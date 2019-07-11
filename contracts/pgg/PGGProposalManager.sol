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

pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/drafts/Counters.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./PGGConfig.sol";


contract PGGProposalManager is IPGGProposalManager {
  using SafeMath for uint256;
  using Counters for Counters.Counter;
  using ArraySet for ArraySet.AddressSet;
  using ArraySet for ArraySet.Uint256Set;

  uint256 public constant DECIMALS = 10**6;
  uint256 public constant SPACE_REPUTATION_SHARE = 40;
  uint256 public constant GALT_REPUTATION_SHARE = 30;
  uint256 public constant STAKE_REPUTATION_SHARE = 30;

  event NewProposal(uint256 proposalId, address indexed creator, address indexed destination, bytes32 marker);
  event Approve(uint256 ayeShare, uint256 threshold);
  event Reject(uint256 nayShare, uint256 threshold);

  enum ProposalStatus {
    NULL,
    ACTIVE,
    APPROVED,
    EXECUTED,
    REJECTED
  }

  enum Choice {
    PENDING,
    AYE,
    NAY
  }

  struct ProposalVoting {
    uint256 creationBlock;
    uint256 creationTotalSpaceSupply;
    uint256 creationTotalGaltSupply;
    uint256 creationTotalStakeSupply;
    mapping(address => Choice) participants;
    ChoiceAccounting aye;
    ChoiceAccounting nay;
  }

  struct ChoiceAccounting {
    uint256 totalSpace;
    uint256 totalGalt;
    uint256 totalStake;
    ArraySet.AddressSet voters;
  }

  struct Proposal {
    ProposalStatus status;
    address creator;
    address destination;
    uint256 value;
    bytes32 marker;
    bytes data;
    string description;
    bytes response;
  }

  Counters.Counter internal idCounter;

  uint256[] private _approvedProposals;
  uint256[] private _rejectedProposals;

  mapping(uint256 => Proposal) public proposals;
  mapping(uint256 => ProposalVoting) internal _proposalVotings;
  PGGConfig internal pggConfig;

  // Cache
  ArraySet.Uint256Set private _activeProposals;
  mapping(address => ArraySet.Uint256Set) private _activeProposalsBySender;
  mapping(uint256 => address) private _proposalToSender;

  modifier onlyMember() {
    uint256 blockNumber = block.number - 1;
    address member = msg.sender;

    bool hasSpace = pggConfig.getDelegateSpaceVoting().balanceOfDelegate(member) > 0;
    bool hasGalt = pggConfig.getDelegateGaltVoting().balanceOfDelegate(member) > 0;
    bool hasStake = pggConfig.getOracleStakes().balanceOf(member) > 0;

    require(hasSpace || hasGalt || hasStake, "Not a valid member");

    _;
  }

  constructor(PGGConfig _pggConfig) public {
    pggConfig = _pggConfig;
  }

  function propose(
    address _destination,
    uint256 _value,
    bytes calldata _data,
    string calldata _description
  )
    external
    onlyMember
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
    p.marker = pggConfig.getThresholdMarker(_destination, _data);

    _activeProposals.add(id);
    _activeProposalsBySender[msg.sender].add(id);
    _proposalToSender[id] = msg.sender;

    proposals[id].status = ProposalStatus.ACTIVE;

    _cacheTotalSupplyValues(id);

    emit NewProposal(id, msg.sender, _destination, p.marker);

    return id;
  }

  function _cacheTotalSupplyValues(uint256 _id) internal {
    ProposalVoting storage pV = _proposalVotings[_id];

    uint256 blockNumber = block.number.sub(1);

    uint256 totalSpaceSupply = pggConfig.getDelegateSpaceVoting().totalDelegateSupplyAt(blockNumber);
    uint256 totalGaltSupply = pggConfig.getDelegateGaltVoting().totalDelegateSupplyAt(blockNumber);
    uint256 totalStakeSupply = pggConfig.getOracleStakes().totalSupplyAt(blockNumber);

    require((totalSpaceSupply + totalGaltSupply + totalStakeSupply) > 0, "Total reputation is 0");

    pV.creationBlock = blockNumber;
    pV.creationTotalSpaceSupply = totalSpaceSupply;
    pV.creationTotalGaltSupply = totalGaltSupply;
    pV.creationTotalStakeSupply = totalStakeSupply;
  }

  function aye(uint256 _proposalId) external {
    require(proposals[_proposalId].status == ProposalStatus.ACTIVE, "Proposal isn't active");

    _aye(_proposalId, msg.sender);
  }

  function nay(uint256 _proposalId) external {
    require(proposals[_proposalId].status == ProposalStatus.ACTIVE, "Proposal isn't active");

    _nay(_proposalId, msg.sender);
  }

  function triggerApprove(uint256 _proposalId) external {
    Proposal storage p = proposals[_proposalId];
    require(p.status == ProposalStatus.ACTIVE, "Proposal isn't active");

    uint256 support = getAyeShare(_proposalId);
    assert(support <= DECIMALS);

    uint256 threshold = pggConfig.thresholds(p.marker);
    if (threshold > 0) {
      require(support >= threshold, "Custom threshold doesn't reached yet");
    } else {
      require(support >= pggConfig.defaultProposalThreshold(), "Default threshold doesn't reached yet");
    }

    p.status = ProposalStatus.APPROVED;

    _activeProposals.remove(_proposalId);
    _activeProposalsBySender[_proposalToSender[_proposalId]].remove(_proposalId);
    _approvedProposals.push(_proposalId);

    emit Approve(support, threshold);

    execute(_proposalId);
  }

  function triggerReject(uint256 _proposalId) external {
    Proposal storage p = proposals[_proposalId];

    require(p.status == ProposalStatus.ACTIVE, "Proposal isn't active");

    uint256 threshold = pggConfig.thresholds(p.marker);
    uint256 nayShare = getNayShare(_proposalId);
    assert(nayShare <= DECIMALS);

    if (threshold > 0) {
      require(nayShare >= threshold, "Threshold doesn't reached yet");
    } else {
      require(nayShare >= pggConfig.defaultProposalThreshold(), "Threshold doesn't reached yet");
    }

    p.status = ProposalStatus.REJECTED;

    _activeProposals.remove(_proposalId);
    _activeProposalsBySender[_proposalToSender[_proposalId]].remove(_proposalId);
    _rejectedProposals.push(_proposalId);

    emit Reject(nayShare, threshold);
  }

  function execute(uint256 _proposalId) public {
    Proposal storage p = proposals[_proposalId];

    require(p.status == ProposalStatus.APPROVED, "Proposal isn't APPROVED");

    p.status = ProposalStatus.EXECUTED;

    (bool ok, bytes memory response) = address(p.destination)
      .call
      .value(p.value)
      .gas(gasleft() - 50000)(p.data);

    if (ok == false) {
      p.status = ProposalStatus.APPROVED;
    }

    p.response = response;
  }

  // INTERNAL

  function _aye(uint256 _proposalId, address _voter) internal {
    ProposalVoting storage pV = _proposalVotings[_proposalId];
    uint256 blockNumber = pV.creationBlock;

    uint256 spaceBalance = pggConfig.getDelegateSpaceVoting().balanceOfDelegateAt(_voter, blockNumber);
    uint256 galtBalance = pggConfig.getDelegateGaltVoting().balanceOfDelegateAt(_voter, blockNumber);
    uint256 stakeBalance = pggConfig.getOracleStakes().balanceOfAt(_voter, blockNumber);

    if (pV.participants[_voter] == Choice.NAY) {
      pV.nay.totalSpace = pV.nay.totalSpace.sub(spaceBalance);
      pV.nay.totalGalt = pV.nay.totalGalt.sub(galtBalance);
      pV.nay.totalStake = pV.nay.totalStake.sub(stakeBalance);
      pV.nay.voters.remove(_voter);
    }

    pV.aye.totalSpace = pV.aye.totalSpace.add(spaceBalance);
    pV.aye.totalGalt = pV.aye.totalGalt.add(galtBalance);
    pV.aye.totalStake = pV.aye.totalStake.add(stakeBalance);
    pV.aye.voters.add(_voter);

    pV.participants[_voter] = Choice.AYE;
  }

  function _nay(uint256 _proposalId, address _voter) internal {
    ProposalVoting storage pV = _proposalVotings[_proposalId];
    uint256 blockNumber = pV.creationBlock;

    uint256 spaceBalance = pggConfig.getDelegateSpaceVoting().balanceOfDelegateAt(_voter, blockNumber);
    uint256 galtBalance = pggConfig.getDelegateGaltVoting().balanceOfDelegateAt(_voter, blockNumber);
    uint256 stakeBalance = pggConfig.getOracleStakes().balanceOfAt(_voter, blockNumber);

    if (pV.participants[_voter] == Choice.AYE) {
      pV.aye.totalSpace = pV.aye.totalSpace.sub(spaceBalance);
      pV.aye.totalGalt = pV.aye.totalGalt.sub(galtBalance);
      pV.aye.totalStake = pV.aye.totalStake.sub(stakeBalance);
      pV.aye.voters.remove(_voter);
    }

    pV.nay.totalSpace = pV.nay.totalSpace.add(spaceBalance);
    pV.nay.totalGalt = pV.nay.totalGalt.add(galtBalance);
    pV.nay.totalStake = pV.nay.totalStake.add(stakeBalance);
    pV.nay.voters.add(_voter);

    pV.participants[_voter] = Choice.NAY;
  }

  function _onNewProposal(uint256 _proposalId) internal {
    _activeProposals.add(_proposalId);
    _activeProposalsBySender[msg.sender].add(_proposalId);
    _proposalToSender[_proposalId] = msg.sender;
  }

  // GETTERS
  function getThreshold(uint256 _proposalId) external view returns (uint256) {
    uint256 custom = pggConfig.thresholds(proposals[_proposalId].marker);

    if (custom > 0) {
      return custom;
    } else {
      return pggConfig.defaultProposalThreshold();
    }
  }

  function getAyeShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    ProposalVoting storage pV = _proposalVotings[_proposalId];

    return getShare(pV, pV.aye);
  }

  function getNayShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    ProposalVoting storage pV = _proposalVotings[_proposalId];

    return getShare(pV, pV.nay);
  }

  function getShare(ProposalVoting storage pV, ChoiceAccounting storage cA) internal view returns (uint256) {
    uint256 spaceShare = 0;
    uint256 glatShare = 0;
    uint256 stakeShare = 0;

    if (cA.totalSpace > 0) {
      spaceShare = cA.totalSpace * DECIMALS * SPACE_REPUTATION_SHARE / pV.creationTotalSpaceSupply;
    }

    if (cA.totalGalt > 0) {
      glatShare = cA.totalGalt * DECIMALS * GALT_REPUTATION_SHARE / pV.creationTotalGaltSupply;
    }

    if (cA.totalStake > 0) {
      stakeShare = cA.totalStake * DECIMALS * STAKE_REPUTATION_SHARE / pV.creationTotalStakeSupply;
    }

    return (spaceShare + glatShare + stakeShare) / 100;
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

  function getProposalResponseAsErrorString(uint256 _proposalId) public view returns (string memory) {
    return string(proposals[_proposalId].response);
  }

  function getProposalVoting(
    uint256 _proposalId
  )
    external
    view
    returns (
      uint256 creationBlock,
      uint256 creationTotalSpaceSupply,
      uint256 creationTotalGaltSupply,
      uint256 creationTotalStakeSupply
    )
  {
    ProposalVoting storage pV = _proposalVotings[_proposalId];

    return (
      pV.creationBlock,
      pV.creationTotalSpaceSupply,
      pV.creationTotalGaltSupply,
      pV.creationTotalStakeSupply
    );
  }

  function getProposalVotingAyeChoice(
    uint256 _proposalId
  )
    external
    view
    returns (
      uint256 space,
      uint256 galt,
      uint256 stake,
      address[] memory voters
    )
  {
    ChoiceAccounting storage cA = _proposalVotings[_proposalId].aye;

    return (
      cA.totalSpace,
      cA.totalGalt,
      cA.totalStake,
      cA.voters.elements()
    );
  }

  function getProposalVotingNayChoice(
    uint256 _proposalId
  )
    external
    view
    returns (
      uint256 space,
      uint256 galt,
      uint256 stake,
      address[] memory voters
    )
  {
    ChoiceAccounting storage cA = _proposalVotings[_proposalId].nay;

    return (
      cA.totalSpace,
      cA.totalGalt,
      cA.totalStake,
      cA.voters.elements()
    );
  }

  function getProposalVoters(
    uint256 _proposalId
  )
    external
    view
    returns (
      address[] memory ayes,
      address[] memory nays
    )
  {
    ProposalVoting storage pV = _proposalVotings[_proposalId];

    return (
      pV.aye.voters.elements(),
      pV.nay.voters.elements()
    );
  }

  function getParticipantProposalChoice(uint256 _proposalId, address _participant) external view returns (Choice) {
    return _proposalVotings[_proposalId].participants[_participant];
  }
}
