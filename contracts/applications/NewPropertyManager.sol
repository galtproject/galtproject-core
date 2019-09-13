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
import "@galtproject/geodesic/contracts/interfaces/IGeodesic.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../interfaces/ISpaceToken.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "./interfaces/IPropertyManagerFeeCalculator.sol";
import "./interfaces/IContourModifierApplication.sol";
import "./AbstractApplication.sol";
import "./AbstractOracleApplication.sol";
import "./NewPropertyManagerLib.sol";
import "../registries/GaltGlobalRegistry.sol";
import "../registries/interfaces/IPGGRegistry.sol";
import "./ContourVerifiableApplication.sol";
import "./ContourVerificationManager.sol";
import "../ACL.sol";


contract NewPropertyManager is AbstractOracleApplication, ContourVerifiableApplication {
  using SafeMath for uint256;

  bytes32 public constant PM_LAWYER_ORACLE_TYPE = bytes32("PM_LAWYER_ORACLE_TYPE");
  bytes32 public constant PM_SURVEYOR_ORACLE_TYPE = bytes32("PM_SURVEYOR_ORACLE_TYPE");

  bytes32 public constant APPLICATION_UNLOCKER = bytes32("application_unlocker");

  bytes32 public constant CONFIG_MINIMAL_FEE_ETH = bytes32("PM_MINIMAL_FEE_ETH");
  bytes32 public constant CONFIG_MINIMAL_FEE_GALT = bytes32("PM_MINIMAL_FEE_GALT");
  bytes32 public constant CONFIG_PAYMENT_METHOD = bytes32("PM_PAYMENT_METHOD");

  bytes32 public constant CONFIG_APPLICATION_CANCEL_TIMEOUT = bytes32("PM_APPLICATION_CANCEL_TIMEOUT");
  bytes32 public constant CONFIG_APPLICATION_CLOSE_TIMEOUT = bytes32("PM_APPLICATION_CLOSE_TIMEOUT");
  bytes32 public constant CONFIG_ROLE_UNLOCK_TIMEOUT = bytes32("PM_ROLE_UNLOCK_TIMEOUT");

  bytes32 public constant CONFIG_PREFIX = bytes32("PM");

  event NewSpaceToken(address indexed applicant, uint256 spaceTokenId, bytes32 applicationId);
  event NewApplication(address indexed applicant, bytes32 applicationId);
  event ApplicationStatusChanged(bytes32 indexed applicationId, ApplicationStatus indexed status);
  event ValidationStatusChanged(bytes32 indexed applicationId, bytes32 indexed oracleType, ValidationStatus indexed status);
  event OracleRewardClaim(bytes32 indexed applicationId, address indexed oracle);
  event ApplicantFeeClaim(bytes32 indexed applicationId);
  event GaltProtocolFeeAssigned(bytes32 indexed applicationId);
  event ClaimSpaceToken(bytes32 indexed applicationId, uint256 indexed spaceTokenId);

  enum ApplicationStatus {
    NOT_EXISTS,
    PARTIALLY_SUBMITTED,
    CONTOUR_VERIFICATION,
    CANCELLED,
    CV_REJECTED,
    PENDING,
    APPROVED,
    REJECTED,
    REVERTED,
    PARTIALLY_RESUBMITTED,
    STORED,
    CLOSED
  }

  enum ValidationStatus {
    NOT_EXISTS,
    PENDING,
    LOCKED,
    APPROVED,
    REJECTED,
    REVERTED
  }

  struct Application {
    bytes32 id;
    address pgg;
    address applicant;
    address beneficiary;
    uint256 spaceTokenId;
    uint256 createdAt;
    uint256 becomePendingAt;
    uint256 becomeRevertedAt;
    bool lockedAtLeastOnce;
    Details details;
    Rewards rewards;
    Currency currency;
    ApplicationStatus status;

    bytes32[] assignedOracleTypes;

    mapping(bytes32 => uint256) assignedRewards;
    mapping(bytes32 => bool) oracleTypeRewardPaidOut;
    mapping(bytes32 => string) oracleTypeMessages;
    mapping(bytes32 => address) oracleTypeAddresses;
    mapping(address => bytes32) addressOracleTypes;
    mapping(bytes32 => uint256) lastLockedAt;
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  struct Rewards {
    uint256 totalPaidFee;
    uint256 oraclesReward;
    uint256 galtProtocolFee;
    uint256 latestCommittedFee;
    bool galtProtocolFeePaidOut;
    bool applicantFeePaidOut;
  }

  struct Details {
    bytes32 credentialsHash;

    ISpaceGeoDataRegistry.SpaceTokenType spaceTokenType;

    uint256[] contour;
    int256 highestPoint;

    ISpaceGeoDataRegistry.AreaSource areaSource;
    uint256 area;

    bytes32 ledgerIdentifier;
    string humanAddress;
    string dataLink;
  }

  mapping(bytes32 => Application) internal applications;

  constructor () public {}

  function initialize(
    GaltGlobalRegistry _ggr
  )
    public
    isInitializer
  {
    ggr = _ggr;
  }

  function onlyCVM() internal {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_CONTOUR_VERIFIER_POOL),
      "Invalid verifier contract"
    );
  }

  function onlyApplicant(bytes32 _aId) internal {
    require(applications[_aId].applicant == msg.sender, "Applicant invalid");
  }

  function onlyOracleOfApplication(bytes32 _aId) internal {
    require(applications[_aId].addressOracleTypes[msg.sender] != 0x0, "Not valid oracle");
  }

  function minimalApplicationFeeEth(address _pgg) internal view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_MINIMAL_FEE_ETH));
  }

  function minimalApplicationFeeGalt(address _pgg) internal view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_MINIMAL_FEE_GALT));
  }

  function applicationCancelTimeout(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_APPLICATION_CANCEL_TIMEOUT));
  }

  function applicationCloseTimeout(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_APPLICATION_CLOSE_TIMEOUT));
  }

  function roleUnlockTimeout(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_ROLE_UNLOCK_TIMEOUT));
  }

  function getOracleTypeShareKey(bytes32 _oracleType) public pure returns (bytes32) {
    return keccak256(abi.encode(CONFIG_PREFIX, "share", _oracleType));
  }

  function paymentMethod(address _pgg) public view returns (PaymentMethod) {
    return PaymentMethod(uint256(pggConfigValue(_pgg, CONFIG_PAYMENT_METHOD)));
  }

  uint256 idCounter = 1;

  function cvApprove(bytes32 _applicationId) external {
    onlyCVM();
    Application storage a = applications[_applicationId];

    require(a.status == ApplicationStatus.CONTOUR_VERIFICATION, "Expect CONTOUR_VERIFICATION status");

    a.becomePendingAt = block.timestamp;

    CVPendingApplicationIds.remove(_applicationId);
    CVApprovedApplicationIds.add(_applicationId);

    _changeApplicationStatus(a, ApplicationStatus.PENDING);
  }

  function cvReject(bytes32 _applicationId) external {
    onlyCVM();
    Application storage a = applications[_applicationId];

    require(a.status == ApplicationStatus.CONTOUR_VERIFICATION, "Expect CONTOUR_VERIFICATION status");

    CVPendingApplicationIds.remove(_applicationId);

    _changeApplicationStatus(a, ApplicationStatus.CV_REJECTED);
  }

  function submit(
      address _pgg,
      ISpaceGeoDataRegistry.SpaceTokenType _spaceTokenType,
      uint256 _customArea,
      address _beneficiary,
      string calldata _dataLink,
      string calldata _humanAddress,
      bytes32 _credentialsHash,
      bytes32 _ledgerIdentifier,
      uint256 _submissionFeeInGalt
)
      external
      payable
      returns (bytes32)
  {
    pggRegistry().requireValidPgg(_pgg);

    require(_customArea > 0, "Provide custom area value");

    bytes32 _id = bytes32(idCounter);
    idCounter++;

    Application storage a = applications[_id];
    require(a.status == ApplicationStatus.NOT_EXISTS, "Application already exists");


    // GALT
    if (_submissionFeeInGalt > 0) {
      requireValidPaymentType(_pgg, PaymentType.GALT);
      require(msg.value == 0, "Could not accept both ETH and GALT");
      require(_submissionFeeInGalt >= minimalApplicationFeeGalt(_pgg), "Insufficient payment");

      require(ggr.getGaltToken().allowance(msg.sender, address(this)) >= _submissionFeeInGalt, "Insufficient allowance");
      ggr.getGaltToken().transferFrom(msg.sender, address(this), _submissionFeeInGalt);

      a.rewards.totalPaidFee = _submissionFeeInGalt;
      a.currency = Currency.GALT;
    // ETH
    } else {
      requireValidPaymentType(_pgg, PaymentType.ETH);
      a.rewards.totalPaidFee = msg.value;
      // Default a.currency is Currency.ETH

      require(msg.value >= minimalApplicationFeeEth(_pgg), "Insufficient payment");
    }

    a.status = ApplicationStatus.PARTIALLY_SUBMITTED;
    a.id = _id;
    a.applicant = msg.sender;
    a.createdAt = block.timestamp;

    _calculateAndStoreFee(a, a.rewards.totalPaidFee);

    a.pgg = _pgg;
    a.details.spaceTokenType = _spaceTokenType;
    a.beneficiary = _beneficiary;
    a.details.humanAddress = _humanAddress;
    a.details.dataLink = _dataLink;
    a.details.ledgerIdentifier = _ledgerIdentifier;
    a.details.credentialsHash = _credentialsHash;
    a.details.area = _customArea;
    // Default a.areaSource is AreaSource.USER_INPUT

    applicationsArray.push(_id);
    applicationsByApplicant[msg.sender].push(_id);

    emit NewApplication(msg.sender, _id);
    emit ApplicationStatusChanged(_id, ApplicationStatus.PARTIALLY_SUBMITTED);

    _assignRequiredOracleTypesAndRewards(applications[_id]);

    return _id;
  }

  function setContour(
    bytes32 _aId,
    int256 _highestPoint,
    uint256[] calldata _contour
  )
    external
  {
    Application storage a = applications[_aId];

    require(
      _contour.length >= 3 && _contour.length <= 350,
      "Contour vertex count should be between 3 and 350"
    );

    require(a.applicant == msg.sender, "Applicant invalid");
    require(
      a.status == ApplicationStatus.PARTIALLY_SUBMITTED
      || a.status == ApplicationStatus.PARTIALLY_RESUBMITTED
      || a.status == ApplicationStatus.CV_REJECTED,
      "Expect PARTIALLY_SUBMITTED or CV_REJECTED status"
    );

    a.details.contour = _contour;
    a.details.highestPoint = _highestPoint;

    CVPendingApplicationIds.add(_aId);

    _changeApplicationStatus(a, ApplicationStatus.CONTOUR_VERIFICATION);
  }

  /**
   * @dev Resubmit application after it was reverted
   *
   * @param _aId application id
   * @param _newCredentialsHash keccak256 of user credentials
   * @param _newLedgerIdentifier of a plot
   * @param _newDataLink of a plot
   * @param _newCustomArea int
   * @param _resubmissionFeeInGalt or 0 if paid by ETH
   */
  function resubmit(
    bytes32 _aId,
    bool _contourChanged,
    bytes32 _newCredentialsHash,
    bytes32 _newLedgerIdentifier,
    string calldata _newDataLink,
    string calldata _newHumanAddress,
    uint256 _newCustomArea,
    uint256 _resubmissionFeeInGalt
  )
    external
    payable
  {
    require(_newCustomArea > 0, "Provide custom area value");

    Application storage a = applications[_aId];
    Details storage d = a.details;

    require(a.applicant == msg.sender, "Applicant invalid");
    require(a.status == ApplicationStatus.REVERTED, "Application status should be REVERTED");

    _checkResubmissionPayment(a, _resubmissionFeeInGalt);

    d.area = _newCustomArea;
    d.humanAddress = _newHumanAddress;
    d.dataLink = _newDataLink;
    d.ledgerIdentifier = _newLedgerIdentifier;
    d.credentialsHash = _newCredentialsHash;

    _assignLockedStatus(_aId);

    _changeApplicationStatus(
      a,
      _contourChanged ? ApplicationStatus.PARTIALLY_RESUBMITTED : ApplicationStatus.PENDING
    );
  }

  function _assignLockedStatus(bytes32 _aId) internal {
    for (uint256 i = 0; i < applications[_aId].assignedOracleTypes.length; i++) {
      if (applications[_aId].validationStatus[applications[_aId].assignedOracleTypes[i]] != ValidationStatus.LOCKED) {
        _changeValidationStatus(applications[_aId], applications[_aId].assignedOracleTypes[i], ValidationStatus.LOCKED);
      }
    }
  }

  function _checkResubmissionPayment(
    Application storage a,
    uint256 _resubmissionFeeInGalt
  )
    internal
  {
    Currency currency = a.currency;
    uint256 fee;
    uint256 minimalFee;

    if (a.currency == Currency.GALT) {
      require(msg.value == 0, "ETH payment not expected");
      fee = _resubmissionFeeInGalt;
      minimalFee = minimalApplicationFeeEth(a.pgg);
    } else {
      require(_resubmissionFeeInGalt == 0, "GALT payment not expected");
      fee = msg.value;
      minimalFee = minimalApplicationFeeGalt(a.pgg);
    }

    uint256 totalPaid = a.rewards.latestCommittedFee.add(fee);

    require(totalPaid >= minimalFee, "Insufficient payment");

    a.rewards.latestCommittedFee = totalPaid;
  }

  // Application can be locked by an oracle type only once.
  function lock(bytes32 _aId, bytes32 _oracleType) external {
    Application storage a = applications[_aId];

    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, _oracleType);

    require(a.status == ApplicationStatus.PENDING, "Application status should be PENDING");
    require(a.oracleTypeAddresses[_oracleType] == address(0), "Oracle is already assigned on this oracle type");
    require(a.validationStatus[_oracleType] == ValidationStatus.PENDING, "Can't lock an oracle type not in PENDING status");

    a.lockedAtLeastOnce = true;
    a.lastLockedAt[_oracleType] = block.timestamp;
    a.oracleTypeAddresses[_oracleType] = msg.sender;
    a.addressOracleTypes[msg.sender] = _oracleType;
    applicationsByOracle[msg.sender].push(_aId);

    _changeValidationStatus(a, _oracleType, ValidationStatus.LOCKED);
  }

  function unlock(bytes32 _aId, bytes32 _oracleType) external {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.PENDING, "Application status should be PENDING");
    require(a.validationStatus[_oracleType] == ValidationStatus.LOCKED, "Validation status should be LOCKED");
    require(a.oracleTypeAddresses[_oracleType] != address(0), "Address should be already set");

    uint256 timeout = applicationCancelTimeout(a.pgg);
    require(block.timestamp > a.lastLockedAt[_oracleType].add(timeout), "Timeout has not passed yet");

    a.oracleTypeAddresses[_oracleType] = address(0);
    _changeValidationStatus(a, _oracleType, ValidationStatus.PENDING);
  }

  function approve(
    bytes32 _aId,
    bytes32 _credentialsHash
  )
    external
  {
    onlyOracleOfApplication(_aId);
    Application storage a = applications[_aId];

    require(a.details.credentialsHash == _credentialsHash, "Credentials don't match");
    require(a.status == ApplicationStatus.PENDING, "Application status should be PENDING");

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    require(a.validationStatus[oracleType] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.oracleTypeAddresses[oracleType] == msg.sender, "Sender not assigned to this application");
    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, oracleType);

    _changeValidationStatus(a, oracleType, ValidationStatus.APPROVED);

    uint256 len = a.assignedOracleTypes.length;
    bool allApproved = true;

    for (uint256 i = 0; i < len; i++) {
      if (a.validationStatus[a.assignedOracleTypes[i]] != ValidationStatus.APPROVED) {
        allApproved = false;
      }
    }

    if (allApproved) {
      _changeApplicationStatus(a, ApplicationStatus.APPROVED);
      CVApprovedApplicationIds.remove(_aId);
      NewPropertyManagerLib.mintToken(ggr, a, address(this));
      emit NewSpaceToken(a.applicant, a.spaceTokenId, _aId);
    }
  }

  function claimSpaceToken(bytes32 _aId) external {
    onlyApplicant(_aId);
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.APPROVED,
      "Application status should be APPROVED");

    emit ClaimSpaceToken(_aId, a.spaceTokenId);

    ggr.getSpaceToken().transferFrom(address(this), a.beneficiary, a.spaceTokenId);
  }

  function reject(
    bytes32 _aId,
    string calldata _message
  )
    external
  {
    onlyOracleOfApplication(_aId);
    Application storage a = applications[_aId];

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, oracleType);

    NewPropertyManagerLib.rejectApplicationHelper(a, _message);
    CVApprovedApplicationIds.remove(_aId);

    _changeValidationStatus(a, a.addressOracleTypes[msg.sender], ValidationStatus.REJECTED);
    _changeApplicationStatus(a, ApplicationStatus.REJECTED);
  }

  function revert(
    bytes32 _aId,
    string calldata _message
  )
    external
  {
    onlyOracleOfApplication(_aId);
    Application storage a = applications[_aId];
    bytes32 senderOracleType = a.addressOracleTypes[msg.sender];
    uint256 len = a.assignedOracleTypes.length;

    require(a.status == ApplicationStatus.PENDING, "Application status should be PENDING");
    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, senderOracleType);
    require(a.validationStatus[senderOracleType] == ValidationStatus.LOCKED, "Application should be locked first");

    for (uint256 i = 0; i < len; i++) {
      if (a.validationStatus[a.assignedOracleTypes[i]] == ValidationStatus.PENDING) {
        revert("All oracle types should lock the application first");
      }
    }

    a.oracleTypeMessages[senderOracleType] = _message;
    a.becomeRevertedAt = block.timestamp;

    CVApprovedApplicationIds.remove(_aId);

    _changeValidationStatus(a, senderOracleType, ValidationStatus.REVERTED);
    _changeApplicationStatus(a, ApplicationStatus.REVERTED);
  }

  function close(bytes32 _aId) external {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.REVERTED, "Application status should be REVERTED");
    if (msg.sender != a.applicant) {
      require(
        block.timestamp > a.becomeRevertedAt.add(applicationCloseTimeout(a.pgg)),
        "Timeout has not passed yet"
      );
    }

    _changeApplicationStatus(a, ApplicationStatus.CLOSED);
  }

  function cancel(bytes32 _aId) external {
    onlyApplicant(_aId);
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.PENDING, "Application status should be PENDING");
    require(block.timestamp > a.becomePendingAt.add(roleUnlockTimeout(a.pgg)), "Timeout has not passed yet");
    require(a.lockedAtLeastOnce == false, "The application has been already locked at least once");

    _changeApplicationStatus(a, ApplicationStatus.CANCELLED);
  }

  function store(bytes32 _aId) external {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.APPROVED, "Application status should be APPROVED");

    ISpaceGeoDataRegistry spaceGeoData = ISpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress());

    spaceGeoData.setSpaceTokenContour(a.spaceTokenId, a.details.contour);
    spaceGeoData.setSpaceTokenHighestPoint(a.spaceTokenId, a.details.highestPoint);

    _changeApplicationStatus(a, ApplicationStatus.STORED);
  }

  function claimApplicantFee(bytes32 _aId) external {
    onlyApplicant(_aId);

    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.CANCELLED, "Application status should be CANCELLED");

    require(a.rewards.applicantFeePaidOut == false, "Fee already paid out");

    a.rewards.applicantFeePaidOut = true;

    uint256 reward = a.rewards.totalPaidFee;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (a.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(msg.sender, reward);
    }

    emit ApplicantFeeClaim(_aId);
  }

  function claimOracleReward(bytes32 _aId) external {
    onlyOracleOfApplication(_aId);
    Application storage a = applications[_aId];
    bytes32 senderOracleType = a.addressOracleTypes[msg.sender];
    uint256 reward = a.assignedRewards[senderOracleType];

    /* solium-disable-next-line */
    require(
      a.status == ApplicationStatus.STORED || a.status == ApplicationStatus.REJECTED || a.status == ApplicationStatus.CLOSED,
      "Application status should be STORED, REJECTED or CLOSED");
    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, senderOracleType);

    require(reward > 0, "Reward is 0");
    require(a.oracleTypeRewardPaidOut[senderOracleType] == false, "Reward is already paid");

    a.oracleTypeRewardPaidOut[senderOracleType] = true;

    _assignGaltProtocolFee(a);

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (a.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(msg.sender, reward);
    }

    emit OracleRewardClaim(_aId, msg.sender);
  }

  function _assignGaltProtocolFee(Application storage _a) internal {
    if (_a.rewards.galtProtocolFeePaidOut == false) {
      if (_a.currency == Currency.ETH) {
        protocolFeesEth = protocolFeesEth.add(_a.rewards.galtProtocolFee);
      } else if (_a.currency == Currency.GALT) {
        protocolFeesGalt = protocolFeesGalt.add(_a.rewards.galtProtocolFee);
      }

      _a.rewards.galtProtocolFeePaidOut = true;
      emit GaltProtocolFeeAssigned(_a.id);
    }
  }

  function _calculateAndStoreFee(
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

    assert(share > 0);
    assert(share <= 100);

    uint256 galtProtocolFee = share.mul(_fee).div(100);
    uint256 oraclesReward = _fee.sub(galtProtocolFee);

    assert(oraclesReward.add(galtProtocolFee) == _fee);

    _a.rewards.oraclesReward = oraclesReward;
    _a.rewards.galtProtocolFee = galtProtocolFee;

    _a.rewards.latestCommittedFee = _fee;
  }

  function _assignRequiredOracleTypesAndRewards(Application storage a) internal {
    assert(a.rewards.oraclesReward > 0);

    uint256 totalReward = 0;

    a.assignedOracleTypes = [PM_SURVEYOR_ORACLE_TYPE, PM_LAWYER_ORACLE_TYPE];
    uint256 surveyorShare = oracleTypeShare(a.pgg, PM_SURVEYOR_ORACLE_TYPE);
    uint256 lawyerShare = oracleTypeShare(a.pgg, PM_LAWYER_ORACLE_TYPE);
    uint256[2] memory shares = [surveyorShare, lawyerShare];

    require(surveyorShare + lawyerShare == 100, "PM shares invalid setup");

    uint256 len = a.assignedOracleTypes.length;
    for (uint256 i = 0; i < len; i++) {
      bytes32 oracleType = a.assignedOracleTypes[i];
      uint256 rewardShare = a
      .rewards
      .oraclesReward
      .mul(shares[i])
      .div(100);

      a.assignedRewards[oracleType] = rewardShare;
      _changeValidationStatus(a, oracleType, ValidationStatus.PENDING);
      totalReward = totalReward.add(rewardShare);
    }

    assert(totalReward <= a.rewards.oraclesReward);
    uint256 diff = a.rewards.oraclesReward - totalReward;
    a.assignedRewards[a.assignedOracleTypes[0]] = a.assignedRewards[a.assignedOracleTypes[0]].add(diff);
  }

  function _changeValidationStatus(
    Application storage _a,
    bytes32 _oracleType,
    ValidationStatus _status
  )
    internal
  {
    emit ValidationStatusChanged(_a.id, _oracleType, _status);

    _a.validationStatus[_oracleType] = _status;
  }

  // NOTICE: the application should already persist in storage
  function _changeApplicationStatus(
    Application storage _a,
    ApplicationStatus _status
  )
    internal
  {
    emit ApplicationStatusChanged(_a.id, _status);

    _a.status = _status;
  }

  /**
   * @dev Get common application details
   */
  function getApplication(
    bytes32 _id
  )
    external
    view
    returns (
      uint256 createdAt,
      address beneficiary,
      address applicant,
      uint256 becomePendingAt,
      uint256 becomeRevertedAt,
      address pgg,
      uint256 spaceTokenId,
      ApplicationStatus status,
      Currency currency,
      bytes32[] memory assignedOracleTypes
    )
  {
    Application storage m = applications[_id];

    return (
      m.createdAt,
      m.beneficiary,
      m.applicant,
      m.becomePendingAt,
      m.becomeRevertedAt,
      m.pgg,
      m.spaceTokenId,
      m.status,
      m.currency,
      m.assignedOracleTypes
    );
  }

  /**
   * @dev Get application rewards-related information
   */
  function getApplicationRewards(
    bytes32 _id
  )
    external
    view
    returns (
      ApplicationStatus status,
      Currency currency,
      uint256 oraclesReward,
      uint256 galtProtocolFee,
      uint256 latestCommittedFee,
      bool galtProtocolFeePaidOut
    )
  {
    Application storage m = applications[_id];

    return (
      m.status,
      m.currency,
      m.rewards.oraclesReward,
      m.rewards.galtProtocolFee,
      m.rewards.latestCommittedFee,
      m.rewards.galtProtocolFeePaidOut
    );
  }

  /**
   * @dev Get application details
   */
  function getApplicationDetails(
    bytes32 _id
  )
    external
    view
    returns (
      bytes32 credentialsHash,
      ISpaceGeoDataRegistry.SpaceTokenType spaceTokenType,
      uint256[] memory contour,
      int256 highestPoint,
      ISpaceGeoDataRegistry.AreaSource areaSource,
      uint256 area,
      bytes32 ledgerIdentifier,
      string memory humanAddress,
      string memory dataLink
    )
  {
    Application storage m = applications[_id];

    return (
      m.details.credentialsHash,
      m.details.spaceTokenType,
      m.details.contour,
      m.details.highestPoint,
      m.details.areaSource,
      m.details.area,
      m.details.ledgerIdentifier,
      m.details.humanAddress,
      m.details.dataLink
    );
  }

  function getApplicationOracle(
    bytes32 _aId,
    bytes32 _oracleType
  )
    external
    view
    returns (
      address oracle,
      uint256 reward,
      bool rewardPaidOut,
      ValidationStatus status,
      string memory message
    )
  {
    return (
      applications[_aId].oracleTypeAddresses[_oracleType],
      applications[_aId].assignedRewards[_oracleType],
      applications[_aId].oracleTypeRewardPaidOut[_oracleType],
      applications[_aId].validationStatus[_oracleType],
      applications[_aId].oracleTypeMessages[_oracleType]
    );
  }

  function getCVContour(bytes32 _applicationId) external view returns (uint256[] memory) {
    return applications[_applicationId].details.contour;
  }

  function getCVHighestPoint(bytes32 _applicationId) external view returns (int256) {
    return applications[_applicationId].details.highestPoint;
  }

  function getCVSpaceTokenType(bytes32 _aId) external view returns (ISpaceGeoDataRegistry.SpaceTokenType) {
    return applications[_aId].details.spaceTokenType;
  }

  function getApplicationBeneficiary(bytes32 _aId) public view returns (address) {
    return applications[_aId].beneficiary;
  }

  function getCVData(bytes32 _applicationId)
    external
    view
    returns (
      IContourModifierApplication.ContourModificationType contourModificationType,
      uint256 spaceTokenId,
      uint256[] memory contour
    )
  {
    contourModificationType = IContourModifierApplication.ContourModificationType.ADD;
    contour = applications[_applicationId].details.contour;
  }
}
