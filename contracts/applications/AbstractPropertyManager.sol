/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "./AbstractOracleApplication.sol";
import "./AbstractPropertyManagerLib.sol";
import "../registries/GaltGlobalRegistry.sol";
import "./ContourVerifiableApplication.sol";


contract AbstractPropertyManager is AbstractOracleApplication, ContourVerifiableApplication {
  using SafeMath for uint256;

  event NewApplication(address indexed applicant, uint256 applicationId);
  event ApplicationStatusChanged(uint256 indexed applicationId, ApplicationStatus indexed status);
  event ValidationStatusChanged(uint256 indexed applicationId, bytes32 indexed oracleType, ValidationStatus indexed status);
  event OracleRewardClaim(uint256 indexed applicationId, address indexed oracle);
  event ApplicantFeeClaim(uint256 indexed applicationId);
  event GaltProtocolFeeAssigned(uint256 indexed applicationId);

  enum ApplicationStatus {
    NOT_EXISTS,
    PARTIALLY_SUBMITTED,
    CONTOUR_VERIFICATION,
    CANCELLED,
    CV_REJECTED,
    PENDING,
    APPROVED,
    REJECTED,
    REVERTED,
    PARTIALLY_RESUBMITTED,
    STORED,
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
    uint256 id;
    address pgg;
    address applicant;
    address beneficiary;
    uint256 spaceTokenId;
    uint256 createdAt;
    uint256 becomePendingAt;
    uint256 becomeRevertedAt;
    bool lockedAtLeastOnce;
    Details details;
    Rewards rewards;
    Currency currency;
    ApplicationStatus status;

    bytes32[] assignedOracleTypes;

    // Mapping (oracleType => raward(ETH or GALT))
    mapping(bytes32 => uint256) assignedRewards;
    // Mapping (oracleType => isPaidOut)
    mapping(bytes32 => bool) oracleTypeRewardPaidOut;
    // Mapping (oracleType => message string)
    mapping(bytes32 => string) oracleTypeMessages;
    // Mapping (oracleType => addressLockedTheOracleType)
    mapping(bytes32 => address) oracleTypeAddresses;
    // Mapping (oracleAddress => oracleTypeLockedByTheAddress)
    mapping(address => bytes32) addressOracleTypes;
    // Mapping (oracleType => lastLockedAtTimestamp)
    mapping(bytes32 => uint256) lastLockedAt;
    // Mapping (oracleType => validationStatus)
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  struct Rewards {
    uint256 totalPaidFee;
    uint256 oraclesReward;
    uint256 galtProtocolFee;
    uint256 latestCommittedFee;
    bool galtProtocolFeePaidOut;
    bool applicantFeePaidOut;
  }

  struct Details {
    bytes32 credentialsHash;

    ISpaceGeoDataRegistry.SpaceTokenType spaceTokenType;

    uint256[] contour;
    int256 highestPoint;

    ISpaceGeoDataRegistry.AreaSource areaSource;
    uint256 area;

    bytes32 ledgerIdentifier;
    string humanAddress;
    string dataLink;
  }

  // Mapping (applicationId => Application)
  mapping(uint256 => Application) internal applications;

  constructor () public {}

  function initialize(
    GaltGlobalRegistry _ggr
  )
    external
    isInitializer
  {
    ggr = _ggr;
  }

  // MODIFIER-LIKE FUNCTIONS

  function onlyCVM() internal {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_CONTOUR_VERIFIER_POOL),
      "Invalid verifier contract"
    );
  }

  function onlyApplicant(uint256 _aId) internal {
    require(applications[_aId].applicant == msg.sender, "Invalid applicant");
  }

  function onlyOracleOfApplication(uint256 _aId) internal {
    require(applications[_aId].addressOracleTypes[msg.sender] != 0x0, "Not valid oracle");
  }

  // CONFIG GETTERS

  /**
   * @notice Returns a minimal application fee in ETH for the given PGG address.

   * @param _pgg Protocol Governance Group (PGG) address
   * @return minimal fee in ETH
   */
  function minimalApplicationFeeEth(address _pgg) public view returns (uint256);

  /**
   * @notice Returns a minimal application fee in GALT for the given PGG address.

   * @param _pgg Protocol Governance Group (PGG) address
   * @return minimal fee in GALT
   */
  function minimalApplicationFeeGalt(address _pgg) public view returns (uint256);

  /**
   * @notice Returns P*_APPLICATION_CANCEL_TIMEOUT for the given PGG address.
   * @dev The value used by `#cancel()` method.

   * @param _pgg Protocol Governance Group (PGG) address
   * @return timeout in seconds
   */
  function applicationCancelTimeout(address _pgg) public view returns (uint256);

  /**
   * @notice Returns P*_APPLICATION_CLOSE_TIMEOUT for the given PGG address.
   * @dev The value used by `#close()` method.

   * @param _pgg Protocol Governance Group (PGG) address
   * @return timeout in seconds
   */
  function applicationCloseTimeout(address _pgg) public view returns (uint256);

  /**
   * @notice Returns P*_ROLE_UNLOCK_TIMEOUT for the given PGG address.
   * @dev The value used by `#unlock()` method.

   * @param _pgg Protocol Governance Group (PGG) address
   * @return timeout in seconds
   */
  function oracleTypeUnlockTimeout(address _pgg) public view returns (uint256);

  // EXTERNAL

  /**
   * @notice Synchronizes Contour Verification application APPROVED status.
   * @dev The method should be internally called by Contour Verification Manager contract #pushApproval() method.
   *
   * @param _aId application ID
   */
  function cvApprove(uint256 _aId) external {
    onlyCVM();
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.CONTOUR_VERIFICATION, "Expect CONTOUR_VERIFICATION status");

    a.becomePendingAt = block.timestamp;

    CVPendingApplicationIds.remove(_aId);
    CVApprovedApplicationIds.add(_aId);

    _changeApplicationStatus(a, ApplicationStatus.PENDING);
  }

  /**
   * @notice Synchronizes Contour Verification application REJECTED status.
   * @dev The method should be internally called by Contour Verification Manager contract #pushRejection() method.
   *
   * @param _aId application ID
   */
  function cvReject(uint256 _aId) external {
    onlyCVM();
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.CONTOUR_VERIFICATION, "Expect CONTOUR_VERIFICATION status");

    CVPendingApplicationIds.remove(_aId);

    _changeApplicationStatus(a, ApplicationStatus.CV_REJECTED);
  }

  /**
   * @notice Sets contour among with the highest point.
   *
   * @param _aId application ID
   * @param _highestPoint above the sea level (in centimeters)
   * @param _contour array of geohash5z encoded points
   */
  function setContour(
    uint256 _aId,
    int256 _highestPoint,
    uint256[] calldata _contour
  )
    external
  {
    Application storage a = applications[_aId];

    require(
      _contour.length >= 3 && _contour.length <= 350,
      "Contour vertex count should be between 3 and 350"
    );

    require(a.applicant == msg.sender, "Invalid applicant");
    require(
      /* solium-disable-next-line */
      a.status == ApplicationStatus.PARTIALLY_SUBMITTED
      || a.status == ApplicationStatus.PARTIALLY_RESUBMITTED
      || a.status == ApplicationStatus.CV_REJECTED,
      "setContour(): Incorrect status"
    );

    a.details.contour = _contour;
    a.details.highestPoint = _highestPoint;

    CVPendingApplicationIds.add(_aId);

    _changeApplicationStatus(a, ApplicationStatus.CONTOUR_VERIFICATION);
  }

  /**
   * @notice Resubmits the application after it was reverted. If you don't want to change contour or the highest point,
   *      you can resubmit it to PENDING status directly by setting `_contourChanged` to false. This will allow you to
   *      skip going through the contour verification process again.
   * @dev Resets all the oracle type statuses to LOCKED.
   *
   * @param _aId application ID
   * @param _contourChanged switch to PARTIALLY_RESUBMITTED if true, PENDING otherwise
   * @param _newCredentialsHash keccak256 of user credentials
   * @param _newLedgerIdentifier of a plot
   * @param _newDataLink IPLD address
   * @param _newHumanAddress just a human readable address string
   * @param _newCustomArea in sq. meters (1 sq. meter == 1 eth)
   * @param _resubmissionFeeInGalt or 0 if paid by ETH
   */
  function resubmit(
    uint256 _aId,
    bool _contourChanged,
    bytes32 _newCredentialsHash,
    bytes32 _newLedgerIdentifier,
    string calldata _newDataLink,
    string calldata _newHumanAddress,
    uint256 _newCustomArea,
    uint256 _resubmissionFeeInGalt
  )
    external
    payable
  {
    require(_newCustomArea > 0, "Provide custom area value");

    Application storage a = applications[_aId];
    Details storage d = a.details;

    require(a.applicant == msg.sender, "Invalid applicant");
    require(a.status == ApplicationStatus.REVERTED, "Application status should be REVERTED");

    _checkResubmissionPayment(a, _resubmissionFeeInGalt);

    d.area = _newCustomArea;
    d.humanAddress = _newHumanAddress;
    d.dataLink = _newDataLink;
    d.ledgerIdentifier = _newLedgerIdentifier;
    d.credentialsHash = _newCredentialsHash;

    _assignLockedStatus(_aId);

    if (_contourChanged) {
      _changeApplicationStatus(a, ApplicationStatus.PARTIALLY_RESUBMITTED);
    } else {
      _changeApplicationStatus(a, ApplicationStatus.PENDING);
      a.becomePendingAt = block.timestamp;
    }
  }

  /**
   * @notice Locks an application by specified `_oracleType`. Caller should have the assigned oracle type at the moment
   *         of locking.
   *
   * @param _aId application ID
   * @param _oracleType oracle type to lock application for
   */
  function lock(uint256 _aId, bytes32 _oracleType) external {
    Application storage a = applications[_aId];

    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, _oracleType);

    require(a.status == ApplicationStatus.PENDING, "Application status should be PENDING");
    require(a.oracleTypeAddresses[_oracleType] == address(0), "Oracle is already assigned on this oracle type");
    require(a.validationStatus[_oracleType] == ValidationStatus.PENDING, "Can't lock an oracle type not in PENDING status");

    a.lockedAtLeastOnce = true;
    a.lastLockedAt[_oracleType] = block.timestamp;
    a.oracleTypeAddresses[_oracleType] = msg.sender;
    a.addressOracleTypes[msg.sender] = _oracleType;
    applicationsByOracle[msg.sender].push(_aId);

    _changeValidationStatus(a, _oracleType, ValidationStatus.LOCKED);
  }

  /**
   * @notice Unlocks an application by specified `_oracleType`. This action could be called for LOCKED validation status
   *         in 2 cases:
   *         - immediately by the oracle who has already locked this `_oracleType`
   *         - after `oracleTypeUnlockTimeout()` by anyone
   *
   * @param _aId application ID
   * @param _oracleType oracle type to unlock
   */
  function unlock(uint256 _aId, bytes32 _oracleType) external {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.PENDING, "Application status should be PENDING");
    require(a.validationStatus[_oracleType] == ValidationStatus.LOCKED, "Validation status should be LOCKED");
    require(a.oracleTypeAddresses[_oracleType] != address(0), "Address should be already set");

    if (msg.sender != a.oracleTypeAddresses[_oracleType]) {
      require(
        block.timestamp > a.lastLockedAt[_oracleType].add(oracleTypeUnlockTimeout(a.pgg)),
        "Timeout has not passed yet"
      );
    }

    a.oracleTypeAddresses[_oracleType] = address(0);
    _changeValidationStatus(a, _oracleType, ValidationStatus.PENDING);
  }

  /**
   * @notice Approves the application from the given oracle type. There are all role approvals are required to
   *         change the application status to APPROVED(->STORED)
   *
   * @param _aId application ID
   * @param _credentialsHash keccak256 hash, just to prevent accidental approvals
   */
  function approve(
    uint256 _aId,
    bytes32 _credentialsHash
  )
    external
  {
    onlyOracleOfApplication(_aId);
    Application storage a = applications[_aId];

    require(a.details.credentialsHash == _credentialsHash, "Credentials don't match");
    require(a.status == ApplicationStatus.PENDING, "Application status should be PENDING");

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    require(a.validationStatus[oracleType] == ValidationStatus.LOCKED, "Application should be locked first");
    require(a.oracleTypeAddresses[oracleType] == msg.sender, "Sender not assigned to this application");
    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, oracleType);

    _changeValidationStatus(a, oracleType, ValidationStatus.APPROVED);

    uint256 len = a.assignedOracleTypes.length;
    bool allApproved = true;

    for (uint256 i = 0; i < len; i++) {
      if (a.validationStatus[a.assignedOracleTypes[i]] != ValidationStatus.APPROVED) {
        allApproved = false;
      }
    }

    if (allApproved) {
      _executeApproval(_aId);
    }
  }

  /**
   * @notice Rejects the application in case when an oracle has considered the applicant behaviour is  malicious.
   *
   * @param _aId application ID
   * @param _message string with an explanation of reject
   */
  function reject(
    uint256 _aId,
    string calldata _message
  )
    external
  {
    onlyOracleOfApplication(_aId);
    Application storage a = applications[_aId];

    bytes32 oracleType = a.addressOracleTypes[msg.sender];

    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, oracleType);

    AbstractPropertyManagerLib.rejectApplicationHelper(a, _message);
    CVApprovedApplicationIds.remove(_aId);

    _changeValidationStatus(a, a.addressOracleTypes[msg.sender], ValidationStatus.REJECTED);
    _changeApplicationStatus(a, ApplicationStatus.REJECTED);
  }

  /**
   * @notice Reverts the application in case when an oracle has considered the application details are not comply
   *         requirements and should be corrected by an applicant.
   * @dev Uses external `AbstractPropertyManagerLib` helpers.
   *
   * @param _aId application ID
   * @param _message string with an explanation of revert
   */
  function revert(
    uint256 _aId,
    string calldata _message
  )
    external
  {
    onlyOracleOfApplication(_aId);
    Application storage a = applications[_aId];
    bytes32 senderOracleType = a.addressOracleTypes[msg.sender];
    uint256 len = a.assignedOracleTypes.length;

    require(a.status == ApplicationStatus.PENDING, "Application status should be PENDING");
    requireOracleActiveWithAssignedActiveOracleType(a.pgg, msg.sender, senderOracleType);
    require(a.validationStatus[senderOracleType] == ValidationStatus.LOCKED, "Application should be locked first");

    for (uint256 i = 0; i < len; i++) {
      if (a.validationStatus[a.assignedOracleTypes[i]] == ValidationStatus.PENDING) {
        revert("All oracle types should lock the application first");
      }
    }

    a.oracleTypeMessages[senderOracleType] = _message;
    a.becomeRevertedAt = block.timestamp;

    CVApprovedApplicationIds.remove(_aId);

    _changeValidationStatus(a, senderOracleType, ValidationStatus.REVERTED);
    _changeApplicationStatus(a, ApplicationStatus.REVERTED);
  }

  /**
   * @notice Closes an application in REVERTED status. Assigns rewards to the oracles who has locked the application.
   *         Applicant can call this method anytime he want if he don't want to resubmit this application again.
   *         If the applicant had not resubmitted the application during `applicationCloseTimeout()` anyone can call
   *         `close()` method. Especially the oracles are incentivized doing that in order to receive their rewards.
   *
   * @param _aId application ID
   */
  function close(uint256 _aId) external {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.REVERTED, "Application status should be REVERTED");
    if (msg.sender != a.applicant) {
      require(
        block.timestamp > a.becomeRevertedAt.add(applicationCloseTimeout(a.pgg)),
        "Timeout has not passed yet"
      );
    }

    _changeApplicationStatus(a, ApplicationStatus.CLOSED);
  }

  /**
   * @notice Cancels an application in PENDING status. Only the applicant is allowed to cancel his application.
   *
   * @param _aId application ID
   */
  function cancel(uint256 _aId) external {
    onlyApplicant(_aId);
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.PENDING, "Application status should be PENDING");
    require(
      block.timestamp > a.becomePendingAt.add(applicationCancelTimeout(a.pgg)),
      "Timeout has not passed yet"
    );
    require(a.lockedAtLeastOnce == false, "The application has been already locked at least once");

    _changeApplicationStatus(a, ApplicationStatus.CANCELLED);
  }

  /**
   * @notice Stores contour and the highest point into SpaceGeoDataRegistry.
   * @dev This additional step is required to devote the whole transaction (and probably a block) for storing
   *      large enough contour.
   *
   * @param _aId application ID
   */
  function store(uint256 _aId) external {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.APPROVED, "Application status should be APPROVED");

    ISpaceGeoDataRegistry spaceGeoData = ISpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress());

    spaceGeoData.setSpaceTokenContour(a.spaceTokenId, a.details.contour);
    spaceGeoData.setSpaceTokenHighestPoint(a.spaceTokenId, a.details.highestPoint);

    _changeApplicationStatus(a, ApplicationStatus.STORED);
  }

  /**
   * @notice Refunds an application fee when the application status is CANCELLED.
   *
   * @param _aId application ID
   */
  function claimApplicantFee(uint256 _aId) external {
    onlyApplicant(_aId);

    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.CANCELLED, "Application status should be CANCELLED");

    require(a.rewards.applicantFeePaidOut == false, "Fee already paid out");

    a.rewards.applicantFeePaidOut = true;

    uint256 reward = a.rewards.totalPaidFee;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (a.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(msg.sender, reward);
    }

    emit ApplicantFeeClaim(_aId);
  }

  /**
   * @notice Transfers to an oracle his reward for a given application. Requires STORED, REJECTED, or CLOSED status.
   *
   * @param _aId application ID
   */
  function claimOracleReward(uint256 _aId) external {
    onlyOracleOfApplication(_aId);
    Application storage a = applications[_aId];
    bytes32 senderOracleType = a.addressOracleTypes[msg.sender];
    uint256 reward = a.assignedRewards[senderOracleType];

    /* solium-disable-next-line */
    require(
      a.status == ApplicationStatus.STORED || a.status == ApplicationStatus.REJECTED || a.status == ApplicationStatus.CLOSED,
      "Application status should be STORED, REJECTED or CLOSED");
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

  // INTERNAL
  function _executeApproval(uint256 _aId) internal {
    revert("_executeApproval(): Not implemented");
  }

  function _assignRequiredOracleTypesAndRewards(Application storage a) internal {
    revert("_assignRequiredOracleTypesAndRewards(): Not implemented");
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

  function _calculateAndStoreFee(
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

  function _checkResubmissionPayment(
    Application storage a,
    uint256 _resubmissionFeeInGalt
  )
    internal
  {
    uint256 fee;
    uint256 minimalFee;

    if (a.currency == Currency.GALT) {
      require(msg.value == 0, "ETH payment not expected");
      fee = _resubmissionFeeInGalt;
      minimalFee = minimalApplicationFeeGalt(a.pgg);
    } else {
      require(_resubmissionFeeInGalt == 0, "GALT payment not expected");
      fee = msg.value;
      minimalFee = minimalApplicationFeeEth(a.pgg);
    }

    uint256 totalPaid = a.rewards.latestCommittedFee.add(fee);

    require(totalPaid >= minimalFee, "Insufficient payment");

    a.rewards.latestCommittedFee = totalPaid;
  }

  function _assignLockedStatus(uint256 _aId) internal {
    for (uint256 i = 0; i < applications[_aId].assignedOracleTypes.length; i++) {
      if (applications[_aId].validationStatus[applications[_aId].assignedOracleTypes[i]] != ValidationStatus.LOCKED) {
        _changeValidationStatus(applications[_aId], applications[_aId].assignedOracleTypes[i], ValidationStatus.LOCKED);
      }
    }
  }

  function _changeValidationStatus(
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
  function _changeApplicationStatus(
    Application storage _a,
    ApplicationStatus _status
  )
    internal
  {
    emit ApplicationStatusChanged(_a.id, _status);

    _a.status = _status;
  }

  // GETTERS

  /**
   * @notice Returns application general information
   *
   * @param _aId application ID
   */
  function getApplication(
    uint256 _aId
  )
    external
    view
    returns (
      uint256 createdAt,
      address beneficiary,
      address applicant,
      uint256 becomePendingAt,
      uint256 becomeRevertedAt,
      address pgg,
      uint256 spaceTokenId,
      ApplicationStatus status,
      Currency currency,
      bytes32[] memory assignedOracleTypes
    )
  {
    Application storage m = applications[_aId];

    return (
      m.createdAt,
      m.beneficiary,
      m.applicant,
      m.becomePendingAt,
      m.becomeRevertedAt,
      m.pgg,
      m.spaceTokenId,
      m.status,
      m.currency,
      m.assignedOracleTypes
    );
  }

  /**
   * @notice Returns application rewards information
   *
   * @param _aId application ID
   */
  function getApplicationRewards(
    uint256 _aId
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
    Application storage m = applications[_aId];

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
   * @notice Returns application geodata details
   *
   * @param _aId application ID
   */
  function getApplicationDetails(
    uint256 _aId
  )
    external
    view
    returns (
      bytes32 credentialsHash,
      ISpaceGeoDataRegistry.SpaceTokenType spaceTokenType,
      uint256[] memory contour,
      int256 highestPoint,
      ISpaceGeoDataRegistry.AreaSource areaSource,
      uint256 area,
      bytes32 ledgerIdentifier,
      string memory humanAddress,
      string memory dataLink
    )
  {
    Application storage m = applications[_aId];

    return (
      m.details.credentialsHash,
      m.details.spaceTokenType,
      m.details.contour,
      m.details.highestPoint,
      m.details.areaSource,
      m.details.area,
      m.details.ledgerIdentifier,
      m.details.humanAddress,
      m.details.dataLink
    );
  }

  /**
   * @notice Returns application oracle type information
   *
   * @param _aId application ID
   */
  function getApplicationOracle(
    uint256 _aId,
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

  function getCVContour(uint256 _aId) external view returns (uint256[] memory) {
    return applications[_aId].details.contour;
  }

  function getCVHighestPoint(uint256 _aId) external view returns (int256) {
    return applications[_aId].details.highestPoint;
  }

  function getCVSpaceTokenType(uint256 _aId) external view returns (ISpaceGeoDataRegistry.SpaceTokenType) {
    return applications[_aId].details.spaceTokenType;
  }
}
