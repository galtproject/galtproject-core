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
import "./applications/PlotCustodianManager.sol";
import "./PlotEscrowLib.sol";
import "./SpaceToken.sol";
import "./Oracles.sol";
import "./collections/ArraySet.sol";
import "./AbstractOracleApplication.sol";


/**
 * Plot Escrow contract
 *
 * Glossary for this contract
 * - Order - Sale order to sell SpaceToken using escrow contract
 * - Offer - Offer for a specific order
 *
 * There is only `PV_AUDITOR_ROLE` oracle role. It's reward is assigned only in
 * a case when escrow cancellation audit process was instantiated.
 */
contract PlotEscrow is AbstractOracleApplication {
  using SafeMath for uint256;
  using ArraySet for ArraySet.Bytes32Set;

  // `PlotEscrow` keccak256 hash
  bytes32 public constant APPLICATION_TYPE = 0xf17a99d990bb2b0a5c887c16a380aa68996c0b23307f6633bd7a2e1632e1ef48;

  // `PE_AUDITOR_ORACLE_TYPE` bytes32 representation
  bytes32 public constant PE_AUDITOR_ORACLE_TYPE = 0x50455f41554449544f525f4f5241434c455f5459504500000000000000000000;

  enum SaleOrderStatus {
    NOT_EXISTS,
    OPEN,
    LOCKED,
    CLOSED,
    CANCELLED
  }

  enum SaleOfferStatus {
    NOT_EXISTS,
    OPEN,
    MATCH,
    ESCROW,
    CUSTODIAN_REVIEW,
    AUDIT_REQUIRED,
    AUDIT,
    RESOLVED,
    CLOSED,
    CANCELLED,
    EMPTY
  }

  enum ValidationStatus {
    NOT_EXISTS,
    PENDING,
    LOCKED,
    APPROVED,
    REJECTED
  }

  enum EscrowCurrency {
    ETH,
    ERC20
  }

  event LogSaleOrderStatusChanged(bytes32 orderId, SaleOrderStatus status);
  event LogSaleOfferStatusChanged(bytes32 orderId, address buyer, SaleOfferStatus status);
  event LogAuditorStatusChanged(bytes32 applicationId, address buyer, bytes32 role, ValidationStatus status);
  event LogNewApplication(bytes32 id, address applicant);

  struct SaleOrder {
    bytes32 id;
    address seller;
    uint256 spaceTokenId;
    uint256 createdAt;
    uint256 ask;
    address lastBuyer;

    // Order currency
    ERC20 tokenContract;

    // Escrow order currency
    EscrowCurrency escrowCurrency;

    SaleOrderDetails details;
    SaleOrderFees fees;
    SaleOrderStatus status;

    mapping(address => SaleOffer) offers;
    address[] offerList;

    bytes32[] attachedDocuments;
  }

  struct SaleOrderFees {
    Currency currency;

    // Used in case when no audit process instantiated
    uint256 totalReward;

    // Used in case when audit process instantiated to share
    // reward among galtSpace and auditor
    uint256 auditorReward;
    uint256 galtSpaceReward;

    bool auditorRewardPaidOut;
    bool galtSpaceRewardPaidOut;
  }

  struct SaleOrderDetails {
    bytes32[] documents;
    bytes32 ledgerIdentifier;
    uint8 precision;
    bytes2 country;
  }

  struct SaleOffer {
    SaleOfferStatus status;
    SaleOfferAuditor auditor;
    address buyer;
    uint256 index;
    uint256 ask;
    uint256 bid;
    uint256 lastAskAt;
    uint256 lastBidAt;
    uint256 createdAt;
    bytes32 custodianApplicationId;
    uint8 resolved;
    bool paymentAttached;
  }

  struct SaleOfferAuditor {
    ValidationStatus status;
    address addr;
  }

  mapping(bytes32 => SaleOrder) public saleOrders;
  mapping(uint256 => bool) public tokenOnSale;

  SpaceToken internal spaceToken;
  PlotCustodianManager internal plotCustodianManager;
  SpaceCustodianRegistry internal spaceCustodianRegistry;

  // Caching (items could be obsolete)
  bytes32[] public saleOrderArray;
  mapping(address => bytes32[]) public saleOrderArrayBySeller;
  mapping(address => bytes32[]) public saleOrderArrayByBuyer;
  mapping(address => bytes32[]) public saleOrderArrayByAuditor;
  mapping(uint256 => bytes32) public spaceTokenLastOrderId;
  ArraySet.Bytes32Set openSaleOrders;
  ArraySet.Bytes32Set auditRequiredSaleOrders;


  constructor () public {}

  function initialize(
    SpaceToken _spaceToken,
    PlotCustodianManager _plotCustodianManager,
    SpaceCustodianRegistry _spaceCustodianRegistry,
    Oracles _oracles,
    ERC20 _galtToken,
    address _galtSpaceRewardsAddress
  )
    public
    isInitializer
  {
    spaceToken = _spaceToken;
    plotCustodianManager = _plotCustodianManager;
    oracles = _oracles;
    galtToken = _galtToken;
    galtSpaceRewardsAddress = _galtSpaceRewardsAddress;
    spaceCustodianRegistry = _spaceCustodianRegistry;

    // Default values for revenue shares and application fees
    // Override them using one of the corresponding setters
    minimalApplicationFeeInEth = 1;
    minimalApplicationFeeInGalt = 10;
    galtSpaceEthShare = 33;
    galtSpaceGaltShare = 33;
    paymentMethod = PaymentMethod.ETH_AND_GALT;
  }

  function createSaleOrder(
    uint256 _spaceTokenId,
    uint256 _ask,
    bytes32[] _documents,
    EscrowCurrency _currency,
    ERC20 _erc20address,
    uint256 _feeInGalt
  )
    external
    payable
  {
    require(spaceToken.exists(_spaceTokenId), "Token doesn't exist");
    require(spaceToken.ownerOf(_spaceTokenId) == msg.sender, "Only space token owner allowed");
    require(tokenOnSale[_spaceTokenId] == false, "Token is already on sale");
    require(_ask > 0, "Negative ask price");
    require(_documents.length > 0, "PlotEscrow. Documents missing");

    if (_currency == EscrowCurrency.ERC20) {
      require(ERC20(_erc20address).balanceOf(msg.sender) >= 0, "Failed ERC20 contract check");
    }

    bytes32 _id = keccak256(
      abi.encode(
        _spaceTokenId,
        _ask,
        blockhash(block.number)
      )
    );

    SaleOrder memory saleOrder;
    uint256 fee;

    // Payment in GALT
    if (msg.value == 0) {
      require(_feeInGalt >= minimalApplicationFeeInGalt, "Insufficient payment in GALT");
      saleOrder.fees.currency = Currency.GALT;
      fee = _feeInGalt;
      galtToken.transferFrom(msg.sender, address(this), fee);
    // Payment in ETH
    } else {
      require(_feeInGalt == 0, "ETH and GALT attached");
      // TODO: keep the require with error message
//      require(msg.value >= minimalApplicationFeeInEth, "Insufficient payment in ETH");
      require(msg.value >= minimalApplicationFeeInEth);
      saleOrder.fees.currency = Currency.ETH;
      fee = msg.value;
    }

    saleOrder.id = _id;
    saleOrder.seller = msg.sender;
    saleOrder.status = SaleOrderStatus.OPEN;
    saleOrder.escrowCurrency = _currency;
    saleOrder.tokenContract = _erc20address;
    saleOrder.ask = _ask;
    saleOrder.spaceTokenId = _spaceTokenId;
    saleOrder.createdAt = block.timestamp;

    saleOrders[_id] = saleOrder;
    saleOrderArray.push(_id);
    saleOrderArrayBySeller[msg.sender].push(_id);
    tokenOnSale[_spaceTokenId] = true;
    spaceTokenLastOrderId[_spaceTokenId] = _id;
    openSaleOrders.add(_id);

    PlotEscrowLib.calculateAndStoreFee(galtSpaceEthShare, galtSpaceGaltShare, saleOrders[_id], fee);

    changeSaleOrderStatus(saleOrders[_id], SaleOrderStatus.OPEN);
  }

  function createSaleOffer(
    bytes32 _orderId,
    uint256 _bid
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];
    PlotEscrowLib.createSaleOfferHelper(saleOrder, _bid, msg.sender);

    saleOrderArrayByBuyer[msg.sender].push(_orderId);

    changeSaleOfferStatus(saleOrder, msg.sender, SaleOfferStatus.OPEN);
  }

  function changeSaleOfferAsk(
    bytes32 _orderId,
    address _buyer,
    uint256 _ask
  )
    external
  {
    (SaleOrder storage saleOrder, SaleOffer storage saleOffer) = requireOpenHelper(_orderId, _buyer);
    require(saleOrder.seller == msg.sender, "PlotEscrow. Only seller allowed");

    saleOffer.ask = _ask;
  }

  function changeSaleOfferBid(
    bytes32 _orderId,
    uint256 _bid
  )
    external
  {
    (SaleOrder storage saleOrder, SaleOffer storage saleOffer) = requireOpenHelper(_orderId, msg.sender);

    saleOffer.bid = _bid;
  }

  function selectSaleOffer(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    (SaleOrder storage saleOrder, SaleOffer storage saleOffer) = requireOpenHelper(_orderId, _buyer);

    require(saleOrder.seller == msg.sender, "PlotEscrow. Only seller allowed");
    require(saleOffer.ask == saleOffer.bid, "ask & bid prices should match");

    saleOrder.lastBuyer = _buyer;

    openSaleOrdersRemove(_orderId);

    changeSaleOrderStatus(saleOrder, SaleOrderStatus.LOCKED);
    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.MATCH);
  }

  function cancelSaleOffer(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    (SaleOrder storage saleOrder, SaleOffer storage saleOffer) = requireMatchHelper(_orderId, _buyer);

    require(
      msg.sender == saleOrder.seller || msg.sender == saleOffer.buyer,
      "Only seller/buyer are allowed");

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.CANCELLED);
  }

  function attachSpaceToken(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    (SaleOrder storage saleOrder, SaleOffer storage saleOffer) = requireMatchHelper(_orderId, _buyer);

    require(saleOrder.seller == msg.sender, "PlotEscrow. Only seller allowed");
    require(spaceToken.ownerOf(saleOrder.spaceTokenId) == msg.sender, "Sender doesn't own given token");

    spaceToken.transferFrom(msg.sender, address(this), saleOrder.spaceTokenId);

    if (saleOffer.paymentAttached) {
      changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.ESCROW);
    }
  }

  function attachPayment(
    bytes32 _orderId,
    address _buyer
  )
    external
    payable
  {
    (SaleOrder storage saleOrder, SaleOffer storage saleOffer) = requireMatchHelper(_orderId, _buyer);

    require(saleOffer.buyer == msg.sender, "PlotEscrow. Only buyer allowed");
    require(saleOffer.paymentAttached == false, "Payment is already attached");

    if (saleOrder.escrowCurrency == EscrowCurrency.ETH) {
      require(msg.value == saleOffer.ask, "Incorrect payment");
    } else {
      require(msg.value == 0, "ERC20 token payment required");
      saleOrder.tokenContract.transferFrom(msg.sender, address(this), saleOffer.ask);
    }

    saleOffer.paymentAttached = true;

    if (spaceToken.ownerOf(saleOrder.spaceTokenId) == address(this)) {
      changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.ESCROW);
    }
  }

  function requestCancellationAudit(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.ESCROW, "ESCROW offer status required");

    require(
      msg.sender == saleOrder.seller || msg.sender == saleOffer.buyer,
      "Only seller/buyer are allowed");

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.AUDIT_REQUIRED);
    changeAuditorStatus(saleOrder, _buyer, ValidationStatus.PENDING);

    auditRequiredSaleOrders.add(_orderId);
  }

  function lockForAudit(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.AUDIT_REQUIRED, "AUDIT_REQUIRED offer required");

    oracles.requireOracleActiveWithAssignedActiveOracleType(msg.sender, PE_AUDITOR_ORACLE_TYPE);

    saleOffer.auditor.addr = msg.sender;

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.AUDIT);
    changeAuditorStatus(saleOrder, _buyer, ValidationStatus.LOCKED);
    
    auditRequiredSaleOrders.remove(_orderId);
    saleOrderArrayByAuditor[msg.sender].push(_orderId);
  }

  function cancellationAuditReject(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.AUDIT, "AUDIT offer status required");

    oracles.requireOracleActiveWithAssignedActiveOracleType(msg.sender, PE_AUDITOR_ORACLE_TYPE);
    require(saleOffer.auditor.addr == msg.sender, "Auditor address mismatch");

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.ESCROW);
    changeAuditorStatus(saleOrder, _buyer, ValidationStatus.REJECTED);
  }

  function cancellationAuditApprove(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.AUDIT, "AUDIT offer status required");

    oracles.requireOracleActiveWithAssignedActiveOracleType(msg.sender, PE_AUDITOR_ORACLE_TYPE);
    require(saleOffer.auditor.addr == msg.sender, "Auditor address mismatch");

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.CANCELLED);
    changeAuditorStatus(saleOrder, _buyer, ValidationStatus.APPROVED);
  }


  /**
   * @dev Seller withdraws Space token when status is CANCELLED.
   */
  function withdrawSpaceToken(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.CANCELLED, "CANCELLED offer status required");

    require(saleOrder.seller == msg.sender, "PlotEscrow. Only seller allowed");

    require(spaceToken.ownerOf(saleOrder.spaceTokenId) == address(this), "Contract should own the token");

    spaceToken.safeTransferFrom(address(this), msg.sender, saleOrder.spaceTokenId);

    if (saleOffer.paymentAttached == false) {
      changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.EMPTY);
    }
  }

  /**
   * @dev Buyer withdraws Payment when status is CANCELLED
   */
  function withdrawPayment(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.CANCELLED, "CANCELLED offer status required");

    require(saleOffer.buyer == msg.sender, "PlotEscrow. Only buyer allowed");

    if (spaceToken.ownerOf(saleOrder.spaceTokenId) != address(this)) {
      changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.EMPTY);
    }

    saleOffer.paymentAttached = false;

    if (saleOrder.escrowCurrency == EscrowCurrency.ETH) {
      msg.sender.transfer(saleOffer.ask);
    } else {
      saleOrder.tokenContract.transfer(msg.sender, saleOffer.ask);
    }
  }

  /**
   * @dev Change CANCELED offer status to EMPTY.
   * Anyone is allowed to perform this action.
   */
  function emptySaleOffer(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.CANCELLED, "CANCELLED offer status required");

    require(
      spaceToken.ownerOf(saleOrder.spaceTokenId) != address(this) && saleOffer.paymentAttached == false,
      "Both Space token and the payment should be withdrawn");

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.EMPTY);
  }

  /**
   * @dev Resolve offer in ESCROW status.
   * To change state to RESOLVED requires a custodian to be attached to this offer.
   * Method doesn't change a decision if it has been made once.
   */
  function resolve(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    if (PlotEscrowLib.resolveHelper(saleOrder, spaceCustodianRegistry, _buyer)) {
      changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.RESOLVED);
    }
  }

  /**
   * @dev Transfer the token to PlotCustodianContract on behalf of owner
   */
  function applyCustodianAssignment(
    bytes32 _orderId,
    address _buyer,
    address[] _chosenCustodians,
    uint256 _applicationFeeInGalt
  )
    external
    payable
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];
    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");
    SaleOffer storage saleOffer = saleOrder.offers[_buyer];
    require(saleOffer.status == SaleOfferStatus.ESCROW, "ESCROW offer status required");

    require(saleOrder.seller == msg.sender, "PlotEscrow. Invalid applicant");

    require(spaceToken.ownerOf(saleOrder.spaceTokenId) == address(this), "Contract should own the token");

    spaceToken.approve(address(plotCustodianManager), saleOrder.spaceTokenId);
    saleOffer.custodianApplicationId = plotCustodianManager.submitApplicationFromEscrow.value(msg.value)(
      saleOrder.spaceTokenId,
      PlotCustodianManager.Action.ATTACH,
      _chosenCustodians,
      msg.sender,
      _applicationFeeInGalt
    );

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.CUSTODIAN_REVIEW);
  }

  function withdrawTokenFromCustodianContract(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];
    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");
    SaleOffer storage saleOffer = saleOrder.offers[_buyer];
    require(saleOffer.status == SaleOfferStatus.CUSTODIAN_REVIEW, "CUSTODIAN_REVIEW offer status required");

    require(saleOrder.seller == msg.sender, "PlotEscrow. Only seller allowed");

    plotCustodianManager.withdrawToken(
      saleOffer.custodianApplicationId
    );

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.ESCROW);
  }

  /**
   * @dev Buyer withdraws Space token when status is RESOLVED.
   */
  function claimSpaceToken(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    (SaleOrder storage saleOrder, SaleOffer storage saleOffer) = requireClosedWithResolvedHelper(_orderId, _buyer);

    require(saleOffer.buyer == msg.sender, "PlotEscrow. Only buyer allowed");

    require(spaceToken.ownerOf(saleOrder.spaceTokenId) == address(this), "Contract should own the token");

    spaceToken.safeTransferFrom(address(this), msg.sender, saleOrder.spaceTokenId);

    if (saleOffer.paymentAttached == false) {
      closeOrderHelper(saleOrder, _buyer);
    }
  }

  /**
   * @dev Seller withdraws Payment when status is RESOLVED.
   */
  function claimPayment(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    (SaleOrder storage saleOrder, SaleOffer storage saleOffer) = requireClosedWithResolvedHelper(_orderId, _buyer);

    require(saleOrder.seller == msg.sender, "PlotEscrow. Invalid claimer");

    if (spaceToken.ownerOf(saleOrder.spaceTokenId) != address(this)) {
      closeOrderHelper(saleOrder, _buyer);
    }

    saleOffer.paymentAttached = false;

    if (saleOrder.escrowCurrency == EscrowCurrency.ETH) {
      msg.sender.transfer(saleOffer.ask);
    } else {
      saleOrder.tokenContract.transfer(msg.sender, saleOffer.ask);
    }
  }

  /**
   * @dev Cancel OPEN order by seller
   */
  function cancelOpenSaleOrder(
    bytes32 _orderId
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.OPEN, "OPEN order status required");
    require(saleOrder.seller == msg.sender, "PlotEscrow. Only seller allowed");
    tokenOnSale[saleOrder.spaceTokenId] = false;
    openSaleOrdersRemove(_orderId);

    changeSaleOrderStatus(saleOrder, SaleOrderStatus.CANCELLED);
  }

  /**
   * @dev Seller reopens LOCKED/EMPTY order/offer
   */
  function reopenSaleOrder(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];
    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");
    require(saleOrder.seller == msg.sender, "PlotEscrow. Only seller allowed");
    require(saleOffer.status == SaleOfferStatus.EMPTY, "EMPTY offer status required");

    tokenOnSale[saleOrder.spaceTokenId] = true;
    openSaleOrders.add(_orderId);

    changeSaleOrderStatus(saleOrder, SaleOrderStatus.OPEN);
    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.OPEN);
  }

  function claimOracleReward(
    bytes32 _rId
  )
    external
  {
    (SaleOrder storage saleOrder, SaleOffer storage saleOffer) = requireClosedOrCancelledHelper(_rId);

    require(saleOffer.auditor.addr == msg.sender, "Only the last auditor allowed");
    require(saleOrder.fees.auditorRewardPaidOut == false, "Reward is already paid out");

    saleOrder.fees.auditorRewardPaidOut = true;

    if (saleOrder.fees.currency == Currency.ETH) {
      msg.sender.transfer(saleOrder.fees.auditorReward);
    } else if (saleOrder.fees.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, saleOrder.fees.auditorReward);
    }
  }

  function claimGaltSpaceReward(
    bytes32 _rId
  )
    external
  {
    require(msg.sender == galtSpaceRewardsAddress, "Only GaltSpace allowed");

    (SaleOrder storage saleOrder, SaleOffer storage saleOffer) = requireClosedOrCancelledHelper(_rId);

    SaleOfferAuditor storage auditor = saleOffer.auditor;

    uint256 reward;

    // Also applicable when saleOffer not set and|or buyer not chosen
    if (auditor.status == ValidationStatus.NOT_EXISTS) {
      // total reward goes galtSpace
      reward = saleOrder.fees.totalReward;
    } else {
      reward = saleOrder.fees.galtSpaceReward;
    }

    require(saleOrder.fees.galtSpaceRewardPaidOut == false, "Reward is already paid out");

    saleOrder.fees.galtSpaceRewardPaidOut = true;

    if (saleOrder.fees.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else if (saleOrder.fees.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, reward);
    }
  }

  function saleOrderExists(bytes32 _rId) external view returns (bool) {
    return saleOrders[_rId].status != SaleOrderStatus.NOT_EXISTS;
  }

  function saleOfferExists(
    bytes32 _rId,
    address _buyer
  )
    external
    view
    returns (bool)
  {
    return saleOrders[_rId].offers[_buyer].status != SaleOfferStatus.NOT_EXISTS;
  }

  /**
   * @dev Get sale order details by it's ID
   *
   * @param _rId sale order ID
   */
  function getSaleOrder(bytes32 _rId)
    external
    view
    returns (
      bytes32 id,
      SaleOrderStatus status,
      EscrowCurrency escrowCurrency,
      uint256 ask,
      address tokenContract,
      address seller,
      uint256 offerCount,
      uint256 spaceTokenId,
      uint256 createdAt,
      address lastBuyer,
      address[] offersList
    )
  {
    SaleOrder storage r = saleOrders[_rId];

    return(
      r.id,
      r.status,
      r.escrowCurrency,
      r.ask,
      r.tokenContract,
      r.seller,
      r.offerList.length,
      r.spaceTokenId,
      r.createdAt,
      r.lastBuyer,
      r.offerList
    );
  }

  /**
   * @dev Get sale order fee details by it's ID
   *
   * @param _rId sale order ID
   */
  function getSaleOrderFees(bytes32 _rId)
    external
    view
    returns (
      bool auditorRewardPaidOut,
      bool galtSpaceRewardPaidOut,
      uint256 auditorReward,
      uint256 galtSpaceReward,
      uint256 totalReward
    )
  {
    SaleOrderFees storage f = saleOrders[_rId].fees;

    return(
      f.auditorRewardPaidOut,
      f.galtSpaceRewardPaidOut,
      f.auditorReward,
      f.galtSpaceReward,
      f.totalReward
    );
  }

  /**
   * @dev Get sale offer details by Order ID and buyer's address
   *
   * @param _rId sale order ID
   * @param _buyer address
   */
  function getSaleOffer(bytes32 _rId, address _buyer)
    external
    view
    returns (
      uint256 index,
      SaleOfferStatus status,
      uint256 ask,
      uint256 bid,
      bool paymentAttached,
      uint8 resolved,
      uint256 lastBidAt,
      uint256 lastAskAt,
      uint256 createdAt,
      bytes32 custodianApplicationId
    )
  {
    SaleOffer storage r = saleOrders[_rId].offers[_buyer];

    return(
      r.index,
      r.status,
      r.ask,
      r.bid,
      r.paymentAttached,
      r.resolved,
      r.lastBidAt,
      r.lastAskAt,
      r.createdAt,
      r.custodianApplicationId
    );
  }

  /**
   * @dev Get sale offer audit details by Order ID and buyer's address
   *
   * @param _rId sale order ID
   * @param _buyer address
   */
  function getSaleOfferAudit(bytes32 _rId, address _buyer)
    external
    view
    returns (
      ValidationStatus status,
      address addr
    )
  {
    SaleOfferAuditor storage a = saleOrders[_rId].offers[_buyer].auditor;

    return(
      a.status,
      a.addr
    );
  }

  function getSaleOrdersLength() external view returns (uint256) {
    return saleOrderArray.length;
  }

  function getSaleOrders() external view returns (bytes32[]) {
    return saleOrderArray;
  }

  function getSaleOrderArrayByBuyerLength(address _buyer) external view returns (uint256) {
    return saleOrderArrayByBuyer[_buyer].length;
  }

  function getSaleOrderArrayBySellerLength(address _seller) external view returns (uint256) {
    return saleOrderArrayBySeller[_seller].length;
  }

  function getOpenSaleOrdersLength() external view returns (uint256) {
    return openSaleOrders.size();
  }

  function getOpenSaleOrders() external view returns (bytes32[]) {
    return openSaleOrders.elements();
  }

  function getAuditRequiredSaleOrdersLength() external view returns (uint256) {
    return auditRequiredSaleOrders.size();
  }

  function getAuditRequiredSaleOrders() external view returns (bytes32[]) {
    return auditRequiredSaleOrders.elements();
  }

  function getSellerOrders(address _seller) external view returns (bytes32[]) {
    return saleOrderArrayBySeller[_seller];
  }

  function getBuyerOrders(address _buyer) external view returns (bytes32[]) {
    return saleOrderArrayByBuyer[_buyer];
  }

  function getAuditorOrders(address _buyer) external view returns (bytes32[]) {
    return saleOrderArrayByAuditor[_buyer];
  }

  function closeOrderHelper(SaleOrder storage saleOrder, address _buyer) internal {
    tokenOnSale[saleOrder.spaceTokenId] = false;

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.CLOSED);
    changeSaleOrderStatus(saleOrder, SaleOrderStatus.CLOSED);
  }

  function requireOpenHelper(
    bytes32 _orderId,
    address _buyer
  )
    internal
    returns (SaleOrder storage, SaleOffer storage)
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.OPEN, "OPEN sale order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.OPEN, "OPEN sale offer status required");

    return (saleOrder, saleOffer);
  }

  function requireMatchHelper(
    bytes32 _orderId,
    address _buyer
  )
    internal
    returns (SaleOrder storage, SaleOffer storage)
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED sale order required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.MATCH, "MATCH sale offer status required");

    return (saleOrder, saleOffer);
  }

  function requireClosedOrCancelledHelper(
    bytes32 _orderId
  )
    internal
    returns (SaleOrder storage, SaleOffer storage)
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];
    SaleOffer storage saleOffer = saleOrder.offers[saleOrder.lastBuyer];

    require(
      saleOrder.status == SaleOrderStatus.CLOSED ||
      saleOrder.status == SaleOrderStatus.CANCELLED,
      "CLOSED or CANCELLED sale order status required");

    return (saleOrder, saleOffer);
  }

  function requireClosedWithResolvedHelper(
    bytes32 _orderId,
    address _buyer
  )
    internal
    returns (SaleOrder storage, SaleOffer storage)
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];
    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(
      saleOrder.status == SaleOrderStatus.CLOSED ||
      saleOffer.status == SaleOfferStatus.RESOLVED,
      "CLOSED sale order and RESOLVED sale offer statuses required");

    return (saleOrder, saleOffer);
  }

  function openSaleOrdersRemove(bytes32 _orderId) internal {
    openSaleOrders.remove(_orderId);
  }

  function changeSaleOrderStatus(
    SaleOrder storage _order,
    SaleOrderStatus _status
  )
    internal
  {
    emit LogSaleOrderStatusChanged(_order.id, _status);

    _order.status = _status;
  }

  function changeSaleOfferStatus(
    SaleOrder storage _saleOrder,
    address _buyer,
    SaleOfferStatus _status
  )
    internal
  {
    emit LogSaleOfferStatusChanged(_saleOrder.id, _buyer, _status);

    _saleOrder.offers[_buyer].status = _status;
  }

  function changeAuditorStatus(
    SaleOrder storage _r,
    address _buyer,
    ValidationStatus _status
  )
    internal
  {
    emit LogAuditorStatusChanged(_r.id, _buyer, PE_AUDITOR_ORACLE_TYPE, _status);

    _r.offers[_buyer].auditor.status = _status;
  }
}
