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
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../interfaces/ISpaceToken.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "../ACL.sol";
import "./AbstractPropertyManager.sol";


contract NewPropertyManager is AbstractPropertyManager {
  using SafeMath for uint256;

  bytes32 public constant PM_LAWYER_ORACLE_TYPE = bytes32("PM_LAWYER_ORACLE_TYPE");
  bytes32 public constant PM_SURVEYOR_ORACLE_TYPE = bytes32("PM_SURVEYOR_ORACLE_TYPE");

  bytes32 public constant CONFIG_MINIMAL_FEE_ETH = bytes32("PM_MINIMAL_FEE_ETH");
  bytes32 public constant CONFIG_MINIMAL_FEE_GALT = bytes32("PM_MINIMAL_FEE_GALT");
  bytes32 public constant CONFIG_PAYMENT_METHOD = bytes32("PM_PAYMENT_METHOD");

  bytes32 public constant CONFIG_APPLICATION_CANCEL_TIMEOUT = bytes32("PM_APPLICATION_CANCEL_TIMEOUT");
  bytes32 public constant CONFIG_APPLICATION_CLOSE_TIMEOUT = bytes32("PM_APPLICATION_CLOSE_TIMEOUT");
  bytes32 public constant CONFIG_ROLE_UNLOCK_TIMEOUT = bytes32("PM_ROLE_UNLOCK_TIMEOUT");

  bytes32 public constant CONFIG_PREFIX = bytes32("PM");

  event NewSpaceToken(address indexed applicant, uint256 spaceTokenId, uint256 applicationId);
  event ClaimSpaceToken(uint256 indexed applicationId, uint256 indexed spaceTokenId);

  constructor () public {}

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

  function roleUnlockTimeout(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_ROLE_UNLOCK_TIMEOUT));
  }

  function getOracleTypeShareKey(bytes32 _oracleType) public pure returns (bytes32) {
    return keccak256(abi.encode(CONFIG_PREFIX, "share", _oracleType));
  }

  function paymentMethod(address _pgg) public view returns (PaymentMethod) {
    return PaymentMethod(uint256(pggConfigValue(_pgg, CONFIG_PAYMENT_METHOD)));
  }

  function submit(
    address _pgg,
    ISpaceGeoDataRegistry.SpaceTokenType _spaceTokenType,
    uint256 _customArea,
    address _beneficiary,
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
    pggRegistry().requireValidPgg(_pgg);

    require(_customArea > 0, "Provide custom area value");

    uint256 _id = nextId();

    Application storage a = applications[_id];
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

    a.status = ApplicationStatus.PARTIALLY_SUBMITTED;
    a.id = _id;
    a.applicant = msg.sender;
    a.createdAt = block.timestamp;

    _calculateAndStoreFee(a, a.rewards.totalPaidFee);

    a.pgg = _pgg;
    a.details.spaceTokenType = _spaceTokenType;
    a.beneficiary = _beneficiary;
    a.details.humanAddress = _humanAddress;
    a.details.dataLink = _dataLink;
    a.details.ledgerIdentifier = _ledgerIdentifier;
    a.details.credentialsHash = _credentialsHash;
    a.details.area = _customArea;
    // Default a.areaSource is AreaSource.USER_INPUT

    applicationsByApplicant[msg.sender].push(_id);

    emit NewApplication(msg.sender, _id);
    emit ApplicationStatusChanged(_id, ApplicationStatus.PARTIALLY_SUBMITTED);

    _assignRequiredOracleTypesAndRewards(applications[_id]);

    return _id;
  }

  function claimSpaceToken(uint256 _aId) external {
    onlyApplicant(_aId);
    Application storage a = applications[_aId];
    require(
      a.status == ApplicationStatus.STORED,
      "Application status should be STORED");

    emit ClaimSpaceToken(_aId, a.spaceTokenId);

    ggr.getSpaceToken().transferFrom(address(this), a.beneficiary, a.spaceTokenId);
  }

  function _executeApproval(uint256 _aId) internal {
    Application storage a = applications[_aId];

    CVApprovedApplicationIds.remove(_aId);
    _changeApplicationStatus(a, ApplicationStatus.APPROVED);

    AbstractPropertyManagerLib.mintToken(ggr, a, address(this));
    emit NewSpaceToken(a.applicant, a.spaceTokenId, _aId);
  }

  function _assignRequiredOracleTypesAndRewards(Application storage a) internal {
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
      _changeValidationStatus(a, oracleType, ValidationStatus.PENDING);
      totalReward = totalReward.add(rewardShare);
    }

    assert(totalReward <= a.rewards.oraclesReward);
    uint256 diff = a.rewards.oraclesReward - totalReward;
    a.assignedRewards[a.assignedOracleTypes[0]] = a.assignedRewards[a.assignedOracleTypes[0]].add(diff);
  }

  function getCVSpaceTokenType(uint256 _aId) external view returns (ISpaceGeoDataRegistry.SpaceTokenType) {
    return applications[_aId].details.spaceTokenType;
  }

  function getApplicationBeneficiary(uint256 _aId) public view returns (address) {
    return applications[_aId].beneficiary;
  }

  function getCVData(uint256 _applicationId)
    external
    view
    returns (
      IContourModifierApplication.ContourModificationType contourModificationType,
      uint256 spaceTokenId,
      uint256[] memory contour
    )
  {
    contourModificationType = IContourModifierApplication.ContourModificationType.ADD;
    contour = applications[_applicationId].details.contour;
  }
}
