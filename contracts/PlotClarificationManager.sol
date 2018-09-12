pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./Validators.sol";


contract PlotClarificationManager is Initializable, Ownable {
  using SafeMath for uint256;

  // 'PlotClarificationManager' hash
  bytes32 public constant APPLICATION_TYPE = 0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7;

  // 'clarification pusher' bytes32 representation
  bytes32 public constant PUSHER_ROLE = 0x636c6172696669636174696f6e20707573686572000000000000000000000000;

  enum ApplicationStatus {
    NOT_EXISTS,
    NEW,
    VALUATION_REQUIRED,
    VALUATION,
    PAYMENT_REQUIRED,
    SUBMITTED,
    APPROVED,
    REVERTED,
    PACKED
  }

  enum ValidationStatus {
    NOT_EXISTS,
    PENDING,
    LOCKED,
    APPROVED,
    REVERTED
  }

  enum PaymentMethod {
    NONE,
    ETH_ONLY,
    GALT_ONLY,
    ETH_AND_GALT
  }

  enum Currency {
    ETH,
    GALT
  }

  event LogApplicationStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event LogValidationStatusChanged(bytes32 applicationId, bytes32 role, ValidationStatus status);
  event LogPackageTokenWithdrawn(bytes32 applicationId, uint256 packageTokenId);
  event LogGasDepositWithdrawnByApplicant(bytes32 applicationId);
  event LogGasDepositWithdrawnByValidator(bytes32 applicationId);
  event LogNewApplication(bytes32 id, address applicant);

  struct Application {
    bytes32 id;
    address applicant;
    bytes32 ledgerIdentifier;
    uint256 packageTokenId;
    uint256 validatorsReward;
    uint256 galtSpaceReward;
    uint256 gasDeposit;
    bool galtSpaceRewardPaidOut;
    bool tokenWithdrawn;
    bool gasDepositWithdrawn;

    uint8 precision;
    Currency currency;
    ApplicationStatus status;

    bytes32[] assignedRoles;

    mapping(bytes32 => uint256) assignedRewards;
    mapping(bytes32 => bool) roleRewardPaidOut;
    mapping(bytes32 => string) roleMessages;
    mapping(bytes32 => address) roleAddresses;
    mapping(address => bytes32) addressRoles;
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  mapping(bytes32 => Application) public applications;
  mapping(address => bytes32[]) public applicationsByAddresses;
  bytes32[] private applicationsArray;
  // WARNING: we do not remove applications from validator's list,
  // so do not rely on this variable to verify whether validator
  // exists or not.
  mapping(address => bytes32[]) public applicationsByValidator;

  PaymentMethod public paymentMethod;
  uint256 public minimalApplicationFeeInEth;
  uint256 public minimalApplicationFeeInGalt;
  uint256 public galtSpaceEthShare;
  uint256 public galtSpaceGaltShare;
  address private galtSpaceRewardsAddress;


  SpaceToken public spaceToken;
  SplitMerge public splitMerge;
  Validators public validators;
  ERC20 public galtToken;

  constructor () public {}

  modifier validatorsReady() {
    require(validators.isApplicationTypeReady(APPLICATION_TYPE), "Roles list not complete");

    _;
  }

  modifier anyValidator() {
    require(validators.isValidatorActive(msg.sender), "Not active validator");
    _;
  }

  modifier onlyValidatorOfApplication(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.addressRoles[msg.sender] != 0x0, "Not valid validator");
    validators.ensureValidatorActive(msg.sender);

    _;
  }

  modifier onlyPusherRole() {
    require(validators.hasRole(msg.sender, PUSHER_ROLE), "Validator doesn't qualify for this action");
    validators.ensureValidatorActive(msg.sender);

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

  function setGaltSpaceRewardsAddress(address _newAddress) external onlyOwner {
    galtSpaceRewardsAddress = _newAddress;
  }

  function setPaymentMethod(PaymentMethod _newMethod) external onlyOwner {
    paymentMethod = _newMethod;
  }

  function setMinimalApplicationFeeInEth(uint256 _newFee) external onlyOwner {
    minimalApplicationFeeInEth = _newFee;
  }

  function setMinimalApplicationFeeInGalt(uint256 _newFee) external onlyOwner {
    minimalApplicationFeeInGalt = _newFee;
  }

  function setGaltSpaceEthShare(uint256 _newShare) external onlyOwner {
    require(_newShare >= 1, "Percent value should be greater or equal to 1");
    require(_newShare <= 100, "Percent value should be greater or equal to 100");

    galtSpaceEthShare = _newShare;
  }

  function setGaltSpaceGaltShare(uint256 _newShare) external onlyOwner {
    require(_newShare >= 1, "Percent value should be greater or equal to 1");
    require(_newShare <= 100, "Percent value should be greater or equal to 100");

    galtSpaceGaltShare = _newShare;
  }

  function applyForPlotClarification(
    uint256 _packageTokenId,
    bytes32 _ledgerIdentifier,
    uint8 _precision
  )
    external
    validatorsReady
    returns (bytes32)
  {
    require(_precision > 5, "Precision should be greater than 5");
    require(spaceToken.ownerOf(_packageTokenId) == msg.sender, "Sender should own the provided token");

    spaceToken.transferFrom(msg.sender, address(this), _packageTokenId);

    Application memory a;
    bytes32 _id = keccak256(
      abi.encodePacked(
        _packageTokenId,
        blockhash(block.number)
      )
    );

    require(applications[_id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    a.status = ApplicationStatus.NEW;
    a.id = _id;
    a.applicant = msg.sender;

    a.packageTokenId = _packageTokenId;
    a.ledgerIdentifier = _ledgerIdentifier;
    a.precision = _precision;

    applications[_id] = a;
    applicationsArray.push(_id);
    applicationsByAddresses[msg.sender].push(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.NEW);

    return _id;
  }

  function submitApplicationForValuation(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.NEW, "ApplicationStatus should be NEW");

    changeApplicationStatus(a, ApplicationStatus.VALUATION_REQUIRED);

  }

  function lockApplicationForValuation(bytes32 _aId) external onlyPusherRole {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.VALUATION_REQUIRED, "ApplicationStatus should be VALUATION_REQUIRED");

    changeValidationStatus(a, PUSHER_ROLE, ValidationStatus.LOCKED);
    a.roleAddresses[PUSHER_ROLE] = msg.sender;
    a.addressRoles[msg.sender] = PUSHER_ROLE;

    changeApplicationStatus(a, ApplicationStatus.VALUATION);
  }

  function valuateGasDeposit(bytes32 _aId, uint256 _gasDeposit) external onlyPusherRole {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.VALUATION, "ApplicationStatus should be VALUATION");

    a.gasDeposit = _gasDeposit;
    changeApplicationStatus(a, ApplicationStatus.PAYMENT_REQUIRED);
  }

  function submitApplicationForReview(
    bytes32 _aId,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    validatorsReady
    onlyApplicant(_aId)
  {
    Application storage a = applications[_aId];
    uint256 deposit = a.gasDeposit;

    require(a.status == ApplicationStatus.PAYMENT_REQUIRED, "ApplicationStatus should be PAYMENT_REQUIRED");

    // Default is ETH
    Currency currency;
    uint256 fee;

    // GALT
    if (_applicationFeeInGalt > 0) {
      require(msg.value == deposit, "Provided gas deposit should exactly match valuation");
      require(_applicationFeeInGalt >= minimalApplicationFeeInGalt, "Incorrect fee passed in");
      galtToken.transferFrom(msg.sender, address(this), _applicationFeeInGalt);
      fee = _applicationFeeInGalt;
      a.currency = Currency.GALT;
    // ETH
    } else {
      require(msg.value >= (minimalApplicationFeeInEth + deposit), "Provided payment insufficient");

      fee = msg.value.sub(deposit);
    }

    calculateAndStoreFee(a, fee);
    assignRequiredValidatorRolesAndRewards(_aId);

    changeApplicationStatus(a, ApplicationStatus.SUBMITTED);
  }

  function lockApplicationForReview(bytes32 _aId, bytes32 _role) external anyValidator {
    Application storage a = applications[_aId];

    require(validators.hasRole(msg.sender, _role), "Unable to lock with given roles");
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

  function applicationPackingCompleted(bytes32 _aId) external onlyPusherRole {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.APPROVED, "ApplicationStatus should be APPROVED");

    a.status = ApplicationStatus.PACKED;
  }

  function withdrawPackageToken(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];
    ApplicationStatus status = a.status;

    /* solium-disable-next-line */
    require(status == ApplicationStatus.NEW ||
      status == ApplicationStatus.PAYMENT_REQUIRED ||
      status == ApplicationStatus.REVERTED ||
      status == ApplicationStatus.PACKED,
      "ApplicationStatus should one of NEW, PAYMENT_REQUIRED, REVERTED or PACKED");

    require(a.tokenWithdrawn == false, "Token is already withdrawn");

    spaceToken.transferFrom(address(this), msg.sender, a.packageTokenId);

    a.tokenWithdrawn = true;
    emit LogPackageTokenWithdrawn(a.id, a.packageTokenId);
  }

  function claimGasDepositAsApplicant(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.REVERTED,
      "ApplicationStatus should be REVERTED");
    require(a.tokenWithdrawn == true, "Token should be withdrawn first");
    require(a.gasDepositWithdrawn == false, "Gas deposit is already withdrawn");

    a.gasDepositWithdrawn = true;
    msg.sender.transfer(a.gasDeposit);

    emit LogGasDepositWithdrawnByApplicant(_aId);
  }

  function claimGasDepositAsValidator(
    bytes32 _aId
  )
    external
    onlyValidatorOfApplication(_aId)
    onlyPusherRole
  {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.PACKED,
      "ApplicationStatus should be PACKED");
    require(a.tokenWithdrawn == true, "Token should be withdrawn first");
    require(a.gasDepositWithdrawn == false, "Gas deposit is already withdrawn");

    a.gasDepositWithdrawn = true;
    msg.sender.transfer(a.gasDeposit);

    emit LogGasDepositWithdrawnByValidator(_aId);
  }

  function claimValidatorReward(bytes32 _aId) external onlyValidatorOfApplication(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.REVERTED ||
      a.status == ApplicationStatus.PACKED,
      "ApplicationStatus should one of REVERTED or PACKED");

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
      a.status == ApplicationStatus.PACKED,
      "ApplicationStatus should one of REVERTED or PACKED");
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
      uint256 packageTokenId,
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
      m.packageTokenId,
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
      uint8 precision,
      bytes32 ledgerIdentifier
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (m.precision, m.ledgerIdentifier);
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

  function addGeohashesToApplication(
    bytes32 _aId,
    uint256[] _geohashes,
    uint256[] _neighborsGeohashTokens,
    bytes2[] _directions
  )
    public
    onlyPusherRole
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.APPROVED, "ApplicationStatus should be APPROVED");

    for (uint8 i = 0; i < _geohashes.length; i++) {
      uint256 geohashTokenId = spaceToken.geohashToTokenId(_geohashes[i]);
      if (spaceToken.exists(geohashTokenId)) {
        require(
          spaceToken.ownerOf(geohashTokenId) == address(this),
          "Existing geohash token should belongs to PlotClarificationManager contract"
        );
      } else {
        spaceToken.mintGeohash(address(this), _geohashes[i]);
      }

      _geohashes[i] = geohashTokenId;
    }

    splitMerge.addGeohashesToPackage(a.packageTokenId, _geohashes, _neighborsGeohashTokens, _directions);
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
      if (role != PUSHER_ROLE) {
        changeValidationStatus(a, role, ValidationStatus.PENDING);
      }
      totalReward = totalReward.add(rewardShare);
    }

    assert(totalReward == a.validatorsReward);
  }
}