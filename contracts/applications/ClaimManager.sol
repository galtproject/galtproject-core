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
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../pgg/PGGOracleStakeAccounting.sol";
import "../pgg/PGGMultiSig.sol";
import "../registries/PGGRegistry.sol";
import "./AbstractApplication.sol";


contract ClaimManager is AbstractApplication {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  // `bytes4(keccak256('transfer(address,uint256)'))`
  bytes4 public constant ERC20_TRANSFER_SIGNATURE = 0xa9059cbb;

  bytes32 public constant CONFIG_MINIMAL_FEE_ETH = bytes32("CM_MINIMAL_FEE_ETH");
  bytes32 public constant CONFIG_MINIMAL_FEE_GALT = bytes32("CM_MINIMAL_FEE_GALT");
  bytes32 public constant CONFIG_PAYMENT_METHOD = bytes32("CM_PAYMENT_METHOD");
  bytes32 public constant CONFIG_M = bytes32("CM_M");
  bytes32 public constant CONFIG_N = bytes32("CM_N");
  bytes32 public constant CONFIG_PREFIX = bytes32("CM");

  event NewApplication(address indexed applicant, bytes32 applicationId);
  event NewProposal(address indexed arbitrator, bytes32 indexed applicationId, Action action, bytes32 proposalId);
  event ApplicationStatusChanged(bytes32 indexed applicationId, ApplicationStatus indexed status);
  event ArbitratorSlotTaken(bytes32 indexed applicationId, uint256 slotsTaken, uint256 totalSlots);
  event ArbitratorRewardClaim(bytes32 indexed applicationId, address indexed oracle);
  event GaltProtocolFeeAssigned(bytes32 indexed applicationId);
  // TODO: cut out messages
  event NewMessage(bytes32 claimId, uint256 messageId);

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

  struct Claim {
    bytes32 id;
    address payable pgg;
    address applicant;
    address beneficiary;
    uint256 amount;
    bytes32 chosenProposal;
    uint256 messageCount;
    uint256 multiSigTransactionId;
    uint256 createdAt;
    uint256 m;
    uint256 n;

    ApplicationStatus status;
    FeeDetails fees;

    mapping(bytes32 => Proposal) proposalDetails;
    mapping(uint256 => Message) messages;
    mapping(address => bytes32) votes;
    bytes32[] attachedDocuments;

    bytes32[] proposals;
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
    uint256 amount;
    address[] oracles;
    bytes32[] oracleTypes;
    uint256[] fines;
    address[] arbitrators;
    uint256[] arbitratorFines;
  }

  struct Message {
    uint256 id;
    uint256 timestamp;
    address from;
    string text;
  }

  struct ArbitratorFine {
    address addr;
    uint256 amount;
  }

  struct OracleFine {
    address addr;
    bytes32 oracleType;
    uint256 amount;
  }

  mapping(bytes32 => Claim) claims;
  mapping(address => bytes32[]) applicationsByArbitrator;

  constructor () public {}

  function initialize(
    GaltGlobalRegistry _ggr
  )
    public
    isInitializer
  {
    ggr = _ggr;
  }

  function minimalApplicationFeeEth(address _pgg) internal view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_MINIMAL_FEE_ETH));
  }

  function minimalApplicationFeeGalt(address _pgg) internal view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_MINIMAL_FEE_GALT));
  }

  // arbitrators count required
  function m(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_M));
  }

  // total arbitrators count able to lock the claim
  function n(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_N));
  }

  function paymentMethod(address _pgg) public view returns (PaymentMethod) {
    return PaymentMethod(uint256(pggConfigValue(_pgg, CONFIG_PAYMENT_METHOD)));
  }

  /**
   * @dev Submit a new claim.
   *
   * @param _pgg to submit a claim
   * @param _beneficiary for refund
   * @param _amount of claim
   * @param _documents with details
   * @param _applicationFeeInGalt or 0 for ETH payment method
   * @return new claim id
   */
  function submit(
    address payable _pgg,
    address _beneficiary,
    uint256 _amount,
    bytes32[] calldata _documents,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    returns (bytes32)
  {
    pggRegistry().requireValidPgg(_pgg);

    // Default is ETH
    Currency currency;
    uint256 fee;

    // ETH
    if (msg.value > 0) {
      require(_applicationFeeInGalt == 0, "Could not accept both ETH and GALT");
      require(msg.value >= minimalApplicationFeeEth(_pgg), "Incorrect fee passed in");
      fee = msg.value;
    // GALT
    } else {
      require(msg.value == 0, "Could not accept both ETH and GALT");
      require(_applicationFeeInGalt >= minimalApplicationFeeGalt(_pgg), "Incorrect fee passed in");
      ggr.getGaltToken().transferFrom(msg.sender, address(this), _applicationFeeInGalt);
      fee = _applicationFeeInGalt;
      currency = Currency.GALT;
    }


    bytes32 id = keccak256(
      abi.encodePacked(
        msg.sender,
        _beneficiary,
        _documents,
        blockhash(block.number - 1),
        applicationsArray.length
      )
    );

    Claim storage c = claims[id];
    require(claims[id].status == ApplicationStatus.NOT_EXISTS, "Claim already exists");

    c.status = ApplicationStatus.SUBMITTED;
    c.id = id;
    c.pgg = _pgg;
    c.amount = _amount;
    c.beneficiary = _beneficiary;
    c.applicant = msg.sender;
    c.attachedDocuments = _documents;
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
   * @param _cId Claim ID
   */
  function lock(bytes32 _cId) external {
    Claim storage c = claims[_cId];

    require(pggConfig(c.pgg).getMultiSig().isOwner(msg.sender), "Invalid arbitrator");

    require(c.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(!c.arbitrators.has(msg.sender), "Arbitrator has already locked the application");
    require(c.arbitrators.size() < n(c.pgg), "All arbitrator slots are locked");

    c.arbitrators.add(msg.sender);

    emit ArbitratorSlotTaken(_cId, c.arbitrators.size(), n(c.pgg));
  }

  /**
   * @dev Arbitrator makes approve proposal
   * @param _cId Claim ID
   */
  function proposeApproval(
    bytes32 _cId,
    string calldata _msg,
    uint256 _amount,
    address[] calldata _oracles,
    bytes32[] calldata _oracleTypes,
    uint256[] calldata _oracleFines,
    address[] calldata _arbitrators,
    uint256[] calldata _arbitratorFines
  )
    external
  {
    require(_oracles.length == _oracleTypes.length, "Oracle/OracleType arrays should be equal");
    require(_oracleTypes.length == _oracleFines.length, "OracleType/Fine arrays should be equal");
    require(_arbitrators.length == _arbitratorFines.length, "Arbitrator list/fines arrays should be equal");
    require(_oracles.length > 0 || _arbitratorFines.length > 0, "Either oracles or arbitrators should be fined");

    verifyOraclesAreValid(_cId, _oracles, _oracleTypes);
    Proposal storage p = createProposal(_cId);

    p.from = msg.sender;
    p.action = Action.APPROVE;
    p.amount = _amount;
    p.message = _msg;
    p.arbitrators = _arbitrators;
    p.arbitratorFines = _arbitratorFines;
    p.fines = _oracleFines;
    p.oracleTypes = _oracleTypes;
    p.oracles = _oracles;
  }

  function verifyOraclesAreValid(bytes32 _cId, address[] memory _oracles, bytes32[] memory _oracleTypes) internal {
    Claim storage c = claims[_cId];

    require(
      pggConfig(c.pgg)
        .getOracles()
        .oraclesHasTypesAssigned(_oracles, _oracleTypes),
      "Some oracle types are invalid"
    );
  }

  function createProposal(bytes32 _cId) internal returns (Proposal storage p) {
    Claim storage c = claims[_cId];

    require(c.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(c.arbitrators.has(msg.sender) == true, "Arbitrator not in locked list");

    bytes32 pId = keccak256(abi.encode(_cId, block.number, msg.sender));

    require(c.proposalDetails[pId].from == address(0), "Proposal already exists");

    emit NewProposal(msg.sender, _cId, Action.APPROVE, pId);

    c.proposals.push(pId);

    // arbitrator immediately votes for the proposal
    // as we have minimum n equal 2, a brand new proposal could not be executed in this step
    _voteFor(c, pId);

    p = c.proposalDetails[pId];
  }

  /**
   * @dev Arbitrator makes reject proposal
   * @param _cId Claim ID
   */
  function proposeReject(bytes32 _cId, string calldata _msg) external {
    Claim storage c = claims[_cId];

    require(c.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(c.arbitrators.has(msg.sender) == true, "Arbitrator not in locked list");

    bytes32 pId = keccak256(abi.encode(_cId, _msg, msg.sender));
    require(c.proposalDetails[pId].from == address(0), "Proposal already exists");

    Proposal memory p;

    p.from = msg.sender;
    p.message = _msg;
    p.action = Action.REJECT;

    c.proposalDetails[pId] = p;
    c.proposals.push(pId);

    // arbitrator immediately votes for the proposal
    _voteFor(c, pId);
    // as we have minimum n equal 2, a brand new proposal could not be executed in this step

    emit NewProposal(msg.sender, _cId, Action.REJECT, pId);
  }

  /**
   * @dev Arbitrator votes for a proposal
   * @param _cId Claim ID
   * @param _pId Proposal ID
   */
  function vote(bytes32 _cId, bytes32 _pId) external {
    Claim storage c = claims[_cId];

    require(c.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(c.arbitrators.has(msg.sender) == true, "Arbitrator not in locked list");

    Proposal storage p = c.proposalDetails[_pId];

    require(p.from != address(0), "Proposal doesn't exists");

    _voteFor(c, _pId);

    if (p.votesFor.size() == c.m) {
      c.chosenProposal = _pId;
      calculateAndStoreAuditorRewards(c);

      if (p.action == Action.APPROVE) {
        changeSaleOrderStatus(c, ApplicationStatus.APPROVED);
        IPGGConfig cfg = pggConfig(c.pgg);

        cfg
          .getOracleStakes()
          .slashMultiple(p.oracles, p.oracleTypes, p.fines);

        cfg
          .getArbitratorStakes()
          .slashMultiple(p.arbitrators, p.arbitratorFines);

        c.multiSigTransactionId = cfg.getMultiSig().proposeTransaction(
          address(ggr.getGaltToken()),
          0x0,
          abi.encodeWithSelector(ERC20_TRANSFER_SIGNATURE, c.beneficiary, p.amount)
        );
      } else {
        changeSaleOrderStatus(c, ApplicationStatus.REJECTED);
      }
    }
  }

  function claimArbitratorReward(bytes32 _cId) external {
    Claim storage c = claims[_cId];

    require(
      c.status == ApplicationStatus.APPROVED || c.status == ApplicationStatus.REJECTED,
      "Application status should be APPROVED or REJECTED");
    require(c.arbitrators.has(msg.sender) == true, "Arbitrator not in locked list");
    require(c.fees.arbitratorRewardPaidOut[msg.sender] == false, "Reward already paid out");
    if (c.status == ApplicationStatus.APPROVED) {
      require(_checkMultiSigTransactionExecuted(c), "Transaction hasn't executed by multiSig yet");
    }

    c.fees.arbitratorRewardPaidOut[msg.sender] = true;

    _assignGaltProtocolFee(c);

    if (c.fees.currency == Currency.ETH) {
      msg.sender.transfer(c.fees.arbitratorReward);
    } else if (c.fees.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(msg.sender, c.fees.arbitratorReward);
    }

    emit ArbitratorRewardClaim(_cId, msg.sender);
  }

  function _assignGaltProtocolFee(Claim storage _a) internal {
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

  function pushMessage(bytes32 _cId, string calldata _text) external {
    Claim storage c = claims[_cId];

    require(c.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(c.arbitrators.has(msg.sender) == true || c.applicant == msg.sender, "Allowed only to an applicant or a arbitrator");

    uint256 id = c.messageCount;
    c.messages[id] = Message(id, block.timestamp, msg.sender, _text);
    c.messageCount = id + 1;

    emit NewMessage(_cId, id);
  }

  function _voteFor(Claim storage _c, bytes32 _pId) internal {
    Proposal storage _p = _c.proposalDetails[_pId];

    if (_c.votes[msg.sender] != 0x0) {
      _c.proposalDetails[_c.votes[msg.sender]].votesFor.remove(msg.sender);
    }

    _c.votes[msg.sender] = _pId;
    _p.votesFor.add(msg.sender);
  }

  function calculateAndStoreFee(
    Claim memory _c,
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
  function calculateAndStoreAuditorRewards (Claim storage c) internal {
    uint256 len = c.arbitrators.size();
    uint256 rewardSize = c.fees.arbitratorsReward.div(len);

    c.fees.arbitratorReward = rewardSize;
  }

  function _checkMultiSigTransactionExecuted(Claim storage c) internal returns (bool) {
    (, , , bool executed) = pggConfig(c.pgg).getMultiSig().transactions(c.multiSigTransactionId);
    return executed;
  }

  function changeSaleOrderStatus(
    Claim storage _claim,
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
      address beneficiary,
      address pgg,
      uint256 amount,
      bytes32[] memory attachedDocuments,
      address[] memory arbitrators,
      uint256 slotsTaken,
      uint256 slotsThreshold,
      uint256 totalSlots,
      uint256 multiSigTransactionId,
      uint256 createdAt,
      ApplicationStatus status
    )
  {
    Claim storage c = claims[_cId];

    return (
      c.applicant,
      c.beneficiary,
      c.pgg,
      c.amount,
      c.attachedDocuments,
      c.arbitrators.elements(),
      c.arbitrators.size(),
      c.m,
      c.n,
      c.multiSigTransactionId,
      c.createdAt,
      c.status
    );
  }

  function getClaimFees(
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
    FeeDetails storage f = claims[_cId].fees;

    return (
      f.currency,
      f.arbitratorsReward,
      f.galtProtocolFee,
      f.arbitratorReward
    );
  }

  function getMessageCount(bytes32 _cId) external view returns (uint256) {
    return claims[_cId].messageCount;
  }

  function getProposals(bytes32 _cId) external view returns (bytes32[] memory) {
    return claims[_cId].proposals;
  }

  function getMessage(
    bytes32 _cId,
    uint256 _mId
  )
    external
    view
    returns (
      uint256 timestamp,
      address from,
      string memory text
    )
  {
    Message storage message = claims[_cId].messages[_mId];

    return (
      message.timestamp,
      message.from,
      message.text
    );
  }

  /*
   * @dev Get Proposal ID the arbitrator voted for
   * @param _cId Claim ID
   * @param _v arbitrator address
   */
  function getVotedFor(bytes32 _cId, address _v) external view returns (bytes32) {
    return claims[_cId].votes[_v];
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
      string memory message,
      address[] memory oracles,
      bytes32[] memory oracleTypes,
      uint256[] memory oracleFines,
      address[] memory arbitrators,
      uint256[] memory arbitratorFines
    )
  {
    Proposal storage p = claims[_cId].proposalDetails[_pId];

    return (
      p.action,
      p.from,
      p.message,
      p.oracles,
      p.oracleTypes,
      p.fines,
      p.arbitrators,
      p.arbitratorFines
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
    Proposal storage p = claims[_cId].proposalDetails[_pId];

    return (
      p.votesFor.size(),
      p.votesFor.elements()
    );
  }
}
