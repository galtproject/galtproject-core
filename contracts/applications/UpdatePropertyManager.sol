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
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "@galtproject/geodesic/contracts/interfaces/IGeodesic.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "../interfaces/ISpaceToken.sol";
import "./AbstractOracleApplication.sol";
import "../registries/GaltGlobalRegistry.sol";
import "../registries/interfaces/IPGGRegistry.sol";


contract UpdatePropertyManager is AbstractOracleApplication {
  using SafeMath for uint256;

  bytes32 public constant PL_AUDITOR_ORACLE_TYPE = bytes32("PL_AUDITOR_ORACLE_TYPE");
  bytes32 public constant PL_LAWYER_ORACLE_TYPE = bytes32("PL_LAWYER_ORACLE_TYPE");
  bytes32 public constant PL_SURVEYOR_ORACLE_TYPE = bytes32("PL_SURVEYOR_ORACLE_TYPE");

  bytes32 public constant CONFIG_MINIMAL_FEE_ETH = bytes32("PL_MINIMAL_FEE_ETH");
  bytes32 public constant CONFIG_MINIMAL_FEE_GALT = bytes32("PL_MINIMAL_FEE_GALT");
  bytes32 public constant CONFIG_PAYMENT_METHOD = bytes32("PL_PAYMENT_METHOD");
  bytes32 public constant CONFIG_PREFIX = bytes32("PL");

  event NewApplication(address indexed applicant, bytes32 applicationId);
  event ApplicationStatusChanged(bytes32 indexed applicationId, ApplicationStatus indexed status);
  event ValidationStatusChanged(bytes32 indexed applicationId, bytes32 indexed oracleType, ValidationStatus indexed status);
  event OracleRewardClaim(bytes32 indexed applicationId, address indexed oracle);
  event GaltProtocolFeeAssigned(bytes32 indexed applicationId);
  event SpaceTokenTokenDeposit(bytes32 indexed applicationId, uint256 indexed spaceTokenId);
  event SpaceTokenTokenWithdrawal(bytes32 indexed applicationId, uint256 indexed spaceTokenId);

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

  struct Application {
    bytes32 id;
    address pgg;
    address applicant;
    uint256 spaceTokenId;
    uint256 createdAt;
    bool tokenWithdrawn;

    // Default is ETH
    Currency currency;
    ApplicationStatus status;
    Details details;
    Rewards rewards;

    bytes32[] assignedOracleTypes;

    mapping(bytes32 => uint256) assignedRewards;
    mapping(bytes32 => bool) oracleTypeRewardPaidOut;
    mapping(bytes32 => string) oracleTypeMessages;
    mapping(bytes32 => address) oracleTypeAddresses;
    mapping(address => bytes32) addressOracleTypes;
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  struct Details {
    bytes32 ledgerIdentifier;
    string description;
    int256 level;
    uint256 area;
    ISpaceGeoDataRegistry.AreaSource areaSource;
    uint256[] contour;
    int256[] heights;
  }

  struct Rewards {
    uint256 totalPaidFee;
    uint256 oraclesReward;
    uint256 galtProtocolFee;
    uint256 latestCommittedFee;
    bool galtProtocolFeePaidOut;
  }

  mapping(bytes32 => Application) internal applications;

  constructor () public {}

  modifier onlyOracleOfApplication(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.addressOracleTypes[msg.sender] != 0x0, "Not valid oracle");

    _;
  }

  modifier onlyApplicant(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.applicant == msg.sender, "Applicant invalid");

    _;
  }

  function initialize(
    GaltGlobalRegistry _ggr
  )
    external
    isInitializer
  {
    ggr = _ggr;
  }

  function minimalApplicationFeeEth(address _pgg) internal view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_MINIMAL_FEE_ETH));
  }

  function minimalApplicationFeeGalt(address _pgg) internal view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_MINIMAL_FEE_GALT));
  }

  function getOracleTypeShareKey(bytes32 _oracleType) public pure returns (bytes32) {
    return keccak256(abi.encode(CONFIG_PREFIX, "share", _oracleType));
  }

  function paymentMethod(address _pgg) public view returns (PaymentMethod) {
    return PaymentMethod(uint256(pggConfigValue(_pgg, CONFIG_PAYMENT_METHOD)));
  }

  function _performSubmissionChecks(
    address _pgg,
    uint256 _spaceTokenId,
    uint256[] memory _newContour,
    int256[] memory _newHeights
  )
    internal
    returns(bytes32 _id)
  {
    _id = keccak256(
      abi.encodePacked(
        _pgg,
        _spaceTokenId,
        blockhash(block.number - 1)
      )
    );

    require(ggr.getSpaceToken().ownerOf(_spaceTokenId) == msg.sender, "Sender should own the provided token");
    require(_newContour.length >= 3, "Contour sould have at least 3 vertices");
    require(_newContour.length == _newHeights.length, "Contour length should be equal heights length");

    pggRegistry().requireValidPgg(_pgg);
    ggr.getSpaceToken().transferFrom(msg.sender, address(this), _spaceTokenId);

    emit SpaceTokenTokenDeposit(_id, _spaceTokenId);
  }

  function _acceptPayment(
    Application storage _a,
    address _pgg,
    uint256 _applicationFeeInGalt
  )
    internal
  {
    // GALT
    if (_applicationFeeInGalt > 0) {
      requireValidPaymentType(_pgg, PaymentType.GALT);
      require(msg.value == 0, "Could not accept both GALT and ETH");
      require(_applicationFeeInGalt >= minimalApplicationFeeGalt(_pgg), "Insufficient payment");

      require(ggr.getGaltToken().allowance(msg.sender, address(this)) >= _applicationFeeInGalt, "Insufficient allowance");
      ggr.getGaltToken().transferFrom(msg.sender, address(this), _applicationFeeInGalt);

      _a.rewards.totalPaidFee = _applicationFeeInGalt;
      _a.currency = Currency.GALT;
      // ETH
    } else {
      requireValidPaymentType(_pgg, PaymentType.ETH);
      require(msg.value >= minimalApplicationFeeEth(_pgg), "Insufficient payment");

      _a.rewards.totalPaidFee = msg.value;
    }
  }

  function submit(
    uint256 _spaceTokenId,
    bytes32 _ledgerIdentifier,
    int256 _level,
    uint256 _customArea,
    string calldata _description,
    uint256[] calldata _contour,
    int256[] calldata _heights,
    address _pgg,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    returns (bytes32)
  {
    bytes32 _id = _performSubmissionChecks(_pgg, _spaceTokenId, _contour, _heights);

    Application storage a = applications[_id];
    require(a.status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    _acceptPayment(a, _pgg, _applicationFeeInGalt);

    if (_customArea == 0) {
      a.details.areaSource = ISpaceGeoDataRegistry.AreaSource.CONTRACT;
      a.details.area = IGeodesic(ggr.getGeodesicAddress()).calculateContourArea(_contour);
    } else {
      a.details.area = _customArea;
      // Default a.areaSource is AreaSource.USER_INPUT
    }

    a.status = ApplicationStatus.SUBMITTED;
    a.id = _id;
    a.applicant = msg.sender;

    a.details.ledgerIdentifier = _ledgerIdentifier;
    a.details.description = _description;
    a.details.level = _level;
    a.details.contour = _contour;
    a.details.heights = _heights;

    a.pgg = _pgg;
    a.createdAt = block.timestamp;

    a.spaceTokenId = _spaceTokenId;

    applicationsArray.push(_id);
    applicationsByApplicant[msg.sender].push(_id);

    emit NewApplication(msg.sender, _id);
    emit ApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);

    calculateAndStoreFee(a, a.rewards.totalPaidFee);
    assignRequiredOracleTypesAndRewards(_id);

    return _id;
  }

  function lock(bytes32 _aId, bytes32 _oracleType) external {
    Application storage a = applications[_aId];

    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, _oracleType);
    require(a.status == ApplicationStatus.SUBMITTED, "ApplicationStatus should be SUBMITTED");
    require(a.oracleTypeAddresses[_oracleType] == address(0), "Oracle is already assigned on this oracle type");
    require(a.validationStatus[_oracleType] == ValidationStatus.PENDING, "Can't lock a oracle type not in PENDING status");

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
    bytes32 _aId
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.SUBMITTED, "ApplicationStatus should be SUBMITTED");

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, oracleType);

    require(a.validationStatus[oracleType] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.oracleTypeAddresses[oracleType] == msg.sender, "Sender not assigned to this application");

    changeValidationStatus(a, oracleType, ValidationStatus.APPROVED);

    uint256 len = a.assignedOracleTypes.length;
    bool allApproved = true;

    for (uint256 i = 0; i < len; i++) {
      if (a.validationStatus[a.assignedOracleTypes[i]] != ValidationStatus.APPROVED) {
        allApproved = false;
      }
    }

    if (allApproved) {
      ISpaceGeoDataRegistry spaceGeoData = ISpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress());
      spaceGeoData.setSpaceTokenContour(a.spaceTokenId, a.details.contour);
      spaceGeoData.setSpaceTokenHeights(a.spaceTokenId, a.details.heights);
      spaceGeoData.setSpaceTokenLevel(a.spaceTokenId, a.details.level);
      spaceGeoData.setSpaceTokenArea(a.spaceTokenId, a.details.area, a.details.areaSource);
      spaceGeoData.setSpaceTokenInfo(a.spaceTokenId, a.details.ledgerIdentifier, a.details.description);
      changeApplicationStatus(a, ApplicationStatus.APPROVED);
    }
  }

  function revert(
    bytes32 _aId,
    string calldata _message
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.SUBMITTED, "ApplicationStatus should be SUBMITTED");

    bytes32 senderOracleType = a.addressOracleTypes[msg.sender];
    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, senderOracleType);

    require(a.validationStatus[senderOracleType] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.oracleTypeAddresses[senderOracleType] == msg.sender, "Sender not assigned to this application");

    uint256 len = a.assignedOracleTypes.length;

    for (uint256 i = 0; i < len; i++) {
      bytes32 currentOracleType = a.assignedOracleTypes[i];
      if (a.validationStatus[currentOracleType] == ValidationStatus.PENDING) {
        revert("All oracle types should lock the application first");
      }
    }

    a.oracleTypeMessages[senderOracleType] = _message;

    changeValidationStatus(a, senderOracleType, ValidationStatus.REVERTED);
    changeApplicationStatus(a, ApplicationStatus.REVERTED);
  }

  function resubmit(
    bytes32 _aId,
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

    require(a.applicant == msg.sender, "Applicant invalid");
    require(a.status == ApplicationStatus.REVERTED, "Application status should be REVERTED");

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

  function withdrawSpaceToken(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];
    ApplicationStatus status = a.status;

    /* solium-disable-next-line */
    require(
      status == ApplicationStatus.REVERTED ||
      status == ApplicationStatus.APPROVED,
      "ApplicationStatus should one of REVERTED or APPROVED");

    require(a.tokenWithdrawn == false, "Token is already withdrawn");

    ggr.getSpaceToken().transferFrom(address(this), msg.sender, a.spaceTokenId);

    a.tokenWithdrawn = true;
    emit SpaceTokenTokenWithdrawal(a.id, a.spaceTokenId);
  }

  function claimOracleReward(bytes32 _aId) external {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.REVERTED ||
      a.status == ApplicationStatus.APPROVED,
      "ApplicationStatus should one of REVERTED or APPROVED");

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    require(a.tokenWithdrawn == true, "Token should be withdrawn first");
    require(a.oracleTypeRewardPaidOut[oracleType] == false, "Reward is already withdrawn");
    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, oracleType);

    _assignGaltProtocolFee(a);

    uint256 reward = a.assignedRewards[oracleType];
    a.oracleTypeRewardPaidOut[oracleType] = true;

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

  function getApplication(
    bytes32 _id
  )
    external
    view
    returns (
      ApplicationStatus status,
      Currency currency,
      uint256 createdAt,
      address applicant,
      address pgg,
      uint256 spaceTokenId,
      bool tokenWithdrawn,
      bytes32[] memory assignedOracleTypes
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.status,
      m.currency,
      m.createdAt,
      m.applicant,
      m.pgg,
      m.spaceTokenId,
      m.tokenWithdrawn,
      m.assignedOracleTypes
    );
  }

  /**
   * @dev Get application reward-related information
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

  function getApplicationDetails(
    bytes32 _id
  )
    external
    view
    returns(
      uint256[] memory contour,
      int256[] memory heights,
      int256 level,
      uint256 area,
      ISpaceGeoDataRegistry.AreaSource areaSource,
      bytes32 ledgerIdentifier,
      string memory description
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Details storage d = applications[_id].details;

    return (
      d.contour,
      d.heights,
      d.level,
      d.area,
      d.areaSource,
      d.ledgerIdentifier,
      d.description
    );
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
    Application storage m = applications[_aId];

    return (
      m.oracleTypeAddresses[_oracleType],
      m.assignedRewards[_oracleType],
      m.oracleTypeRewardPaidOut[_oracleType],
      m.validationStatus[_oracleType],
      m.oracleTypeMessages[_oracleType]
    );
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

  function changeApplicationStatus(
    Application storage _a,
    ApplicationStatus _status
  )
    internal
  {
    emit ApplicationStatusChanged(_a.id, _status);

    _a.status = _status;
  }

  function calculateAndStoreFee(
    Application storage _a,
    uint256 _fee
  )
    internal
  {
    assert(_fee > 0);

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

  function assignRequiredOracleTypesAndRewards(bytes32 _aId) internal {
    Application storage a = applications[_aId];
    assert(a.rewards.oraclesReward > 0);

    uint256 totalReward = 0;

    a.assignedOracleTypes = [PL_SURVEYOR_ORACLE_TYPE, PL_LAWYER_ORACLE_TYPE, PL_AUDITOR_ORACLE_TYPE];

    uint256 len = a.assignedOracleTypes.length;

    for (uint256 i = 0; i < len; i++) {
      bytes32 oracleType = a.assignedOracleTypes[i];
      uint256 rewardShare = a
        .rewards
        .oraclesReward
        .mul(oracleTypeShare(a.pgg, oracleType))
        .div(100);

      a.assignedRewards[oracleType] = rewardShare;
      changeValidationStatus(a, oracleType, ValidationStatus.PENDING);
      totalReward = totalReward.add(rewardShare);
    }

    assert(totalReward == a.rewards.oraclesReward);
  }
}
