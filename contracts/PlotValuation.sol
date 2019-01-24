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
import "./AbstractOracleApplication.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./Oracles.sol";


contract PlotValuation is AbstractOracleApplication {
  using SafeMath for uint256;

  // `PlotValuation` keccak256 hash
  bytes32 public constant APPLICATION_TYPE = 0x619647f9036acf2e8ad4ea6c06ae7256e68496af59818a2b63e51b27a46624e9;

  // `PV_APPRAISER_ORACLE_TYPE` bytes32 representation hash
  bytes32 public constant PV_APPRAISER_ORACLE_TYPE = 0x50565f4150505241495345525f4f5241434c455f545950450000000000000000;
  // `PV_APPRAISER2_ORACLE_TYPE` bytes32 representation
  bytes32 public constant PV_APPRAISER2_ORACLE_TYPE = 0x50565f415050524149534552325f4f5241434c455f5459504500000000000000;
  // `PV_AUDITOR_ORACLE_TYPE` bytes32 representation
  bytes32 public constant PV_AUDITOR_ORACLE_TYPE = 0x50565f41554449544f525f4f5241434c455f5459504500000000000000000000;

  enum ApplicationStatus {
    NOT_EXISTS,
    SUBMITTED,
    VALUATED,
    CONFIRMED,
    REVERTED,
    APPROVED
  }

  enum ValidationStatus {
    NOT_EXISTS,
    PENDING,
    LOCKED
  }

  event LogApplicationStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event LogValidationStatusChanged(bytes32 applicationId, bytes32 oracleType, ValidationStatus status);
  event LogNewApplication(bytes32 id, address applicant);

  struct Application {
    bytes32 id;
    address applicant;
    uint256 spaceTokenId;
    uint256 oraclesReward;
    uint256 galtSpaceReward;
    uint256 firstValuation;
    uint256 secondValuation;
    bool galtSpaceRewardPaidOut;
    ApplicationDetails details;
    Currency currency;
    ApplicationStatus status;

    bytes32[] attachedDocuments;
    bytes32[] assignedOracleTypes;

    // TODO: combine into oracleType struct
    mapping(bytes32 => uint256) assignedRewards;
    mapping(bytes32 => bool) oracleTypeRewardPaidOut;
    mapping(bytes32 => string) oracleTypeMessages;
    mapping(bytes32 => address) oracleTypeAddresses;
    mapping(address => bytes32) addressOracleTypes;
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  struct ApplicationDetails {
    bytes32 credentialsHash;
    bytes32 ledgerIdentifier;
    uint8 precision;
    bytes2 country;
  }

  uint256 public gasPriceForDeposits;

  mapping(bytes32 => Application) public applications;
  // spaceTokenId => valuationInWei
  mapping(uint256 => uint256) public plotValuations;

  SpaceToken public spaceToken;
  SplitMerge public splitMerge;

  constructor () public {}

  function initialize(
    SpaceToken _spaceToken,
    SplitMerge _splitMerge,
    Oracles _oracles,
    ERC20 _galtToken,
    address _galtSpaceRewardsAddress
  )
    public
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
    gasPriceForDeposits = 4 wei;
    paymentMethod = PaymentMethod.ETH_AND_GALT;
  }

  modifier onlyApplicant(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(
      a.applicant == msg.sender,
      "Invalid applicant");

    _;
  }

  modifier onlyOracleOfApplication(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(a.addressOracleTypes[msg.sender] != 0x0, "The oracle is not assigned to any oracleType");
    require(oracles.isOracleActive(msg.sender), "Not active oracle");

    _;
  }

  // TODO: move to abstract class
  modifier oracleTypesReady() {
    require(oracles.isApplicationTypeReady(APPLICATION_TYPE), "OracleTypes list not complete");

    _;
  }
  
  function setGasPriceForDeposits(uint256 _newPrice) external onlyFeeManager {
    gasPriceForDeposits = _newPrice;
  }

  /**
   * @dev Submit a new plot valuation application
   * @param _spaceTokenId application id
   * @param _attachedDocuments IPFS hashes
   * @param _applicationFeeInGalt if GALT is application currency, 0 for ETH
   */
  function submitApplication(
    uint256 _spaceTokenId,
    bytes32[] _attachedDocuments,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    oracleTypesReady
    returns (bytes32)
  {
    require(_attachedDocuments.length > 0, "At least one document should be attached");
    require(spaceToken.exists(_spaceTokenId), "SpaceToken with the given ID doesn't exist");
    require(spaceToken.ownerOf(_spaceTokenId) == msg.sender, "Sender should own the token");

    // Default is ETH
    Currency currency;
    uint256 fee;

    // ETH
    if (msg.value > 0) {
      require(_applicationFeeInGalt == 0, "Could not accept both ETH and GALT");
      require(msg.value >= minimalApplicationFeeInEth, "Incorrect fee passed in");
      fee = msg.value;
    // GALT
    } else {
      require(msg.value == 0, "Could not accept both ETH and GALT");
      require(_applicationFeeInGalt >= minimalApplicationFeeInGalt, "Incorrect fee passed in");
      galtToken.transferFrom(msg.sender, address(this), _applicationFeeInGalt);
      fee = _applicationFeeInGalt;
      currency = Currency.GALT;
    }

    Application memory a;
    bytes32 _id = keccak256(
      abi.encodePacked(
        _attachedDocuments[0],
        applicationsArray.length
      )
    );

    require(applications[_id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    a.status = ApplicationStatus.SUBMITTED;
    a.id = _id;
    a.applicant = msg.sender;
    a.currency = currency;
    a.spaceTokenId = _spaceTokenId;
    a.attachedDocuments = _attachedDocuments;

    calculateAndStoreFee(a, fee);

    applications[_id] = a;

    applicationsArray.push(_id);
    applicationsByApplicant[msg.sender].push(_id);

    emit LogNewApplication(_id, msg.sender);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);

    assignRequiredOracleOracleTypesAndRewards(_id);

    return _id;
  }

  // Application can be locked by a oracleType only once.
  function lockApplication(bytes32 _aId, bytes32 _oracleType) external {
    Application storage a = applications[_aId];
    oracles.requireOracleActiveWithAssignedActiveOracleType(msg.sender, _oracleType);

    require(
      /* solium-disable-next-line */
      a.status == ApplicationStatus.SUBMITTED ||
      a.status == ApplicationStatus.VALUATED ||
      a.status == ApplicationStatus.REVERTED ||
      a.status == ApplicationStatus.CONFIRMED,
      "Application status should be SUBMITTED, REVERTED, VALUATED or CONFIRMED");
    require(a.oracleTypeAddresses[_oracleType] == address(0), "Oracle is already assigned on this oracleType");
    require(a.validationStatus[_oracleType] == ValidationStatus.PENDING, "Can't lock a oracleType not in PENDING status");

    a.oracleTypeAddresses[_oracleType] = msg.sender;
    a.addressOracleTypes[msg.sender] = _oracleType;
    applicationsByOracle[msg.sender].push(_aId);

    changeValidationStatus(a, _oracleType, ValidationStatus.LOCKED);
  }

  // DANGER: could reset non-existing oracleType
  function resetApplicationOracleType(bytes32 _aId, bytes32 _oracleType) external {
  // TODO: move permissions to an applicant
    assert(false);
    Application storage a = applications[_aId];
    require(
      a.status != ApplicationStatus.APPROVED &&
      a.status != ApplicationStatus.NOT_EXISTS,
      "Could not reset applications in state NOT_EXISTS or APPROVED");
    require(a.oracleTypeAddresses[_oracleType] != address(0), "Address should be already set");

    // Do not affect on application state
    a.oracleTypeAddresses[_oracleType] = address(0);
    changeValidationStatus(a, _oracleType, ValidationStatus.PENDING);
  }

  /**
   * @dev First custodian valuates the plot
   * @param _aId application id
   * @param _valuation in GALT
   */
  function valuatePlot(
    bytes32 _aId,
    uint256 _valuation
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.SUBMITTED || a.status == ApplicationStatus.REVERTED,
      "Application status should be SUBMITTED or REVERTED");

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    require(oracleType == PV_APPRAISER_ORACLE_TYPE, "PV_APPRAISER_ORACLE_TYPE expected");
    require(a.validationStatus[oracleType] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.oracleTypeAddresses[oracleType] == msg.sender, "Sender not assigned to this application");

    a.firstValuation = _valuation;

    if (a.firstValuation == a.secondValuation) {
      changeApplicationStatus(a, ApplicationStatus.CONFIRMED);
    } else {
      changeApplicationStatus(a, ApplicationStatus.VALUATED);
    }
  }

  /**
   * @dev Second custodian verifies the first valuation.
   * If the values match, status becomes CONFIRMED, if not - REVERTED.
   * @param _aId application id
   * @param _valuation in GALT
   */
  function valuatePlot2(
    bytes32 _aId,
    uint256 _valuation
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.VALUATED,
      "Application status should be VALUATED");

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    require(oracleType == PV_APPRAISER2_ORACLE_TYPE, "PV_APPRAISER2_ORACLE_TYPE expected");
    require(a.validationStatus[oracleType] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.oracleTypeAddresses[oracleType] == msg.sender, "Sender not assigned to this application");

    a.secondValuation = _valuation;

    if (a.firstValuation == _valuation) {
      changeApplicationStatus(a, ApplicationStatus.CONFIRMED);
    } else {
      changeApplicationStatus(a, ApplicationStatus.REVERTED);
    }
  }

  /**
   * @dev Auditor approves plot valuation.
   * Changes status to APPROVED.
   * @param _aId application id
   */
  function approveValuation(
    bytes32 _aId
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.CONFIRMED,
      "Application status should be CONFIRMED");

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    require(oracleType == PV_AUDITOR_ORACLE_TYPE, "PV_AUDITOR_ORACLE_TYPE expected");
    require(a.validationStatus[oracleType] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.oracleTypeAddresses[oracleType] == msg.sender, "Sender not assigned to this application");

    plotValuations[a.spaceTokenId] = a.firstValuation;
    changeApplicationStatus(a, ApplicationStatus.APPROVED);
  }
  
  /**
   * @dev Auditor reject plot valuation.
   * Changes status to REVERTED.
   * @param _aId application id
   */
  function rejectValuation(
    bytes32 _aId,
    string _message
  )
    external
    onlyOracleOfApplication(_aId)
  {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.CONFIRMED,
      "Application status should be CONFIRMED");

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    require(oracleType == PV_AUDITOR_ORACLE_TYPE, "PV_AUDITOR_ORACLE_TYPE expected");
    require(a.validationStatus[oracleType] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.oracleTypeAddresses[oracleType] == msg.sender, "Sender not assigned to this application");

    a.oracleTypeMessages[oracleType] = _message;

    changeApplicationStatus(a, ApplicationStatus.REVERTED);
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

    require(
      a.status == ApplicationStatus.APPROVED,
      "Application status should be APPROVED");

    require(reward > 0, "Reward is 0");
    require(a.oracleTypeRewardPaidOut[senderOracleType] == false, "Reward is already paid");

    a.oracleTypeRewardPaidOut[senderOracleType] = true;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (a.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, reward);
    } else {
      revert("Unknown currency");
    }
  }

  function claimGaltSpaceReward(
    bytes32 _aId
  )
    external
  {
    require(msg.sender == galtSpaceRewardsAddress, "The method call allowed only for galtSpace address");

    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.APPROVED,
      "Application status should be APPROVED");
    require(a.galtSpaceReward > 0, "Reward is 0");
    require(a.galtSpaceRewardPaidOut == false, "Reward is already paid out");

    a.galtSpaceRewardPaidOut = true;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(a.galtSpaceReward);
    } else if (a.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, a.galtSpaceReward);
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
      address applicant,
      uint256 spaceTokenId,
      ApplicationStatus status,
      Currency currency,
      uint256 firstValuation,
      uint256 secondValuation,
      bytes32[] attachedDocuments,
      bytes32[] assignedOracleTypes,
      uint256 galtSpaceReward,
      uint256 oraclesReward,
      bool galtSpaceRewardPaidOut
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.applicant,
      m.spaceTokenId,
      m.status,
      m.currency,
      m.firstValuation,
      m.secondValuation,
      m.attachedDocuments,
      m.assignedOracleTypes,
      m.galtSpaceReward,
      m.oraclesReward,
      m.galtSpaceRewardPaidOut
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
      string message
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
    Application memory _a,
    uint256 _fee
  )
    internal
  {
    uint256 share;

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

  /**
   * Completely relies on Oracle contract share values without any check
   */
  function assignRequiredOracleOracleTypesAndRewards(bytes32 _aId) internal {
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
