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

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./AbstractApplication.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./Validators.sol";


contract PlotEscrow is AbstractApplication {
  using SafeMath for uint256;

  // `PlotValuation` keccak256 hash
  bytes32 public constant APPLICATION_TYPE = 0xf17a99d990bb2b0a5c887c16a380aa68996c0b23307f6633bd7a2e1632e1ef48;

  // `PV_AUDITOR_ROLE` bytes32 representation
  bytes32 public constant PV_AUDITOR_ROLE = 0x50565f41554449544f525f524f4c450000000000000000000000000000000000;

  enum SaleOrderStatus {
    NOT_EXISTS,
    OPEN,
    LOCKED,
    CLOSED
  }

  enum SaleOfferStatus {
    NOT_EXISTS,
    MATCH,
    ESCROW,
    AUDIT_REQUIRED,
    AUDIT,
    RESOLVED,
    CLOSED
  }

  enum ValidationStatus {
    NOT_EXISTS,
    PENDING,
    LOCKED
  }

  enum OrderCurrency {
    ETH,
    ERC20
  }

  event LogSaleOrderStatusChanged(bytes32 applicationId, SaleOfferStatus status);
  event LogSaleOfferStatusChanged(bytes32 applicationId, bytes32 offerId, SaleOrderStatus status);
  event LogValidationStatusChanged(bytes32 applicationId, bytes32 role, ValidationStatus status);
  event LogNewApplication(bytes32 id, address applicant);

  struct SaleOrder {
    bytes32 id;
    address applicant;
    uint256 packageTokenId;
    uint256 createdAt;
    // Fee currency
    Currency currency;
    SaleOrderDetails details;
    SaleOrderFees fees;
    SaleOrderStatus status;

    mapping(address => SaleOffer) offers;
    bytes32[] attachedDocuments;
    bytes32[] assignedRoles;

    // TODO: combine into role struct
    mapping(bytes32 => uint256) assignedRewards;
    mapping(bytes32 => bool) roleRewardPaidOut;
    mapping(bytes32 => string) roleMessages;
    mapping(bytes32 => address) roleAddresses;
    mapping(address => bytes32) addressRoles;
    mapping(bytes32 => ValidationStatus) validationStatus;
  }

  struct SaleOrderFees {
    // Order currency
    OrderCurrency currency;
    ERC20 tokenContract;
    uint256 ask;
    uint256 validatorsReward;
    uint256 galtSpaceReward;
    bool galtSpaceRewardPaidOut;
  }

  struct SaleOrderDetails {
    bytes32[] documents;
    bytes32 ledgerIdentifier;
    uint8 precision;
    bytes2 country;
  }

  struct SaleOffer {
    address buyer;
    bytes32 order;
    uint256 ask;
    uint256 bid;
    uint256 lastAskAt;
    uint256 lastBidAt;
  }

  mapping(bytes32 => SaleOrder) public saleOrders;
//  mapping(bytes32 => SaleOrder) public saleOffers;

  SpaceToken public spaceToken;
  SplitMerge public splitMerge;

  constructor () public {}

  function initialize(
    SpaceToken _spaceToken,
    SplitMerge _splitMerge,
    Validators _validators,
    ERC20 _galtToken,
    address _galtSpaceRewardsAddress
  )
    public
    isInitializer
  {
    owner = msg.sender;

    spaceToken = _spaceToken;
    splitMerge = _splitMerge;
    validators = _validators;
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

  // CalSpace share
  function claimValidatorReward(
    bytes32 _aId
  )
    external
  {
    SaleOrder storage order = saleOrders[_aId];
    bytes32 senderRole = order.addressRoles[msg.sender];
    uint256 reward = order.assignedRewards[senderRole];

//    require(
//      order.status == SaleOrderStatus.APPROVED || order.status == SaleOrderStatus.DISASSEMBLED_BY_VALIDATOR,
//      "Application status should be ether APPROVED or DISASSEMBLED_BY_VALIDATOR");

    require(reward > 0, "Reward is 0");
    require(order.roleRewardPaidOut[senderRole] == false, "Reward is already paid");

    order.roleRewardPaidOut[senderRole] = true;

    if (order.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (order.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, reward);
    } else {
      revert("Unknown currency");
    }
  }

  function claimGaltSpaceReward(
    bytes32 _aId
  )
    external
    // TODO: only auditor
  {
    require(msg.sender == galtSpaceRewardsAddress, "The method call allowed only for galtSpace address");

    SaleOrder storage order = saleOrders[_aId];


//    require(
//      order.status == SaleOrderStatus.CANCELLED || order.status == SaleOrderStatus.DISASSEMBLED_BY_VALIDATOR,
//      "Application status should be ether APPROVED or DISASSEMBLED_BY_VALIDATOR");
    require(order.fees.galtSpaceReward > 0, "Reward is 0");
    require(order.fees.galtSpaceRewardPaidOut == false, "Reward is already paid out");

    order.fees.galtSpaceRewardPaidOut = true;

    if (order.currency == Currency.ETH) {
      msg.sender.transfer(order.fees.galtSpaceReward);
    } else if (order.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, order.fees.galtSpaceReward);
    } else {
      revert("Unknown currency");
    }
  }

//  modifier onlyApplicant(bytes32 _aId) {
//    Application storage a = applications[_aId];
//
//    require(
//      a.applicant == msg.sender,
//      "Invalid applicant");
//
//    _;
//  }
//
//  modifier onlyValidatorOfApplication(bytes32 _aId) {
//    Application storage a = applications[_aId];
//
//    require(a.addressRoles[msg.sender] != 0x0, "The validator is not assigned to any role");
//    require(validators.isValidatorActive(msg.sender), "Not active validator");
//
//    _;
//  }

//  // TODO: move to abstract class
//  modifier rolesReady() {
//    require(validators.isApplicationTypeReady(APPLICATION_TYPE), "Roles list not complete");
//
//    _;
//  }

}
