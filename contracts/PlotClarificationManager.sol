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
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./Validators.sol";
import "./AbstractApplication.sol";


contract PlotClarificationManager is AbstractApplication {
  using SafeMath for uint256;

  // 'PlotClarificationManager' hash
  bytes32 public constant APPLICATION_TYPE = 0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7;

  enum ApplicationStatus {
    NOT_EXISTS,
    SUBMITTED,
    APPROVED,
    REVERTED
  }

  enum ValidationStatus {
    NOT_EXISTS,
    PENDING,
    LOCKED,
    APPROVED,
    REVERTED
  }

  event LogApplicationStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event LogValidationStatusChanged(bytes32 applicationId, bytes32 role, ValidationStatus status);
  event LogPackageTokenWithdrawn(bytes32 applicationId, uint256 spaceTokenId);
  event LogNewApplication(bytes32 id, address applicant);

  struct Application {
    bytes32 id;
    address applicant;
    bytes32 ledgerIdentifier;
    uint256 spaceTokenId;
    
    uint256 validatorsReward;
    uint256 galtSpaceReward;
    uint256 gasDeposit;
    bool galtSpaceRewardPaidOut;
    bool tokenWithdrawn;
    bool gasDepositWithdrawn;

    // Default is ETH
    Currency currency;
    ApplicationStatus status;

    uint256[] newContour;
    int256[] newHeights;
    int256 newLevel;
    bytes32[] assignedRoles;

    mapping(bytes32 => uint256) assignedRewards;
    mapping(bytes32 => bool) roleRewardPaidOut;
    mapping(bytes32 => string) roleMessages;
    mapping(bytes32 => address) roleAddresses;
    mapping(address => bytes32) addressRoles;
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  mapping(bytes32 => Application) public applications;

  SpaceToken public spaceToken;
  SplitMerge public splitMerge;

  constructor () public {}

  modifier validatorsReady() {
    require(validators.isApplicationTypeReady(APPLICATION_TYPE), "Roles list not complete");

    _;
  }

  modifier onlyValidatorOfApplication(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.addressRoles[msg.sender] != 0x0, "Not valid validator");
    validators.requireValidatorActiveWithAssignedActiveRole(msg.sender, a.addressRoles[msg.sender]);

    _;
  }

  modifier onlyApplicant(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.applicant == msg.sender, "Applicant invalid");

    _;
  }

  function initialize(
    SpaceToken _spaceToken,
    SplitMerge _splitMerge,
    Validators _validators,
    ERC20 _galtToken,
    address _galtSpaceRewardsAddress
  )
    external
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
    paymentMethod = PaymentMethod.ETH_AND_GALT;
  }

  function submitApplication(
    uint256 _spaceTokenId,
    bytes32 _ledgerIdentifier,
    uint256[] _newContour,
    int256[] _newHeights,
    int256 _newLevel,
    uint256 _applicationFeeInGalt
  )
    external
    validatorsReady
    payable
    returns (bytes32)
  {
    require(spaceToken.ownerOf(_spaceTokenId) == msg.sender, "Sender should own the provided token");
    require(_newContour.length >= 3, "Contour sould have at least 3 vertices");
    require(_newContour.length == _newHeights.length, "Contour length should be equal heights length");

    spaceToken.transferFrom(msg.sender, address(this), _spaceTokenId);

    Application memory a;
    bytes32 _id = keccak256(
      abi.encodePacked(
        _spaceTokenId,
        blockhash(block.number)
      )
    );

    uint256 fee;

    // GALT
    if (_applicationFeeInGalt > 0) {
      require(msg.value == 0, "Could not accept both GALT and ETH");
      require(_applicationFeeInGalt >= minimalApplicationFeeInGalt, "Insufficient payment");
      galtToken.transferFrom(msg.sender, address(this), _applicationFeeInGalt);
      fee = _applicationFeeInGalt;
      a.currency = Currency.GALT;
      // ETH
    } else {
      require(msg.value >= minimalApplicationFeeInEth, "Insufficient payment");

      fee = msg.value;
    }

    require(applications[_id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    a.status = ApplicationStatus.SUBMITTED;
    a.id = _id;
    a.applicant = msg.sender;
    a.newContour = _newContour;
    a.newHeights = _newHeights;
    a.newLevel = _newLevel;

    a.spaceTokenId = _spaceTokenId;
    a.ledgerIdentifier = _ledgerIdentifier;

    applications[_id] = a;
    applicationsArray.push(_id);
    applicationsByAddresses[msg.sender].push(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);

    calculateAndStoreFee(applications[_id], fee);
    assignRequiredValidatorRolesAndRewards(_id);

    return _id;
  }

  function lockApplicationForReview(bytes32 _aId, bytes32 _role) external anyValidator {
    Application storage a = applications[_aId];

    validators.requireValidatorActiveWithAssignedActiveRole(msg.sender, _role);
    require(a.status == ApplicationStatus.SUBMITTED, "ApplicationStatus should be SUBMITTED");
    require(a.roleAddresses[_role] == address(0), "Validator is already assigned on this role");
    require(a.validationStatus[_role] == ValidationStatus.PENDING, "Can't lock a role not in PENDING status");

    a.roleAddresses[_role] = msg.sender;
    a.addressRoles[msg.sender] = _role;
    applicationsByValidator[msg.sender].push(_aId);

    changeValidationStatus(a, _role, ValidationStatus.LOCKED);
  }

  function approveApplication(
    bytes32 _aId
  )
    external
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.SUBMITTED, "ApplicationStatus should be SUBMITTED");

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
      splitMerge.setPackageContour(a.spaceTokenId, a.newContour);
      splitMerge.setPackageHeights(a.spaceTokenId, a.newHeights);
      splitMerge.setPackageLevel(a.spaceTokenId, a.newLevel);
      changeApplicationStatus(a, ApplicationStatus.APPROVED);
    }
  }

  function revertApplication(
    bytes32 _aId,
    string _message
  )
    external
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.SUBMITTED, "ApplicationStatus should be SUBMITTED");

    bytes32 senderRole = a.addressRoles[msg.sender];

    require(a.validationStatus[senderRole] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.roleAddresses[senderRole] == msg.sender, "Sender not assigned to this application");

    uint256 len = a.assignedRoles.length;

    for (uint8 i = 0; i < len; i++) {
      bytes32 currentRole = a.assignedRoles[i];
      if (a.validationStatus[currentRole] == ValidationStatus.PENDING) {
        revert("All validator roles should lock the application first");
      }
    }

    a.roleMessages[senderRole] = _message;

    changeValidationStatus(a, senderRole, ValidationStatus.REVERTED);
    changeApplicationStatus(a, ApplicationStatus.REVERTED);
  }

  function resubmitApplication(
    bytes32 _aId
  )
    external
    onlyApplicant(_aId)
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.REVERTED, "ApplicationStatus should be REVERTED");

    uint256 len = a.assignedRoles.length;

    for (uint8 i = 0; i < len; i++) {
      bytes32 currentRole = a.assignedRoles[i];
      if (a.validationStatus[currentRole] != ValidationStatus.LOCKED) {
        changeValidationStatus(a, currentRole, ValidationStatus.LOCKED);
      }
    }

    changeApplicationStatus(a, ApplicationStatus.SUBMITTED);
  }

  function withdrawPackageToken(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];
    ApplicationStatus status = a.status;

    /* solium-disable-next-line */
    require(
      status == ApplicationStatus.REVERTED ||
      status == ApplicationStatus.APPROVED,
      "ApplicationStatus should one of REVERTED or APPROVED");

    require(a.tokenWithdrawn == false, "Token is already withdrawn");

    spaceToken.transferFrom(address(this), msg.sender, a.spaceTokenId);

    a.tokenWithdrawn = true;
    emit LogPackageTokenWithdrawn(a.id, a.spaceTokenId);
  }

  function claimValidatorReward(bytes32 _aId) external onlyValidatorOfApplication(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.REVERTED ||
      a.status == ApplicationStatus.APPROVED,
      "ApplicationStatus should one of REVERTED or APPROVED");

    bytes32 role = a.addressRoles[msg.sender];

    require(a.tokenWithdrawn == true, "Token should be withdrawn first");
    require(a.roleRewardPaidOut[role] == false, "Reward is already withdrawn");

    uint256 reward = a.assignedRewards[role];
    a.roleRewardPaidOut[role] = true;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (a.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, reward);
    } else {
      revert("Unknown currency");
    }
  }

  function claimGaltSpaceReward(bytes32 _aId) external {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.REVERTED ||
      a.status == ApplicationStatus.APPROVED,
      "ApplicationStatus should one of REVERTED or APPROVED");
    require(msg.sender == galtSpaceRewardsAddress, "The method call allowed only for galtSpace address");

    require(a.tokenWithdrawn == true, "Token should be withdrawn first");
    require(a.galtSpaceRewardPaidOut == false, "Reward is already withdrawn");

    a.galtSpaceRewardPaidOut = true;
    uint256 reward = a.galtSpaceReward;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (a.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, reward);
    } else {
      revert("Unknown currency");
    }
  }

  function getApplicationById(
    bytes32 _id
  )
    external
    view
    returns (
      ApplicationStatus status,
      Currency currency,
      address applicant,
      uint256 spaceTokenId,
      bool tokenWithdrawn,
      bool gasDepositWithdrawn,
      bool galtSpaceRewardPaidOut,
      bytes32[] assignedValidatorRoles,
      uint256 gasDeposit,
      uint256 validatorsReward,
      uint256 galtSpaceReward
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.status,
      m.currency,
      m.applicant,
      m.spaceTokenId,
      m.tokenWithdrawn,
      m.gasDepositWithdrawn,
      m.galtSpaceRewardPaidOut,
      m.assignedRoles,
      m.gasDeposit,
      m.validatorsReward,
      m.galtSpaceReward
    );
  }

  function getApplicationPayloadById(
    bytes32 _id
  )
    external
    view
    returns(
      uint256[] newContour,
      int256[] newHeights,
      int256 newLevel,
      bytes32 ledgerIdentifier
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (m.newContour, m.newHeights, m.newLevel, m.ledgerIdentifier);
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
    Application storage m = applications[_aId];

    return (
      m.roleAddresses[_role],
      m.assignedRewards[_role],
      m.roleRewardPaidOut[_role],
      m.validationStatus[_role],
      m.roleMessages[_role]
    );
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

  function changeApplicationStatus(
    Application storage _a,
    ApplicationStatus _status
  )
    internal
  {
    emit LogApplicationStatusChanged(_a.id, _status);

    _a.status = _status;
  }

  function calculateAndStoreFee(
    Application storage _a,
    uint256 _fee
  )
    internal
  {
    uint256 share;
    assert(_fee > 0);

    if (_a.currency == Currency.ETH) {
      share = galtSpaceEthShare;
    } else {
      share = galtSpaceGaltShare;
    }

    uint256 galtSpaceReward = share.mul(_fee).div(100);
    uint256 validatorsReward = _fee.sub(galtSpaceReward);

    assert(validatorsReward.add(galtSpaceReward) == _fee);

    _a.validatorsReward = validatorsReward;
    _a.galtSpaceReward = galtSpaceReward;
  }

  function assignRequiredValidatorRolesAndRewards(bytes32 _aId) internal {
    Application storage a = applications[_aId];
    assert(a.validatorsReward > 0);

    uint256 totalReward = 0;

    a.assignedRoles = validators.getApplicationTypeRoles(APPLICATION_TYPE);
    uint256 len = a.assignedRoles.length;
    for (uint8 i = 0; i < len; i++) {
      bytes32 role = a.assignedRoles[i];
      uint256 rewardShare = a
        .validatorsReward
        .mul(validators.getRoleRewardShare(role))
        .div(100);

      a.assignedRewards[role] = rewardShare;
      changeValidationStatus(a, role, ValidationStatus.PENDING);
      totalReward = totalReward.add(rewardShare);
    }

    assert(totalReward == a.validatorsReward);
  }

  function getAllApplications() external view returns (bytes32[]) {
    return applicationsArray;
  }

  function getApplicationsByAddress(address _applicant) external view returns (bytes32[]) {
    return applicationsByAddresses[_applicant];
  }

  function getApplicationsByValidator(address _validator) external view returns (bytes32[]) {
    return applicationsByValidator[_validator];
  }
}
