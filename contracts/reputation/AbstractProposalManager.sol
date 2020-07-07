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

  uint256 public constant VERSION = 2;

  using SafeMath for uint256;
  using Counters for Counters.Counter;
  using ArraySet for ArraySet.AddressSet;
  using ArraySet for ArraySet.Uint256Set;

  // 100% == 100 ether
  uint256 public constant ONE_HUNDRED_PCT = 100 ether;
  bytes32 public constant VOTE_FEE_KEY = bytes32("PMANAGER_VOTE");

  event NewProposal(uint256 indexed proposalId, address indexed proposer, bytes32 indexed marker);
  event AyeProposal(uint256 indexed proposalId, address indexed voter);
  event NayProposal(uint256 indexed proposalId, address indexed voter);
  event AbstainProposal(uint256 indexed proposalId, address indexed voter);

  event Approved(uint256 ayeShare, uint256 support, uint256 indexed proposalId, bytes32 indexed marker);
  event Execute(uint256 indexed proposalId, address indexed executer, bool indexed success, bytes response);

  event SetProposalVotingConfig(bytes32 indexed key, uint256 support, uint256 minAcceptQuorum, uint256 timeout, uint256 committingTimeout);
  event SetDefaultProposalVotingConfig(uint256 support, uint256 minAcceptQuorum, uint256 timeout, uint256 committingTimeout);

  struct ProposalVoting {
    bool isCommitReveal;
    uint256 creationBlock;
    uint256 creationTotalSupply;
    uint256 createdAt;
    uint256 timeoutAt;
    uint256 committingTimeoutAt;
    uint256 requiredSupport;
    uint256 minAcceptQuorum;
    // in reputation points
    uint256 totalAyes;
    // in reputation points
    uint256 totalNays;
    // in reputation points
    uint256 totalAbstains;
    // votes counter
    uint256 totalVotes;
    mapping(address => Choice) participants;
    mapping(address => bytes32) commitments;
    mapping(address => bool) revealed;
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
    uint256 committingTimeout;
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

  function initialize(address _feeRegistryAddr) public isInitializer {
    _feeRegistry = _feeRegistryAddr;
  }

  function _propose(
    address _destination,
    uint256 _value,
    bool _castVote,
    bool _executesIfDecided,
    bool _isCommitReveal,
    bytes memory _data,
    string memory _dataLink
  )
    internal
    onlyMember
    returns (uint256 id)
  {
    idCounter.increment();
    id = idCounter.current();

    Proposal storage p = proposals[id];
    p.creator = msg.sender;
    p.destination = _destination;
    p.value = _value;
    p.data = _data;
    p.dataLink = _dataLink;
    p.marker = getThresholdMarker(_destination, _data);

    p.status = ProposalStatus.ACTIVE;
    _onNewProposal(id, _isCommitReveal);

    emit NewProposal(id, msg.sender, p.marker);

    if (!_isCommitReveal && _castVote) {
      _aye(id, msg.sender, _executesIfDecided);
    }

    return id;
  }

  function commit(uint256 _proposalId, bytes32 _commitment) external {
    require(_isProposalOpen(_proposalId), "Proposal isn't open");

    ProposalVoting storage pV = _proposalVotings[_proposalId];
    require(pV.isCommitReveal == true, "Not a commit-reveal vote");
    require(_isCommittingOpen(_proposalId), "Committing is closed");

    pV.commitments[msg.sender] = _commitment;
  }

  function aye(uint256 _proposalId, bool _executeIfDecided) external payable {
    require(_isProposalOpen(_proposalId), "Proposal isn't open");

    _aye(_proposalId, msg.sender, _executeIfDecided);
  }

  function ayeReveal(
    uint256 _proposalId,
    address _voter,
    bool _executeIfDecided,
    string calldata _raw
  )
    external
    payable
  {
    // "1" is AYE representation
    _revealCommitment(_proposalId, _voter, _raw, "1");

    _aye(_proposalId, _voter, _executeIfDecided);
  }

  function nay(uint256 _proposalId) external payable {
    require(_isProposalOpen(_proposalId), "Proposal isn't open");

    _nay(_proposalId, msg.sender);
  }

  function nayReveal(uint256 _proposalId, address _voter, string calldata _raw) external payable {
    // "2" is NAY representation
    _revealCommitment(_proposalId, _voter, _raw, "2");

    _nay(_proposalId, _voter);
  }

  function abstain(uint256 _proposalId, bool _executeIfDecided) external payable {
    require(_isProposalOpen(_proposalId), "Proposal isn't open");

    _abstain(_proposalId, msg.sender, _executeIfDecided);
  }

  function abstainReveal(
    uint256 _proposalId,
    address _voter,
    bool _executeIfDecided,
    string calldata _raw
  )
    external
    payable
  {
    // "3" is ABSTAIN representation
    _revealCommitment(_proposalId, _voter, _raw, "3");

    _abstain(_proposalId, _voter, _executeIfDecided);
  }

  function executeProposal(uint256 _proposalId, uint256 _gasToKeep) external {
    require(proposals[_proposalId].status == ProposalStatus.ACTIVE, "Proposal isn't active");

    (bool canExecuteThis, string memory reason) = _canExecute(_proposalId);
    require(canExecuteThis, reason);

    _unsafeExecuteProposal(_proposalId, _gasToKeep);
  }

  // INTERNAL

  function _revealCommitment(uint256 _proposalId, address _voter, string memory _raw, bytes1 _expectedChoice) internal {
    require(_isProposalOpen(_proposalId), "Proposal isn't open");
    require(_isRevealingOpen(_proposalId), "Revealing isn't open");

    ProposalVoting storage pV = _proposalVotings[_proposalId];
    require(pV.revealed[_voter] == false, "Already revealed");
    require(keccak256(abi.encode(_raw)) == pV.commitments[_voter], "Commitment doesn't match");

    bytes memory bytesUnencoded = bytes(_raw);

    require(bytesUnencoded[0] == _expectedChoice, "Invalid choice decoded");

    pV.revealed[_voter] = true;
  }

  function _aye(uint256 _proposalId, address _voter, bool _executeIfDecided) internal {
    _acceptPayment(VOTE_FEE_KEY);
    ProposalVoting storage pV = _proposalVotings[_proposalId];
    uint256 reputation = reputationOfAt(_voter, pV.creationBlock);
    require(reputation > 0, "Can't vote with 0 reputation");
    bool keepTotalVotesTheSame = false;

    if (pV.participants[_voter] == Choice.NAY) {
      pV.nays.remove(_voter);
      pV.totalNays = pV.totalNays.sub(reputation);
      keepTotalVotesTheSame = true;
    } else if (pV.participants[_voter] == Choice.ABSTAIN) {
      pV.abstains.remove(_voter);
      pV.totalAbstains = pV.totalAbstains.sub(reputation);
      keepTotalVotesTheSame = true;
    }

    pV.participants[_voter] = Choice.AYE;
    pV.ayes.add(_voter);
    pV.totalAyes = pV.totalAyes.add(reputation);

    if (keepTotalVotesTheSame == false) {
      pV.totalVotes++;
    }

    emit AyeProposal(_proposalId, _voter);

    // Fail silently without revert
    if (_executeIfDecided && _canExecuteOnlyBool(_proposalId)) {
      // We've already checked if the vote can be executed with `_canExecute()`
      _unsafeExecuteProposal(_proposalId, 0);
    }
  }

  function _nay(uint256 _proposalId, address _voter) internal {
    _acceptPayment(VOTE_FEE_KEY);
    ProposalVoting storage pV = _proposalVotings[_proposalId];
    uint256 reputation = reputationOfAt(_voter, pV.creationBlock);
    require(reputation > 0, "Can't vote with 0 reputation");
    bool keepTotalVotesTheSame = false;

    if (pV.participants[_voter] == Choice.AYE) {
      pV.ayes.remove(_voter);
      pV.totalAyes = pV.totalAyes.sub(reputation);
      keepTotalVotesTheSame = true;
    } else if (pV.participants[_voter] == Choice.ABSTAIN) {
      pV.abstains.remove(_voter);
      pV.totalAbstains = pV.totalAbstains.sub(reputation);
      keepTotalVotesTheSame = true;
    }

    pV.participants[_voter] = Choice.NAY;
    pV.nays.add(_voter);
    pV.totalNays = pV.totalNays.add(reputation);

    if (keepTotalVotesTheSame == false) {
      pV.totalVotes++;
    }

    emit NayProposal(_proposalId, _voter);
  }

  function _abstain(uint256 _proposalId, address _voter, bool _executeIfDecided) internal {
    _acceptPayment(VOTE_FEE_KEY);
    ProposalVoting storage pV = _proposalVotings[_proposalId];
    uint256 reputation = reputationOfAt(_voter, pV.creationBlock);
    require(reputation > 0, "Can't vote with 0 reputation");
    bool keepTotalVotesTheSame = false;

    if (pV.participants[_voter] == Choice.AYE) {
      pV.ayes.remove(_voter);
      pV.totalAyes = pV.totalAyes.sub(reputation);
      keepTotalVotesTheSame = true;
    } else if (pV.participants[_voter] == Choice.NAY) {
      pV.nays.remove(_voter);
      pV.totalNays = pV.totalNays.sub(reputation);
      keepTotalVotesTheSame = true;
    }

    pV.participants[_voter] = Choice.ABSTAIN;
    pV.abstains.add(_voter);
    pV.totalAbstains = pV.totalAbstains.add(reputation);

    if (keepTotalVotesTheSame == false) {
      pV.totalVotes++;
    }

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

  function _onNewProposal(uint256 _proposalId, bool _isCommitReveal) internal {
    bytes32 marker = proposals[_proposalId].marker;

    uint256 blockNumber = block.number.sub(1);
    uint256 totalSupply = totalReputationSupplyAt(blockNumber);
    require(totalSupply > 0, "Total reputation is 0");

    ProposalVoting storage pv = _proposalVotings[_proposalId];

    pv.creationBlock = blockNumber;
    pv.creationTotalSupply = totalSupply;

    (uint256 support, uint256 quorum, uint256 timeout, uint256 committingTimeout) = getProposalVotingConfig(marker);
    pv.createdAt = block.timestamp;
    // pv.timeoutAt = block.timestamp + timeout;
    pv.timeoutAt = block.timestamp.add(timeout);

    if (_isCommitReveal) {
      require(committingTimeout > 0, "Missing committing timeout");
      pv.isCommitReveal = _isCommitReveal;
      pv.committingTimeoutAt = block.timestamp.add(committingTimeout);
    }

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
    uint256 _timeout,
    uint256 _committingTimeout
  )
    external
    onlyProposalDefaultConfigManager
  {
    _setDefaultProposalConfig(_support, _minAcceptQuorum, _timeout, _committingTimeout);
  }

  function _setDefaultProposalConfig(
    uint256 _support,
    uint256 _minAcceptQuorum,
    uint256 _timeout,
    uint256 _committingTimeout
  )
    internal
  {
    _validateVotingConfig(_support, _minAcceptQuorum, _timeout, _committingTimeout);

    defaultVotingConfig.support = _support;
    defaultVotingConfig.minAcceptQuorum = _minAcceptQuorum;
    defaultVotingConfig.timeout = _timeout;
    defaultVotingConfig.committingTimeout = _committingTimeout;

    emit SetDefaultProposalVotingConfig(_support, _minAcceptQuorum, _timeout, _committingTimeout);
  }

  function setProposalConfig(
    bytes32 _marker,
    uint256 _support,
    uint256 _minAcceptQuorum,
    uint256 _timeout,
    uint256 _committingTimeout
  )
    external
    onlyProposalConfigManager
  {
    _setProposalConfig(_marker, _support, _minAcceptQuorum, _timeout, _committingTimeout);
  }

  function _setProposalConfig(
    bytes32 _marker,
    uint256 _support,
    uint256 _minAcceptQuorum,
    uint256 _timeout,
    uint256 _committingTimeout
  )
    internal
  {
    _validateVotingConfig(_support, _minAcceptQuorum, _timeout, _committingTimeout);

    customVotingConfigs[_marker] = VotingConfig({
      support: _support,
      minAcceptQuorum: _minAcceptQuorum,
      timeout: _timeout,
      committingTimeout: _committingTimeout
    });

    emit SetProposalVotingConfig(_marker, _support, _minAcceptQuorum, _timeout, _committingTimeout);
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

  function _isCommittingOpen(uint256 _proposalId) internal view returns (bool) {
    return now < _proposalVotings[_proposalId].committingTimeoutAt;
  }

  function _isRevealingOpen(uint256 _proposalId) internal view returns (bool) {
    ProposalVoting storage pv = _proposalVotings[_proposalId];

    return pv.committingTimeoutAt < now && now < pv.timeoutAt;
  }

  function _validateVotingConfig(
    uint256 _support,
    uint256 _minAcceptQuorum,
    uint256 _timeout,
    uint256 _committingTimeout
  )
    internal
    pure
  {
    require(_minAcceptQuorum > 0, "Invalid min accept quorum value");
    require(_support > 0 && _support <= ONE_HUNDRED_PCT, "Invalid support value");
    require(_timeout > 0, "Invalid duration value");
    if (_committingTimeout > 0) {
      require(_committingTimeout < _timeout, "Committing timeout should be less than timeout");
    }
  }

  // GETTERS

  function getProposalVoting(
    uint256 _proposalId
  )
    external
    view
    returns (
      bool isCommitReveal,
      uint256 creationBlock,
      uint256 creationTotalSupply,
      uint256 totalAyes,
      uint256 totalNays,
      uint256 totalAbstains,
      uint256 totalVotes,
      address[] memory ayes,
      address[] memory nays,
      address[] memory abstains
    )
  {
    ProposalVoting storage pV = _proposalVotings[_proposalId];

    return (
      pV.isCommitReveal,
      pV.creationBlock,
      pV.creationTotalSupply,
      pV.totalAyes,
      pV.totalNays,
      pV.totalAbstains,
      pV.totalVotes,
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

  function getCommitmentOf(uint256 _proposalId, address _committer) external view returns (bytes32) {
    return _proposalVotings[_proposalId].commitments[_committer];
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
    returns (uint256 support, uint256 minAcceptQuorum, uint256 timeout, uint256 committingTimeout)
  {
    uint256 to = customVotingConfigs[_key].timeout;

    if (to > 0) {
      return (
        customVotingConfigs[_key].support,
        customVotingConfigs[_key].minAcceptQuorum,
        customVotingConfigs[_key].timeout,
        customVotingConfigs[_key].committingTimeout
      );
    } else {
      return (
        defaultVotingConfig.support,
        defaultVotingConfig.minAcceptQuorum,
        defaultVotingConfig.timeout,
        defaultVotingConfig.committingTimeout
      );
    }
  }
}
