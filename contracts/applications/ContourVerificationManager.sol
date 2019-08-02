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
import "@galtproject/geodesic/contracts/utils/SegmentUtils.sol";
import "@galtproject/geodesic/contracts/utils/LandUtils.sol";
import "@galtproject/geodesic/contracts/utils/PolygonUtils.sol";
import "../registries/GaltGlobalRegistry.sol";
import "../registries/ContourVerificationSourceRegistry.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "../registries/interfaces/IFeeRegistry.sol";
import "../applications/interfaces/IContourModifierApplication.sol";
import "../ContourVerifiers.sol";
import "./AbstractApplication.sol";


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
    address[] approvers;
    mapping(address => bool) verifierVoted;
    Action action;
    uint256 requiredConfirmations;
    uint256 approvalCount;
    address rejecter;

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

    emit NewApplication(id);
  }

  function approve(
    uint256 _id,
    address _verifier
  )
    external
    onlyValidContourVerifier(_verifier)
  {
    Application storage a = verificationQueue[_id];

    eligibleForCastingDecision(_id, _verifier);

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

  function pushApproval(uint256 _id) external {
    Application storage a = verificationQueue[_id];

    require(a.status == Status.APPROVAL_TIMEOUT, "Expect APPROVAL_TIMEOUT status");
    require(a.approvalTimeoutInitiatedAt.add(approvalTimeout) < block.timestamp, "Expect APPROVAL_TIMEOUT status");

    a.status = Status.APPROVED;

    IContourModifierApplication(a.applicationContract).cvApprove(a.externalApplicationId);
  }

  function rejectWithExistingContourIntersectionProof(
    uint256 _id,
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
    Application storage a = verificationQueue[_id];

    eligibleForCastingDecision(_id, _verifier);

    require(isSelfUpdateCase(_id, _existingTokenId) == false, "Cant' reject self-update action");

    uint256[] memory existingTokenContour = ISpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress()).getSpaceTokenContour(_existingTokenId);
    bool intersects = _checkContourIntersects(
      _id,
      existingTokenContour,
      _existingContourSegmentFirstPointIndex,
      _existingContourSegmentFirstPoint,
      _existingContourSegmentSecondPoint,
      _verifyingContourSegmentFirstPointIndex,
      _verifyingContourSegmentFirstPoint,
      _verifyingContourSegmentSecondPoint
    );
    require(intersects == true, "Contours don't intersect");

    _executeReject(_id, _verifier);
  }

  function rejectWithApplicationApprovedContourIntersectionProof(
    uint256 _id,
    address _verifier,
    address _applicationContract,
    bytes32 _externalApplicationId,
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
    Application storage a = verificationQueue[_id];

    eligibleForCastingDecision(_id, _verifier);

    ContourVerificationSourceRegistry(ggr.getContourVerificationSourceRegistryAddress())
      .requireValid(_applicationContract);
    IContourModifierApplication applicationContract = IContourModifierApplication(_applicationContract);
    require(applicationContract.isCVApplicationApproved(_externalApplicationId), "Not in CVApplicationApproved list");

    require(_checkContourIntersects(
      _id,
      applicationContract.getCVContour(_externalApplicationId),
      _existingContourSegmentFirstPointIndex,
      _existingContourSegmentFirstPoint,
      _existingContourSegmentSecondPoint,
      _verifyingContourSegmentFirstPointIndex,
      _verifyingContourSegmentFirstPoint,
      _verifyingContourSegmentSecondPoint
    ), "Contours don't intersect");

    _executeReject(_id, _verifier);
  }

  function rejectWithApplicationApprovedTimeoutContourIntersectionProof(
    uint256 _id,
    address _verifier,
    address _applicationContract,
    uint256 _existingApplicationId,
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
    Application storage a = verificationQueue[_id];
    Application storage existingA = verificationQueue[_existingApplicationId];

    eligibleForCastingDecision(_id, _verifier);

    require(existingA.status == Status.APPROVAL_TIMEOUT, "Expect APPROVAL_TIMEOUT status for existing application");

    require(_checkContourIntersects(
        _id,
        IContourModifierApplication(_applicationContract).getCVContour(existingA.externalApplicationId),
        _existingContourSegmentFirstPointIndex,
        _existingContourSegmentFirstPoint,
        _existingContourSegmentSecondPoint,
        _verifyingContourSegmentFirstPointIndex,
        _verifyingContourSegmentFirstPoint,
        _verifyingContourSegmentSecondPoint
      ), "Contours don't intersect");

    _executeReject(_id, _verifier);
  }

  function rejectWithExistingPointInclusionProof(
    uint256 _id,
    address _verifier,
    uint256 _existingTokenId,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
    onlyValidContourVerifier(_verifier)
  {
    Application storage a = verificationQueue[_id];

    eligibleForCastingDecision(_id, _verifier);

    require(isSelfUpdateCase(_id, _existingTokenId) == false, "Cant' reject self-update action");

    // Existing Token
    uint256[] memory existingTokenContour = ISpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress())
      .getSpaceTokenContour(_existingTokenId);

    bool isInside = _checkPointInsideContour(
      _id,
      existingTokenContour,
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );
    require(isInside == true, "Existing contour doesn't include verifying");

    _executeReject(_id, _verifier);
  }

  function rejectWithApplicationApprovedPointInclusionProof(
    uint256 _id,
    address _verifier,
    address _applicationContract,
    bytes32 _externalApplicationId,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
    onlyValidContourVerifier(_verifier)
  {
    Application storage a = verificationQueue[_id];

    eligibleForCastingDecision(_id, _verifier);

    ContourVerificationSourceRegistry(ggr.getContourVerificationSourceRegistryAddress())
      .requireValid(_applicationContract);
    IContourModifierApplication applicationContract = IContourModifierApplication(_applicationContract);
    require(applicationContract.isCVApplicationApproved(_externalApplicationId), "Not in CVApplicationApproved list");

    bool isInside = _checkPointInsideContour(
      _id,
      applicationContract.getCVContour(_externalApplicationId),
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );
    require(isInside == true, "Existing contour doesn't include verifying");

    _executeReject(_id, _verifier);
  }

  function rejectWithApplicationApprovedTimeoutPointInclusionProof(
    uint256 _id,
    address _verifier,
    address _applicationContract,
    uint256 _existingApplicationId,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
    onlyValidContourVerifier(_verifier)
  {
    Application storage a = verificationQueue[_id];
    Application storage existingA = verificationQueue[_existingApplicationId];

    eligibleForCastingDecision(_id, _verifier);

    require(existingA.status == Status.APPROVAL_TIMEOUT, "Expect APPROVAL_TIMEOUT status for existing application");

    bool isInside = _checkPointInsideContour(
      _id,
      IContourModifierApplication(_applicationContract).getCVContour(existingA.externalApplicationId),
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );
    require(isInside == true, "Existing contour doesn't include verifying");

    _executeReject(_id, _verifier);
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

  function _checkContourIntersects(
    uint256 _id,
    uint256[] memory _existingTokenContour,
    uint256 _existingContourSegmentFirstPointIndex,
    uint256 _existingContourSegmentFirstPoint,
    uint256 _existingContourSegmentSecondPoint,
    uint256 _verifyingContourSegmentFirstPointIndex,
    uint256 _verifyingContourSegmentFirstPoint,
    uint256 _verifyingContourSegmentSecondPoint
  )
    internal
    returns (bool)
  {
    Application storage a = verificationQueue[_id];

    // Existing Token
    require(
      _contourHasSegment(
        _existingContourSegmentFirstPointIndex,
        _existingContourSegmentFirstPoint,
        _existingContourSegmentSecondPoint,
        _existingTokenContour
      ),
      "Invalid segment for existing token"
    );

    // Verifying Token
    IContourModifierApplication applicationContract = IContourModifierApplication(a.applicationContract);

    applicationContract.isCVApplicationPending(a.externalApplicationId);
    uint256[] memory verifyingTokenContour = applicationContract.getCVContour(a.externalApplicationId);

    require(
      _contourHasSegment(
        _verifyingContourSegmentFirstPointIndex,
        _verifyingContourSegmentFirstPoint,
        _verifyingContourSegmentSecondPoint,
        verifyingTokenContour
      ),
      "Invalid segment for verifying token"
    );

    return SegmentUtils.segmentsIntersect(
      getLatLonSegment(_existingContourSegmentFirstPoint, _existingContourSegmentSecondPoint),
      getLatLonSegment(_verifyingContourSegmentFirstPoint, _verifyingContourSegmentSecondPoint)
    );
  }

  function _checkPointInsideContour(
    uint256 _id,
    uint256[] memory _existingTokenContour,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    internal
    returns (bool)
  {
    Application storage a = verificationQueue[_id];

    // Verifying Token
    IContourModifierApplication applicationContract = IContourModifierApplication(a.applicationContract);

    applicationContract.isCVApplicationPending(a.externalApplicationId);
    uint256[] memory verifyingTokenContour = applicationContract.getCVContour(a.externalApplicationId);

    require(
      verifyingTokenContour[_verifyingContourPointIndex] == _verifyingContourPoint,
      "Invalid point of verifying token"
    );

    return PolygonUtils.isInsideWithoutCache(_verifyingContourPoint, _existingTokenContour);
  }

  function _contourHasSegment(
    uint256 _firstPointIndex,
    uint256 _firstPoint,
    uint256 _secondPoint,
    uint256[] memory _contour
  )
    internal
    returns (bool)
  {
    uint256 len = _contour.length;
    require(len > 0, "Empty contour");
    require(_firstPointIndex < len, "Invalid existing coord index");

    if(_contour[_firstPointIndex] != _firstPoint) {
      return false;
    }

    uint256 secondPointIndex = _firstPointIndex + 1;
    if (secondPointIndex == len) {
      secondPointIndex = 0;
    }

    if(_contour[secondPointIndex] != _secondPoint) {
      return false;
    }

    return true;
  }

  function claimVerifierApprovalReward(uint256 _id, address payable _verifier) external onlyValidContourVerifier(_verifier) {
    Application storage a = verificationQueue[_id];
    Rewards storage r = a.rewards;

    require(a.status == Status.APPROVED, "Expect APPROVED status");
    require(r.verifierRewardPaidOut[_verifier] == false, "Reward has already paid out");
    require(a.verifierVoted[_verifier] == true, "Not voted on the application ");

    r.verifierRewardPaidOut[_verifier] = true;

    _calculateAndStoreApprovalRewards(a);
    _assignGaltProtocolReward(_id);

    if (a.currency == Currency.ETH) {
      _verifier.transfer(r.verifierReward);
    } else if (a.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(_verifier, r.verifierReward);
    }

    emit ClaimVerifierApprovalReward(_id, msg.sender, _verifier);
  }

  function claimVerifierRejectionReward(uint256 _id, address payable _verifier) external onlyValidContourVerifier(_verifier) {
    Application storage a = verificationQueue[_id];
    Rewards storage r = a.rewards;

    require(a.status == Status.REJECTED, "Expect REJECTED status");
    require(r.verifierRewardPaidOut[_verifier] == false, "Reward has already paid out");
    require(a.verifierVoted[_verifier] == true, "Not voted on the application ");
    require(a.rejecter == _verifier, "Only rejecter allowed ");

    r.verifierRewardPaidOut[_verifier] = true;

    _calculateAndStoreRejectionRewards(a);
    _assignGaltProtocolReward(_id);

    if (a.currency == Currency.ETH) {
      _verifier.transfer(r.verifierReward);
    } else if (a.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(_verifier, r.verifierReward);
    }

    emit ClaimVerifierApprovalReward(_id, msg.sender, _verifier);
  }

  // INTERNAL

  function isSelfUpdateCase(uint256 _id, uint256 _existingTokenId) public view returns (bool) {
    Application storage a = verificationQueue[_id];
    (IContourModifierApplication.ContourModificationType modificationType, uint256 spaceTokenId,,) = IContourModifierApplication(a.applicationContract).getCVData(a.externalApplicationId);
    if (modificationType == IContourModifierApplication.ContourModificationType.UPDATE) {

      return (spaceTokenId ==_existingTokenId);
    }

    return false;
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
    ContourVerifiers(ggr.getContourVerifiersAddress()).slash(_a.approvers, _verifier);
  }

  // GETTERS

  function getLatLonSegment(
    uint256 _firstPointGeohash,
    uint256 _secondPointGeohash
  )
    public
    view
    returns (int256[2][2] memory)
  {
    (int256 lat1, int256 lon1) = LandUtils.geohash5ToLatLon(_firstPointGeohash);
    (int256 lat2, int256 lon2) = LandUtils.geohash5ToLatLon(_secondPointGeohash);

    int256[2] memory first = int256[2]([lat1, lon1]);
    int256[2] memory second = int256[2]([lat2, lon2]);

    return int256[2][2]([first, second]);
  }

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
      uint256 requiredApprovals,
      uint256 approvalCount
    )
  {
    Application storage a = verificationQueue[_id];

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
