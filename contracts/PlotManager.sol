pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";


contract PlotManager is Initializable, Ownable {
  enum ApplicationStatuses { NOT_EXISTS, NEW, SWAPPED, SUBMITTED, APPROVED, REJECTED }

  event ApplicationStatusChanged(bytes32 application, ApplicationStatuses status);
  event NewApplication(bytes32 id, address applicant);
  event NewPackMinted(bytes32 spaceTokenId, bytes32 applicationId);
  event NewGeohashMinted(bytes32 spaceTokenId, bytes32 applicationId);

  struct Application {
    bytes32 id;
    address applicant;
    address validator;
    bytes32 credentialsHash;
    bytes32 ledgerIdentifier;
    uint256 packageToken;
    uint8 precision;
    bytes2 country;
    uint256[] vertices;
    uint256[] geohashTokens;
    ApplicationStatuses status;
  }

  struct Validator {
    bytes32 name;
    bytes2 country;
    bool active;
  }

  mapping(bytes32 => Application) applications;
  mapping(address => Validator) validators;
  bytes32[] applicationsArray;
  mapping(address => bytes32[]) public applicationsByAddresses;
  // WARNING: we do not remove validators from validatorsArray,
  // so do not rely on this variable to verify whether validator
  // exists or not.
  address[] validatorsArray;
  uint256 validationFee;

  SpaceToken public spaceToken;
  SplitMerge public splitMerge;

  constructor () public {}

  function initialize(
    SpaceToken _spaceToken,
    SplitMerge _splitMerge
  )
    public
    isInitializer
  {
    owner = msg.sender;
    spaceToken = _spaceToken;
    splitMerge = _splitMerge;
    validationFee = 1 ether;
  }

  modifier onlyApplicant(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.applicant == msg.sender, "Not valid applicant");
    require(splitMerge != address(0), "SplitMerge address not set");

    _;
  }

  modifier onlyValidator() {
    require(validators[msg.sender].active == true, "Not active validator");
    _;
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
    uint256[] _vertices,
    bytes32 _credentialsHash,
    bytes32 _ledgerIdentifier,
    bytes2 _country,
    uint8 _precision
  )
    public
    returns (bytes32)
  {
    require(_precision > 5, "Precision should be greater than 5");
    require(_vertices.length >= 3, "Number of vertices should be equal or greater than 3");
    require(_vertices.length < 51, "Number of vertices should be equal or less than 50");

    for (uint8 i = 0; i < _vertices.length; i++) {
      require(_vertices[i] > 0, "Vertex should not be zero");
    }

    Application memory a;
    bytes32 _id = keccak256(abi.encodePacked(_vertices[0], _vertices[1], _credentialsHash));

    a.status = ApplicationStatuses.NEW;
    a.id = _id;
    a.applicant = msg.sender;
    a.vertices = _vertices;
    a.country = _country;
    a.credentialsHash = _credentialsHash;
    a.ledgerIdentifier = _ledgerIdentifier;
    a.precision = _precision;

    applications[_id] = a;
    applicationsArray.push(_id);
    applicationsByAddresses[msg.sender].push(_id);

    emit NewApplication(_id, msg.sender);
    emit ApplicationStatusChanged(_id, ApplicationStatuses.NEW);

    return _id;
  }

  function mintPack(bytes32 _aId) public onlyApplicant(_aId) {
    // TODO: prevent double mint
    Application storage a = applications[_aId];
    uint256 t = spaceToken.mintPack(splitMerge);
    a.packageToken = t;

    emit NewPackMinted(bytes32(t), _aId);
  }

  function pushGeohashes(bytes32 _aId, uint256[] _geohashes) public onlyApplicant(_aId) {
    require(_geohashes.length < 40, "Able to handle up to 40 geohashes only");
    Application storage a = applications[_aId];

    for (uint8 i = 0; i < _geohashes.length; i++) {
      uint256 g = spaceToken.geohashToTokenId(_geohashes[i]);
      // TODO: check for geohash parents exists
      spaceToken.mint(address(this), g);
      a.geohashTokens.push(g);
      emit NewGeohashMinted(bytes32(g), _aId);
    }
  }

  function swapTokens(bytes32 _aId) public onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(a.applicant == msg.sender, "Not valid applicant");
    require(a.status == ApplicationStatuses.NEW, "Application status should be NEW");
    require(splitMerge != address(0), "SplitMerge address not set");

    // TODO: should use actual functions from SplitMerge
//    splitMerge.swapTokens(a.packageToken, a.geohashTokens);
    a.status = ApplicationStatuses.SWAPPED;
    emit ApplicationStatusChanged(_aId, ApplicationStatuses.SWAPPED);
  }

  function submitApplication(bytes32 _aId) public payable onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatuses.SWAPPED, "Application status should be SWAPPED");
    require(msg.value == validationFee, "Incorrect fee passed in");

    a.status = ApplicationStatuses.SUBMITTED;
    emit ApplicationStatusChanged(_aId, ApplicationStatuses.SUBMITTED);
  }

  function validateApplication(bytes32 _aId, bool _approve) public payable onlyValidator {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatuses.SUBMITTED, "Application status should be SUBMITTED");

    if (_approve) {
      a.status = ApplicationStatuses.APPROVED;
      emit ApplicationStatusChanged(_aId, ApplicationStatuses.APPROVED);
    } else {
      a.status = ApplicationStatuses.REJECTED;
      emit ApplicationStatusChanged(_aId, ApplicationStatuses.REJECTED);
    }
  }

  function getPlotApplication(
    bytes32 _id
  )
    public
    view
    returns (
      address applicant,
      uint256[] vertices,
      uint256 packageToken,
      uint256[] geohashTokens,
      bytes32 credentiaslHash,
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
      m.vertices,
      m.packageToken,
      m.geohashTokens,
      m.credentialsHash,
      m.status,
      m.precision,
      m.country,
      m.ledgerIdentifier
    );
  }

  function getApplicationsByAddress(address applicant) external {
    return applicationsByAddresses[applicant];
  }
}
