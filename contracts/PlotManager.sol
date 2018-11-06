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

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./AbstractApplication.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./Validators.sol";
import "./PlotManagerLib.sol";


contract PlotManager is AbstractApplication {
  using SafeMath for uint256;

  bytes32 public constant APPLICATION_TYPE = 0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6;

  enum ApplicationStatus {
    NOT_EXISTS,
    SUBMITTED,
    APPROVED,
    REJECTED,
    REVERTED,
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

  event LogApplicationStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event LogValidationStatusChanged(bytes32 applicationId, bytes32 role, ValidationStatus status);
  event LogNewApplication(bytes32 id, address applicant);

  struct Application {
    bytes32 id;
    address applicant;
    address operator;
    uint256 spaceTokenId;
    // TODO: should depend on plot area, but now it is fixed
    ApplicationDetails details;
    ApplicationFees fees;
    Currency currency;
    ApplicationStatus status;

    bytes32[] assignedRoles;

    // TODO: combine into role struct
    mapping(bytes32 => uint256) assignedRewards;
    mapping(bytes32 => bool) roleRewardPaidOut;
    mapping(bytes32 => string) roleMessages;
    mapping(bytes32 => address) roleAddresses;
    mapping(address => bytes32) addressRoles;
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  struct ApplicationFees {
    uint256 validatorsReward;
    uint256 galtSpaceReward;
    uint256 latestCommittedFee;
    uint256 feeRefundAvailable;
    bool galtSpaceRewardPaidOut;
  }

  struct ApplicationDetails {
    bytes32 credentialsHash;
    bytes32 ledgerIdentifier;
  }

  // rate per one 12-symbol geohash in GALT
  uint256 public submissionFeeRateGalt;
  // rate per one 12-symbol geohash in ETH
  uint256 public submissionFeeRateEth;

  mapping(bytes32 => Application) public applications;
  mapping(address => bytes32[]) public applicationsByAddresses;
  bytes32[] private applicationsArray;

  // WARNING: we do not remove applications from validator's list,
  // so do not rely on this variable to verify whether validator
  // exists or not.
  mapping(address => bytes32[]) public applicationsByValidator;

  SpaceToken public spaceToken;
  SplitMerge public splitMerge;
  Validators public validators;
  ERC20 public galtToken;

  constructor () public {}

  function initialize(
    SpaceToken _spaceToken,
    SplitMerge _splitMerge,
    Validators _validators,
    ERC20 _galtToken,
    address _galtSpaceRewardsAddress
  )
    public
    isInitializer
  {
    owner = msg.sender;

    spaceToken = _spaceToken;
    splitMerge = _splitMerge;
    validators = _validators;
    galtToken = _galtToken;
    galtSpaceRewardsAddress = _galtSpaceRewardsAddress;

    // Default values for revenue shares and application fees
    // Override them using one of the corresponding setters
    minimalApplicationFeeInEth = 1;
    minimalApplicationFeeInGalt = 10;
    galtSpaceEthShare = 33;
    galtSpaceGaltShare = 33;
    // 1_000 gwei
    submissionFeeRateEth = 1 szabo;
    // 10_000 gwei
    submissionFeeRateGalt = 10 szabo;
    paymentMethod = PaymentMethod.ETH_AND_GALT;
  }

  modifier onlyApplicant(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(
      a.applicant == msg.sender || getApplicationOperator(_aId) == msg.sender,
      "Applicant invalid");

    _;
  }

  modifier onlyValidatorOfApplication(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.addressRoles[msg.sender] != 0x0 && validators.isValidatorActive(msg.sender), "Not valid validator");

    _;
  }

  modifier ready() {
    require(validators.isApplicationTypeReady(APPLICATION_TYPE), "Roles list not complete");

    _;
  }

  function setSubmissionFeeRate(uint256 _newEthRate, uint256 _newGaltRate) external onlyFeeManager {
    submissionFeeRateGalt = _newGaltRate;
    submissionFeeRateEth = _newEthRate;
  }

  function approveOperator(bytes32 _aId, address _to) external {
    Application storage a = applications[_aId];
    require(
      msg.sender == a.applicant ||
      (a.status == ApplicationStatus.REJECTED && a.addressRoles[msg.sender] != 0x0),
      "Unable to approve"
    );
    require(_to != a.applicant, "Unable to approve to the same account");

    a.operator = _to;
  }

  function submitApplication(
    uint256[] _packageContour,
    int256[] _heights,
    int256 _level,
    bytes32 _credentialsHash,
    bytes32 _ledgerIdentifier,
    uint256 _submissionFeeInGalt
  )
    external
    payable
    ready
    // TODO: should be payable
    returns (bytes32)
  {
    require(
      _packageContour.length >= 3 && _packageContour.length <= 50,
      "Number of contour elements should be between 3 and 50"
    );

    Application memory a;
    bytes32 _id = keccak256(
      abi.encodePacked(
        _packageContour,
        _credentialsHash,
        msg.sender,
        applicationsArray.length
      )
    );

    // Default is ETH
    Currency currency;
    uint256 fee;

    // GALT
    if (_submissionFeeInGalt > 0) {
      require(msg.value == 0, "Could not accept both ETH and GALT");
      require(_submissionFeeInGalt >= getSubmissionFee(Currency.GALT, _packageContour), "Incorrect fee passed in");
      galtToken.transferFrom(msg.sender, address(this), _submissionFeeInGalt);
      fee = _submissionFeeInGalt;
      a.currency = Currency.GALT;
      // ETH
    } else {
      fee = msg.value;
      require(
        msg.value >= getSubmissionFee(Currency.ETH, _packageContour),
        "Incorrect msg.value passed in");
    }

    require(applications[_id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    a.status = ApplicationStatus.SUBMITTED;
    a.id = _id;
    a.applicant = msg.sender;
    // TODO: should depend on plot area
    a.spaceTokenId = splitMerge.initPackage();

    calculateAndStoreFee(a, fee);

    applications[_id] = a;

    applicationsArray.push(_id);
    applicationsByAddresses[msg.sender].push(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);

    applications[_id].details = ApplicationDetails({
      ledgerIdentifier: _ledgerIdentifier,
      credentialsHash: _credentialsHash
    });

    applications[_id].fees.latestCommittedFee = fee;
    assignRequiredValidatorRolesAndRewards(applications[_id]);

    splitMerge.setPackageContour(a.spaceTokenId, _packageContour);
    splitMerge.setPackageHeights(a.spaceTokenId, _heights);
    splitMerge.setPackageLevel(a.spaceTokenId, _level);

    return _id;
  }

  /**
   * @dev Resubmit application after it was reverted
   *
   * TODO: handle payments correctly
   *
   * @param _aId application id
   * @param _credentialsHash keccak256 of user credentials
   * @param _ledgerIdentifier of a plot
   * @param _newPackageContour array, empty if not changed
   * @param _newHeights array, empty if not changed
   * @param _newLevel int
   * @param _resubmissionFeeInGalt or 0 if paid by ETH
   */
  function resubmitApplication(
    bytes32 _aId,
    bytes32 _credentialsHash,
    bytes32 _ledgerIdentifier,
    uint256[] _newPackageContour,
    int256[] _newHeights,
    int256 _newLevel,
    uint256 _resubmissionFeeInGalt
  )
    external
    payable
    onlyApplicant(_aId)
  {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.REVERTED,
      "Application status should be REVERTED");

    checkResubmissionPayment(a, _resubmissionFeeInGalt, _newPackageContour);

    uint256 len = a.assignedRoles.length;

    a.details.credentialsHash = _credentialsHash;
    a.details.ledgerIdentifier = _ledgerIdentifier;

    if (_newPackageContour.length != 0) {
      splitMerge.setPackageContour(a.spaceTokenId, _newPackageContour);
    }
    if (_newHeights.length != 0) {
      splitMerge.setPackageHeights(a.spaceTokenId, _newHeights);
    }
    splitMerge.setPackageLevel(a.spaceTokenId, _newLevel);

    for (uint8 i = 0; i < len; i++) {
      if (a.validationStatus[a.assignedRoles[i]] != ValidationStatus.LOCKED) {
        changeValidationStatus(a, a.assignedRoles[i], ValidationStatus.LOCKED);
      }
    }

    changeApplicationStatus(a, ApplicationStatus.SUBMITTED);
  }

  function checkResubmissionPayment(
    Application storage a,
    uint256 _resubmissionFeeInGalt,
    uint256[] _newPackageContour
  )
    internal
  {
    Currency currency = a.currency;
    uint256 fee;

    if (a.currency == Currency.GALT) {
      require(msg.value == 0, "ETH payment not expected");
      fee = _resubmissionFeeInGalt;
    } else {
      require(_resubmissionFeeInGalt == 0, "GALT payment not expected");
      fee = msg.value;
    }

    uint256 newTotalFee = getSubmissionFee(a.currency, _newPackageContour);
    uint256 alreadyPaid = a.fees.latestCommittedFee;

    if (newTotalFee > alreadyPaid) {
      uint256 requiredPayment = newTotalFee.sub(alreadyPaid);
      require(fee >= requiredPayment, "Incorrect fee passed in");
      newTotalFee = fee;
    } else if (newTotalFee < alreadyPaid) {
      require(fee == 0, "Unexpected payment");
      uint256 requiredRefund = alreadyPaid.sub(newTotalFee);
      a.fees.feeRefundAvailable = a.fees.feeRefundAvailable.add(requiredRefund);
    } else {
      require(fee == 0, "Unexpected payment");
    }

    a.fees.latestCommittedFee = newTotalFee;
  }

  // Application can be locked by a role only once.
  function lockApplicationForReview(bytes32 _aId, bytes32 _role) external {
    Application storage a = applications[_aId];
    validators.requireValidatorActiveWithAssignedActiveRole(msg.sender, _role);

    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");
    require(a.roleAddresses[_role] == address(0), "Validator is already assigned on this role");
    require(a.validationStatus[_role] == ValidationStatus.PENDING, "Can't lock a role not in PENDING status");

    a.roleAddresses[_role] = msg.sender;
    a.addressRoles[msg.sender] = _role;
    applicationsByValidator[msg.sender].push(_aId);

    changeValidationStatus(a, _role, ValidationStatus.LOCKED);
  }

  function resetApplicationRole(bytes32 _aId, bytes32 _role) external onlyOwner {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");
    require(a.validationStatus[_role] != ValidationStatus.PENDING, "Validation status not set");
    require(a.roleAddresses[_role] != address(0), "Address should be already set");

    // Do not affect on application state
    a.roleAddresses[_role] = address(0);
    changeValidationStatus(a, _role, ValidationStatus.PENDING);
  }

  function approveApplication(
    bytes32 _aId,
    bytes32 _credentialsHash
  )
    external
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(a.details.credentialsHash == _credentialsHash, "Credentials don't match");
    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");

    bytes32 role = a.addressRoles[msg.sender];

    require(a.validationStatus[role] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.roleAddresses[role] == msg.sender, "Sender not assigned to this application");

    changeValidationStatus(a, role, ValidationStatus.APPROVED);

    uint256 len = a.assignedRoles.length;
    bool allApproved = true;

    for (uint8 i = 0; i < len; i++) {
      if (a.validationStatus[a.assignedRoles[i]] != ValidationStatus.APPROVED) {
        allApproved = false;
      }
    }

    if (allApproved) {
      changeApplicationStatus(a, ApplicationStatus.APPROVED);
      spaceToken.transferFrom(address(this), a.applicant, a.spaceTokenId);
    }
  }

  function rejectApplication(
    bytes32 _aId,
    string _message
  )
    external
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];
    PlotManagerLib.rejectApplicationHelper(a, _message);

    changeValidationStatus(a, a.addressRoles[msg.sender], ValidationStatus.REJECTED);
    changeApplicationStatus(a, ApplicationStatus.REJECTED);
  }

  function revertApplication(
    bytes32 _aId,
    string _message
  )
    external
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");

    bytes32 senderRole = a.addressRoles[msg.sender];
    uint256 len = a.assignedRoles.length;

    require(a.validationStatus[senderRole] == ValidationStatus.LOCKED, "Application should be locked first");

    for (uint8 i = 0; i < len; i++) {
      if (a.validationStatus[a.assignedRoles[i]] == ValidationStatus.PENDING) {
        revert("All validator roles should lock the application first");
      }
    }

    a.roleMessages[senderRole] = _message;

    changeValidationStatus(a, senderRole, ValidationStatus.REVERTED);
    changeApplicationStatus(a, ApplicationStatus.REVERTED);
  }

  function closeApplication(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.REVERTED,
      "Application status should be REVERTED");

    changeApplicationStatus(a, ApplicationStatus.CLOSED);
  }

  function claimValidatorReward(
    bytes32 _aId
  )
    external 
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];
    bytes32 senderRole = a.addressRoles[msg.sender];
    uint256 reward = a.assignedRewards[senderRole];

    /* solium-disable-next-line */
    require(
      a.status == ApplicationStatus.APPROVED || a.status == ApplicationStatus.REJECTED || a.status == ApplicationStatus.CLOSED,
      "Application status should be APPROVED, REJECTED or CLOSED");

    require(reward > 0, "Reward is 0");
    require(a.roleRewardPaidOut[senderRole] == false, "Reward is already paid");

    a.roleRewardPaidOut[senderRole] = true; 

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (a.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, reward);
    } else {
      revert("Unknown currency");
    }
  }

  function claimGaltSpaceReward(
    bytes32 _aId
  )
    external
  {
    require(msg.sender == galtSpaceRewardsAddress, "The method call allowed only for galtSpace address");

    Application storage a = applications[_aId];

    /* solium-disable-next-line */
    require(
      a.status == ApplicationStatus.APPROVED || a.status == ApplicationStatus.REJECTED || a.status == ApplicationStatus.CLOSED,
      "Application status should be APPROVED, REJECTED or CLOSED");

    require(a.fees.galtSpaceReward > 0, "Reward is 0");
    require(a.fees.galtSpaceRewardPaidOut == false, "Reward is already paid out");

    a.fees.galtSpaceRewardPaidOut = true;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(a.fees.galtSpaceReward);
    } else if (a.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, a.fees.galtSpaceReward);
    } else {
      revert("Unknown currency");
    }
  }

  /**
   * @dev Withdraw total unused submission fee back
   */
  function withdrawSubmissionFee(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];
    uint256 refund = a.fees.feeRefundAvailable;

    require(refund > 0, "No refund available");
    a.fees.feeRefundAvailable = 0;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(refund);
    } else if (a.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, refund);
    }
  }

  function calculateAndStoreFee(
    Application memory _a,
    uint256 _fee
  )
    internal
  {
    uint256 share;

    if (_a.currency == Currency.ETH) {
      share = galtSpaceEthShare;
    } else {
      share = galtSpaceGaltShare;
    }

    uint256 galtSpaceReward = share.mul(_fee).div(100);
    uint256 validatorsReward = _fee.sub(galtSpaceReward);

    assert(validatorsReward.add(galtSpaceReward) == _fee);

    _a.fees.validatorsReward = validatorsReward;
    _a.fees.galtSpaceReward = galtSpaceReward;
  }

  function assignRequiredValidatorRolesAndRewards(Application storage a) internal {
    assert(a.fees.validatorsReward > 0);

    uint256 totalReward = 0;

    a.assignedRoles = validators.getApplicationTypeRoles(APPLICATION_TYPE);
    uint256 len = a.assignedRoles.length;
    for (uint8 i = 0; i < len; i++) {
      bytes32 role = a.assignedRoles[i];
      uint256 rewardShare = a
      .fees
      .validatorsReward
      .mul(validators.getRoleRewardShare(role))
      .div(100);

      a.assignedRewards[role] = rewardShare;
      changeValidationStatus(a, role, ValidationStatus.PENDING);
      totalReward = totalReward.add(rewardShare);
    }

    assert(totalReward == a.fees.validatorsReward);
  }

  function changeValidationStatus(
    Application storage _a,
    bytes32 _role,
    ValidationStatus _status
  )
    internal
  {
    emit LogValidationStatusChanged(_a.id, _role, _status);

    _a.validationStatus[_role] = _status;
  }

  // NOTICE: the application should already persist in storage
  function changeApplicationStatus(
    Application storage _a,
    ApplicationStatus _status
  )
    internal
  {
    emit LogApplicationStatusChanged(_a.id, _status);

    _a.status = _status;
  }

  function isCredentialsHashValid(
    bytes32 _id,
    bytes32 _hash
  )
    external
    view
    returns (bool)
  {
    return (_hash == applications[_id].details.credentialsHash);
  }

  /**
   * @dev Get common application details
   */
  function getApplicationById(
    bytes32 _id
  )
    external
    view
    returns (
      address applicant,
      uint256 spaceTokenId,
      bytes32 credentialsHash,
      ApplicationStatus status,
      Currency currency,
      bytes32 ledgerIdentifier,
      bytes32[] assignedValidatorRoles
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.applicant,
      m.spaceTokenId,
      m.details.credentialsHash,
      m.status,
      m.currency,
      m.details.ledgerIdentifier,
      m.assignedRoles
    );
  }

  /**
   * @dev Get application fees-related information
   */
  function getApplicationFees(
    bytes32 _id
  )
    external
    view
    returns (
      ApplicationStatus status,
      Currency currency,
      uint256 validatorsReward,
      uint256 galtSpaceReward,
      uint256 latestCommittedFee,
      uint256 feeRefundAvailable,
      bool galtSpaceRewardPaidOut
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.status,
      m.currency,
      m.fees.validatorsReward,
      m.fees.galtSpaceReward,
      m.fees.latestCommittedFee,
      m.fees.feeRefundAvailable,
      m.fees.galtSpaceRewardPaidOut
    );
  }

  function getAllApplications() external view returns (bytes32[]) {
    return applicationsArray;
  }

  function getApplicationsByAddress(address _applicant) external view returns (bytes32[]) {
    return applicationsByAddresses[_applicant];
  }

  function getApplicationsByValidator(address _applicant) external view returns (bytes32[]) {
    return applicationsByValidator[_applicant];
  }

  function getApplicationOperator(bytes32 _aId) public view returns (address) {
    return applications[_aId].operator;
  }

  /**
   * @dev A minimum fee to pass in to #submitApplication() method either in GALT or in ETH
   * WARNING: currently area weight is hardcoded in #submitApplication() method
   */
  function getSubmissionFee(Currency _currency, uint256[] _packageContour) public view returns (uint256) {
    if (_currency == Currency.GALT) {
      return 2000000 * submissionFeeRateGalt;
    } else {
      return 2000000 * submissionFeeRateEth;
    }
  }

  /**
   * @dev Fee to pass in to #resubmitApplication().
   *
   * if newTotalFee > latestPaidFee:
   *   (result > 0) and should be sent either as GALT or as ETH depending on application currency.
   * if newTotalFee == latestPaidFee:
   *   (result == 0)
   * if newTotalFee < latestPaidFee:
   *   (result < 0) and could be claimed back.
   */
  function getResubmissionFee(bytes32 _aId, uint256[] _packageContour) external returns (int256) {
    Application storage a = applications[_aId];
    uint256 newTotalFee = getSubmissionFee(a.currency, _packageContour);
    uint256 latest = a.fees.latestCommittedFee;

    return int256(newTotalFee) - int256(latest);
  }

  function getApplicationValidator(
    bytes32 _aId,
    bytes32 _role
  )
    external
    view
    returns (
      address validator,
      uint256 reward,
      bool rewardPaidOut,
      ValidationStatus status,
      string message
    )
  {
    return (
      applications[_aId].roleAddresses[_role],
      applications[_aId].assignedRewards[_role],
      applications[_aId].roleRewardPaidOut[_role],
      applications[_aId].validationStatus[_role],
      applications[_aId].roleMessages[_role]
    );
  }
}
