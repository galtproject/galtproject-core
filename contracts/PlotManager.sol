pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";


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
  }

  uint256 public applicationFeeInEth;
  uint256 public applicationFeeInGalt;
  uint256 public galtSpaceEthShare;
  uint256 public galtSpaceGaltShare;
  address galtSpaceRewardsAddress;

  mapping(bytes32 => Application) public applications;
  mapping(address => Validator) public validators;
  mapping(address => bytes32[]) public applicationsByAddresses;
  bytes32[] applicationsArray;

  // WARNING: we do not remove applications from validator's list,
  // so do not rely on this variable to verify whether validator
  // exists or not.
  mapping(address => bytes32[]) public applicationsByValidator;
  // WARNING: we do not remove validators from validatorsArray,
  // so do not rely on this variable to verify whether validator
  // exists or not.
  address[] validatorsArray;

  SpaceToken public spaceToken;
  SplitMerge public splitMerge;

  constructor () public {}

  function initialize(
    uint256 _validationFeeInEth,
    uint256 _galtSpaceEthShare,
    address _galtSpaceRewardsAddress,
    SpaceToken _spaceToken,
    SplitMerge _splitMerge
  )
    public
    isInitializer
  {
    owner = msg.sender;
    spaceToken = _spaceToken;
    splitMerge = _splitMerge;
    applicationFeeInEth = _validationFeeInEth;
    galtSpaceEthShare = _galtSpaceEthShare;
    galtSpaceRewardsAddress = _galtSpaceRewardsAddress;
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

  function addValidator(address _validator, bytes32 _name, bytes2 _country) public onlyOwner {
    require(_validator != address(0), "Missing validator");
    require(_country != 0x0, "Missing country");

    validators[_validator] = Validator({ name: _name, country: _country, active: true });
    validatorsArray.push(_validator);
  }

  function removeValidator(address _validator) public onlyOwner {
    require(_validator != address(0), "Missing validator");

    validators[_validator].active = false;
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
    require(msg.value == applicationFeeInEth, "Incorrect fee passed in");

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
