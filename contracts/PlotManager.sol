pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./ISpaceToken.sol";
import "./ISplitMerge.sol";


contract PlotManager is Initializable, Ownable {
  using SafeMath for uint256;

  enum ApplicationStatus {
    NOT_EXISTS,
    NEW,
    SUBMITTED,
    CONSIDERATION,
    APPROVED,
    REJECTED,
    REVERTED,
    DISASSEMBLED,
    REFUNDED,
    VALIDATOR_REWARDED,
    GALTSPACE_REWARDED
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

  event LogApplicationStatusChanged(bytes32 application, ApplicationStatus status);
  event LogNewApplication(bytes32 id, address applicant);
  event LogReadyForApplications();
  event LogNotReadyForApplications(uint256 total);
  event LogValidatorRoleAdded(bytes32 role, uint8 share);
  event LogValidatorRoleRemoved(bytes32 role);
  event LogValidatorRoleEnabled(bytes32 role);
  event LogValidatorRoleDisabled(bytes32 role);

  struct Application {
    bytes32 id;
    address applicant;
    bytes32 credentialsHash;
    bytes32 ledgerIdentifier;
    uint256 packageTokenId;
    uint256 validatorsReward;
    uint256 galtSpaceReward;
    uint8 precision;
    bytes2 country;
    Currency currency;
    ApplicationStatus status;

    bytes32[] assignedRoles;
    mapping(bytes32 => uint256) assignedRewards;
    mapping(bytes32 => address) validators;
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  struct Validator {
    bytes32 name;
    bytes32 role;
    bytes2 country;
    bool active;
  }

  struct ValidatorRole {
    bool exists;
    bool active;
    uint8 index;
    uint8 rewardShare;
  }

  uint256 public constant ROLES_LIMIT = 10;

  bytes32[] public validatorRolesIndex;
  mapping(bytes32 => ValidatorRole) public validatorRolesMap;
  bool public readyForApplications;

  PaymentMethod public paymentMethod;
  uint256 public applicationFeeInEth;
  uint256 public applicationFeeInGalt;
  uint256 public galtSpaceEthShare;
  uint256 public galtSpaceGaltShare;
  address private galtSpaceRewardsAddress;

  mapping(bytes32 => Application) public applications;
  mapping(address => Validator) public validators;
  mapping(address => bytes32[]) public applicationsByAddresses;
  bytes32[] private applicationsArray;

  // WARNING: we do not remove applications from validator's list,
  // so do not rely on this variable to verify whether validator
  // exists or not.
  mapping(address => bytes32[]) public applicationsByValidator;
  // WARNING: we do not remove validators from validatorsArray,
  // so do not rely on this variable to verify whether validator
  // exists or not.
  address[] public validatorsArray;

  ISpaceToken public spaceToken;
  ISplitMerge public splitMerge;
  ERC20 public galtToken;

  constructor () public {}

  function initialize(
    ISpaceToken _spaceToken,
    ISplitMerge _splitMerge,
    ERC20 _galtToken,
    address _galtSpaceRewardsAddress
  )
    public
    isInitializer
  {
    owner = msg.sender;

    spaceToken = _spaceToken;
    splitMerge = _splitMerge;
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

  modifier onlyApplicantOrValidator(bytes32 _aId) {
    Application storage a = applications[_aId];
    bytes32 role = validators[msg.sender].role;

    require(a.applicant == msg.sender || a.validators[role] == msg.sender, "Not valid sender");

    if (a.validators[role] == msg.sender) {
      require(isValidator(msg.sender), "Not active validator");
    }

    _;
  }

  modifier onlyValidator() {
    require(validators[msg.sender].active == true, "Not active validator");
    _;
  }

  modifier onlyValidatorOfApplication(bytes32 _aId) {
    Application storage a = applications[_aId];
    bytes32 role = validators[msg.sender].role;

    require(a.validators[role] == msg.sender, "Not valid validator");
    require(isValidator(msg.sender), "Not active validator");

    _;
  }

  modifier ready() {
    require(readyForApplications == true, "Roles list not complete");

    _;
  }

  // TODO: fix incorrect meaning
  function isValidator(address account) public view returns (bool) {
    return validators[account].active == true;
  }

  function getValidator(
    address validator
  )
    public
    view
    returns (
      bytes32 name,
      bytes2 country,
      bool active
    )
  {
    Validator storage v = validators[validator];

    return (
      v.name,
      v.country,
      v.active
    );
  }

  function addValidatorRole(bytes32 _role, uint8 _share) public onlyOwner {
    require(validatorRolesMap[_role].exists == false, "Role already exists");
    require(validatorRolesIndex.length < ROLES_LIMIT, "The limit is 256 roles");
    require(_share >= 1, "Share should be greater or equal to 1");
    require(_share <= 100, "Share value should be less or equal to 100");

    validatorRolesMap[_role] = ValidatorRole(
      true,
      true,
      uint8(validatorRolesIndex.length),
      _share
    );
    validatorRolesIndex.push(_role);

    recalculateValidatorRoleShares();
    emit LogValidatorRoleAdded(_role, _share);
  }

  function removeValidatorRole(bytes32 _role) public onlyOwner {
    require(validatorRolesMap[_role].exists == true, "Role doesn't exist");

    uint8 indexToReassign = validatorRolesMap[_role].index;
    uint256 lastIndex = validatorRolesIndex.length.sub(1);
    bytes32 lastRole = validatorRolesIndex[lastIndex];

    validatorRolesIndex[indexToReassign] = lastRole;
    delete validatorRolesIndex[lastIndex];
    validatorRolesIndex.length--;

    validatorRolesMap[lastRole].index = indexToReassign;
    delete validatorRolesMap[_role];

    recalculateValidatorRoleShares();
    emit LogValidatorRoleRemoved(_role);
  }

  function setValidatorRoleShare(bytes32 _role, uint8 _share) public onlyOwner {
    ValidatorRole storage role = validatorRolesMap[_role];
    require(role.exists == true, "Role doesn't exist");
    require(_share >= 1, "Share should be greater or equal to 1");
    require(_share <= 100, "Share value should be less or equal to 100");

    role.rewardShare = _share;
    recalculateValidatorRoleShares();
  }

  function enableValidatorRole(bytes32 _role) public onlyOwner {
    ValidatorRole storage role = validatorRolesMap[_role];
    require(role.exists == true, "Role doesn't exist");

    role.active = true;
    recalculateValidatorRoleShares();
    emit LogValidatorRoleEnabled(_role);
  }

  function disableValidatorRole(bytes32 _role) public onlyOwner {
    ValidatorRole storage role = validatorRolesMap[_role];
    require(role.exists == true, "Role doesn't exist");

    validatorRolesMap[_role].active = false;
    recalculateValidatorRoleShares();
    emit LogValidatorRoleDisabled(_role);
  }

  function recalculateValidatorRoleShares() internal {
    uint8 total = 0;

    for (uint8 i = 0; i < validatorRolesIndex.length; i++) {
      assert(i < ROLES_LIMIT);

      ValidatorRole storage role = validatorRolesMap[validatorRolesIndex[i]];
      if (role.active == true) {
        uint8 res = total + role.rewardShare;
        assert(res > total);
        total = res;
      }
    }

    if (total == 100) {
      readyForApplications = true;
      emit LogReadyForApplications();
    } else {
      readyForApplications = false;
      emit LogNotReadyForApplications(uint256(total));
    }
  }

  function getValidatorRoles() public view returns (bytes32[]) {
    return validatorRolesIndex;
  }

  function addValidator(
    address _validator,
    bytes32 _name,
    bytes2 _country,
    bytes32 _role
  )
    public
    onlyOwner
  {
    require(_validator != address(0), "Validator address is empty");
    require(_country != 0x0, "Missing country");
    require(validatorRolesMap[_role].exists == true, "Role doesn't exist");

    validators[_validator] = Validator({
      name: _name,
      role: _role,
      country: _country,
      active: true
    });
    validatorsArray.push(_validator);
  }

  function removeValidator(address _validator) public onlyOwner {
    require(_validator != address(0), "Missing validator");
    // TODO: use index to remove validator
    validators[_validator].active = false;
  }

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

  function changeApplicationCredentialsHash(
    bytes32 _aId,
    bytes32 _credentialsHash
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
  }

  function changeApplicationLedgerIdentifier(
    bytes32 _aId,
    bytes32 _ledgerIdentifier
  )
    public
    onlyApplicant(_aId)
  {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.NEW || a.status == ApplicationStatus.REVERTED,
      "Application status should be NEW or REVERTED."
    );

    a.ledgerIdentifier = _ledgerIdentifier;
  }

  function changeApplicationPrecision(
    bytes32 _aId,
    uint8 _precision
  )
    public
    onlyApplicant(_aId)
  {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.NEW || a.status == ApplicationStatus.REVERTED,
      "Application status should be NEW or REVERTED."
    );

    a.precision = _precision;
  }

  function changeApplicationCountry(
    bytes32 _aId,
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

    assignRequiredValidatorRolesAndRewardsInGalt(_id);

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

  function assignRequiredValidatorRolesAndRewardsInGalt(bytes32 _aId) internal {
    Application storage a = applications[_aId];
    assert(a.validatorsReward > 0);
    assert(a.currency == Currency.GALT);

    uint256 totalReward = 0;

    for (uint8 i = 0; i < validatorRolesIndex.length; i++) {
      assert(i < ROLES_LIMIT);
      bytes32 key = validatorRolesIndex[i];
      ValidatorRole storage role = validatorRolesMap[validatorRolesIndex[i]];
      if (role.exists && role.active) {
        a.assignedRoles.push(key);
        uint256 rewardShare = a.validatorsReward.mul(role.rewardShare).div(100);
        a.assignedRewards[key] = rewardShare;
        totalReward = totalReward.add(rewardShare);
      }
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

    assignRequiredValidatorRolesAndRewardsInEth(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.NEW);

    return _id;
  }

  function assignRequiredValidatorRolesAndRewardsInEth(bytes32 _aId) internal {
    Application storage a = applications[_aId];
    assert(a.validatorsReward > 0);
    assert(a.currency == Currency.ETH);

    uint256 totalReward = 0;

    for (uint8 i = 0; i < validatorRolesIndex.length; i++) {
      assert(i < ROLES_LIMIT);
      bytes32 key = validatorRolesIndex[i];
      ValidatorRole storage role = validatorRolesMap[validatorRolesIndex[i]];
      if (role.exists && role.active) {
        a.assignedRoles.push(key);
        uint256 rewardShare = a.validatorsReward.mul(role.rewardShare).div(100);
        a.assignedRewards[key] = rewardShare;
        totalReward = totalReward.add(rewardShare);
      }
    }

    assert(totalReward == a.validatorsReward);
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
    onlyApplicantOrValidator(_aId)
  {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.NEW || a.status == ApplicationStatus.REJECTED || a.status == ApplicationStatus.REVERTED,
      "Application status should be NEW or REJECTED for this operation."
    );

    for (uint8 i = 0; i < _geohashes.length; i++) {
      uint256 geohashTokenId = spaceToken.geohashToTokenId(_geohashes[i]);

      require(spaceToken.ownerOf(geohashTokenId) == address(splitMerge), "Existing geohash token should belongs to PlotManager contract");

      _geohashes[i] = geohashTokenId;
    }

    // TODO: implement directions
    splitMerge.removeGeohashesFromPackage(a.packageTokenId, _geohashes, _directions1, _directions2);

    if (splitMerge.packageGeohashesCount(a.packageTokenId) == 0 && a.status == ApplicationStatus.NEW) {
      a.status = ApplicationStatus.DISASSEMBLED;
    }
  }

  function submitApplication(bytes32 _aId) public onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.NEW || a.status == ApplicationStatus.REVERTED,
      "Application status should be NEW"
    );

    if (a.status == ApplicationStatus.NEW) {
      a.status = ApplicationStatus.SUBMITTED;
      emit LogApplicationStatusChanged(_aId, ApplicationStatus.SUBMITTED);
    } else if (a.status == ApplicationStatus.REVERTED) {
      a.status = ApplicationStatus.CONSIDERATION;
      emit LogApplicationStatusChanged(_aId, ApplicationStatus.CONSIDERATION);
    }
  }

  // Application can be locked by a role only once.
  function lockApplicationForReview(bytes32 _aId) public onlyValidator {
    Application storage a = applications[_aId];
    Validator storage v = validators[msg.sender];
    bytes32 role = v.role;

    require(a.country == v.country, "Application and validator countries don't match");
    require(a.status == ApplicationStatus.SUBMITTED, "Application status should be SUBMITTED");
    require(a.validationStatus[role] == ValidationStatus.INTACT, "Can't lock an application already in work");
    require(a.validators[role] == address(0), "Validator can't be empty");

    a.validators[role] = msg.sender;
    a.validationStatus[role] = ValidationStatus.LOCKED;
    applicationsByValidator[msg.sender].push(_aId);

    uint256 len = a.assignedRoles.length;
    bool allLocked = true;

    for (uint8 i = 0; i < len; i++) {
      assert(i < ROLES_LIMIT);
      if (a.validators[a.assignedRoles[i]] == address(0)) {
        allLocked = false;
      }
    }

    if (allLocked) {
      a.status = ApplicationStatus.CONSIDERATION;
      emit LogApplicationStatusChanged(_aId, ApplicationStatus.CONSIDERATION);
    }
  }

  function unlockApplication(bytes32 _aId) public onlyOwner {
    Application storage a = applications[_aId];
    require(a.status == ApplicationStatus.CONSIDERATION, "Application status should be CONSIDERATION");

//    a.validator = address(0);
    a.status = ApplicationStatus.SUBMITTED;

    emit LogApplicationStatusChanged(_aId, ApplicationStatus.SUBMITTED);
  }

  function approveApplication(bytes32 _aId, bytes32 _credentialsHash) public onlyValidatorOfApplication(_aId) {
    Application storage a = applications[_aId];
    require(a.status == ApplicationStatus.CONSIDERATION, "Application status should be CONSIDERATION");
    require(a.credentialsHash == _credentialsHash, "Credentials don't match");

    a.status = ApplicationStatus.APPROVED;

    spaceToken.transferFrom(address(this), a.applicant, a.packageTokenId);

    emit LogApplicationStatusChanged(_aId, ApplicationStatus.APPROVED);
  }

  function rejectApplication(bytes32 _aId) public onlyValidatorOfApplication(_aId) {
    Application storage a = applications[_aId];
    require(a.status == ApplicationStatus.CONSIDERATION, "Application status should be CONSIDERATION");

    a.status = ApplicationStatus.REJECTED;
    emit LogApplicationStatusChanged(_aId, ApplicationStatus.REJECTED);
  }

  function revertApplication(bytes32 _aId) public onlyValidatorOfApplication(_aId) {
    Application storage a = applications[_aId];
    require(a.status == ApplicationStatus.CONSIDERATION, "Application status should be CONSIDERATION");

    a.status = ApplicationStatus.REVERTED;
    emit LogApplicationStatusChanged(_aId, ApplicationStatus.REVERTED);
  }

  function claimValidatorRewardEth(bytes32 _aId) public onlyValidator {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.APPROVED || a.status == ApplicationStatus.REJECTED,
      "Application status should be ether APPROVED or REJECTED");
    require(a.validatorsReward > 0, "Reward in ETH is 0");

    if (a.status == ApplicationStatus.REJECTED) {
      require(
        splitMerge.packageGeohashesCount(a.packageTokenId) == 0,
        "Application geohashes count must be 0 for REJECTED status");
    }

    a.status = ApplicationStatus.VALIDATOR_REWARDED;
    emit LogApplicationStatusChanged(_aId, ApplicationStatus.VALIDATOR_REWARDED);

    msg.sender.transfer(a.validatorsReward);
  }

  function claimGaltSpaceRewardEth(bytes32 _aId) public {
    require(msg.sender == galtSpaceRewardsAddress, "The method call allowed only for galtSpace address");

    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.VALIDATOR_REWARDED, "Application status should be VALIDATOR_REWARDED");
    require(a.galtSpaceReward > 0, "Reward in ETH is 0");

    a.status = ApplicationStatus.GALTSPACE_REWARDED;
    emit LogApplicationStatusChanged(_aId, ApplicationStatus.GALTSPACE_REWARDED);

    msg.sender.transfer(a.galtSpaceReward);
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
      ValidationStatus status
    )
  {
    return (
      applications[_aId].validators[_role],
      applications[_aId].assignedRewards[_role],
      applications[_aId].validationStatus[_role]
    );
  }
}
