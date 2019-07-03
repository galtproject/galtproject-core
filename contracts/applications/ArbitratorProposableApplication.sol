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
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../pgg/PGGOracleStakeAccounting.sol";
import "../pgg/PGGMultiSig.sol";
import "../registries/PGGRegistry.sol";
import "./AbstractApplication.sol";


contract ArbitratorProposableApplication is AbstractApplication {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  event NewApplication(address indexed applicant, bytes32 applicationId);
  event NewProposal(address indexed arbitrator, bytes32 indexed applicationId, Action action, bytes32 proposalId);
  event ApplicationStatusChanged(bytes32 indexed applicationId, ApplicationStatus indexed status);
  event ArbitratorSlotTaken(bytes32 indexed applicationId, uint256 slotsTaken, uint256 totalSlots);
  event ArbitratorRewardApplication(bytes32 indexed applicationId, address indexed oracle);
  event GaltProtocolFeeAssigned(bytes32 indexed applicationId);

  enum ApplicationStatus {
    NOT_EXISTS,
    SUBMITTED,
    APPROVED,
    REJECTED,
    REVERTED
  }

  enum Action {
    APPROVE,
    REJECT
  }

  struct Application {
    bytes32 id;
    address payable pgg;
    address applicant;
    bytes32 chosenProposal;
    uint256 createdAt;
    uint256 m;
    uint256 n;

    ApplicationStatus status;
    FeeDetails fees;

    mapping(bytes32 => Proposal) proposals;
    mapping(address => bytes32) votes;

    bytes32[] proposalList;
    ArraySet.AddressSet arbitrators;
  }

  struct FeeDetails {
    Currency currency;
    uint256 arbitratorsReward;
    uint256 arbitratorReward;
    uint256 galtProtocolFee;
    bool galtProtocolFeePaidOut;
    mapping(address => bool) arbitratorRewardPaidOut;
  }

  struct Proposal {
    Action action;
    ArraySet.AddressSet votesFor;
    address from;
    string message;
  }

  mapping(bytes32 => Application) internal applications;
  mapping(address => bytes32[]) internal applicationByArbitrator;

  constructor () public {}

  function initialize(
    GaltGlobalRegistry _ggr
  )
    public
    isInitializer
  {
    ggr = _ggr;
  }

  function _execute(bytes32 _cId, bytes32 _pId) internal {
    revert("#_execute() not implemented");
  }

  function _checkRewardCanBeClaimed(bytes32 _cId) internal returns (bool) {
    revert("#_checkRewardCanBeClaimed() not implemented");
  }

  function minimalApplicationFeeEth(address _pgg) internal view returns (uint256) {
    revert("#minimalApplicationFeeEth() not implemented");
  }

  function minimalApplicationFeeGalt(address _pgg) internal view returns (uint256) {
    revert("#minimalApplicationFeeGalt() not implemented");
  }

  // arbitrators count required
  function m(address _pgg) public view returns (uint256) {
    revert("#m() not implemented");
  }

  // total arbitrators count able to lock the claim
  function n(address _pgg) public view returns (uint256) {
    revert("#n() not implemented");
  }

  function paymentMethod(address _pgg) public view returns (PaymentMethod);

  /**
   * @dev Submit a new claim.
   *
   * @param _pgg to submit a claim
   * @param _applicationFeeInGalt or 0 for ETH payment method
   * @return new claim id
   */
  function _submit(
    address payable _pgg,
    uint256 _applicationFeeInGalt
  )
    internal
    returns (bytes32)
  {
    pggRegistry().requireValidPgg(_pgg);

    // Default is ETH
    Currency currency;
    uint256 fee;

    // ETH
    if (msg.value > 0) {
      requireValidPaymentType(_pgg, PaymentType.ETH);
      require(_applicationFeeInGalt == 0, "Could not accept both ETH and GALT");
      require(msg.value >= minimalApplicationFeeEth(_pgg), "Incorrect fee passed in");
      fee = msg.value;
    // GALT
    } else {
      requireValidPaymentType(_pgg, PaymentType.GALT);
      require(msg.value == 0, "Could not accept both ETH and GALT");
      require(_applicationFeeInGalt >= minimalApplicationFeeGalt(_pgg), "Incorrect fee passed in");
      ggr.getGaltToken().transferFrom(msg.sender, address(this), _applicationFeeInGalt);
      fee = _applicationFeeInGalt;
      currency = Currency.GALT;
    }

    bytes32 id = keccak256(
      abi.encodePacked(
        msg.sender,
        blockhash(block.number - 1),
        applicationsArray.length
      )
    );

    Application storage c = applications[id];
    require(applications[id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    c.status = ApplicationStatus.SUBMITTED;
    c.id = id;
    c.pgg = _pgg;
    c.applicant = msg.sender;
    c.fees.currency = currency;
    c.n = n(_pgg);
    c.m = m(_pgg);
    c.createdAt = block.timestamp;

    calculateAndStoreFee(c, fee);

    applicationsArray.push(id);
    applicationsByApplicant[msg.sender].push(id);

    emit NewApplication(msg.sender, id);
    emit ApplicationStatusChanged(id, ApplicationStatus.SUBMITTED);

    return id;
  }

  /**
   * @dev Arbitrator locks a claim to work on
   * @param _cId Application ID
   */
  function lock(bytes32 _cId) external {
    Application storage c = applications[_cId];

    require(pggConfig(c.pgg).getMultiSig().isOwner(msg.sender), "Invalid arbitrator");

    require(c.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(!c.arbitrators.has(msg.sender), "Arbitrator has already locked the application");
    require(c.arbitrators.size() < n(c.pgg), "All arbitrator slots are locked");

    c.arbitrators.add(msg.sender);

    emit ArbitratorSlotTaken(_cId, c.arbitrators.size(), n(c.pgg));
  }

  /**
   * @dev Arbitrator makes approve proposal
   * @param _cId Application ID
   */
  function _proposeApproval(bytes32 _cId, string memory _msg) internal returns (bytes32 pId) {
    Application storage c = applications[_cId];

    require(c.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(c.arbitrators.has(msg.sender) == true, "Arbitrator not in locked list");

    pId = keccak256(abi.encode(_cId, block.number, msg.sender));

    Proposal storage p = c.proposals[pId];

    require(p.from == address(0), "Proposal already exists");

    // arbitrator immediately votes for the proposal
    // as we have minimum n equal 2, a brand new proposal could not be executed in this step
    _voteFor(c, pId);

    p.from = msg.sender;
    p.action = Action.APPROVE;
    p.message = _msg;

    c.proposalList.push(pId);

    emit NewProposal(msg.sender, _cId, Action.APPROVE, pId);
  }

  /**
   * @dev Arbitrator makes reject proposal
   * @param _cId Application ID
   */
  function proposeReject(bytes32 _cId, string calldata _msg) external {
    Application storage c = applications[_cId];

    require(c.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(c.arbitrators.has(msg.sender) == true, "Arbitrator not in locked list");

    bytes32 pId = keccak256(abi.encode(_cId, _msg, msg.sender));
    Proposal storage p = c.proposals[pId];
    require(p.from == address(0), "Proposal already exists");

    c.proposalList.push(pId);

    // arbitrator immediately votes for the proposal
    _voteFor(c, pId);
    // as we have minimum n equal 2, a brand new proposal could not be executed in this step

    p.from = msg.sender;
    p.message = _msg;
    p.action = Action.REJECT;

    emit NewProposal(msg.sender, _cId, Action.REJECT, pId);
  }

  /**
   * @dev Arbitrator votes for a proposal
   * @param _cId Application ID
   * @param _pId Proposal ID
   */
  function vote(bytes32 _cId, bytes32 _pId) external {
    Application storage c = applications[_cId];

    require(c.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(c.arbitrators.has(msg.sender) == true, "Arbitrator not in locked list");

    Proposal storage p = c.proposals[_pId];

    require(p.from != address(0), "Proposal doesn't exists");

    _voteFor(c, _pId);

    if (p.votesFor.size() == c.m) {
      c.chosenProposal = _pId;
      calculateAndStoreAuditorRewards(c);

      if (p.action == Action.APPROVE) {
        changeApplicationStatus(c, ApplicationStatus.APPROVED);
        _execute(_cId, _pId);
      } else {
        changeApplicationStatus(c, ApplicationStatus.REJECTED);
      }
    }
  }

  function claimArbitratorReward(bytes32 _cId) external {
    Application storage c = applications[_cId];

    require(
      c.status == ApplicationStatus.APPROVED || c.status == ApplicationStatus.REJECTED,
      "Application status should be APPROVED or REJECTED");
    require(c.arbitrators.has(msg.sender) == true, "Arbitrator not in locked list");
    require(c.fees.arbitratorRewardPaidOut[msg.sender] == false, "Reward already paid out");
    if (c.status == ApplicationStatus.APPROVED) {
      require(_checkRewardCanBeClaimed(_cId), "Transaction hasn't executed by multiSig yet");
    }

    c.fees.arbitratorRewardPaidOut[msg.sender] = true;

    _assignGaltProtocolFee(c);

    if (c.fees.currency == Currency.ETH) {
      msg.sender.transfer(c.fees.arbitratorReward);
    } else if (c.fees.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(msg.sender, c.fees.arbitratorReward);
    }

    emit ArbitratorRewardApplication(_cId, msg.sender);
  }

  function verifyOraclesAreValid(bytes32 _cId, address[] memory _oracles, bytes32[] memory _oracleTypes) internal {
    Application storage c = applications[_cId];

    require(
      pggConfig(c.pgg)
      .getOracles()
      .oraclesHasTypesAssigned(_oracles, _oracleTypes),
      "Some oracle types are invalid"
    );
  }

  function _assignGaltProtocolFee(Application storage _a) internal {
    if (_a.fees.galtProtocolFeePaidOut == false) {
      if (_a.fees.currency == Currency.ETH) {
        protocolFeesEth = protocolFeesEth.add(_a.fees.galtProtocolFee);
      } else if (_a.fees.currency == Currency.GALT) {
        protocolFeesGalt = protocolFeesGalt.add(_a.fees.galtProtocolFee);
      }

      _a.fees.galtProtocolFeePaidOut = true;
      emit GaltProtocolFeeAssigned(_a.id);
    }
  }

  function _voteFor(Application storage _c, bytes32 _pId) internal {
    Proposal storage _p = _c.proposals[_pId];

    if (_c.votes[msg.sender] != 0x0) {
      _c.proposals[_c.votes[msg.sender]].votesFor.remove(msg.sender);
    }

    _c.votes[msg.sender] = _pId;
    _p.votesFor.add(msg.sender);
  }

  function calculateAndStoreFee(
    Application storage _c,
    uint256 _fee
  )
    internal
  {
    uint256 share;

    (uint256 ethFee, uint256 galtFee) = getProtocolShares();

    if (_c.fees.currency == Currency.ETH) {
      share = ethFee;
    } else {
      share = galtFee;
    }

    require(share > 0 && share <= 100, "Fee not properly set up");

    uint256 galtProtocolFee = share.mul(_fee).div(100);
    uint256 arbitratorsReward = _fee.sub(galtProtocolFee);

    assert(arbitratorsReward.add(galtProtocolFee) == _fee);

    _c.fees.arbitratorsReward = arbitratorsReward;
    _c.fees.galtProtocolFee = galtProtocolFee;
  }

  // NOTICE: in case 100 ether / 3, each arbitrator will receive 33.33... ether and 1 wei will remain on contract
  function calculateAndStoreAuditorRewards (Application storage c) internal {
    uint256 len = c.arbitrators.size();
    uint256 rewardSize = c.fees.arbitratorsReward.div(len);

    c.fees.arbitratorReward = rewardSize;
  }

  function changeApplicationStatus(
    Application storage _claim,
    ApplicationStatus _status
  )
    internal
  {
    emit ApplicationStatusChanged(_claim.id, _status);

    _claim.status = _status;
  }

  /** GETTERS **/
  function getApplication(
    bytes32 _cId
  )
    external
    view
    returns (
      address applicant,
      address pgg,
      address[] memory arbitrators,
      uint256 slotsTaken,
      uint256 slotsThreshold,
      uint256 totalSlots,
      uint256 createdAt,
      ApplicationStatus status
    )
  {
    Application storage c = applications[_cId];

    return (
      c.applicant,
      c.pgg,
      c.arbitrators.elements(),
      c.arbitrators.size(),
      c.m,
      c.n,
      c.createdAt,
      c.status
    );
  }

  function getApplicationRewards(
    bytes32 _cId
  )
    external
    view
    returns (
      Currency currency,
      uint256 arbitratorsReward,
      uint256 galtProtocolFee,
      uint256 arbitratorReward
    )
  {
    FeeDetails storage f = applications[_cId].fees;

    return (
      f.currency,
      f.arbitratorsReward,
      f.galtProtocolFee,
      f.arbitratorReward
    );
  }

  function getProposalList(bytes32 _cId) external view returns (bytes32[] memory) {
    return applications[_cId].proposalList;
  }

  /*
   * @dev Get Proposal ID the arbitrator voted for
   * @param _cId Application ID
   * @param _v arbitrator address
   */
  function getVotedFor(bytes32 _cId, address _v) external view returns (bytes32) {
    return applications[_cId].votes[_v];
  }

  function getProposal(
    bytes32 _cId,
    bytes32 _pId
  )
    external
    view
    returns (
      Action action,
      address from,
      string memory message
    )
  {
    Proposal storage p = applications[_cId].proposals[_pId];

    return (
      p.action,
      p.from,
      p.message
    );
  }

  function getProposalVotes(
    bytes32 _cId,
    bytes32 _pId
  )
    external
    view
    returns (
      uint256 votesSize,
      address[] memory votesFor
    )
  {
    Proposal storage p = applications[_cId].proposals[_pId];

    return (
      p.votesFor.size(),
      p.votesFor.elements()
    );
  }
}
