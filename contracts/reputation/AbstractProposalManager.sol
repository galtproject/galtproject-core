/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/drafts/Counters.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "@galtproject/libs/contracts/traits/Initializable.sol";
import "../traits/ChargesEthFee.sol";


contract AbstractProposalManager is Initializable, ChargesEthFee {

  uint256 constant VERSION = 2;

  using SafeMath for uint256;
  using Counters for Counters.Counter;
  using ArraySet for ArraySet.AddressSet;
  using ArraySet for ArraySet.Uint256Set;

  // 100% == 100 ether
  uint256 public constant ONE_HUNDRED_PCT = 100 ether;

  event NewProposal(uint256 indexed proposalId, address indexed proposer, bytes32 indexed marker);
  event AyeProposal(uint256 indexed proposalId, address indexed voter);
  event NayProposal(uint256 indexed proposalId, address indexed voter);
  event AbstainProposal(uint256 indexed proposalId, address indexed voter);

  event Approved(uint256 ayeShare, uint256 support, uint256 indexed proposalId, bytes32 indexed marker);
  event Execute(uint256 indexed proposalId, address indexed executer, bool indexed success, bytes response);

  event SetProposalVotingConfig(bytes32 indexed key, uint256 support, uint256 minAcceptQuorum, uint256 timeout);
  event SetDefaultProposalVotingConfig(uint256 support, uint256 minAcceptQuorum, uint256 timeout);

  struct ProposalVoting {
    uint256 creationBlock;
    uint256 creationTotalSupply;
    uint256 createdAt;
    uint256 timeoutAt;
    uint256 requiredSupport;
    uint256 minAcceptQuorum;
    uint256 totalAyes;
    uint256 totalNays;
    uint256 totalAbstains;
    mapping(address => Choice) participants;
    ArraySet.AddressSet ayes;
    ArraySet.AddressSet nays;
    ArraySet.AddressSet abstains;
  }

  struct Proposal {
    ProposalStatus status;
    address creator;
    address destination;
    uint256 value;
    bytes32 marker;
    bytes data;
    string dataLink;
  }

  struct VotingConfig {
    uint256 support;
    uint256 minAcceptQuorum;
    uint256 timeout;
  }

  Counters.Counter public idCounter;

  mapping(uint256 => Proposal) public proposals;
  mapping(uint256 => ProposalVoting) internal _proposalVotings;
  mapping(uint256 => address) private _proposalToSender;

  VotingConfig public defaultVotingConfig;

  // marker => customVotingConfigs
  mapping(bytes32 => VotingConfig) public customVotingConfigs;

  enum ProposalStatus {
    NULL,
    ACTIVE,
    EXECUTED
  }

  enum Choice {
    PENDING,
    AYE,
    NAY,
    ABSTAIN
  }

  modifier onlyMember() {
    require(reputationOf(msg.sender) > 0, "Not valid member");

    _;
  }

  modifier onlyProposalConfigManager() {
    require(false, "Should be implemented in children");

    _;
  }

  modifier onlyProposalDefaultConfigManager() {
    require(false, "Should be implemented in children");

    _;
  }

  constructor() public {
  }

  function initialize(address _feeManager) public isInitializer {
    feeManager = _feeManager;
  }

  function propose(
    address _destination,
    uint256 _value,
    bool _castVote,
    bool _executesIfDecided,
    bytes calldata _data,
    string calldata _dataLink
  )
    public
    payable
    onlyMember
  {
    idCounter.increment();
    uint256 id = idCounter.current();

    Proposal storage p = proposals[id];
    p.creator = msg.sender;
    p.destination = _destination;
    p.value = _value;
    p.data = _data;
    p.dataLink = _dataLink;
    p.marker = getThresholdMarker(_destination, _data);

    p.status = ProposalStatus.ACTIVE;
    _onNewProposal(id);

    emit NewProposal(id, msg.sender, p.marker);

    if (_castVote) {
      _aye(id, msg.sender, _executesIfDecided);
    }
  }

  function aye(uint256 _proposalId, bool _executeIfDecided) external payable {
    require(_isProposalOpen(_proposalId), "Proposal isn't open");

    _aye(_proposalId, msg.sender, _executeIfDecided);
  }

  function nay(uint256 _proposalId) external payable {
    require(_isProposalOpen(_proposalId), "Proposal isn't open");

    _nay(_proposalId, msg.sender);
  }

  function abstain(uint256 _proposalId, bool _executeIfDecided) external payable {
    require(_isProposalOpen(_proposalId), "Proposal isn't open");

    _abstain(_proposalId, msg.sender, _executeIfDecided);
  }

  function executeProposal(uint256 _proposalId, uint256 _gasToKeep) external {
    require(proposals[_proposalId].status == ProposalStatus.ACTIVE, "Proposal isn't active");

    (bool canExecuteThis, string memory reason) = _canExecute(_proposalId);
    require(canExecuteThis, reason);

    _unsafeExecuteProposal(_proposalId, _gasToKeep);
  }

  // INTERNAL

  function _aye(uint256 _proposalId, address _voter, bool _executeIfDecided) internal {
    _acceptPayment();
    ProposalVoting storage pV = _proposalVotings[_proposalId];
    uint256 reputation = reputationOfAt(_voter, pV.creationBlock);
    require(reputation > 0, "Can't vote with 0 reputation");

    if (pV.participants[_voter] == Choice.NAY) {
      pV.nays.remove(_voter);
      pV.totalNays = pV.totalNays.sub(reputation);
    } else if (pV.participants[_voter] == Choice.ABSTAIN) {
      pV.abstains.remove(_voter);
      pV.totalAbstains = pV.totalAbstains.sub(reputation);
    }

    pV.participants[_voter] = Choice.AYE;
    pV.ayes.add(_voter);
    pV.totalAyes = pV.totalAyes.add(reputation);

    emit AyeProposal(_proposalId, _voter);

    // Fail silently without revert
    if (_executeIfDecided && _canExecuteOnlyBool(_proposalId)) {
      // We've already checked if the vote can be executed with `_canExecute()`
      _unsafeExecuteProposal(_proposalId, 0);
    }
  }

  function _nay(uint256 _proposalId, address _voter) internal {
    _acceptPayment();
    ProposalVoting storage pV = _proposalVotings[_proposalId];
    uint256 reputation = reputationOfAt(_voter, pV.creationBlock);
    require(reputation > 0, "Can't vote with 0 reputation");

    if (pV.participants[_voter] == Choice.AYE) {
      pV.ayes.remove(_voter);
      pV.totalAyes = pV.totalAyes.sub(reputation);
    } else if (pV.participants[_voter] == Choice.ABSTAIN) {
      pV.abstains.remove(_voter);
      pV.totalAbstains = pV.totalAbstains.sub(reputation);
    }

    pV.participants[msg.sender] = Choice.NAY;
    pV.nays.add(msg.sender);
    pV.totalNays = pV.totalNays.add(reputation);

    emit NayProposal(_proposalId, _voter);
  }

  function _abstain(uint256 _proposalId, address _voter, bool _executeIfDecided) internal {
    _acceptPayment();
    ProposalVoting storage pV = _proposalVotings[_proposalId];
    uint256 reputation = reputationOfAt(_voter, pV.creationBlock);
    require(reputation > 0, "Can't vote with 0 reputation");

    if (pV.participants[_voter] == Choice.AYE) {
      pV.ayes.remove(_voter);
      pV.totalAyes = pV.totalAyes.sub(reputation);
    } else if (pV.participants[_voter] == Choice.NAY) {
      pV.nays.remove(_voter);
      pV.totalNays = pV.totalNays.sub(reputation);
    }

    pV.participants[msg.sender] = Choice.ABSTAIN;
    pV.abstains.add(msg.sender);
    pV.totalAbstains = pV.totalAbstains.add(reputation);

    emit AbstainProposal(_proposalId, _voter);

    // Fail silently without revert
    if (_executeIfDecided && _canExecuteOnlyBool(_proposalId)) {
      // We've already checked if the vote can be executed with `_canExecute()`
      _unsafeExecuteProposal(_proposalId, 0);
    }
  }

  function _canExecuteOnlyBool(uint256 _proposalId) internal view returns (bool) {
    (bool canExecuteThis,) = _canExecute(_proposalId);
    return canExecuteThis;
  }

  function _onNewProposal(uint256 _proposalId) internal {
    bytes32 marker = proposals[_proposalId].marker;

    uint256 blockNumber = block.number.sub(1);
    uint256 totalSupply = totalReputationSupplyAt(blockNumber);
    require(totalSupply > 0, "Total reputation is 0");

    ProposalVoting storage pv = _proposalVotings[_proposalId];

    pv.creationBlock = blockNumber;
    pv.creationTotalSupply = totalSupply;

    (uint256 support, uint256 quorum, uint256 timeout) = getProposalVotingConfig(marker);
    pv.createdAt = block.timestamp;
    // pv.timeoutAt = block.timestamp + timeout;
    pv.timeoutAt = block.timestamp.add(timeout);

    pv.requiredSupport = support;
    pv.minAcceptQuorum = quorum;
  }

  function _unsafeExecuteProposal(uint256 _proposalId, uint256 _gasToKeep) internal {
    uint256 gasToKeep = 0;
    if (_gasToKeep == 0) {
      gasToKeep = 100000;
    }

    Proposal storage p = proposals[_proposalId];

    p.status = ProposalStatus.EXECUTED;

    (bool ok, bytes memory response) = address(p.destination)
      .call
      .value(p.value)
      .gas(gasleft().sub(gasToKeep))(p.data);

    if (ok == false) {
      p.status = ProposalStatus.ACTIVE;
    }

    emit Execute(_proposalId, msg.sender, ok, response);
  }

  function setDefaultProposalConfig(
    uint256 _support,
    uint256 _minAcceptQuorum,
    uint256 _timeout
  )
    external
    onlyProposalDefaultConfigManager
  {
    _validateVotingConfig(_support, _minAcceptQuorum, _timeout);

    defaultVotingConfig.support = _support;
    defaultVotingConfig.minAcceptQuorum = _minAcceptQuorum;
    defaultVotingConfig.timeout = _timeout;

    emit SetDefaultProposalVotingConfig(_support, _minAcceptQuorum, _timeout);
  }

  function setProposalConfig(
    bytes32 _marker,
    uint256 _support,
    uint256 _minAcceptQuorum,
    uint256 _timeout
  )
    external
    onlyProposalConfigManager
  {
    _validateVotingConfig(_support, _minAcceptQuorum, _timeout);

    customVotingConfigs[_marker] = VotingConfig({
      support: _support,
      minAcceptQuorum: _minAcceptQuorum,
      timeout: _timeout
    });

    emit SetProposalVotingConfig(_marker, _support, _minAcceptQuorum, _timeout);
  }

  // INTERNAL GETTERS

  function _canExecute(uint256 _proposalId) internal view returns (bool can, string memory errorReason) {
    Proposal storage p = proposals[_proposalId];
    ProposalVoting storage pv = _proposalVotings[_proposalId];

    // Voting is not executed yet
    if (p.status != ProposalStatus.ACTIVE) {
      return (false, "Proposal isn't active");
    }

    // Voting is already decided
    uint256 ayeShare = getAyeShare(_proposalId);
    if (ayeShare >= pv.requiredSupport) {
      return (true, "");
    }

    // Vote ended?
    if (_isProposalOpen(_proposalId)) {
      return (false, "Proposal is still active");
    }

    // Has enough support?
    uint256 support = getCurrentSupport(_proposalId);
    if (support < pv.requiredSupport) {
      return (false, "Support hasn't been reached");
    }

    // Has min quorum?
    uint256 quorum = getCurrentQuorum(_proposalId);
    if (quorum < pv.minAcceptQuorum) {
      return (false, "MIN quorum hasn't been reached");
    }

    return (true, "");
  }

  function _isProposalOpen(uint256 _proposalId) internal view returns (bool) {
    Proposal storage p = proposals[_proposalId];
    ProposalVoting storage pv = _proposalVotings[_proposalId];

    return block.timestamp < pv.timeoutAt && p.status == ProposalStatus.ACTIVE;
  }

  function _validateVotingConfig(
    uint256 _support,
    uint256 _minAcceptQuorum,
    uint256 _timeout
  )
    internal
    pure
  {
    require(_minAcceptQuorum > 0, "Invalid min accept quorum value");
    require(_support > 0 && _support <= ONE_HUNDRED_PCT, "Invalid support value");
    require(_timeout > 0, "Invalid duration value");
  }

  // GETTERS

  function getProposalVoting(
    uint256 _proposalId
  )
    external
    view
    returns (
      uint256 creationBlock,
      uint256 creationTotalSupply,
      uint256 totalAyes,
      uint256 totalNays,
      uint256 totalAbstains,
      address[] memory ayes,
      address[] memory nays,
      address[] memory abstains
    )
  {
    ProposalVoting storage pV = _proposalVotings[_proposalId];

    return (
      pV.creationBlock,
      pV.creationTotalSupply,
      pV.totalAyes,
      pV.totalNays,
      pV.totalAbstains,
      pV.ayes.elements(),
      pV.nays.elements(),
      pV.abstains.elements()
    );
  }

  function getProposalVotingProgress(
    uint256 _proposalId
  )
    external
    view
    returns (
      uint256 ayesShare,
      uint256 naysShare,
      uint256 abstainsShare,
      uint256 currentSupport,
      uint256 currentQuorum,
      uint256 requiredSupport,
      uint256 minAcceptQuorum,
      uint256 timeoutAt
    )
  {
    ProposalVoting storage pV = _proposalVotings[_proposalId];

    return (
      getAyeShare(_proposalId),
      getNayShare(_proposalId),
      getAbstainShare(_proposalId),
      getCurrentSupport(_proposalId),
      getCurrentQuorum(_proposalId),
      pV.requiredSupport,
      pV.minAcceptQuorum,
      pV.timeoutAt
    );
  }

  function reputationOf(address _address) public view returns (uint256) {
    require(false, "Should be implemented in children");
    return 0;
  }

  function reputationOfAt(address _address, uint256 _blockNumber) public view returns (uint256) {
    require(false, "Should be implemented in children");
    return 0;
  }

  function totalReputationSupplyAt(uint256 blockNumber) public view returns (uint256) {
    require(false, "Should be implemented in children");
    return 0;
  }

  function canExecute(uint256 _proposalId) external view returns (bool can, string memory errorReason) {
    return _canExecute(_proposalId);
  }

  function getParticipantProposalChoice(uint256 _proposalId, address _participant) external view returns (Choice) {
    return _proposalVotings[_proposalId].participants[_participant];
  }

  function getCurrentSupport(uint256 _proposalId) public view returns (uint256) {
    ProposalVoting storage pv = _proposalVotings[_proposalId];

    uint256 totalVotes = pv.totalAyes.add(pv.totalNays).add(pv.totalAbstains);

    if (totalVotes == 0) {
      return 0;
    }

    return pv.totalAyes.mul(ONE_HUNDRED_PCT) / totalVotes;
  }

  function getCurrentQuorum(uint256 _proposalId) public view returns (uint256) {
    ProposalVoting storage pv = _proposalVotings[_proposalId];
    ProposalVoting storage p = _proposalVotings[_proposalId];

    uint256 totalVotes = pv.totalAyes.add(pv.totalNays).add(pv.totalAbstains);

    return totalVotes.mul(ONE_HUNDRED_PCT) / p.creationTotalSupply;
  }

  function getAyeShare(uint256 _proposalId) public view returns (uint256) {
    ProposalVoting storage p = _proposalVotings[_proposalId];

    return p.totalAyes.mul(ONE_HUNDRED_PCT) / p.creationTotalSupply;
  }

  function getNayShare(uint256 _proposalId) public view returns (uint256) {
    ProposalVoting storage p = _proposalVotings[_proposalId];

    return p.totalNays.mul(ONE_HUNDRED_PCT) / p.creationTotalSupply;
  }

  function getAbstainShare(uint256 _proposalId) public view returns (uint256) {
    ProposalVoting storage p = _proposalVotings[_proposalId];

    return p.totalAbstains.mul(ONE_HUNDRED_PCT) / p.creationTotalSupply;
  }

  function getThresholdMarker(address _destination, bytes memory _data) public pure returns(bytes32 marker) {
    bytes32 methodName;

    assembly {
      methodName := and(mload(add(_data, 0x20)), 0xffffffff00000000000000000000000000000000000000000000000000000000)
    }

    return keccak256(abi.encode(_destination, methodName));
  }

  function getProposalVotingConfig(
    bytes32 _key
  )
    public
    view
    returns (uint256 support, uint256 minAcceptQuorum, uint256 timeout)
  {
    uint256 to = customVotingConfigs[_key].timeout;

    if (to > 0) {
      return (
        customVotingConfigs[_key].support,
        customVotingConfigs[_key].minAcceptQuorum,
        customVotingConfigs[_key].timeout
      );
    } else {
      return (
        defaultVotingConfig.support,
        defaultVotingConfig.minAcceptQuorum,
        defaultVotingConfig.timeout
      );
    }
  }
}
