pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./Validators.sol";


contract PlotManager is Initializable, Ownable {
  using SafeMath for uint256;

  bytes32 public constant APPLICATION_TYPE = 0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6;

  enum ApplicationStatus {
    NOT_EXISTS,
    NEW,
    SUBMITTED,
    APPROVED,
    REJECTED,
    REVERTED,
    DISASSEMBLED_BY_APPLICANT,
    DISASSEMBLED_BY_VALIDATOR,
    REVOKED
  }

  enum ValidationStatus {
    INTACT,
    LOCKED,
    APPROVED,
    REJECTED,
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
  event LogNewApplication(bytes32 id, address applicant);

  struct Application {
    bytes32 id;
    address applicant;
    bytes32 credentialsHash;
    bytes32 ledgerIdentifier;
    uint256 packageTokenId;
    uint256 validatorsReward;
    uint256 galtSpaceReward;
    bool galtSpaceRewardPaidOut;
    uint8 precision;
    bytes2 country;
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

  PaymentMethod public paymentMethod;
  uint256 public applicationFeeInEth;
  uint256 public applicationFeeInGalt;
  uint256 public galtSpaceEthShare;
  uint256 public galtSpaceGaltShare;
  address private galtSpaceRewardsAddress;

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
    applicationFeeInEth = 1;
    applicationFeeInGalt = 10;
    galtSpaceEthShare = 33;
    galtSpaceGaltShare = 33;
    paymentMethod = PaymentMethod.ETH_AND_GALT;
  }

  modifier onlyApplicant(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.applicant == msg.sender, "Not valid applicant");

    _;
  }

  modifier anyValidator() {
    require(validators.isValidatorActive(msg.sender), "Not active validator");
    _;
  }

  modifier onlyValidatorOfApplication(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.addressRoles[msg.sender] != 0x0, "Not valid validator");
    require(validators.isValidatorActive(msg.sender), "Not active validator");

    _;
  }

  modifier ready() {
    require(validators.isApplicationTypeReady(APPLICATION_TYPE), "Roles list not complete");

    _;
  }

  // TODO: fix incorrect meaning
  function setGaltSpaceRewardsAddress(address _newAddress) public onlyOwner {
    galtSpaceRewardsAddress = _newAddress;
  }

  function setPaymentMethod(PaymentMethod _newMethod) public onlyOwner {
    paymentMethod = _newMethod;
  }

  function setApplicationFeeInEth(uint256 _newFee) public onlyOwner {
    applicationFeeInEth = _newFee;
  }

  function setApplicationFeeInGalt(uint256 _newFee) public onlyOwner {
    applicationFeeInGalt = _newFee;
  }

  function setGaltSpaceEthShare(uint256 _newShare) public onlyOwner {
    require(_newShare >= 1, "Percent value should be greater or equal to 1");
    require(_newShare <= 100, "Percent value should be greater or equal to 100");

    galtSpaceEthShare = _newShare;
  }

  function setGaltSpaceGaltShare(uint256 _newShare) public onlyOwner {
    require(_newShare >= 1, "Percent value should be greater or equal to 1");
    require(_newShare <= 100, "Percent value should be greater or equal to 100");

    galtSpaceGaltShare = _newShare;
  }

  function changeApplicationDetails(
    bytes32 _aId,
    bytes32 _credentialsHash,
    bytes32 _ledgerIdentifier,
    uint8 _precision,
    bytes2 _country
  )
    public
    onlyApplicant(_aId)
  {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.NEW || a.status == ApplicationStatus.REVERTED,
      "Application status should be NEW or REVERTED."
    );

    a.credentialsHash = _credentialsHash;
    a.ledgerIdentifier = _ledgerIdentifier;
    a.precision = _precision;
    a.country = _country;
  }

  function applyForPlotOwnershipGalt(
    uint256[] _packageContour,
    uint256 _baseGeohash,
    bytes32 _credentialsHash,
    bytes32 _ledgerIdentifier,
    bytes2 _country,
    uint8 _precision,
    uint256 _applicationFeeInGalt
  )
    public
    ready
    returns (bytes32)
  {
    require(_precision > 5, "Precision should be greater than 5");
    require(_packageContour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(_packageContour.length <= 50, "Number of contour elements should be equal or less than 50");
    require(_applicationFeeInGalt >= applicationFeeInGalt, "Application fee should be greater or equal to the minimum value");

    galtToken.transferFrom(msg.sender, address(this), _applicationFeeInGalt);

    Application memory a;
    bytes32 _id = keccak256(
      abi.encodePacked(
        _baseGeohash,
        _packageContour[0],
        _packageContour[1],
        _credentialsHash
      )
    );

    require(applications[_id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    a.status = ApplicationStatus.NEW;
    a.id = _id;
    a.applicant = msg.sender;
    a.country = _country;
    a.credentialsHash = _credentialsHash;
    a.ledgerIdentifier = _ledgerIdentifier;
    a.precision = _precision;
    a.currency = Currency.GALT;

    calculateAndStoreGaltFee(a, _applicationFeeInGalt);

    uint256 geohashTokenId = spaceToken.mintGeohash(address(this), _baseGeohash);
    uint256 packageTokenId = splitMerge.initPackage(geohashTokenId);
    a.packageTokenId = packageTokenId;

    splitMerge.setPackageContour(packageTokenId, _packageContour);

    applications[_id] = a;
    applicationsArray.push(_id);
    applicationsByAddresses[msg.sender].push(_id);

    assignRequiredValidatorRolesAndRewards(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.NEW);

    return _id;
  }

  function calculateAndStoreGaltFee(Application memory _a, uint256 _applicationFeeInGalt) internal {
    uint256 galtSpaceReward = galtSpaceGaltShare.mul(_applicationFeeInGalt).div(100);
    uint256 validatorsReward = _applicationFeeInGalt.sub(galtSpaceReward);

    assert(validatorsReward.add(galtSpaceReward) == _applicationFeeInGalt);

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
      totalReward = totalReward.add(rewardShare);
    }

    assert(totalReward == a.validatorsReward);
  }

  function applyForPlotOwnership(
    uint256[] _packageContour,
    uint256 _baseGeohash,
    bytes32 _credentialsHash,
    bytes32 _ledgerIdentifier,
    bytes2 _country,
    uint8 _precision
  )
    public
    payable
    ready
    returns (bytes32)
  {
    require(_precision > 5, "Precision should be greater than 5");
    require(_packageContour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(_packageContour.length <= 50, "Number of contour elements should be equal or less than 50");
    require(msg.value >= applicationFeeInEth, "Incorrect fee passed in");

    Application memory a;
    bytes32 _id = keccak256(
      abi.encodePacked(
        _baseGeohash,
        _packageContour[0],
        _packageContour[1],
        _credentialsHash
      )
    );

    require(applications[_id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    a.status = ApplicationStatus.NEW;
    a.id = _id;
    a.applicant = msg.sender;
    a.country = _country;
    a.credentialsHash = _credentialsHash;
    a.ledgerIdentifier = _ledgerIdentifier;
    a.precision = _precision;
    a.currency = Currency.ETH;

    uint256 galtSpaceReward = galtSpaceEthShare.mul(msg.value).div(100);
    uint256 validatorsReward = msg.value.sub(galtSpaceReward);

    assert(validatorsReward.add(galtSpaceReward) == msg.value);

    a.validatorsReward = validatorsReward;
    a.galtSpaceReward = galtSpaceReward;

    uint256 geohashTokenId = spaceToken.mintGeohash(address(this), _baseGeohash);
    uint256 packageTokenId = splitMerge.initPackage(geohashTokenId);
    a.packageTokenId = packageTokenId;

    splitMerge.setPackageContour(packageTokenId, _packageContour);

    applications[_id] = a;
    applicationsArray.push(_id);
    applicationsByAddresses[msg.sender].push(_id);

    assignRequiredValidatorRolesAndRewards(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.NEW);

    return _id;
  }

  function addGeohashesToApplication(
    bytes32 _aId,
    uint256[] _geohashes,
    uint256[] _neighborsGeohashTokens,
    bytes2[] _directions
  )
    public
    onlyApplicant(_aId)
  {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.NEW || a.status == ApplicationStatus.REVERTED,
      "Application status should be NEW or REVERTED."
    );

    for (uint8 i = 0; i < _geohashes.length; i++) {
      uint256 geohashTokenId = spaceToken.geohashToTokenId(_geohashes[i]);
      if (spaceToken.exists(geohashTokenId)) {
        require(
          spaceToken.ownerOf(geohashTokenId) == address(this),
          "Existing geohash token should belongs to PlotManager contract"
        );
      } else {
        spaceToken.mintGeohash(address(this), _geohashes[i]);
      }

      _geohashes[i] = geohashTokenId;
    }

    splitMerge.addGeohashesToPackage(a.packageTokenId, _geohashes, _neighborsGeohashTokens, _directions);
  }

  function removeGeohashesFromApplication(
    bytes32 _aId,
    uint256[] _geohashes,
    bytes2[] _directions1,
    bytes2[] _directions2
  )
    public
  {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.NEW || a.status == ApplicationStatus.REJECTED || a.status == ApplicationStatus.REVERTED,
      "Application status should be NEW or REJECTED for this operation."
    );

    require(
      a.applicant == msg.sender ||
      (a.addressRoles[msg.sender] != 0x0 && validators.isValidatorActive(msg.sender)),
      "Sender is not valid");

    for (uint8 i = 0; i < _geohashes.length; i++) {
      uint256 geohashTokenId = spaceToken.geohashToTokenId(_geohashes[i]);

      require(spaceToken.ownerOf(geohashTokenId) == address(splitMerge), "Existing geohash token should belongs to PlotManager contract");

      _geohashes[i] = geohashTokenId;
    }

    // TODO: implement directions
    splitMerge.removeGeohashesFromPackage(a.packageTokenId, _geohashes, _directions1, _directions2);

    if (splitMerge.packageGeohashesCount(a.packageTokenId) == 0) {
      if (msg.sender == a.applicant) {
        changeApplicationStatus(a, ApplicationStatus.DISASSEMBLED_BY_APPLICANT);
      } else {
        changeApplicationStatus(a, ApplicationStatus.DISASSEMBLED_BY_VALIDATOR);
      }
    }
  }

  function submitApplication(bytes32 _aId) public onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.NEW || a.status == ApplicationStatus.REVERTED,
      "Application status should be NEW");

    changeApplicationStatus(a, ApplicationStatus.SUBMITTED);
  }

  // Application can be locked by a role only once.
  function lockApplicationForReview(bytes32 _aId, bytes32 _role) public anyValidator {
    Application storage a = applications[_aId];
    require(validators.hasRole(msg.sender, _role), "Unable to lock with given roles");

    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");
    require(a.roleAddresses[_role] == address(0), "Validator is already assigned on this role");
    require(a.validationStatus[_role] == ValidationStatus.INTACT, "Can't lock an application already in work");

    a.roleAddresses[_role] = msg.sender;
    a.addressRoles[msg.sender] = _role;
    applicationsByValidator[msg.sender].push(_aId);

    changeValidationStatus(a, _role, ValidationStatus.LOCKED);
  }

  function resetApplicationRole(bytes32 _aId, bytes32 _role) public onlyOwner {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");
    require(a.validationStatus[_role] != ValidationStatus.INTACT, "Validation status not set");
    require(a.roleAddresses[_role] != address(0), "Address should be already set");

    // Do not affect on application state
    a.roleAddresses[_role] = address(0);
    changeValidationStatus(a, _role, ValidationStatus.INTACT);
  }

  function approveApplication(
    bytes32 _aId,
    bytes32 _credentialsHash
  )
    public
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(a.credentialsHash == _credentialsHash, "Credentials don't match");
    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");
    require(validators.isValidatorActive(msg.sender), "Validator is not active");

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
      spaceToken.transferFrom(address(this), a.applicant, a.packageTokenId);
    }
  }

  function rejectApplication(
    bytes32 _aId,
    string _message
  )
    public
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");

    uint256 len = a.assignedRoles.length;

    for (uint8 i = 0; i < len; i++) {
      bytes32 currentRole = a.assignedRoles[i];
      if (a.validationStatus[currentRole] == ValidationStatus.INTACT) {
        revert("One of the roles has INTACT status");
      }
    }

    bytes32 senderRole = a.addressRoles[msg.sender];
    a.roleMessages[senderRole] = _message;

    changeValidationStatus(a, senderRole, ValidationStatus.REJECTED);
    changeApplicationStatus(a, ApplicationStatus.REJECTED);
  }

  function revertApplication(
    bytes32 _aId,
    string _message
  )
    public
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");

    bytes32 senderRole = a.addressRoles[msg.sender];
    uint256 len = a.assignedRoles.length;

    for (uint8 i = 0; i < len; i++) {
      bytes32 currentRole = a.assignedRoles[i];
      if (a.validationStatus[currentRole] != ValidationStatus.LOCKED) {
        changeValidationStatus(a, currentRole, ValidationStatus.LOCKED);
      }
    }

    a.roleMessages[senderRole] = _message;

    changeApplicationStatus(a, ApplicationStatus.REVERTED);
  }

  function revokeApplication(bytes32 _aId) public onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.NEW || a.status == ApplicationStatus.DISASSEMBLED_BY_APPLICANT,
      "Application status should either NEW or DISASSEMBLED_BY_APPLICANT");

    require(
      splitMerge.packageGeohashesCount(a.packageTokenId) == 0,
      "Application package geohashes count should be 0");

    changeApplicationStatus(a, ApplicationStatus.REVOKED);

    uint256 deposit = a.validatorsReward.add(a.galtSpaceReward);

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(deposit);
    } else {
      galtToken.transfer(msg.sender, deposit);
    }
  }

  function claimValidatorReward(
    bytes32 _aId,
    Currency _currency
  )
    public 
    onlyValidatorOfApplication(_aId)
  {
    Application storage a = applications[_aId];
    bytes32 senderRole = a.addressRoles[msg.sender];
    uint256 reward = a.assignedRewards[senderRole];

    require(
      a.status == ApplicationStatus.APPROVED || a.status == ApplicationStatus.DISASSEMBLED_BY_VALIDATOR,
      "Application status should be ether APPROVED or DISASSEMBLED_BY_VALIDATOR");

    require(reward > 0, "Reward is 0");
    require(a.currency == _currency, "Reward currency doesn't match");
    require(a.roleRewardPaidOut[senderRole] == false, "Reward is already paid");
    validators.ensureValidatorActive(msg.sender);

    a.roleRewardPaidOut[senderRole] = true; 

    if (_currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (_currency == Currency.GALT) {
      galtToken.transfer(msg.sender, reward);
    } else {
      revert("Unknown currency");
    }
  }

  function claimGaltSpaceReward(
    bytes32 _aId,
    Currency _currency
  )
   public
  {
    require(msg.sender == galtSpaceRewardsAddress, "The method call allowed only for galtSpace address");

    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.APPROVED || a.status == ApplicationStatus.DISASSEMBLED_BY_VALIDATOR,
      "Application status should be ether APPROVED or DISASSEMBLED_BY_VALIDATOR");
    require(a.galtSpaceReward > 0, "Reward is 0");
    require(a.galtSpaceRewardPaidOut == false, "Reward is already paid out");
    require(a.currency == _currency, "Reward currency doesn't match");

    a.galtSpaceRewardPaidOut = true;

    if (_currency == Currency.ETH) {
      msg.sender.transfer(a.galtSpaceReward);
    } else if (_currency == Currency.GALT) {
      galtToken.transfer(msg.sender, a.galtSpaceReward);
    } else {
      revert("Unknown currency");
    }
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
    public
    view
    returns (bool)
  {
    return (_hash == applications[_id].credentialsHash);
  }

  function getApplicationById(
    bytes32 _id
  )
    public
    view
    returns (
      address applicant,
      uint256 packageTokenId,
      bytes32 credentialsHash,
      ApplicationStatus status,
      Currency currency,
      uint8 precision,
      bytes2 country,
      bytes32 ledgerIdentifier,
      bytes32[] assignedValidatorRoles
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.applicant,
      m.packageTokenId,
      m.credentialsHash,
      m.status,
      m.currency,
      m.precision,
      m.country,
      m.ledgerIdentifier,
      m.assignedRoles
    );
  }

  function getApplicationFinanceById(
    bytes32 _id
  )
    public
    view
    returns (
      ApplicationStatus status,
      Currency currency,
      uint256 validatorsReward,
      uint256 galtSpaceReward
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.status,
      m.currency,
      m.validatorsReward,
      m.galtSpaceReward
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
      ValidationStatus status,
      string message
    )
  {
    return (
      applications[_aId].roleAddresses[_role],
      applications[_aId].assignedRewards[_role],
      applications[_aId].validationStatus[_role],
      applications[_aId].roleMessages[_role]
    );
  }
}
