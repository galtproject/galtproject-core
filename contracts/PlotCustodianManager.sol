pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./AbstractApplication.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./Validators.sol";


contract PlotCustodianManager is AbstractApplication {
  using SafeMath for uint256;

  // `PlotCustodianManager` keccak256 hash
  bytes32 public constant APPLICATION_TYPE = 0xe2ce825e66d1e2b4efe1252bf2f9dc4f1d7274c343ac8a9f28b6776eb58188a6;

  // `CUSTODIAN_ROLE` bytes32 representation hash
  bytes32 public constant PC_CUSTODIAN_ROLE = 0x50435f435553544f4449414e5f524f4c45000000000000000000000000000000;
  // `AUDITOR_ROLE` bytes32 representation
  bytes32 public constant PC_AUDITOR_ROLE = 0x50435f41554449544f525f524f4c450000000000000000000000000000000000;

  enum ApplicationStatus {
    NOT_EXISTS,
    SUBMITTED,
    REVERTED,
    LOCKED,
    REVIEW,
    APPROVED,
    COMPLETED,
    REJECTED,
    CLOSED
  }

  enum ValidationStatus {
    NOT_EXISTS,
    PENDING,
    LOCKED
  }

  enum Action {
    ATTACH,
    DETACH
  }

  event LogApplicationStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event LogValidationStatusChanged(bytes32 applicationId, bytes32 role, ValidationStatus status);
  event LogNewApplication(bytes32 id, address applicant);

  struct Application {
    bytes32 id;
    address applicant;
    address chosenCustodian;
    uint256 packageTokenId;
    Action action;
    uint256 validatorsReward;
    uint256 galtSpaceReward;
    bool galtSpaceRewardPaidOut;
    uint8 approveConfirmations;
    Currency currency;
    ApplicationStatus status;

    bytes32[] custodianDocuments;
    bytes32[] assignedRoles;

    // TODO: combine into role struct
    mapping(bytes32 => uint256) assignedRewards;
    mapping(bytes32 => bool) roleRewardPaidOut;
    mapping(bytes32 => string) roleMessages;
    mapping(bytes32 => address) roleAddresses;
    mapping(address => bytes32) addressRoles;
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  struct ApplicationDetails {
    bytes32 credentialsHash;
    bytes32 ledgerIdentifier;
    uint8 precision;
    bytes2 country;
  }

  uint256 public gasPriceForDeposits;

  mapping(bytes32 => Application) public applications;
  mapping(uint256 => address) public assignedCustodians;

  SpaceToken public spaceToken;
  SplitMerge public splitMerge;

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
    gasPriceForDeposits = 4 wei;
    paymentMethod = PaymentMethod.ETH_AND_GALT;
  }

  modifier onlyApplicant(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(
      a.applicant == msg.sender,
      "Invalid applicant");

    _;
  }

  modifier onlyValidatorOfApplication(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.addressRoles[msg.sender] != 0x0, "The validator is not assigned to any role");
    require(validators.isValidatorActive(msg.sender), "Not active validator");

    _;
  }

  // TODO: move to abstract class
  modifier rolesReady() {
    require(validators.isApplicationTypeReady(APPLICATION_TYPE), "Roles list not complete");

    _;
  }

  /**
   * @dev Submit a new custodian management application
   * @param _packageTokenId package SpaceToken ID
   * @param _action either ATTACH or DETACH custodian
   * @param _chosenCustodian which would consider working on this application
   * @param _applicationFeeInGalt if GALT is application currency, 0 for ETH
   */
  function submitApplication(
    uint256 _packageTokenId,
    Action _action,
    address _chosenCustodian,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    returns (bytes32)
  {
    require(spaceToken.exists(_packageTokenId), "SpaceToken with the given ID doesn't exist");
    require(spaceToken.ownerOf(_packageTokenId) == msg.sender, "Sender should own the token");

    // Default is ETH
    Currency currency;
    uint256 fee;

    // ETH
    if (msg.value > 0) {
      require(_applicationFeeInGalt == 0, "Could not accept both ETH and GALT");
      require(msg.value >= minimalApplicationFeeInEth, "Incorrect fee passed in");
      fee = msg.value;
    // GALT
    } else {
      require(msg.value == 0, "Could not accept both ETH and GALT");
      require(_applicationFeeInGalt >= minimalApplicationFeeInGalt, "Incorrect fee passed in");
      galtToken.transferFrom(msg.sender, address(this), _applicationFeeInGalt);
      fee = _applicationFeeInGalt;
      currency = Currency.GALT;
    }

    Application memory a;
    bytes32 _id = keccak256(
      abi.encodePacked(
        _packageTokenId,
        blockhash(block.number),
        applicationsArray.length
      )
    );

    require(applications[_id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");
    require(
      validators.hasRole(_chosenCustodian, PC_CUSTODIAN_ROLE),
      "Unable to assign the application to the chosen custodian");
    validators.ensureValidatorActive(_chosenCustodian);

    a.status = ApplicationStatus.SUBMITTED;
    a.id = _id;
    a.applicant = msg.sender;
    a.chosenCustodian = _chosenCustodian;
    a.currency = currency;
    a.packageTokenId = _packageTokenId;
    a.action = _action;

    calculateAndStoreFee(a, fee);

    applications[_id] = a;

    applicationsArray.push(_id);
    applicationsByAddresses[msg.sender].push(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);

    assignRequiredValidatorRolesAndRewards(_id);

    return _id;
  }

  /**
   * @dev Resubmit an already reverted application
   * @param _aId application ID
   * @param _packageTokenId package SpaceToken ID
   * @param _action either ATTACH or DETACH custodian
   * @param _chosenCustodian which would consider working on this application
   */
  function resubmitApplication(
    bytes32 _aId,
    uint256 _packageTokenId,
    Action _action,
    address _chosenCustodian
  )
    external
    onlyApplicant(_aId)
    returns (bytes32)
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.REVERTED, "Application status should be REVERTED");
    require(spaceToken.exists(_packageTokenId), "SpaceToken with the given ID doesn't exist");
    require(spaceToken.ownerOf(_packageTokenId) == msg.sender, "Sender should own the token");
    require(
      validators.hasRole(_chosenCustodian, PC_CUSTODIAN_ROLE),
      "Unable to assign the application to the chosen custodian");
    validators.ensureValidatorActive(_chosenCustodian);

    a.packageTokenId = _packageTokenId;
    a.action = _action;
    a.chosenCustodian = _chosenCustodian;

    changeApplicationStatus(a, ApplicationStatus.SUBMITTED);
  }

  /**
   * @dev Application can be reverted by a custodian
   * @param _aId application ID
   */
  function revertApplication(bytes32 _aId) external {
    Application storage a = applications[_aId];
    require(validators.hasRole(msg.sender, PC_CUSTODIAN_ROLE), "Unable to lock with given roles");
    validators.ensureValidatorActive(msg.sender);

    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");
    require(a.roleAddresses[PC_CUSTODIAN_ROLE] == address(0), "Validator is already assigned on this role");
    require(a.validationStatus[PC_CUSTODIAN_ROLE] == ValidationStatus.PENDING, "Can't revert a role not in PENDING status");
    require(a.chosenCustodian == msg.sender, "The sender is not chosen as a custodian of this application");

    changeApplicationStatus(a, ApplicationStatus.REVERTED);
  }

  /**
   * @dev Application can be accepted by a custodian
   * @param _aId application ID
   */
  function acceptApplication(bytes32 _aId) external {
    Application storage a = applications[_aId];
    require(validators.hasRole(msg.sender, PC_CUSTODIAN_ROLE), "Unable to lock with given roles");
    validators.ensureValidatorActive(msg.sender);

    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");
    require(a.roleAddresses[PC_CUSTODIAN_ROLE] == address(0), "Validator is already assigned on this role");
    require(a.validationStatus[PC_CUSTODIAN_ROLE] == ValidationStatus.PENDING, "Can't accept a role not in PENDING status");
    require(a.chosenCustodian == msg.sender, "The sender is not chosen as a custodian of this application");

    a.roleAddresses[PC_CUSTODIAN_ROLE] = msg.sender;
    a.addressRoles[msg.sender] = PC_CUSTODIAN_ROLE;
    applicationsByValidator[msg.sender].push(_aId);

    changeValidationStatus(a, PC_CUSTODIAN_ROLE, ValidationStatus.LOCKED);

    if (a.validationStatus[PC_AUDITOR_ROLE] == ValidationStatus.LOCKED) {
      changeApplicationStatus(a, ApplicationStatus.LOCKED);
    }
  }

  /**
   * @dev Application can be locked by an auditor
   * @param _aId application ID
   */
  function lockApplication(bytes32 _aId) external {
    Application storage a = applications[_aId];
    require(validators.hasRole(msg.sender, PC_AUDITOR_ROLE), "Unable to lock with given roles");
    validators.ensureValidatorActive(msg.sender);

    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");
    require(a.roleAddresses[PC_AUDITOR_ROLE] == address(0), "Validator is already assigned on this role");
    require(a.validationStatus[PC_AUDITOR_ROLE] == ValidationStatus.PENDING, "Can't lock a role not in PENDING status");

    a.roleAddresses[PC_AUDITOR_ROLE] = msg.sender;
    a.addressRoles[msg.sender] = PC_AUDITOR_ROLE;
    applicationsByValidator[msg.sender].push(_aId);

    changeValidationStatus(a, PC_AUDITOR_ROLE, ValidationStatus.LOCKED);

    if (a.validationStatus[PC_CUSTODIAN_ROLE] == ValidationStatus.LOCKED) {
      changeApplicationStatus(a, ApplicationStatus.LOCKED);
    }
  }

  /**
   * @dev Attach SpaceToken to an application
   * @param _aId application ID
   */
  function attachToken(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.LOCKED, "Application status should be LOCKED");

    spaceToken.transferFrom(msg.sender, address(this), a.packageTokenId);

    changeApplicationStatus(a, ApplicationStatus.REVIEW);
  }

  /**
   * @dev Custodian attaches documents to the application.
   * Allows multiple calls. Each call replaces the previous document hashes array with a new one.
   *
   * @param _aId application ID
   * @param _documents to attach
   */
  function attachDocuments(bytes32 _aId, bytes32[] _documents) external {
    Application storage a = applications[_aId];
    validators.ensureValidatorActive(msg.sender);

    require(a.status == ApplicationStatus.REVIEW, "Application status should be REVIEW");
    require(a.chosenCustodian == msg.sender, "The sender is not chosen as a custodian of this application");

    a.custodianDocuments = _documents;
  }

  /**
   * @dev Custodian, Auditor and Applicant approve application.
   * Requires all the participants to call this method in order to confirm that they are agree on the given terms.
   * @param _aId application ID
   */
  function approveApplication(bytes32 _aId) external {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.REVIEW, "Application status should be REVIEW");

    if (msg.sender == a.roleAddresses[PC_CUSTODIAN_ROLE]) {
      a.approveConfirmations = a.approveConfirmations + 1;
    } else if (msg.sender == a.roleAddresses[PC_AUDITOR_ROLE]) {
      a.approveConfirmations = a.approveConfirmations + 2;
    } else if (msg.sender == a.applicant) {
      a.approveConfirmations = a.approveConfirmations + 4;
    } else {
      revert("Invalid role");
    }

    if (a.approveConfirmations == 7) {
      if (a.action == Action.DETACH) {
        delete assignedCustodians[a.packageTokenId];
      } else {
        assignedCustodians[a.packageTokenId] = a.chosenCustodian;
      }

      changeApplicationStatus(a, ApplicationStatus.APPROVED);
    }
  }

  /**
   * @dev Reject the application by a custodian if he changed his mind or the application looks suspicious.
   * @param _aId application ID
   */
  function rejectApplication(bytes32 _aId) external {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.REVIEW, "Application status should be REVIEW");
    require(msg.sender == a.roleAddresses[PC_CUSTODIAN_ROLE], "Only a custodian role is allowed to perform this action");

    changeApplicationStatus(a, ApplicationStatus.REJECTED);
  }

  /**
   * @dev Withdraw the attached SpaceToken back by the applicant
   * @param _aId application ID
   */
  function withdrawToken(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.APPROVED, "Application status should be APPROVED");

    spaceToken.transferFrom(address(this), msg.sender, a.packageTokenId);

    changeApplicationStatus(a, ApplicationStatus.COMPLETED);
  }

  /**
   * @dev Close the application by the applicant without attaching/detaching a custodian
   * @param _aId application ID
   */
  function closeApplication(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.REJECTED ||
      a.status == ApplicationStatus.LOCKED,
      "Application status should be either REJECTED or LOCKED");

    if (a.status == ApplicationStatus.REJECTED) {
      spaceToken.transferFrom(address(this), msg.sender, a.packageTokenId);
    }

    changeApplicationStatus(a, ApplicationStatus.CLOSED);
  }

  // DANGER: could reset non-existing role
  function resetApplicationRole(bytes32 _aId, bytes32 _role) external onlyOwner {
    Application storage a = applications[_aId];
    require(
      a.status != ApplicationStatus.APPROVED &&
      a.status != ApplicationStatus.NOT_EXISTS,
      "Could not reset applications in state NOT_EXISTS or APPROVED");
    require(a.roleAddresses[_role] != address(0), "Address should be already set");

    // Do not affect on application state
    a.roleAddresses[_role] = address(0);
    changeValidationStatus(a, _role, ValidationStatus.PENDING);
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

    require(
      a.status == ApplicationStatus.COMPLETED ||
      a.status == ApplicationStatus.CLOSED,
      "Application status should be either COMPLETED or CLOSED");

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

    require(
      a.status == ApplicationStatus.COMPLETED ||
      a.status == ApplicationStatus.CLOSED,
      "Application status should be either COMPLETED or CLOSED");
    require(a.galtSpaceReward > 0, "Reward is 0");
    require(a.galtSpaceRewardPaidOut == false, "Reward is already paid out");

    a.galtSpaceRewardPaidOut = true;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(a.galtSpaceReward);
    } else if (a.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, a.galtSpaceReward);
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
      address applicant,
      uint256 packageTokenId,
      address chosenCustodian,
      uint8 approveConfirmations,
      bytes32[] custodianDocuments,
      ApplicationStatus status,
      Currency currency,
      Action action,
      uint256 galtSpaceReward,
      uint256 validatorsReward,
      bool galtSpaceRewardPaidOut
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.applicant,
      m.packageTokenId,
      m.chosenCustodian,
      m.approveConfirmations,
      m.custodianDocuments,
      m.status,
      m.currency,
      m.action,
      m.galtSpaceReward,
      m.validatorsReward,
      m.galtSpaceRewardPaidOut
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

    _a.validatorsReward = validatorsReward;
    _a.galtSpaceReward = galtSpaceReward;
  }

  /**
   * Completely relies on Validator contract share values without any check
   */
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
}
