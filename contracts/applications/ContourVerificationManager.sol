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
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "../registries/GaltGlobalRegistry.sol";
import "../registries/interfaces/IContourVerificationSourceRegistry.sol";
import "../registries/interfaces/IFeeRegistry.sol";
import "../applications/interfaces/IContourModifierApplication.sol";
import "../interfaces/IContourVerifiers.sol";
import "./AbstractApplication.sol";
import "./ContourVerificationManagerLib.sol";


contract ContourVerificationManager is OwnableAndInitializable, AbstractApplication {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  bytes32 public constant FEE_KEY = bytes32("CONTOUR_VERIFICATION");

  event NewApplication(uint256 indexed applicationId);
  event SetRequiredConfirmations(uint256 requiredConfirmations);
  event SetApprovalTimeout(uint256 approvalTimeout);
  event ClaimVerifierApprovalReward(uint256 indexed applicationId, address indexed operator, address indexed verifier);
  event GaltProtocolRewardAssigned(uint256 indexed applicationId);

  enum Action {
    ADD,
    MODIFY
  }

  enum Inclusion {
    VERIFYING_INSIDE_EXISTING,
    EXISTING_INSIDE_VERIFYING
  }

  enum Status {
    NULL,
    PENDING,
    APPROVAL_TIMEOUT,
    APPROVED,
    REJECTED
  }

  struct Application {
    uint256 id;
    Status status;
    address applicationContract;
    uint256 externalApplicationId;
    uint256 approvalTimeoutInitiatedAt;
    address[] approvers;
    mapping(address => bool) verifierVoted;
    Action action;
    uint256 requiredConfirmations;
    uint256 approvalCount;
    address rejecter;
    bool executed;

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
      IContourVerifiers(ggr.getContourVerifiersAddress()).isVerifierValid(_verifier, msg.sender),
      "Invalid operator"
    );

    _;
  }

  constructor () public {}

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
    require(_requiredConfirmations > 0, "Can't be 0");

    requiredConfirmations = _requiredConfirmations;
    emit SetRequiredConfirmations(_requiredConfirmations);
  }

  function setApprovalTimeout(uint256 _approvalTimeout) external onlyOwner {
    approvalTimeout = _approvalTimeout;
    emit SetApprovalTimeout(_approvalTimeout);
  }

  // USER INTERFACE

  function submit(address _applicationContract, uint256 _externalApplicationId) external payable {
    IContourVerificationSourceRegistry(ggr.getContourVerificationSourceRegistryAddress())
      .requireValid(_applicationContract);
    IContourModifierApplication(_applicationContract).isCVApplicationPending(_externalApplicationId);

    uint256 id = head;
    head += 1;

    Application storage a = verificationQueue[id];
    require(a.status == Status.NULL, "Application already exists");

    _acceptPayment(a);

    a.id = id;
    a.status = Status.PENDING;
    a.applicationContract = _applicationContract;
    a.externalApplicationId = _externalApplicationId;
    a.requiredConfirmations = requiredConfirmations;

    emit NewApplication(id);
  }

  function approve(
    uint256 _aId,
    address _verifier
  )
    external
    onlyValidContourVerifier(_verifier)
  {
    Application storage a = verificationQueue[_aId];

    eligibleForCastingDecision(_aId, _verifier);

    a.verifierVoted[_verifier] = true;
    a.approvers.push(_verifier);
    a.approvalCount += 1;

    if (a.approvalCount == a.requiredConfirmations) {
      a.status = Status.APPROVAL_TIMEOUT;
      a.approvalTimeoutInitiatedAt = block.timestamp;
      tail += 1;
      _calculateAndStoreApprovalRewards(a);
    }
  }

  function pushApproval(uint256 _aId) external {
    Application storage a = verificationQueue[_aId];

    require(a.status == Status.APPROVAL_TIMEOUT, "Expect APPROVAL_TIMEOUT status");
    require(a.executed == false, "Already executed");
    require(
      a.approvalTimeoutInitiatedAt.add(approvalTimeout) < block.timestamp,
      "Timeout period has not passed yet"
    );

    a.status = Status.APPROVED;
    a.executed = true;

    IContourModifierApplication(a.applicationContract).cvApprove(a.externalApplicationId);
  }

  function pushRejection(uint256 _aId) external {
    Application storage a = verificationQueue[_aId];

    require(a.status == Status.REJECTED, "Expect REJECTED status");
    require(a.executed == false, "Already executed");
    a.executed = true;

    IContourModifierApplication(a.applicationContract).cvReject(a.externalApplicationId);
  }

  // Existing token intersection proofs

  // e-is-r
  function rejectWithExistingContourIntersectionProof(
    uint256 _aId,
    address _verifier,
    uint256 _existingTokenId,
    uint256 _existingContourSegmentFirstPointIndex,
    uint256 _existingContourSegmentFirstPoint,
    uint256 _existingContourSegmentSecondPoint,
    uint256 _verifyingContourSegmentFirstPointIndex,
    uint256 _verifyingContourSegmentFirstPoint,
    uint256 _verifyingContourSegmentSecondPoint
  )
    external
    onlyValidContourVerifier(_verifier)
  {
    eligibleForCastingDecision(_aId, _verifier);

    Application storage a = verificationQueue[_aId];

    ContourVerificationManagerLib.denyWithExistingContourIntersectionProof(
      ggr,
      a,
      _verifier,
      _existingTokenId,
      _existingContourSegmentFirstPointIndex,
      _existingContourSegmentFirstPoint,
      _existingContourSegmentSecondPoint,
      _verifyingContourSegmentFirstPointIndex,
      _verifyingContourSegmentFirstPoint,
      _verifyingContourSegmentSecondPoint
    );

    _executeReject(_aId, _verifier);
  }

  // e-is-f
  function reportInvalidApprovalWithExistingContourIntersectionProof(
    uint256 _aId,
    uint256 _existingTokenId,
    uint256 _existingContourSegmentFirstPointIndex,
    uint256 _existingContourSegmentFirstPoint,
    uint256 _existingContourSegmentSecondPoint,
    uint256 _verifyingContourSegmentFirstPointIndex,
    uint256 _verifyingContourSegmentFirstPoint,
    uint256 _verifyingContourSegmentSecondPoint
  )
    external
  {
    Application storage a = verificationQueue[_aId];

    require(
      a.status == Status.APPROVAL_TIMEOUT,
      "Expect APPROVAL_TIMEOUT status"
    );

    ContourVerificationManagerLib.denyWithExistingContourIntersectionProof(
      ggr,
      a,
      msg.sender,
      _existingTokenId,
      _existingContourSegmentFirstPointIndex,
      _existingContourSegmentFirstPoint,
      _existingContourSegmentSecondPoint,
      _verifyingContourSegmentFirstPointIndex,
      _verifyingContourSegmentFirstPoint,
      _verifyingContourSegmentSecondPoint
    );

    _executeReject(_aId, msg.sender);
  }

  // Existing token inclusion proofs

  // e-in-r
  function rejectWithExistingPointInclusionProof(
    uint256 _aId,
    address _verifier,
    Inclusion _inclusion,
    uint256 _existingTokenId,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
    onlyValidContourVerifier(_verifier)
  {
    eligibleForCastingDecision(_aId, _verifier);

    Application storage a = verificationQueue[_aId];

    ContourVerificationManagerLib.denyWithExistingPointInclusionProof(
      ggr,
      a,
      _inclusion,
      _verifier,
      _existingTokenId,
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );

    _executeReject(_aId, _verifier);
  }

  // e-in-f
  function reportInvalidApprovalWithExistingPointInclusionProof(
    uint256 _aId,
    uint256 _existingTokenId,
    Inclusion _inclusion,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
  {
    Application storage a = verificationQueue[_aId];

    require(
      a.status == Status.APPROVAL_TIMEOUT,
      "Expect APPROVAL_TIMEOUT status"
    );

    ContourVerificationManagerLib.denyWithExistingPointInclusionProof(
      ggr,
      a,
      _inclusion,
      msg.sender,
      _existingTokenId,
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );

    _executeReject(_aId, msg.sender);
  }

  // Application approved token intersection proofs

  // aa-is-r
  function rejectWithApplicationApprovedContourIntersectionProof(
    uint256 _aId,
    address _verifier,
    address _applicationContract,
    uint256 _externalApplicationId,
    uint256 _existingContourSegmentFirstPointIndex,
    uint256 _existingContourSegmentFirstPoint,
    uint256 _existingContourSegmentSecondPoint,
    uint256 _verifyingContourSegmentFirstPointIndex,
    uint256 _verifyingContourSegmentFirstPoint,
    uint256 _verifyingContourSegmentSecondPoint
  )
    external
    onlyValidContourVerifier(_verifier)
  {
    eligibleForCastingDecision(_aId, _verifier);

    Application storage a = verificationQueue[_aId];

    ContourVerificationManagerLib.denyWithApplicationApprovedContourIntersectionProof(
      ggr,
      a,
      _verifier,
      _applicationContract,
      _externalApplicationId,
      _existingContourSegmentFirstPointIndex,
      _existingContourSegmentFirstPoint,
      _existingContourSegmentSecondPoint,
      _verifyingContourSegmentFirstPointIndex,
      _verifyingContourSegmentFirstPoint,
      _verifyingContourSegmentSecondPoint
    );

    _executeReject(_aId, _verifier);
  }

  // aa-is-f
  function reportInvalidApprovalWithApplicationApprovedContourIntersectionProof(
    uint256 _aId,
    address _applicationContract,
    uint256 _externalApplicationId,
    uint256 _existingContourSegmentFirstPointIndex,
    uint256 _existingContourSegmentFirstPoint,
    uint256 _existingContourSegmentSecondPoint,
    uint256 _verifyingContourSegmentFirstPointIndex,
    uint256 _verifyingContourSegmentFirstPoint,
    uint256 _verifyingContourSegmentSecondPoint
  )
    external
  {
    Application storage a = verificationQueue[_aId];

    require(
      a.status == Status.APPROVAL_TIMEOUT,
      "Expect APPROVAL_TIMEOUT status"
    );

    ContourVerificationManagerLib.denyWithApplicationApprovedContourIntersectionProof(
      ggr,
      a,
      msg.sender,
      _applicationContract,
      _externalApplicationId,
      _existingContourSegmentFirstPointIndex,
      _existingContourSegmentFirstPoint,
      _existingContourSegmentSecondPoint,
      _verifyingContourSegmentFirstPointIndex,
      _verifyingContourSegmentFirstPoint,
      _verifyingContourSegmentSecondPoint
    );

    _executeReject(_aId, msg.sender);
  }

  // Application approved token inclusion proofs

  // aa-in-r
  function rejectWithApplicationApprovedPointInclusionProof(
    uint256 _aId,
    address _verifier,
    Inclusion _inclusion,
    address _applicationContract,
    uint256 _externalApplicationId,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
    onlyValidContourVerifier(_verifier)
  {
    eligibleForCastingDecision(_aId, _verifier);

    Application storage a = verificationQueue[_aId];

    ContourVerificationManagerLib.denyWithApplicationApprovedPointInclusionProof(
      ggr,
      a,
      _inclusion,
      _verifier,
      _applicationContract,
      _externalApplicationId,
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );

    _executeReject(_aId, _verifier);
  }

  // aa-in-f
  function reportInvalidApprovalWithApplicationApprovedPointInclusionProof(
    uint256 _aId,
    Inclusion _inclusion,
    address _applicationContract,
    uint256 _externalApplicationId,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
  {
    Application storage a = verificationQueue[_aId];

    require(
      a.status == Status.APPROVAL_TIMEOUT,
      "Expect APPROVAL_TIMEOUT status"
    );

    ContourVerificationManagerLib.denyWithApplicationApprovedPointInclusionProof(
      ggr,
      a,
      _inclusion,
      msg.sender,
      _applicationContract,
      _externalApplicationId,
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );

    _executeReject(_aId, msg.sender);
  }

  // Approved (TIMEOUT) token intersection proofs

  // at-is-r
  function rejectWithApplicationApprovedTimeoutContourIntersectionProof(
    uint256 _aId,
    address _verifier,
    uint256 _existingCVApplicationId,
    uint256 _existingContourSegmentFirstPointIndex,
    uint256 _existingContourSegmentFirstPoint,
    uint256 _existingContourSegmentSecondPoint,
    uint256 _verifyingContourSegmentFirstPointIndex,
    uint256 _verifyingContourSegmentFirstPoint,
    uint256 _verifyingContourSegmentSecondPoint
  )
    external
    onlyValidContourVerifier(_verifier)
  {
    eligibleForCastingDecision(_aId, _verifier);

    Application storage a = verificationQueue[_aId];
    Application storage existingA = verificationQueue[_existingCVApplicationId];

    ContourVerificationManagerLib.denyWithApplicationApprovedTimeoutContourIntersectionProof(
      a,
      existingA,
      _verifier,
      _existingCVApplicationId,
      _existingContourSegmentFirstPointIndex,
      _existingContourSegmentFirstPoint,
      _existingContourSegmentSecondPoint,
      _verifyingContourSegmentFirstPointIndex,
      _verifyingContourSegmentFirstPoint,
      _verifyingContourSegmentSecondPoint
    );

    _executeReject(_aId, _verifier);
  }

  // at-is-f
  function reportInvalidApprovalWithApplicationApprovedTimeoutContourIntersectionProof(
    uint256 _aId,
    uint256 _existingCVApplicationId,
    uint256 _existingContourSegmentFirstPointIndex,
    uint256 _existingContourSegmentFirstPoint,
    uint256 _existingContourSegmentSecondPoint,
    uint256 _verifyingContourSegmentFirstPointIndex,
    uint256 _verifyingContourSegmentFirstPoint,
    uint256 _verifyingContourSegmentSecondPoint
  )
    external
  {
    Application storage a = verificationQueue[_aId];
    Application storage existingA = verificationQueue[_existingCVApplicationId];

    require(
      a.status == Status.APPROVAL_TIMEOUT,
      "Expect APPROVAL_TIMEOUT status for reporting application"
    );
    require(
      _existingCVApplicationId < _aId,
      "Existing application ID should be less than reporting ID"
    );

    ContourVerificationManagerLib.denyWithApplicationApprovedTimeoutContourIntersectionProof(
      a,
      existingA,
      msg.sender,
      _existingCVApplicationId,
      _existingContourSegmentFirstPointIndex,
      _existingContourSegmentFirstPoint,
      _existingContourSegmentSecondPoint,
      _verifyingContourSegmentFirstPointIndex,
      _verifyingContourSegmentFirstPoint,
      _verifyingContourSegmentSecondPoint
    );

    _executeReject(_aId, msg.sender);
  }

  // Approved (TIMEOUT) token inclusion proofs

  // at-in-r
  function rejectWithApplicationApprovedTimeoutPointInclusionProof(
    uint256 _aId,
    address _verifier,
    Inclusion _inclusion,
    uint256 _existingCVApplicationId,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
    onlyValidContourVerifier(_verifier)
  {
    eligibleForCastingDecision(_aId, _verifier);

    Application storage a = verificationQueue[_aId];
    Application storage existingA = verificationQueue[_existingCVApplicationId];

    ContourVerificationManagerLib.denyInvalidApprovalWithApplicationApprovedTimeoutPointInclusionProof(
      a,
      existingA,
      _inclusion,
      _verifier,
      _existingCVApplicationId,
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );

    _executeReject(_aId, _verifier);
  }

  // at-in-f
  function reportInvalidApprovalWithApplicationApprovedTimeoutPointInclusionProof(
    uint256 _aId,
    Inclusion _inclusion,
    uint256 _existingCVApplicationId,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
  {
    Application storage a = verificationQueue[_aId];
    Application storage existingA = verificationQueue[_existingCVApplicationId];

    require(
      a.status == Status.APPROVAL_TIMEOUT,
      "Expect APPROVAL_TIMEOUT status for reporting application"
    );
    require(
      _existingCVApplicationId < _aId,
      "Existing application ID should be less than reporting ID"
    );

    ContourVerificationManagerLib.denyInvalidApprovalWithApplicationApprovedTimeoutPointInclusionProof(
      a,
      existingA,
      _inclusion,
      msg.sender,
      _existingCVApplicationId,
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );

    _executeReject(_aId, msg.sender);
  }

  function eligibleForCastingDecision(uint256 _aId, address _verifier) internal {
    Application storage a = verificationQueue[_aId];

    require(_aId == tail, "ID mismatches with the current");
    require(a.status == Status.PENDING, "Expect PENDING status");
    require(a.verifierVoted[_verifier] == false, "Operator has already verified the contour");
  }

  function _executeReject(uint256 _aId, address _verifier) internal {
    Application storage a = verificationQueue[_aId];

    a.verifierVoted[_verifier] = true;
    a.rejecter = _verifier;
    a.status = Status.REJECTED;
    tail += 1;

    _executeSlashing(a, _verifier);
    _calculateAndStoreRejectionRewards(a);
  }

  function claimVerifierApprovalReward(uint256 _aId, address payable _verifier) external onlyValidContourVerifier(_verifier) {
    Application storage a = verificationQueue[_aId];
    Rewards storage r = a.rewards;

    require(a.status == Status.APPROVED, "Expect APPROVED status");
    require(r.verifierRewardPaidOut[_verifier] == false, "Reward has already paid out");
    require(a.verifierVoted[_verifier] == true, "Not voted on the application ");

    r.verifierRewardPaidOut[_verifier] = true;

    _calculateAndStoreApprovalRewards(a);
    _assignGaltProtocolReward(_aId);

    if (a.currency == Currency.ETH) {
      _verifier.transfer(r.verifierReward);
    } else if (a.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(_verifier, r.verifierReward);
    }

    emit ClaimVerifierApprovalReward(_aId, msg.sender, _verifier);
  }

  function claimVerifierRejectionReward(uint256 _aId, address payable _verifier) external onlyValidContourVerifier(_verifier) {
    Application storage a = verificationQueue[_aId];
    Rewards storage r = a.rewards;

    require(a.status == Status.REJECTED, "Expect REJECTED status");
    require(r.verifierRewardPaidOut[_verifier] == false, "Reward has already paid out");
    require(a.verifierVoted[_verifier] == true, "Not voted on the application ");
    require(a.rejecter == _verifier, "Only rejecter allowed ");

    r.verifierRewardPaidOut[_verifier] = true;

    _calculateAndStoreRejectionRewards(a);
    _assignGaltProtocolReward(_aId);

    if (a.currency == Currency.ETH) {
      _verifier.transfer(r.verifierReward);
    } else if (a.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(_verifier, r.verifierReward);
    }

    emit ClaimVerifierApprovalReward(_aId, msg.sender, _verifier);
  }

  // INTERNAL

  function _assignGaltProtocolReward(uint256 _aId) internal {
    Application storage a = verificationQueue[_aId];

    if (a.rewards.galtProtocolRewardPaidOut == false) {
      if (a.currency == Currency.ETH) {
        protocolFeesEth = protocolFeesEth.add(a.rewards.galtProtocolReward);
      } else if (a.currency == Currency.GALT) {
        protocolFeesGalt = protocolFeesGalt.add(a.rewards.galtProtocolReward);
      }

      a.rewards.galtProtocolRewardPaidOut = true;
      emit GaltProtocolRewardAssigned(_aId);
    }
  }

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

    _parseFee(_a, fee);
  }

  function _parseFee(
    Application storage _a,
    uint256 _fee
  )
    internal
  {
    uint256 share;

    (uint256 ethFee, uint256 galtFee) = getProtocolShares();

    if (_a.currency == Currency.ETH) {
      share = ethFee;
    } else {
      share = galtFee;
    }

    uint256 galtProtocolReward = share.mul(_fee).div(100);
    uint256 verifiersReward = _fee.sub(galtProtocolReward);

    assert(verifiersReward.add(galtProtocolReward) == _fee);

    _a.rewards.totalPaidFee = _fee;
    _a.rewards.verifiersReward = verifiersReward;
    _a.rewards.galtProtocolReward = galtProtocolReward;
  }

  function _calculateAndStoreApprovalRewards(
    Application storage _a
  )
    internal
  {
    _a.rewards.verifierReward = _a.rewards.verifiersReward.div(_a.requiredConfirmations);
  }

  function _calculateAndStoreRejectionRewards(
    Application storage _a
  )
    internal
  {
    // An account who was able to invoke and prove the reject receives all the reward
    _a.rewards.verifierReward = _a.rewards.verifiersReward;
  }

  function _executeSlashing(
    Application storage _a,
    address _verifier
  )
    internal
  {
    IContourVerifiers(ggr.getContourVerifiersAddress()).slash(_a.approvers, _verifier);
  }

  // GETTERS

  function checkVerticalIntersects(
    uint256 _aId,
    uint256[] calldata _existingContour,
    int256 _eHP
  )
    external
    view
    returns (bool)
  {
    return ContourVerificationManagerLib.checkForRoomVerticalIntersection(verificationQueue[_aId], _existingContour, _eHP);
  }

  function isSelfUpdateCase(uint256 _aId, uint256 _existingTokenId) public view returns (bool) {
    return ContourVerificationManagerLib.isSelfUpdateCase(verificationQueue[_aId], _existingTokenId);
  }

  function paymentMethod(address _pgg) public view returns (PaymentMethod) {
    return PaymentMethod.ETH_AND_GALT;
  }

  function getApplication(uint256 _aId)
    external
    view
    returns(
      Status status,
      address applicationContract,
      uint256 externalApplicationId,
      uint256 approvalTimeoutInitiatedAt,
      Action action,
      uint256 requiredApprovals,
      uint256 approvalCount
    )
  {
    Application storage a = verificationQueue[_aId];

    status = a.status;
    applicationContract = a.applicationContract;
    externalApplicationId = a.externalApplicationId;
    approvalTimeoutInitiatedAt = a.approvalTimeoutInitiatedAt;
    action = a.action;
    requiredApprovals = a.requiredConfirmations;
    approvalCount = a.approvalCount;
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
