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

pragma solidity 0.5.3;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./Oracles.sol";
import "./AbstractOracleApplication.sol";


contract PlotClarificationManager is AbstractOracleApplication {
  using SafeMath for uint256;

  // 'PlotClarificationManager' hash
  bytes32 public constant APPLICATION_TYPE = 0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7;

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
  event LogPackageTokenWithdrawn(bytes32 applicationId, uint256 spaceTokenId);
  event LogNewApplication(bytes32 id, address applicant);

  struct Application {
    bytes32 id;
    address applicant;
    bytes32 ledgerIdentifier;
    uint256 spaceTokenId;
    
    uint256 oraclesReward;
    uint256 galtSpaceReward;
    uint256 gasDeposit;
    bool galtSpaceRewardPaidOut;
    bool tokenWithdrawn;
    bool gasDepositWithdrawn;

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

  SpaceToken public spaceToken;
  SplitMerge public splitMerge;

  constructor () public {}

  modifier oraclesReady() {
    require(oracles.isApplicationTypeReady(APPLICATION_TYPE), "Oracles list not complete");

    _;
  }

  modifier onlyOracleOfApplication(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.addressOracleTypes[msg.sender] != 0x0, "Not valid oracle");
    oracles.requireOracleActiveWithAssignedActiveOracleType(msg.sender, a.addressOracleTypes[msg.sender]);

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
    Oracles _oracles,
    ERC20 _galtToken,
    address _galtSpaceRewardsAddress
  )
    external
    isInitializer
  {
    spaceToken = _spaceToken;
    splitMerge = _splitMerge;
    oracles = _oracles;
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

  function submitApplication(
    uint256 _spaceTokenId,
    bytes32 _ledgerIdentifier,
    uint256[] _newContour,
    int256[] _newHeights,
    int256 _newLevel,
    uint256 _applicationFeeInGalt
  )
    external
    oraclesReady
    payable
    returns (bytes32)
  {
    require(spaceToken.ownerOf(_spaceTokenId) == msg.sender, "Sender should own the provided token");
    require(_newContour.length >= 3, "Contour sould have at least 3 vertices");
    require(_newContour.length == _newHeights.length, "Contour length should be equal heights length");

    spaceToken.transferFrom(msg.sender, address(this), _spaceTokenId);

    Application memory a;
    bytes32 _id = keccak256(
      abi.encodePacked(
        _spaceTokenId,
        blockhash(block.number)
      )
    );

    uint256 fee;

    // GALT
    if (_applicationFeeInGalt > 0) {
      require(msg.value == 0, "Could not accept both GALT and ETH");
      require(_applicationFeeInGalt >= minimalApplicationFeeInGalt, "Insufficient payment");
      galtToken.transferFrom(msg.sender, address(this), _applicationFeeInGalt);
      fee = _applicationFeeInGalt;
      a.currency = Currency.GALT;
      // ETH
    } else {
      require(msg.value >= minimalApplicationFeeInEth, "Insufficient payment");

      fee = msg.value;
    }

    require(applications[_id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    a.status = ApplicationStatus.SUBMITTED;
    a.id = _id;
    a.applicant = msg.sender;
    a.newContour = _newContour;
    a.newHeights = _newHeights;
    a.newLevel = _newLevel;

    a.spaceTokenId = _spaceTokenId;
    a.ledgerIdentifier = _ledgerIdentifier;

    applications[_id] = a;
    applicationsArray.push(_id);
    applicationsByApplicant[msg.sender].push(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);

    calculateAndStoreFee(applications[_id], fee);
    assignRequiredOracleTypesAndRewards(_id);

    return _id;
  }

  function lockApplicationForReview(bytes32 _aId, bytes32 _oracleType) external anyOracle {
    Application storage a = applications[_aId];

    oracles.requireOracleActiveWithAssignedActiveOracleType(msg.sender, _oracleType);
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
      splitMerge.setPackageContour(a.spaceTokenId, a.newContour);
      splitMerge.setPackageHeights(a.spaceTokenId, a.newHeights);
      splitMerge.setPackageLevel(a.spaceTokenId, a.newLevel);
      changeApplicationStatus(a, ApplicationStatus.APPROVED);
    }
  }

  function revertApplication(
    bytes32 _aId,
    string _message
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.SUBMITTED, "ApplicationStatus should be SUBMITTED");

    bytes32 senderOracleType = a.addressOracleTypes[msg.sender];

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

  function withdrawPackageToken(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];
    ApplicationStatus status = a.status;

    /* solium-disable-next-line */
    require(
      status == ApplicationStatus.REVERTED ||
      status == ApplicationStatus.APPROVED,
      "ApplicationStatus should one of REVERTED or APPROVED");

    require(a.tokenWithdrawn == false, "Token is already withdrawn");

    spaceToken.transferFrom(address(this), msg.sender, a.spaceTokenId);

    a.tokenWithdrawn = true;
    emit LogPackageTokenWithdrawn(a.id, a.spaceTokenId);
  }

  function claimOracleReward(bytes32 _aId) external onlyOracleOfApplication(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.REVERTED ||
      a.status == ApplicationStatus.APPROVED,
      "ApplicationStatus should one of REVERTED or APPROVED");

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    require(a.tokenWithdrawn == true, "Token should be withdrawn first");
    require(a.oracleTypeRewardPaidOut[oracleType] == false, "Reward is already withdrawn");

    uint256 reward = a.assignedRewards[oracleType];
    a.oracleTypeRewardPaidOut[oracleType] = true;

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
      a.status == ApplicationStatus.APPROVED,
      "ApplicationStatus should one of REVERTED or APPROVED");
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
      uint256 spaceTokenId,
      bool tokenWithdrawn,
      bool gasDepositWithdrawn,
      bool galtSpaceRewardPaidOut,
      bytes32[] assignedOracleTypes,
      uint256 gasDeposit,
      uint256 oraclesReward,
      uint256 galtSpaceReward
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.status,
      m.currency,
      m.applicant,
      m.spaceTokenId,
      m.tokenWithdrawn,
      m.gasDepositWithdrawn,
      m.galtSpaceRewardPaidOut,
      m.assignedOracleTypes,
      m.gasDeposit,
      m.oraclesReward,
      m.galtSpaceReward
    );
  }

  function getApplicationPayloadById(
    bytes32 _id
  )
    external
    view
    returns(
      uint256[] newContour,
      int256[] newHeights,
      int256 newLevel,
      bytes32 ledgerIdentifier
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (m.newContour, m.newHeights, m.newLevel, m.ledgerIdentifier);
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
      string message
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
    uint256 share;
    assert(_fee > 0);

    if (_a.currency == Currency.ETH) {
      share = galtSpaceEthShare;
    } else {
      share = galtSpaceGaltShare;
    }

    uint256 galtSpaceReward = share.mul(_fee).div(100);
    uint256 oraclesReward = _fee.sub(galtSpaceReward);

    assert(oraclesReward.add(galtSpaceReward) == _fee);

    _a.oraclesReward = oraclesReward;
    _a.galtSpaceReward = galtSpaceReward;
  }

  function assignRequiredOracleTypesAndRewards(bytes32 _aId) internal {
    Application storage a = applications[_aId];
    assert(a.oraclesReward > 0);

    uint256 totalReward = 0;

    a.assignedOracleTypes = oracles.getApplicationTypeOracleTypes(APPLICATION_TYPE);
    uint256 len = a.assignedOracleTypes.length;
    for (uint8 i = 0; i < len; i++) {
      bytes32 oracleType = a.assignedOracleTypes[i];
      uint256 rewardShare = a
        .oraclesReward
        .mul(oracles.getOracleTypeRewardShare(oracleType))
        .div(100);

      a.assignedRewards[oracleType] = rewardShare;
      changeValidationStatus(a, oracleType, ValidationStatus.PENDING);
      totalReward = totalReward.add(rewardShare);
    }

    assert(totalReward == a.oraclesReward);
  }
}
