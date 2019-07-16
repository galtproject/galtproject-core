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

pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/geodesic/contracts/interfaces/IGeodesic.sol";
import "../interfaces/ISpaceToken.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "./interfaces/IPropertyManagerFeeCalculator.sol";
import "./AbstractApplication.sol";
import "./AbstractOracleApplication.sol";
import "./NewPropertyManagerLib.sol";
import "../registries/GaltGlobalRegistry.sol";
import "../registries/interfaces/IPGGRegistry.sol";


contract NewPropertyManager is AbstractOracleApplication {
  using SafeMath for uint256;

  bytes32 public constant PM_LAWYER_ORACLE_TYPE = bytes32("PM_LAWYER_ORACLE_TYPE");
  bytes32 public constant PM_SURVEYOR_ORACLE_TYPE = bytes32("PM_SURVEYOR_ORACLE_TYPE");

  bytes32 public constant APPLICATION_UNLOCKER = bytes32("application_unlocker");

  bytes32 public constant CONFIG_FEE_CALCULATOR = bytes32("PM_FEE_CALCULATOR");
  bytes32 public constant CONFIG_PAYMENT_METHOD = bytes32("PM_PAYMENT_METHOD");
  bytes32 public constant CONFIG_PREFIX = bytes32("PM");

  event NewSpaceToken(address indexed applicant, uint256 spaceTokenId, bytes32 applicationId);
  event NewApplication(address indexed applicant, bytes32 applicationId);
  event ApplicationStatusChanged(bytes32 indexed applicationId, ApplicationStatus indexed status);
  event ValidationStatusChanged(bytes32 indexed applicationId, bytes32 indexed oracleType, ValidationStatus indexed status);
  event OracleRewardClaim(bytes32 indexed applicationId, address indexed oracle);
  event GaltProtocolFeeAssigned(bytes32 indexed applicationId);
  event ClaimSpaceToken(bytes32 indexed applicationId, uint256 indexed spaceTokenId);

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

  struct Application {
    bytes32 id;
    address pgg;
    address applicant;
    address operator;
    uint256 spaceTokenId;
    uint256 createdAt;
    Details details;
    Rewards rewards;
    Currency currency;
    ApplicationStatus status;

    bytes32[] assignedOracleTypes;

    mapping(bytes32 => uint256) assignedRewards;
    mapping(bytes32 => bool) oracleTypeRewardPaidOut;
    mapping(bytes32 => string) oracleTypeMessages;
    mapping(bytes32 => address) oracleTypeAddresses;
    mapping(address => bytes32) addressOracleTypes;
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  struct Rewards {
    uint256 totalPaidFee;
    uint256 oraclesReward;
    uint256 galtProtocolFee;
    uint256 latestCommittedFee;
    bool galtProtocolFeePaidOut;
  }

  struct Details {
    bytes32 credentialsHash;
    bytes32 ledgerIdentifier;
    string description;
    int256 level;
    uint256 area;
    ISpaceGeoDataRegistry.AreaSource areaSource;
    uint256[] contour;
    int256[] heights;
  }

  mapping(bytes32 => Application) internal applications;

  constructor () public {}

  function initialize(
    GaltGlobalRegistry _ggr
  )
    public
    isInitializer
  {
    ggr = _ggr;
  }

  modifier onlyApplicant(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(
      a.applicant == msg.sender || getApplicationOperator(_aId) == msg.sender,
      "Applicant invalid");

    _;
  }

  modifier onlyOracleOfApplication(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.addressOracleTypes[msg.sender] != 0x0, "Not valid oracle");

    _;
  }

  function feeCalculator(address _pgg) public view returns (IPropertyManagerFeeCalculator) {
    return IPropertyManagerFeeCalculator(address(uint160(uint256(pggConfigValue(_pgg, CONFIG_FEE_CALCULATOR)))));
  }

  function getOracleTypeShareKey(bytes32 _oracleType) public pure returns (bytes32) {
    return keccak256(abi.encode(CONFIG_PREFIX, "share", _oracleType));
  }

  function paymentMethod(address _pgg) public view returns (PaymentMethod) {
    return PaymentMethod(uint256(pggConfigValue(_pgg, CONFIG_PAYMENT_METHOD)));
  }

  function approveOperator(bytes32 _aId, address _to) external {
    Application storage a = applications[_aId];
    require(
      msg.sender == a.applicant ||
      (a.status == ApplicationStatus.REJECTED && a.addressOracleTypes[msg.sender] != 0x0),
      "Unable to approve"
    );
    require(_to != a.applicant, "Unable to approve to the same account");

    a.operator = _to;
  }

  function submit(
    address _pgg,
    uint256[] calldata _contour,
    int256[] calldata _heights,
    int256 _level,
    uint256 _customArea,
    bytes32 _credentialsHash,
    bytes32 _ledgerIdentifier,
    string calldata _description,
    uint256 _submissionFeeInGalt
  )
    external
    payable
    returns (bytes32)
  {
    require(
      _contour.length >= 3 && _contour.length <= 50,
      "Number of contour elements should be between 3 and 50"
    );

    pggRegistry().requireValidPgg(_pgg);

    bytes32 _id = keccak256(
      abi.encodePacked(
        _pgg,
        _contour,
        _credentialsHash,
        msg.sender,
        applicationsArray.length
      )
    );

    Application storage a = applications[_id];

    require(a.status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    if (_customArea == 0) {
      a.details.areaSource = ISpaceGeoDataRegistry.AreaSource.CONTRACT;
      a.details.area = IGeodesic(ggr.getGeodesicAddress()).calculateContourArea(_contour);
    } else {
      a.details.area = _customArea;
      // Default a.areaSource is AreaSource.USER_INPUT
    }

    // GALT
    if (_submissionFeeInGalt > 0) {
      requireValidPaymentType(_pgg, PaymentType.GALT);
      require(msg.value == 0, "Could not accept both ETH and GALT");
      require(_submissionFeeInGalt >= getSubmissionFeeByArea(_pgg, Currency.GALT, a.details.area), "Incorrect fee passed in");

      require(ggr.getGaltToken().allowance(msg.sender, address(this)) >= _submissionFeeInGalt, "Insufficient allowance");
      ggr.getGaltToken().transferFrom(msg.sender, address(this), _submissionFeeInGalt);

      a.rewards.totalPaidFee = _submissionFeeInGalt;
      a.currency = Currency.GALT;
    // ETH
    } else {
      requireValidPaymentType(_pgg, PaymentType.ETH);
      a.rewards.totalPaidFee = msg.value;
      // Default a.currency is Currency.ETH

      require(
        msg.value >= getSubmissionFeeByArea(_pgg, Currency.ETH, a.details.area),
        "Incorrect msg.value passed in");
    }

    a.status = ApplicationStatus.SUBMITTED;
    a.id = _id;
    a.pgg = _pgg;
    a.applicant = msg.sender;
    a.createdAt = block.timestamp;

    calculateAndStoreFee(a, a.rewards.totalPaidFee);

    a.details.ledgerIdentifier = _ledgerIdentifier;
    a.details.description = _description;
    a.details.credentialsHash = _credentialsHash;
    a.details.level = _level;
    a.details.contour = _contour;
    a.details.heights = _heights;

    applicationsArray.push(_id);
    applicationsByApplicant[msg.sender].push(_id);

    emit NewApplication(msg.sender, _id);
    emit ApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);

    assignRequiredOracleTypesAndRewards(applications[_id]);

    return _id;
  }

  /**
   * @dev Resubmit application after it was reverted
   *
   * @param _aId application id
   * @param _newCredentialsHash keccak256 of user credentials
   * @param _newLedgerIdentifier of a plot
   * @param _newDescription of a plot
   * @param _newContour array, empty if not changed
   * @param _newHeights array, empty if not changed
   * @param _newLevel int
   * @param _newCustomArea int
   * @param _resubmissionFeeInGalt or 0 if paid by ETH
   */
  function resubmit(
    bytes32 _aId,
    bytes32 _newCredentialsHash,
    bytes32 _newLedgerIdentifier,
    string calldata _newDescription,
    uint256[] calldata _newContour,
    int256[] calldata _newHeights,
    int256 _newLevel,
    uint256 _newCustomArea,
    uint256 _resubmissionFeeInGalt
  )
    external
    payable
  {
    Application storage a = applications[_aId];
    Details storage d = a.details;
    require(
      a.applicant == msg.sender || getApplicationOperator(_aId) == msg.sender,
      "Applicant invalid");
    require(
      a.status == ApplicationStatus.REVERTED,
      "Application status should be REVERTED");

    checkResubmissionPayment(a, _resubmissionFeeInGalt, _newContour);

    if (_newCustomArea == 0) {
      d.areaSource = ISpaceGeoDataRegistry.AreaSource.CONTRACT;
      d.area = IGeodesic(ggr.getGeodesicAddress()).calculateContourArea(_newContour);
    } else {
      d.area = _newCustomArea;
      d.areaSource = ISpaceGeoDataRegistry.AreaSource.USER_INPUT;
    }

    d.level = _newLevel;
    d.heights = _newHeights;
    d.contour = _newContour;
    d.description = _newDescription;
    d.ledgerIdentifier = _newLedgerIdentifier;
    d.credentialsHash = _newCredentialsHash;

    assignLockedStatus(_aId);

    changeApplicationStatus(a, ApplicationStatus.SUBMITTED);
  }

  function assignLockedStatus(bytes32 _aId) internal {
    for (uint256 i = 0; i < applications[_aId].assignedOracleTypes.length; i++) {
      if (applications[_aId].validationStatus[applications[_aId].assignedOracleTypes[i]] != ValidationStatus.LOCKED) {
        changeValidationStatus(applications[_aId], applications[_aId].assignedOracleTypes[i], ValidationStatus.LOCKED);
      }
    }
  }

  function checkResubmissionPayment(
    Application storage a,
    uint256 _resubmissionFeeInGalt,
    uint256[] memory _newSpaceTokenContour
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

    uint256 area = IGeodesic(ggr.getGeodesicAddress()).calculateContourArea(_newSpaceTokenContour);
    uint256 newMinimalFee = getSubmissionFeeByArea(a.pgg, a.currency, area);
    uint256 alreadyPaid = a.rewards.latestCommittedFee;

    if (newMinimalFee > alreadyPaid) {
      uint256 requiredPayment = newMinimalFee.sub(alreadyPaid);
      require(fee >= requiredPayment, "Incorrect fee passed in");
    }

    a.rewards.latestCommittedFee = alreadyPaid + fee;
  }

  // Application can be locked by an oracle type only once.
  function lock(bytes32 _aId, bytes32 _oracleType) external {
    Application storage a = applications[_aId];

    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, _oracleType);

    require(a.status == ApplicationStatus.SUBMITTED, "Application status should be SUBMITTED");
    require(a.oracleTypeAddresses[_oracleType] == address(0), "Oracle is already assigned on this oracle type");
    require(a.validationStatus[_oracleType] == ValidationStatus.PENDING, "Can't lock an oracle type not in PENDING status");

    a.oracleTypeAddresses[_oracleType] = msg.sender;
    a.addressOracleTypes[msg.sender] = _oracleType;
    applicationsByOracle[msg.sender].push(_aId);

    changeValidationStatus(a, _oracleType, ValidationStatus.LOCKED);
  }

  function unlock(bytes32 _aId, bytes32 _oracleType) external onlyUnlocker {
    Application storage a = applications[_aId];
    require(a.status == ApplicationStatus.SUBMITTED, "Application status should be SUBMITTED");
    require(a.validationStatus[_oracleType] == ValidationStatus.LOCKED, "Validation status should be LOCKED");
    require(a.oracleTypeAddresses[_oracleType] != address(0), "Address should be already set");

    a.oracleTypeAddresses[_oracleType] = address(0);
    changeValidationStatus(a, _oracleType, ValidationStatus.PENDING);
  }

  function approve(
    bytes32 _aId,
    bytes32 _credentialsHash
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(a.details.credentialsHash == _credentialsHash, "Credentials don't match");
    require(a.status == ApplicationStatus.SUBMITTED, "Application status should be SUBMITTED");

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    require(a.validationStatus[oracleType] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.oracleTypeAddresses[oracleType] == msg.sender, "Sender not assigned to this application");
    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, oracleType);

    changeValidationStatus(a, oracleType, ValidationStatus.APPROVED);

    uint256 len = a.assignedOracleTypes.length;
    bool allApproved = true;

    for (uint256 i = 0; i < len; i++) {
      if (a.validationStatus[a.assignedOracleTypes[i]] != ValidationStatus.APPROVED) {
        allApproved = false;
      }
    }

    if (allApproved) {
      changeApplicationStatus(a, ApplicationStatus.APPROVED);
      mintToken(a);
    }
  }

  function claimSpaceToken(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.APPROVED,
      "Application status should be APPROVED");

    emit ClaimSpaceToken(_aId, a.spaceTokenId);

    ggr.getSpaceToken().transferFrom(address(this), a.applicant, a.spaceTokenId);
  }

  function mintToken(Application storage a) internal {
    ISpaceGeoDataRegistry spaceGeoData = ISpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress());

    uint256 spaceTokenId = ISpaceToken(ggr.getSpaceTokenAddress()).mint(address(this));

    a.spaceTokenId = spaceTokenId;

    spaceGeoData.setSpaceTokenContour(spaceTokenId, a.details.contour);
    spaceGeoData.setSpaceTokenHeights(spaceTokenId, a.details.heights);
    spaceGeoData.setSpaceTokenLevel(spaceTokenId, a.details.level);
    spaceGeoData.setSpaceTokenArea(spaceTokenId, a.details.area, a.details.areaSource);
    spaceGeoData.setSpaceTokenInfo(spaceTokenId, a.details.ledgerIdentifier, a.details.description);

    emit NewSpaceToken(a.applicant, spaceTokenId, a.id);
  }

  function reject(
    bytes32 _aId,
    string calldata _message
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, oracleType);

    // TODO: merge into the contract
    NewPropertyManagerLib.rejectApplicationHelper(a, _message);

    changeValidationStatus(a, a.addressOracleTypes[msg.sender], ValidationStatus.REJECTED);
    changeApplicationStatus(a, ApplicationStatus.REJECTED);
  }

  function revert(
    bytes32 _aId,
    string calldata _message
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];
    bytes32 senderOracleType = a.addressOracleTypes[msg.sender];
    uint256 len = a.assignedOracleTypes.length;

    require(a.status == ApplicationStatus.SUBMITTED, "Application status should be SUBMITTED");
    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, senderOracleType);
    require(a.validationStatus[senderOracleType] == ValidationStatus.LOCKED, "Application should be locked first");

    for (uint256 i = 0; i < len; i++) {
      if (a.validationStatus[a.assignedOracleTypes[i]] == ValidationStatus.PENDING) {
        revert("All oracle types should lock the application first");
      }
    }

    a.oracleTypeMessages[senderOracleType] = _message;

    changeValidationStatus(a, senderOracleType, ValidationStatus.REVERTED);
    changeApplicationStatus(a, ApplicationStatus.REVERTED);
  }

  function close(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.REVERTED,
      "Application status should be REVERTED");

    changeApplicationStatus(a, ApplicationStatus.CLOSED);
  }

  function claimOracleReward(
    bytes32 _aId
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];
    bytes32 senderOracleType = a.addressOracleTypes[msg.sender];
    uint256 reward = a.assignedRewards[senderOracleType];

    /* solium-disable-next-line */
    require(
      a.status == ApplicationStatus.APPROVED || a.status == ApplicationStatus.REJECTED || a.status == ApplicationStatus.CLOSED,
      "Application status should be APPROVED, REJECTED or CLOSED");
    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, senderOracleType);

    require(reward > 0, "Reward is 0");
    require(a.oracleTypeRewardPaidOut[senderOracleType] == false, "Reward is already paid");

    a.oracleTypeRewardPaidOut[senderOracleType] = true;

    _assignGaltProtocolFee(a);

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (a.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(msg.sender, reward);
    }

    emit OracleRewardClaim(_aId, msg.sender);
  }

  function _assignGaltProtocolFee(Application storage _a) internal {
    if (_a.rewards.galtProtocolFeePaidOut == false) {
      if (_a.currency == Currency.ETH) {
        protocolFeesEth = protocolFeesEth.add(_a.rewards.galtProtocolFee);
      } else if (_a.currency == Currency.GALT) {
        protocolFeesGalt = protocolFeesGalt.add(_a.rewards.galtProtocolFee);
      }

      _a.rewards.galtProtocolFeePaidOut = true;
      emit GaltProtocolFeeAssigned(_a.id);
    }
  }

  function calculateAndStoreFee(
    Application storage _a,
    uint256 _fee
  )
    internal
  {
    uint256 share;

    (uint256 ethFee, uint256 galtFee) = getProtocolShares();

    if (_a.currency == Currency.ETH) {
      share = ethFee;
    } else {
      share = galtFee;
    }

    assert(share > 0);
    assert(share <= 100);

    uint256 galtProtocolFee = share.mul(_fee).div(100);
    uint256 oraclesReward = _fee.sub(galtProtocolFee);

    assert(oraclesReward.add(galtProtocolFee) == _fee);

    _a.rewards.oraclesReward = oraclesReward;
    _a.rewards.galtProtocolFee = galtProtocolFee;

    _a.rewards.latestCommittedFee = _fee;
  }

  function assignRequiredOracleTypesAndRewards(Application storage a) internal {
    assert(a.rewards.oraclesReward > 0);

    uint256 totalReward = 0;

    a.assignedOracleTypes = [PM_SURVEYOR_ORACLE_TYPE, PM_LAWYER_ORACLE_TYPE];
    uint256 surveyorShare = oracleTypeShare(a.pgg, PM_SURVEYOR_ORACLE_TYPE);
    uint256 lawyerShare = oracleTypeShare(a.pgg, PM_LAWYER_ORACLE_TYPE);
    uint256[2] memory shares = [surveyorShare, lawyerShare];

    require(surveyorShare + lawyerShare == 100, "PM shares invalid setup");

    uint256 len = a.assignedOracleTypes.length;
    for (uint256 i = 0; i < len; i++) {
      bytes32 oracleType = a.assignedOracleTypes[i];
      uint256 rewardShare = a
      .rewards
      .oraclesReward
      .mul(shares[i])
      .div(100);

      a.assignedRewards[oracleType] = rewardShare;
      changeValidationStatus(a, oracleType, ValidationStatus.PENDING);
      totalReward = totalReward.add(rewardShare);
    }

    assert(totalReward <= a.rewards.oraclesReward);
    uint256 diff = a.rewards.oraclesReward - totalReward;
    a.assignedRewards[a.assignedOracleTypes[0]] = a.assignedRewards[a.assignedOracleTypes[0]].add(diff);
  }

  function changeValidationStatus(
    Application storage _a,
    bytes32 _oracleType,
    ValidationStatus _status
  )
    internal
  {
    emit ValidationStatusChanged(_a.id, _oracleType, _status);

    _a.validationStatus[_oracleType] = _status;
  }

  // NOTICE: the application should already persist in storage
  function changeApplicationStatus(
    Application storage _a,
    ApplicationStatus _status
  )
    internal
  {
    emit ApplicationStatusChanged(_a.id, _status);

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
  function getApplication(
    bytes32 _id
  )
    external
    view
    returns (
      uint256 createdAt,
      address applicant,
      address pgg,
      uint256 spaceTokenId,
      ApplicationStatus status,
      Currency currency,
      bytes32[] memory assignedOracleTypes
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.createdAt,
      m.applicant,
      m.pgg,
      m.spaceTokenId,
      m.status,
      m.currency,
      m.assignedOracleTypes
    );
  }

  /**
   * @dev Get application rewards-related information
   */
  function getApplicationRewards(
    bytes32 _id
  )
    external
    view
    returns (
      ApplicationStatus status,
      Currency currency,
      uint256 oraclesReward,
      uint256 galtProtocolFee,
      uint256 latestCommittedFee,
      bool galtProtocolFeePaidOut
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.status,
      m.currency,
      m.rewards.oraclesReward,
      m.rewards.galtProtocolFee,
      m.rewards.latestCommittedFee,
      m.rewards.galtProtocolFeePaidOut
    );
  }

  /**
   * @dev Get application details
   */
  function getApplicationDetails(
    bytes32 _id
  )
    external
    view
    returns (
      bytes32 credentialsHash,
      bytes32 ledgerIdentifier,
      int256 level,
      uint256 area,
      ISpaceGeoDataRegistry.AreaSource areaSource,
      uint256[] memory contour,
      string memory description,
      int256[] memory heights
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.details.credentialsHash,
      m.details.ledgerIdentifier,
      m.details.level,
      m.details.area,
      m.details.areaSource,
      m.details.contour,
      m.details.description,
      m.details.heights
    );
  }

  function getApplicationOperator(bytes32 _aId) public view returns (address) {
    return applications[_aId].operator;
  }

  /**
   * @dev A minimum fee to pass in to #submitApplication() method either in GALT or in ETH
   */
  function getSubmissionFeeByArea(address _pgg, Currency _currency, uint256 _area) public view returns (uint256) {
    if (_currency == Currency.GALT) {
      return feeCalculator(_pgg).calculateGaltFee(_area);
    } else {
      return feeCalculator(_pgg).calculateEthFee(_area);
    }
  }

  /**
   * @dev Fee to pass in to #resubmitApplication().
   */
  function getResubmissionFeeByArea(bytes32 _aId, uint256 _area) external view returns (uint256) {
    Application storage a = applications[_aId];
    uint256 newTotalFee = getSubmissionFeeByArea(a.pgg, a.currency, _area);
    uint256 latest = a.rewards.latestCommittedFee;

    if (newTotalFee <= latest) {
      return 0;
    } else {
      return newTotalFee - latest;
    }
  }

  function getApplicationOracle(
    bytes32 _aId,
    bytes32 _oracleType
  )
    external
    view
    returns (
      address oracle,
      uint256 reward,
      bool rewardPaidOut,
      ValidationStatus status,
      string memory message
    )
  {
    return (
      applications[_aId].oracleTypeAddresses[_oracleType],
      applications[_aId].assignedRewards[_oracleType],
      applications[_aId].oracleTypeRewardPaidOut[_oracleType],
      applications[_aId].validationStatus[_oracleType],
      applications[_aId].oracleTypeMessages[_oracleType]
    );
  }
}
