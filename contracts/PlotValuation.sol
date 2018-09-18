pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./AbstractApplication.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./Validators.sol";


contract PlotValuation is AbstractApplication {
  using SafeMath for uint256;

  // `PlotValuation` keccak256 hash
  bytes32 public constant APPLICATION_TYPE = 0x619647f9036acf2e8ad4ea6c06ae7256e68496af59818a2b63e51b27a46624e9;

  // `APPRAISER_ROLE` bytes32 representation hash
  bytes32 public constant APPRAISER_ROLE = 0x4150505241495345525f524f4c45000000000000000000000000000000000000;
  // `APPRAISER2_ROLE` bytes32 representation
  bytes32 public constant APPRAISER2_ROLE = 0x415050524149534552325f524f4c450000000000000000000000000000000000;
  // `AUDITOR_ROLE` bytes32 representation
  bytes32 public constant AUDITOR_ROLE = 0x41554449544f525f524f4c450000000000000000000000000000000000000000;

  enum ApplicationStatus {
    NOT_EXISTS,
    SUBMITTED,
    VALUATED,
    CONFIRMED,
    REVERTED,
    APPROVED
  }

  enum ValidationStatus {
    NOT_EXISTS,
    PENDING,
    LOCKED
  }

  event LogApplicationStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event LogValidationStatusChanged(bytes32 applicationId, bytes32 role, ValidationStatus status);
  event LogNewApplication(bytes32 id, address applicant);

  struct Application {
    bytes32 id;
    address applicant;
    uint256 packageTokenId;
    uint256 validatorsReward;
    uint256 galtSpaceReward;
    uint256 firstValuation;
    uint256 secondValuation;
    bool galtSpaceRewardPaidOut;
    ApplicationDetails details;
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

  struct ApplicationDetails {
    bytes32 credentialsHash;
    bytes32 ledgerIdentifier;
    uint8 precision;
    bytes2 country;
  }

  uint256 public gasPriceForDeposits;

  mapping(bytes32 => Application) public applications;

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
   * @dev Submit a new plot valuation application
   * @param _packageTokenId application id
   * @param _attachedDocuments IPFS hashes
   * @param _applicationFeeInGalt if GALT is application currency, 0 for ETH
   */
  function submitApplication(
    uint256 _packageTokenId,
    bytes32[] _attachedDocuments,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    rolesReady
    returns (bytes32)
  {
    require(_attachedDocuments.length > 0, "At least one document should be attached");
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
        _attachedDocuments[0],
        applicationsArray.length
      )
    );

    require(applications[_id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    a.status = ApplicationStatus.SUBMITTED;
    a.id = _id;
    a.applicant = msg.sender;
    a.currency = currency;
    a.packageTokenId = _packageTokenId;

    calculateAndStoreFee(a, fee);

    applications[_id] = a;

    applicationsArray.push(_id);
    applicationsByAddresses[msg.sender].push(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);

    assignRequiredValidatorRolesAndRewards(_id);

    return _id;
  }

  // Application can be locked by a role only once.
  function lockApplication(bytes32 _aId, bytes32 _role) external anyValidator {
    Application storage a = applications[_aId];
    require(validators.hasRole(msg.sender, _role), "Unable to lock with given roles");

    require(
      a.status == ApplicationStatus.SUBMITTED ||
      a.status == ApplicationStatus.VALUATED ||
      a.status == ApplicationStatus.REVERTED ||
      a.status == ApplicationStatus.CONFIRMED,
      "Application status should be SUBMITTED, REVERTED, VALUATED or CONFIRMED");
    require(a.roleAddresses[_role] == address(0), "Validator is already assigned on this role");
    require(a.validationStatus[_role] == ValidationStatus.PENDING, "Can't lock a role not in PENDING status");

    a.roleAddresses[_role] = msg.sender;
    a.addressRoles[msg.sender] = _role;
    applicationsByValidator[msg.sender].push(_aId);

    changeValidationStatus(a, _role, ValidationStatus.LOCKED);
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

  /**
   * @dev First custodian valuates the plot
   * @param _aId application id
   * @param _valuation in GALT
   */
  function valuatePlot(
    bytes32 _aId,
    uint256 _valuation
  )
    external
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.SUBMITTED || a.status == ApplicationStatus.REVERTED,
      "Application status should be SUBMITTED or REVERTED");

    bytes32 role = a.addressRoles[msg.sender];

    require(role == APPRAISER_ROLE, "APPRAISER_ROLE expected");
    require(a.validationStatus[role] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.roleAddresses[role] == msg.sender, "Sender not assigned to this application");

    a.firstValuation = _valuation;

    changeApplicationStatus(a, ApplicationStatus.VALUATED);
  }

  /**
   * @dev Second custodian verifies the first valuation.
   * If the values match, status becomes CONFIRMED, if not - REVERTED.
   * @param _aId application id
   * @param _valuation in GALT
   */
  function valuatePlot2(
    bytes32 _aId,
    uint256 _valuation
  )
    external
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.VALUATED,
      "Application status should be VALUATED");

    bytes32 role = a.addressRoles[msg.sender];

    require(role == APPRAISER2_ROLE, "APPRAISER2_ROLE expected");
    require(a.validationStatus[role] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.roleAddresses[role] == msg.sender, "Sender not assigned to this application");

    a.secondValuation = _valuation;

    if (a.firstValuation == _valuation) {
      changeApplicationStatus(a, ApplicationStatus.CONFIRMED);
    } else {
      changeApplicationStatus(a, ApplicationStatus.REVERTED);
    }
  }

  /**
   * @dev Auditor approves plot valuation.
   * Changes status to APPROVED.
   * @param _aId application id
   */
  function approveValuation(
    bytes32 _aId
  )
    external
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.CONFIRMED,
      "Application status should be CONFIRMED");

    bytes32 role = a.addressRoles[msg.sender];

    require(role == AUDITOR_ROLE, "AUDITOR_ROLE expected");
    require(a.validationStatus[role] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.roleAddresses[role] == msg.sender, "Sender not assigned to this application");

    changeApplicationStatus(a, ApplicationStatus.APPROVED);
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
      a.status == ApplicationStatus.APPROVED,
      "Application status should be APPROVED");

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
      a.status == ApplicationStatus.APPROVED,
      "Application status should be APPROVED");
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
      ApplicationStatus status,
      Currency currency,
      uint256 firstValuation,
      uint256 secondValuation,
      bytes32[] assignedValidatorRoles,
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
      m.status,
      m.currency,
      m.firstValuation,
      m.secondValuation,
      m.assignedRoles,
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
