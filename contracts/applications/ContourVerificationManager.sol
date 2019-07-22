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

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "../registries/GaltGlobalRegistry.sol";
import "../registries/ContourVerificationSourceRegistry.sol";
import "../registries/interfaces/IFeeRegistry.sol";
import "../applications/interfaces/IContourModifierApplication.sol";
import "../ContourVerifiers.sol";
import "./AbstractApplication.sol";


contract ContourVerificationManager is OwnableAndInitializable, AbstractApplication {
  using SafeMath for uint256;

  bytes32 public constant FEE_KEY = bytes32("CONTOUR_VERIFICATION");

  event SetRequiredConfirmations(uint256 requiredConfirmations);
  event SetApprovalTimeout(uint256 approvalTimeout);
  event ClaimVerifierApprovalReward(uint256 indexed applicationId, address indexed operator, address indexed verifier);
  event GaltProtocolRewardAssigned(uint256 indexed applicationId);

  enum Action {
    ADD,
    REMOVE
  }

  enum Status {
    NULL,
    PENDING,
    APPROVAL_TIMEOUT,
    APPROVED,
    REJECTED
  }

  struct Application {
    Status status;
    address applicationContract;
    bytes32 externalApplicationId;
    uint256 approvalTimeoutInitiatedAt;
    address[] validators;
    mapping(address => bool) validatorVoted;
    Action action;
    uint256 requiredConfirmations;
    uint256 approvalCount;
    uint256 rejectionCount;

    Rewards rewards;
    Currency currency;
  }

  struct Rewards {
    uint256 totalPaidFee;
    uint256 verifiersReward;
    uint256 verifierReward;
    uint256 galtProtocolReward;
    bool galtProtocolRewardPaidOut;
    mapping(address => bool) verifierRewardPaidOut;
  }

  uint256 public requiredConfirmations;
  uint256 public approvalTimeout;

  mapping(uint256 => Application) internal verificationQueue;

  // .......(TAIL)....queue.....(HEAD) ->
  // contour id for a new pushed contour
  uint256 public head;
  // current contour id to be reviewed by oracles
  uint256 public tail;

  modifier onlyValidContourVerifier(address _verifier) {
    require(
      ContourVerifiers(ggr.getContourVerifiersAddress()).isVerifierValid(_verifier, msg.sender),
      "Invalid operator"
    );

    _;
  }

  constructor () public {}

  function initialize(
    GaltGlobalRegistry _ggr
  )
    public
    isInitializer
  {
    ggr = _ggr;
  }

  function initialize(
    GaltGlobalRegistry _ggr,
    uint256 _requiredConfirmations,
    uint256 _approvalTimeout
  )
    external
    isInitializer
  {
    ggr = _ggr;
    requiredConfirmations = _requiredConfirmations;
    approvalTimeout = _approvalTimeout;
  }

  // OWNER INTERFACE

  function setRequiredConfirmations(uint256 _requiredConfirmations) external onlyOwner {
    requiredConfirmations = _requiredConfirmations;
    emit SetRequiredConfirmations(_requiredConfirmations);
  }

  function setApprovalTimeout(uint256 _approvalTimeout) external onlyOwner {
    approvalTimeout = _approvalTimeout;
    emit SetApprovalTimeout(_approvalTimeout);
  }

  // USER INTERFACE

  function submit(address _applicationContract, bytes32 _externalApplicationId) external {
    ContourVerificationSourceRegistry(ggr.getContourVerificationSourceRegistryAddress())
      .requireValid(_applicationContract);
    IContourModifierApplication(_applicationContract).isCVApplicationPending(_externalApplicationId);

    uint256 id = head;
    head += 1;

    Application storage a = verificationQueue[id];
    require(a.status == Status.NULL, "Application already exists");

    _acceptPayment(a);

    a.status = Status.PENDING;
    a.applicationContract = _applicationContract;
    a.externalApplicationId = _externalApplicationId;
    a.requiredConfirmations = requiredConfirmations;
  }

  function approve(uint256 _id, address _verifier) external onlyValidContourVerifier(_verifier) {
    Application storage a = verificationQueue[_id];

    uint256 currentId = tail;

    require(_id == currentId, "ID mismatches with the current");
    require(a.status == Status.PENDING, "Expect PENDING status");
    require(a.validatorVoted[_verifier] == false, "Operator has already verified the contour");

    a.validatorVoted[_verifier] = true;
    a.validators.push(_verifier);
    a.approvalCount += 1;

    if (a.approvalCount == a.requiredConfirmations) {
      a.status = Status.APPROVAL_TIMEOUT;
      a.approvalTimeoutInitiatedAt = block.timestamp;
      tail += 1;
    }
  }

  function pushApproval(uint256 _id) external {
    Application storage a = verificationQueue[_id];

    require(a.status == Status.APPROVAL_TIMEOUT, "Expect APPROVAL_TIMEOUT status");
    require(a.approvalTimeoutInitiatedAt.add(approvalTimeout) < block.timestamp, "Expect APPROVAL_TIMEOUT status");

    a.status = Status.APPROVED;

    IContourModifierApplication(a.applicationContract).cvApprove(a.externalApplicationId);
  }

  function reject(uint256 _id, address _verifier) external onlyValidContourVerifier(_verifier) {
    // TODO: requires proof
    Application storage a = verificationQueue[_id];

    uint256 currentId = tail;

    require(_id == currentId, "ID mismatches with the current");
    require(a.status == Status.PENDING, "Expect PENDING status");
    require(a.validatorVoted[msg.sender] == false, "Operator has already verified the contour");

    a.validatorVoted[msg.sender] = true;
    a.validators.push(msg.sender);
    a.rejectionCount += 1;

    a.status = Status.REJECTED;
    tail += 1;
  }

  function claimVerifierApprovalReward(uint256 _id, address _verifier) external onlyValidContourVerifier(_verifier) {
    Application storage a = verificationQueue[_id];
    Rewards storage r = a.rewards;

    require(a.status == Status.APPROVED, "Expect APPROVED status");
    require(r.verifierRewardPaidOut[_verifier] == false, "Reward has already paid out");
    require(a.validatorVoted[_verifier] == true, "Not voted on the application ");

    r.verifierRewardPaidOut[_verifier] = true;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(r.verifierReward);
    } else if (a.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(msg.sender, r.verifierReward);
    }

    _assignGaltProtocolReward(_id);

    emit ClaimVerifierApprovalReward(_id, msg.sender, _verifier);
  }

  function _assignGaltProtocolReward(uint256 _id) internal {
    Application storage a = verificationQueue[_id];

    if (a.rewards.galtProtocolRewardPaidOut == false) {
      if (a.currency == Currency.ETH) {
        protocolFeesEth = protocolFeesEth.add(a.rewards.galtProtocolReward);
      } else if (a.currency == Currency.GALT) {
        protocolFeesGalt = protocolFeesGalt.add(a.rewards.galtProtocolReward);
      }

      a.rewards.galtProtocolRewardPaidOut = true;
      emit GaltProtocolRewardAssigned(_id);
    }
  }

  // INTERNAL

  function _acceptPayment(Application storage _a) internal {
    uint256 fee;
    if (msg.value == 0) {
      fee = IFeeRegistry(ggr.getFeeRegistryAddress()).getGaltFeeOrRevert(FEE_KEY);
      ggr.getGaltToken().transferFrom(msg.sender, address(this), fee);
      _a.currency = Currency.GALT;
    } else {
      fee = IFeeRegistry(ggr.getFeeRegistryAddress()).getEthFeeOrRevert(FEE_KEY);
      require(msg.value == fee, "Fee and msg.value not equal");
      // a.currency = Currency.ETH; by default
    }

    _calculateAndStoreRewards(_a, fee);
  }

  function _calculateAndStoreRewards(
    Application storage _a,
    uint256 _fee
  )
    internal
  {
    uint256 share;

    // TODO: discuss where to store these values
    uint256 ethFee = 33 ether;
    uint256 galtFee = 13 ether;

    if (_a.currency == Currency.ETH) {
      share = ethFee;
    } else {
      share = galtFee;
    }

    uint256 galtProtocolReward = share.mul(_fee).div(100 ether);
    uint256 verifiersReward = _fee.sub(galtProtocolReward);

    assert(verifiersReward.add(galtProtocolReward) == _fee);

    _a.rewards.totalPaidFee = _fee;
    _a.rewards.verifiersReward = verifiersReward;
    _a.rewards.galtProtocolReward = galtProtocolReward;

    uint256 verifierReward = verifiersReward.div(requiredConfirmations);

    _a.rewards.verifierReward = verifierReward;
  }

  // GETTERS
  function paymentMethod(address _pgg) public view returns (PaymentMethod) {
    return PaymentMethod.ETH_AND_GALT;
  }

  function getApplication(uint256 _id)
    external
    view
    returns(
      Status status,
      address applicationContract,
      bytes32 externalApplicationId,
      uint256 approvalTimeoutInitiatedAt,
      Action action,
      uint256 requiredConfirmations,
      uint256 approvalCount,
      uint256 rejectionCount
    )
  {
    Application storage a = verificationQueue[_id];

    status = a.status;
    applicationContract = a.applicationContract;
    externalApplicationId = a.externalApplicationId;
    approvalTimeoutInitiatedAt = a.approvalTimeoutInitiatedAt;
    action = a.action;
    requiredConfirmations = a.requiredConfirmations;
    approvalCount = a.approvalCount;
    rejectionCount = a.rejectionCount;
  }

  function getApplicationRewards(
    uint256 _aId
  )
    external
    view
    returns (
      Currency currency,
      uint256 totalPaidFee,
      uint256 verifiersReward,
      uint256 galtProtocolReward,
      uint256 verifierReward
    )
  {
    Rewards storage r = verificationQueue[_aId].rewards;

    return (
      verificationQueue[_aId].currency,
      r.totalPaidFee,
      r.verifiersReward,
      r.galtProtocolReward,
      r.verifierReward
    );
  }

}
