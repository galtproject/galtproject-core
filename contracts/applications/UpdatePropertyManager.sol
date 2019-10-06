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
import "./interfaces/IContourModifierApplication.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "../registries/GaltGlobalRegistry.sol";
import "./AbstractPropertyManager.sol";


/**
 * @title Update Property Information Application.
 */
contract UpdatePropertyManager is AbstractPropertyManager {
  using SafeMath for uint256;

  bytes32 public constant PL_AUDITOR_ORACLE_TYPE = bytes32("PL_AUDITOR_ORACLE_TYPE");
  bytes32 public constant PL_LAWYER_ORACLE_TYPE = bytes32("PL_LAWYER_ORACLE_TYPE");
  bytes32 public constant PL_SURVEYOR_ORACLE_TYPE = bytes32("PL_SURVEYOR_ORACLE_TYPE");

  bytes32 public constant CONFIG_MINIMAL_FEE_ETH = bytes32("PL_MINIMAL_FEE_ETH");
  bytes32 public constant CONFIG_MINIMAL_FEE_GALT = bytes32("PL_MINIMAL_FEE_GALT");
  bytes32 public constant CONFIG_PAYMENT_METHOD = bytes32("PL_PAYMENT_METHOD");

  bytes32 public constant CONFIG_APPLICATION_CANCEL_TIMEOUT = bytes32("PL_APPLICATION_CANCEL_TIMEOUT");
  bytes32 public constant CONFIG_APPLICATION_CLOSE_TIMEOUT = bytes32("PL_APPLICATION_CLOSE_TIMEOUT");
  bytes32 public constant CONFIG_ORACLE_TYPE_UNLOCK_TIMEOUT = bytes32("PL_ORACLE_TYPE_UNLOCK_TIMEOUT");

  bytes32 public constant CONFIG_PREFIX = bytes32("PL");

  event SpaceTokenTokenDeposit(uint256 indexed applicationId, uint256 indexed spaceTokenId);
  event SpaceTokenTokenWithdrawal(uint256 indexed applicationId, uint256 indexed spaceTokenId);

  struct UpdateDetails {
    bool withContourOrHighestPointChange;
    bool tokenWithdrawn;
  }

  mapping(uint256 => UpdateDetails) internal updateDetails;

  constructor () public {}

  // CONFIG GETTERS

  function minimalApplicationFeeEth(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_MINIMAL_FEE_ETH));
  }

  function minimalApplicationFeeGalt(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_MINIMAL_FEE_GALT));
  }

  function applicationCancelTimeout(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_APPLICATION_CANCEL_TIMEOUT));
  }

  function applicationCloseTimeout(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_APPLICATION_CLOSE_TIMEOUT));
  }

  function oracleTypeUnlockTimeout(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_ORACLE_TYPE_UNLOCK_TIMEOUT));
  }

  function getOracleTypeShareKey(bytes32 _oracleType) public pure returns (bytes32) {
    return keccak256(abi.encode(CONFIG_PREFIX, "share", _oracleType));
  }

  function paymentMethod(address _pgg) public view returns (PaymentMethod) {
    return PaymentMethod(uint256(pggConfigValue(_pgg, CONFIG_PAYMENT_METHOD)));
  }

  // EXTERNAL

  /**
   * @notice Submits an existing property information update application. Transfers the token to this contract so
   *         the token transfer should be approved before the submission.
   *         If you don't need to change a contour or the highest point, set `_changeContourOrHighestPoint` to false.
   *         This will allow you to skip contour verification step and will assign the application status straight
   *         to PENDING.
   * @dev Assigns all the oracle type statuses to PENDING.
   *
   * @param _pgg address to submit application to
   * @param _spaceTokenId to modify information for
   * @param _changeContourOrHighestPoint true in case if these changes are required
   * @param _customArea in sq. meters
   * @param _dataLink IPLD address
   * @param _humanAddress just a human readable address string
   * @param _credentialsHash keccak256 of user credentials
   * @param _ledgerIdentifier of a plot, for ex. a cadastral ID
   * @param _submissionFeeInGalt or 0 if paid by ETH
   */
  function submit(
    address _pgg,
    uint256 _spaceTokenId,
    bool _changeContourOrHighestPoint,
    uint256 _customArea,
    string calldata _dataLink,
    string calldata _humanAddress,
    bytes32 _credentialsHash,
    bytes32 _ledgerIdentifier,
    uint256 _submissionFeeInGalt
  )
    external
    payable
    returns (uint256)
  {
    uint256 id = _performSubmissionChecks(_pgg, _spaceTokenId, _customArea);

    Application storage a = applications[id];
    require(a.status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    // GALT
    if (_submissionFeeInGalt > 0) {
      requireValidPaymentType(_pgg, PaymentType.GALT);
      require(msg.value == 0, "Could not accept both ETH and GALT");
      require(_submissionFeeInGalt >= minimalApplicationFeeGalt(_pgg), "Insufficient payment");

      require(ggr.getGaltToken().allowance(msg.sender, address(this)) >= _submissionFeeInGalt, "Insufficient allowance");
      ggr.getGaltToken().transferFrom(msg.sender, address(this), _submissionFeeInGalt);

      a.rewards.totalPaidFee = _submissionFeeInGalt;
      a.currency = Currency.GALT;
      // ETH
    } else {
      requireValidPaymentType(_pgg, PaymentType.ETH);
      a.rewards.totalPaidFee = msg.value;
      // Default a.currency is Currency.ETH

      require(msg.value >= minimalApplicationFeeEth(_pgg), "Insufficient payment");
    }

    a.id = id;
    a.applicant = msg.sender;
    a.createdAt = block.timestamp;
    a.spaceTokenId = _spaceTokenId;
    _calculateAndStoreFee(a, a.rewards.totalPaidFee);

    a.pgg = _pgg;
    a.details.humanAddress = _humanAddress;
    a.details.dataLink = _dataLink;
    a.details.ledgerIdentifier = _ledgerIdentifier;
    a.details.credentialsHash = _credentialsHash;
    a.details.area = _customArea;
    // Default a.areaSource is AreaSource.USER_INPUT

    updateDetails[id].withContourOrHighestPointChange = _changeContourOrHighestPoint;

    applicationsByApplicant[msg.sender].push(id);

    emit NewApplication(msg.sender, id);

    if (_changeContourOrHighestPoint) {
      _changeApplicationStatus(a, ApplicationStatus.PARTIALLY_SUBMITTED);
    } else {
      _changeApplicationStatus(a, ApplicationStatus.PENDING);
    }

    _assignRequiredOracleTypesAndRewards(applications[id]);

    return id;
  }

  /**
   * @notice Transfers a Space token back to the applicant when the application status is set to the one of the finals:
   *         STORED, REJECTED, CLOSED, or CANCELLED. Only the application applicant is allowed to call this method.
   *
   * @param _aId application ID
   */
  function withdrawSpaceToken(uint256 _aId) external {
    onlyApplicant(_aId);

    Application storage a = applications[_aId];
    UpdateDetails storage uD = updateDetails[_aId];
    ApplicationStatus status = a.status;

    /* solium-disable-next-line */
    require(
      status == ApplicationStatus.CLOSED ||
      status == ApplicationStatus.CANCELLED ||
      status == ApplicationStatus.REJECTED ||
      status == ApplicationStatus.STORED,
      "withdrawSpaceToken(): invalid status");

    require(uD.tokenWithdrawn == false, "Token is already withdrawn");

    ggr.getSpaceToken().transferFrom(address(this), msg.sender, a.spaceTokenId);

    uD.tokenWithdrawn = true;
    emit SpaceTokenTokenWithdrawal(a.id, a.spaceTokenId);
  }

  // INTERNAL

  function _executeApproval(uint256 _aId) internal {
    Application storage a = applications[_aId];

    if (updateDetails[_aId].withContourOrHighestPointChange == true) {
      CVApprovedApplicationIds.remove(_aId);
      _changeApplicationStatus(a, ApplicationStatus.APPROVED);
    } else {
      _changeApplicationStatus(a, ApplicationStatus.STORED);
    }

    AbstractPropertyManagerLib.updateGeoData(ggr, a, address(this));
  }

  function _performSubmissionChecks(
    address _pgg,
    uint256 _spaceTokenId,
    uint256 _customArea
  )
    internal
    returns (uint256)
  {
    pggRegistry().requireValidPgg(_pgg);
    require(ggr.getSpaceToken().ownerOf(_spaceTokenId) == msg.sender, "Sender should own the provided token");

    ggr.getSpaceToken().transferFrom(msg.sender, address(this), _spaceTokenId);

    require(_customArea > 0, "Provide custom area value");

    uint256 _id = nextId();

    emit SpaceTokenTokenDeposit(_id, _spaceTokenId);

    return _id;
  }

  function _assignRequiredOracleTypesAndRewards(Application storage a) internal {
    assert(a.rewards.oraclesReward > 0);

    uint256 totalReward = 0;

    a.assignedOracleTypes = [PL_SURVEYOR_ORACLE_TYPE, PL_LAWYER_ORACLE_TYPE];
    uint256 surveyorShare = oracleTypeShare(a.pgg, PL_SURVEYOR_ORACLE_TYPE);
    uint256 lawyerShare = oracleTypeShare(a.pgg, PL_LAWYER_ORACLE_TYPE);
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
      _changeValidationStatus(a, oracleType, ValidationStatus.PENDING);
      totalReward = totalReward.add(rewardShare);
    }

    assert(totalReward <= a.rewards.oraclesReward);
    uint256 diff = a.rewards.oraclesReward - totalReward;
    a.assignedRewards[a.assignedOracleTypes[0]] = a.assignedRewards[a.assignedOracleTypes[0]].add(diff);
  }

  // GETTERS

  function getUpdateDetails(
    uint256 _aId
  )
    external
    view
    returns(
      bool withContourOrHighestPointChange,
      bool tokenWithdrawn
    )
  {
    UpdateDetails storage uD = updateDetails[_aId];

    return (
      uD.withContourOrHighestPointChange,
      uD.tokenWithdrawn
    );
  }

  function getCVSpaceTokenType(uint256 _aId) external view returns (ISpaceGeoDataRegistry.SpaceTokenType) {
    return ISpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress()).getSpaceTokenType(applications[_aId].spaceTokenId);
  }

  function getCVData(uint256 _aId)
    external
    view
    returns (
      IContourModifierApplication.ContourModificationType contourModificationType,
      uint256 spaceTokenId,
      uint256[] memory contour
    )
  {
    contourModificationType = IContourModifierApplication.ContourModificationType.UPDATE;
    spaceTokenId = applications[_aId].spaceTokenId;
    contour = applications[_aId].details.contour;
  }
}
