pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./GaltToken.sol";


contract PlotManager is Initializable, Ownable {
  using SafeMath for uint256;

  enum ApplicationStatuses {
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

  enum PaymentMethods {
    NONE,
    ETH_ONLY,
    GALT_ONLY,
    ETH_AND_GALT
  }

  event LogApplicationStatusChanged(bytes32 application, ApplicationStatuses status);
  event LogNewApplication(bytes32 id, address applicant);

  struct Application {
    bytes32 id;
    address applicant;
    address validator;
    bytes32 credentialsHash;
    bytes32 ledgerIdentifier;
    uint256 packageTokenId;
    uint256 validatorRewardEth;
    uint256 galtSpaceRewardEth;
    uint256 validatorRewardGalt;
    uint256 galtSpaceRewardGalt;
    uint8 precision;
    bytes2 country;
    ApplicationStatuses status;
  }

  struct Validator {
    bytes32 name;
    bytes2 country;
    bool active;
    bytes32 role;
  }

  struct ValidatorRole {
    bool exists;
    bool active;
    uint8 index;
    string name;
  }

  bytes32[] public validatorRolesIndex;
  mapping(bytes32 => ValidatorRole) public validatorRolesMap;
  mapping(address => bytes32) public validatorRoles;

  PaymentMethods public paymentMethod;
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

  SpaceToken public spaceToken;
  SplitMerge public splitMerge;
  GaltToken public galtToken;

  constructor () public {}

  function initialize(
    SpaceToken _spaceToken,
    SplitMerge _splitMerge,
    GaltToken _galtToken,
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
    paymentMethod = PaymentMethods.ETH_AND_GALT;
  }

  modifier onlyApplicant(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.applicant == msg.sender, "Not valid applicant");
    require(splitMerge != address(0), "SplitMerge address not set");

    _;
  }

  modifier onlyApplicantOrValidator(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.applicant == msg.sender || a.validator == msg.sender, "Not valid sender");
    require(splitMerge != address(0), "SplitMerge address not set");

    if (a.validator == msg.sender) {
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

    require(a.validator == msg.sender, "Not valid validator");
    require(splitMerge != address(0), "SplitMerge address not set");
    require(isValidator(msg.sender), "Not active validator");

    _;
  }

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

  function addValidatorRole(bytes _role) public onlyOwner {
    require(validatorRolesMap[keccak256(_role)].exists == false, "Role already exists");
    require(validatorRolesIndex.length < 256, "The limit is 256 roles");

    validatorRolesMap[keccak256(_role)] = ValidatorRole(
      true,
      true,
      uint8(validatorRolesIndex.length),
      string(_role)
    );
    validatorRolesIndex.push(keccak256(_role));
  }

  function removeValidatorRole(bytes _role) public onlyOwner {
    require(validatorRolesMap[keccak256(_role)].exists == true, "Role doesn't exist");

    uint8 indexToReassign = validatorRolesMap[keccak256(_role)].index;
    uint256 lastIndex = validatorRolesIndex.length.sub(1);
    bytes32 lastRole = validatorRolesIndex[lastIndex];

    validatorRolesIndex[indexToReassign] = lastRole;
    delete validatorRolesIndex[lastIndex];
    validatorRolesIndex.length--;

    validatorRolesMap[lastRole].index = indexToReassign;
    delete validatorRolesMap[keccak256(_role)];
  }

  function enableValidatorRole(bytes _role) public onlyOwner {
    require(validatorRolesMap[keccak256(_role)].exists == true, "Role doesn't exist");

    validatorRolesMap[keccak256(_role)].active == true;
    // TODO: increment required confirmations
  }

  function disableValidatorRole(bytes _role) public onlyOwner {
    require(validatorRolesMap[keccak256(_role)].exists == true, "Role doesn't exist");

    validatorRolesMap[keccak256(_role)].active == false;
    // TODO: decrement required confirmations
  }

  function getValidatorRoles() public view returns (bytes32[]) {
    return validatorRolesIndex;
  }

  function addValidator(
    address _validator,
    bytes32 _name,
    bytes2 _country,
    bytes _role
  )
    public
    onlyOwner
  {
    require(_validator != address(0), "Validator address is empty");
    require(_country != 0x0, "Missing country");
    require(validatorRolesMap[keccak256(_role)].exists == true, "Role doesn't exist");

    validators[_validator] = Validator({
      name: _name,
      role: keccak256(_role),
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

  function setPaymentMethod(PaymentMethods _newMethod) public onlyOwner {
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
      a.status == ApplicationStatuses.NEW || a.status == ApplicationStatuses.REVERTED,
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
      a.status == ApplicationStatuses.NEW || a.status == ApplicationStatuses.REVERTED,
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
      a.status == ApplicationStatuses.NEW || a.status == ApplicationStatuses.REVERTED,
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
      a.status == ApplicationStatuses.NEW || a.status == ApplicationStatuses.REVERTED,
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
    payable
    returns (bytes32)
  {
    require(_precision > 5, "Precision should be greater than 5");
    require(_packageContour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(_packageContour.length <= 50, "Number of contour elements should be equal or less than 50");
    require(_applicationFeeInGalt >= applicationFeeInGalt, "Application fee should be greater or equal to the minimum value");

    galtToken.transferFrom(msg.sender, address(this), _applicationFeeInGalt);

    Application memory a;
    bytes32 _id = keccak256(abi.encodePacked(_packageContour[0], _packageContour[1], _credentialsHash));

    a.status = ApplicationStatuses.NEW;
    a.id = _id;
    a.applicant = msg.sender;
    a.country = _country;
    a.credentialsHash = _credentialsHash;
    a.ledgerIdentifier = _ledgerIdentifier;
    a.precision = _precision;

    calculateAndStoreGaltFee(a, _applicationFeeInGalt);

    uint256 geohashTokenId = spaceToken.mintGeohash(address(this), _baseGeohash);
    uint256 packageTokenId = splitMerge.initPackage(geohashTokenId);
    a.packageTokenId = packageTokenId;

    splitMerge.setPackageContour(packageTokenId, _packageContour);

    applications[_id] = a;
    applicationsArray.push(_id);
    applicationsByAddresses[msg.sender].push(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatuses.NEW);

    return _id;
  }

  function calculateAndStoreGaltFee(Application memory _a, uint256 _applicationFeeInGalt) internal {
    uint256 galtSpaceRewardGalt = galtSpaceGaltShare.mul(_applicationFeeInGalt).div(100);
    uint256 validatorRewardGalt = _applicationFeeInGalt.sub(galtSpaceRewardGalt);

    assert(validatorRewardGalt.add(galtSpaceRewardGalt) == _applicationFeeInGalt);

    _a.validatorRewardGalt = validatorRewardGalt;
    _a.galtSpaceRewardGalt = galtSpaceRewardGalt;
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
    returns (bytes32)
  {
    require(_precision > 5, "Precision should be greater than 5");
    require(_packageContour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(_packageContour.length <= 50, "Number of contour elements should be equal or less than 50");
    require(msg.value >= applicationFeeInEth, "Incorrect fee passed in");

    Application memory a;
    bytes32 _id = keccak256(abi.encodePacked(_packageContour[0], _packageContour[1], _credentialsHash));

    a.status = ApplicationStatuses.NEW;
    a.id = _id;
    a.applicant = msg.sender;
    a.country = _country;
    a.credentialsHash = _credentialsHash;
    a.ledgerIdentifier = _ledgerIdentifier;
    a.precision = _precision;

    uint256 galtSpaceRewardEth = galtSpaceEthShare.mul(msg.value).div(100);
    uint256 validatorRewardEth = msg.value.sub(galtSpaceRewardEth);

    assert(validatorRewardEth.add(galtSpaceRewardEth) == msg.value);

    a.validatorRewardEth = validatorRewardEth;
    a.galtSpaceRewardEth = galtSpaceRewardEth;

    uint256 geohashTokenId = spaceToken.mintGeohash(address(this), _baseGeohash);
    uint256 packageTokenId = splitMerge.initPackage(geohashTokenId);
    a.packageTokenId = packageTokenId;

    splitMerge.setPackageContour(packageTokenId, _packageContour);

    applications[_id] = a;
    applicationsArray.push(_id);
    applicationsByAddresses[msg.sender].push(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatuses.NEW);

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
      a.status == ApplicationStatuses.NEW || a.status == ApplicationStatuses.REVERTED,
      "Application status should be NEW or REVERTED."
    );

    for (uint8 i = 0; i < _geohashes.length; i++) {
      uint256 geohashTokenId = _geohashes[i] ^ uint256(spaceToken.GEOHASH_MASK());
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
      a.status == ApplicationStatuses.NEW || a.status == ApplicationStatuses.REJECTED || a.status == ApplicationStatuses.REVERTED,
      "Application status should be NEW or REJECTED for this operation."
    );

    for (uint8 i = 0; i < _geohashes.length; i++) {
      uint256 geohashTokenId = _geohashes[i] ^ uint256(spaceToken.GEOHASH_MASK());

      require(spaceToken.ownerOf(geohashTokenId) == address(splitMerge), "Existing geohash token should belongs to PlotManager contract");

      _geohashes[i] = geohashTokenId;
    }

    // TODO: implement directions
    splitMerge.removeGeohashesFromPackage(a.packageTokenId, _geohashes, _directions1, _directions2);

    if (splitMerge.packageGeohashesCount(a.packageTokenId) == 0 && a.status == ApplicationStatuses.NEW) {
      a.status = ApplicationStatuses.DISASSEMBLED;
    }
  }

  function submitApplication(bytes32 _aId) public onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatuses.NEW || a.status == ApplicationStatuses.REVERTED,
      "Application status should be NEW"
    );

    if (a.status == ApplicationStatuses.NEW) {
      a.status = ApplicationStatuses.SUBMITTED;
      emit LogApplicationStatusChanged(_aId, ApplicationStatuses.SUBMITTED);
    } else if (a.status == ApplicationStatuses.REVERTED) {
      a.status = ApplicationStatuses.CONSIDERATION;
      emit LogApplicationStatusChanged(_aId, ApplicationStatuses.CONSIDERATION);
    }
  }

  function lockApplicationForReview(bytes32 _aId) public onlyValidator {
    Application storage a = applications[_aId];
    require(a.status == ApplicationStatuses.SUBMITTED, "Application status should be SUBMITTED");

    a.validator = msg.sender;
    applicationsByValidator[msg.sender].push(_aId);
    a.status = ApplicationStatuses.CONSIDERATION;

    emit LogApplicationStatusChanged(_aId, ApplicationStatuses.CONSIDERATION);
  }

  function unlockApplication(bytes32 _aId) public onlyOwner {
    Application storage a = applications[_aId];
    require(a.status == ApplicationStatuses.CONSIDERATION, "Application status should be CONSIDERATION");

    a.validator = address(0);
    a.status = ApplicationStatuses.SUBMITTED;

    emit LogApplicationStatusChanged(_aId, ApplicationStatuses.SUBMITTED);
  }

  function approveApplication(bytes32 _aId, bytes32 _credentialsHash) public onlyValidatorOfApplication(_aId) {
    Application storage a = applications[_aId];
    require(a.status == ApplicationStatuses.CONSIDERATION, "Application status should be CONSIDERATION");
    require(a.credentialsHash == _credentialsHash, "Credentials don't match");

    a.status = ApplicationStatuses.APPROVED;

    spaceToken.transferFrom(address(this), a.applicant, a.packageTokenId);

    emit LogApplicationStatusChanged(_aId, ApplicationStatuses.APPROVED);
  }

  function rejectApplication(bytes32 _aId) public onlyValidatorOfApplication(_aId) {
    Application storage a = applications[_aId];
    require(a.status == ApplicationStatuses.CONSIDERATION, "Application status should be CONSIDERATION");

    a.status = ApplicationStatuses.REJECTED;
    emit LogApplicationStatusChanged(_aId, ApplicationStatuses.REJECTED);
  }

  function revertApplication(bytes32 _aId) public onlyValidatorOfApplication(_aId) {
    Application storage a = applications[_aId];
    require(a.status == ApplicationStatuses.CONSIDERATION, "Application status should be CONSIDERATION");

    a.status = ApplicationStatuses.REVERTED;
    emit LogApplicationStatusChanged(_aId, ApplicationStatuses.REVERTED);
  }

  function claimValidatorRewardEth(bytes32 _aId) public onlyValidator {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatuses.APPROVED || a.status == ApplicationStatuses.REJECTED,
      "Application status should be ether APPROVED or REJECTED");
    require(a.validatorRewardEth > 0, "Reward in ETH is 0");

    if (a.status == ApplicationStatuses.REJECTED) {
      require(
        splitMerge.packageGeohashesCount(a.packageTokenId) == 0,
        "Application geohashes count must be 0 for REJECTED status");
    }

    a.status = ApplicationStatuses.VALIDATOR_REWARDED;
    emit LogApplicationStatusChanged(_aId, ApplicationStatuses.VALIDATOR_REWARDED);

    msg.sender.transfer(a.validatorRewardEth);
  }

  function claimGaltSpaceRewardEth(bytes32 _aId) public {
    require(msg.sender == galtSpaceRewardsAddress, "The method call allowed only for galtSpace address");

    Application storage a = applications[_aId];

    require(a.status == ApplicationStatuses.VALIDATOR_REWARDED, "Application status should be VALIDATOR_REWARDED");
    require(a.galtSpaceRewardEth > 0, "Reward in ETH is 0");

    a.status = ApplicationStatuses.GALTSPACE_REWARDED;
    emit LogApplicationStatusChanged(_aId, ApplicationStatuses.GALTSPACE_REWARDED);

    msg.sender.transfer(a.galtSpaceRewardEth);
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
      address validator,
      uint256 packageTokenId,
      bytes32 credentialsHash,
      ApplicationStatuses status,
      uint8 precision,
      bytes2 country,
      bytes32 ledgerIdentifier
    )
  {
    require(applications[_id].status != ApplicationStatuses.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.applicant,
      m.validator,
      m.packageTokenId,
      m.credentialsHash,
      m.status,
      m.precision,
      m.country,
      m.ledgerIdentifier
    );
  }

  function getApplicationFinanceById(
    bytes32 _id
  )
    public
    view
    returns (
      ApplicationStatuses status,
      uint256 validatorRewardEth,
      uint256 galtSpaceRewardEth,
      uint256 validatorRewardGalt,
      uint256 galtSpaceRewardGalt
    )
  {
    require(applications[_id].status != ApplicationStatuses.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.status,
      m.validatorRewardEth,
      m.galtSpaceRewardEth,
      m.validatorRewardGalt,
      m.galtSpaceRewardGalt
    );
  }

  function getAllApplications() external view returns (bytes32[]) {
    return applicationsArray;
  }

  function getApplicationsByAddress(address applicant) external view returns (bytes32[]) {
    return applicationsByAddresses[applicant];
  }

  function getApplicationsByValidator(address applicant) external view returns (bytes32[]) {
    return applicationsByValidator[applicant];
  }
}
