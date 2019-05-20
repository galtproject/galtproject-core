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

pragma solidity 0.5.7;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "../interfaces/ISpaceGeoData.sol";
import "../interfaces/ISpaceToken.sol";
import "./AbstractOracleApplication.sol";
import "../registries/GaltGlobalRegistry.sol";
import "../registries/interfaces/IPGGRegistry.sol";


contract UpdatePropertyManager is AbstractOracleApplication {
  using SafeMath for uint256;

  // 'PlotClarificationManager' hash
  bytes32 public constant APPLICATION_TYPE = 0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7;

  bytes32 public constant PL_AUDITOR_ORACLE_TYPE = bytes32("PL_AUDITOR_ORACLE_TYPE");
  bytes32 public constant PL_LAWYER_ORACLE_TYPE = bytes32("PL_LAWYER_ORACLE_TYPE");
  bytes32 public constant PL_SURVEYOR_ORACLE_TYPE = bytes32("PL_SURVEYOR_ORACLE_TYPE");

  bytes32 public constant CONFIG_MINIMAL_FEE_ETH = bytes32("PL_MINIMAL_FEE_ETH");
  bytes32 public constant CONFIG_MINIMAL_FEE_GALT = bytes32("PL_MINIMAL_FEE_GALT");
  bytes32 public constant CONFIG_PAYMENT_METHOD = bytes32("PL_PAYMENT_METHOD");
  bytes32 public constant CONFIG_PREFIX = bytes32("PL");

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

  event LogApplicationStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event LogValidationStatusChanged(bytes32 applicationId, bytes32 oracleType, ValidationStatus status);
  event LogSpaceTokenTokenWithdrawn(bytes32 applicationId, uint256 spaceTokenId);
  event LogNewApplication(bytes32 id, address applicant);

  struct Application {
    bytes32 id;
    address multiSig;
    address applicant;
    bytes32 ledgerIdentifier;
    string description;
    uint256 spaceTokenId;
    
    uint256 oraclesReward;
    uint256 galtProtocolFee;
    bool galtProtocolFeePaidOut;
    bool tokenWithdrawn;

    // Default is ETH
    Currency currency;
    ApplicationStatus status;

    uint256[] newContour;
    int256[] newHeights;
    int256 newLevel;
    bytes32[] assignedOracleTypes;

    mapping(bytes32 => uint256) assignedRewards;
    mapping(bytes32 => bool) oracleTypeRewardPaidOut;
    mapping(bytes32 => string) oracleTypeMessages;
    mapping(bytes32 => address) oracleTypeAddresses;
    mapping(address => bytes32) addressOracleTypes;
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  mapping(bytes32 => Application) public applications;

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

  function minimalApplicationFeeEth(address _multiSig) internal view returns (uint256) {
    return uint256(pggConfigValue(_multiSig, CONFIG_MINIMAL_FEE_ETH));
  }

  function minimalApplicationFeeGalt(address _multiSig) internal view returns (uint256) {
    return uint256(pggConfigValue(_multiSig, CONFIG_MINIMAL_FEE_GALT));
  }

  function getOracleTypeShareKey(bytes32 _oracleType) public pure returns (bytes32) {
    return keccak256(abi.encode(CONFIG_PREFIX, "share", _oracleType));
  }

  function paymentMethod(address _multiSig) public view returns (PaymentMethod) {
    return PaymentMethod(uint256(pggConfigValue(_multiSig, CONFIG_PAYMENT_METHOD)));
  }

  function submitApplication(
    address _multiSig,
    uint256 _spaceTokenId,
    bytes32 _ledgerIdentifier,
    string calldata _description,
    uint256[] calldata _newContour,
    int256[] calldata _newHeights,
    int256 _newLevel,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    returns (bytes32)
  {
    require(ggr.getSpaceToken().ownerOf(_spaceTokenId) == msg.sender, "Sender should own the provided token");
    require(_newContour.length >= 3, "Contour sould have at least 3 vertices");
    require(_newContour.length == _newHeights.length, "Contour length should be equal heights length");

    pggRegistry().requireValidPggMultiSig(_multiSig);
    ggr.getSpaceToken().transferFrom(msg.sender, address(this), _spaceTokenId);

    // TODO: use storage instead
    bytes32 _id = keccak256(
      abi.encodePacked(
        _multiSig,
        _spaceTokenId,
        blockhash(block.number - 1)
      )
    );

    Application storage a = applications[_id];
    require(applications[_id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    uint256 fee;

    // GALT
    if (_applicationFeeInGalt > 0) {
      require(msg.value == 0, "Could not accept both GALT and ETH");
      require(_applicationFeeInGalt >= minimalApplicationFeeGalt(_multiSig), "Insufficient payment");

      require(ggr.getGaltToken().allowance(msg.sender, address(this)) >= _applicationFeeInGalt, "Insufficient allowance");
      ggr.getGaltToken().transferFrom(msg.sender, address(this), _applicationFeeInGalt);

      fee = _applicationFeeInGalt;
      a.currency = Currency.GALT;
      // ETH
    } else {
      require(msg.value >= minimalApplicationFeeEth(_multiSig), "Insufficient payment");

      fee = msg.value;
    }

    a.status = ApplicationStatus.SUBMITTED;
    a.id = _id;
    a.applicant = msg.sender;
    a.newContour = _newContour;
    a.newHeights = _newHeights;
    a.newLevel = _newLevel;
    a.multiSig = _multiSig;

    a.spaceTokenId = _spaceTokenId;
    a.ledgerIdentifier = _ledgerIdentifier;
    a.description = _description;

    applicationsArray.push(_id);
    applicationsByApplicant[msg.sender].push(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);

    calculateAndStoreFee(applications[_id], fee);
    assignRequiredOracleTypesAndRewards(_id);

    return _id;
  }

  function lockApplicationForReview(bytes32 _aId, bytes32 _oracleType) external {
    Application storage a = applications[_aId];

    requireOracleActiveWithAssignedActiveOracleType(a.multiSig, msg.sender, _oracleType);
    require(a.status == ApplicationStatus.SUBMITTED, "ApplicationStatus should be SUBMITTED");
    require(a.oracleTypeAddresses[_oracleType] == address(0), "Oracle is already assigned on this oracle type");
    require(a.validationStatus[_oracleType] == ValidationStatus.PENDING, "Can't lock a oracle type not in PENDING status");

    a.oracleTypeAddresses[_oracleType] = msg.sender;
    a.addressOracleTypes[msg.sender] = _oracleType;
    applicationsByOracle[msg.sender].push(_aId);

    changeValidationStatus(a, _oracleType, ValidationStatus.LOCKED);
  }

  function approveApplication(
    bytes32 _aId
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.SUBMITTED, "ApplicationStatus should be SUBMITTED");

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    requireOracleActiveWithAssignedActiveOracleType(a.multiSig, msg.sender, oracleType);

    require(a.validationStatus[oracleType] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.oracleTypeAddresses[oracleType] == msg.sender, "Sender not assigned to this application");

    changeValidationStatus(a, oracleType, ValidationStatus.APPROVED);

    uint256 len = a.assignedOracleTypes.length;
    bool allApproved = true;

    for (uint8 i = 0; i < len; i++) {
      if (a.validationStatus[a.assignedOracleTypes[i]] != ValidationStatus.APPROVED) {
        allApproved = false;
      }
    }

    if (allApproved) {
      ISpaceGeoData spaceGeoData = ISpaceGeoData(ggr.getSpaceGeoDataAddress());
      spaceGeoData.setSpaceTokenContour(a.spaceTokenId, a.newContour);
      spaceGeoData.setSpaceTokenHeights(a.spaceTokenId, a.newHeights);
      spaceGeoData.setSpaceTokenLevel(a.spaceTokenId, a.newLevel);
      spaceGeoData.setSpaceToken(a.spaceTokenId, a.ledgerIdentifier, a.description);
      changeApplicationStatus(a, ApplicationStatus.APPROVED);
    }
  }

  function revertApplication(
    bytes32 _aId,
    string calldata _message
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.SUBMITTED, "ApplicationStatus should be SUBMITTED");

    bytes32 senderOracleType = a.addressOracleTypes[msg.sender];
    requireOracleActiveWithAssignedActiveOracleType(a.multiSig, msg.sender, senderOracleType);

    require(a.validationStatus[senderOracleType] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.oracleTypeAddresses[senderOracleType] == msg.sender, "Sender not assigned to this application");

    uint256 len = a.assignedOracleTypes.length;

    for (uint8 i = 0; i < len; i++) {
      bytes32 currentOracleType = a.assignedOracleTypes[i];
      if (a.validationStatus[currentOracleType] == ValidationStatus.PENDING) {
        revert("All oracle types should lock the application first");
      }
    }

    a.oracleTypeMessages[senderOracleType] = _message;

    changeValidationStatus(a, senderOracleType, ValidationStatus.REVERTED);
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

    uint256 len = a.assignedOracleTypes.length;

    for (uint8 i = 0; i < len; i++) {
      bytes32 currentOracleType = a.assignedOracleTypes[i];
      if (a.validationStatus[currentOracleType] != ValidationStatus.LOCKED) {
        changeValidationStatus(a, currentOracleType, ValidationStatus.LOCKED);
      }
    }

    changeApplicationStatus(a, ApplicationStatus.SUBMITTED);
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
    emit LogSpaceTokenTokenWithdrawn(a.id, a.spaceTokenId);
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
    requireOracleActiveWithAssignedActiveOracleType(a.multiSig, msg.sender, oracleType);

    _assignGaltProtocolFee(a);

    uint256 reward = a.assignedRewards[oracleType];
    a.oracleTypeRewardPaidOut[oracleType] = true;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (a.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(msg.sender, reward);
    }
  }

  function _assignGaltProtocolFee(Application storage _a) internal {
    if (_a.galtProtocolFeePaidOut == false) {
      if (_a.currency == Currency.ETH) {
        protocolFeesEth = protocolFeesEth.add(_a.galtProtocolFee);
      } else if (_a.currency == Currency.GALT) {
        protocolFeesGalt = protocolFeesGalt.add(_a.galtProtocolFee);
      }

      _a.galtProtocolFeePaidOut = true;
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
      address multiSig,
      uint256 spaceTokenId,
      bool tokenWithdrawn,
      bool galtProtocolFeePaidOut,
      bytes32[] memory assignedOracleTypes,
      uint256 oraclesReward,
      uint256 galtProtocolFee
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.status,
      m.currency,
      m.applicant,
      m.multiSig,
      m.spaceTokenId,
      m.tokenWithdrawn,
      m.galtProtocolFeePaidOut,
      m.assignedOracleTypes,
      m.oraclesReward,
      m.galtProtocolFee
    );
  }

  function getApplicationPayloadById(
    bytes32 _id
  )
    external
    view
    returns(
      uint256[] memory newContour,
      int256[] memory newHeights,
      int256 newLevel,
      bytes32 ledgerIdentifier,
      string memory description
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (m.newContour, m.newHeights, m.newLevel, m.ledgerIdentifier, m.description);
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
    emit LogValidationStatusChanged(_a.id, _oracleType, _status);

    _a.validationStatus[_oracleType] = _status;
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

    _a.oraclesReward = oraclesReward;
    _a.galtProtocolFee = galtProtocolFee;
  }

  function assignRequiredOracleTypesAndRewards(bytes32 _aId) internal {
    Application storage a = applications[_aId];
    assert(a.oraclesReward > 0);

    uint256 totalReward = 0;

    a.assignedOracleTypes = [PL_SURVEYOR_ORACLE_TYPE, PL_LAWYER_ORACLE_TYPE, PL_AUDITOR_ORACLE_TYPE];

    uint256 len = a.assignedOracleTypes.length;

    for (uint8 i = 0; i < len; i++) {
      bytes32 oracleType = a.assignedOracleTypes[i];
      uint256 rewardShare = a
        .oraclesReward
        .mul(oracleTypeShare(a.multiSig, oracleType))
        .div(100);

      a.assignedRewards[oracleType] = rewardShare;
      changeValidationStatus(a, oracleType, ValidationStatus.PENDING);
      totalReward = totalReward.add(rewardShare);
    }

    assert(totalReward == a.oraclesReward);
  }
}
