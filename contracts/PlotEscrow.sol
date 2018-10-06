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
import "./PlotCustodianManager.sol";
import "./PlotEscrowLib.sol";
import "./SpaceToken.sol";
import "./Validators.sol";


/**
 * Plot Escrow contract
 *
 * Vocabulary for this contract
 * - Order - Sale order to sell SpaceToken using escrow contract
 * - Offer - Offer for a specific order
 *
 * There is only `PV_AUDITOR_ROLE` validator role. It's reward is assigned only in
 * a case when escrow cancellation audit process was instantiated.
 */
contract PlotEscrow is AbstractApplication {
  using SafeMath for uint256;

  // `PlotValuation` keccak256 hash
  bytes32 public constant APPLICATION_TYPE = 0xf17a99d990bb2b0a5c887c16a380aa68996c0b23307f6633bd7a2e1632e1ef48;

  // `PV_AUDITOR_ROLE` bytes32 representation
  bytes32 public constant PE_AUDITOR_ROLE = 0x50455f41554449544f525f524f4c450000000000000000000000000000000000;

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
    uint256 packageTokenId;
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

  SpaceToken public spaceToken;
  PlotCustodianManager public plotCustodianManager;

  // Caching (items could be obsolete)
  bytes32[] public saleOrderArray;
  mapping(address => bytes32[]) public saleOrderArrayBySeller;
  mapping(address => bytes32[]) public saleOrderArrayByBuyer;
  mapping(uint256 => bytes32) public spaceTokenLastOrderId;
  bytes32[] public openSaleOrderArray;
  mapping(bytes32 => uint256) openSaleOrderIndex;


  constructor () public {}

  function initialize(
    SpaceToken _spaceToken,
    PlotCustodianManager _plotCustodianManager,
    Validators _validators,
    ERC20 _galtToken,
    address _galtSpaceRewardsAddress
  )
    public
    isInitializer
  {
    owner = msg.sender;

    spaceToken = _spaceToken;
    plotCustodianManager = _plotCustodianManager;
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

  function createSaleOrder(
    uint256 _packageTokenId,
    uint256 _ask,
    bytes32[] _documents,
    EscrowCurrency _currency,
    ERC20 _erc20address,
    uint256 _feeInGalt
  )
    external
    payable
  {
    require(spaceToken.exists(_packageTokenId), "Token doesn't exist");
    require(spaceToken.ownerOf(_packageTokenId) == msg.sender, "Only owner of the token is allowed to apply");
    require(tokenOnSale[_packageTokenId] == false, "Token is already on sale");
    require(_ask > 0, "Negative ask price");
    require(_documents.length > 0, "At least one attached document required");

    if (_currency == EscrowCurrency.ERC20) {
      require(ERC20(_erc20address).balanceOf(msg.sender) >= 0, "Failed ERC20 contract check");
    }

    bytes32 _id = keccak256(
      abi.encode(
        _packageTokenId,
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
      require(_feeInGalt == 0, "Could not accept both ETH and GALT");
      require(msg.value >= minimalApplicationFeeInEth, "Insufficient payment in ETH");
      saleOrder.fees.currency = Currency.ETH;
      fee = msg.value;
    }

    saleOrder.id = _id;
    saleOrder.seller = msg.sender;
    saleOrder.status = SaleOrderStatus.OPEN;
    saleOrder.escrowCurrency = _currency;
    saleOrder.tokenContract = _erc20address;
    saleOrder.ask = _ask;
    saleOrder.packageTokenId = _packageTokenId;
    saleOrder.createdAt = block.timestamp;

    saleOrders[_id] = saleOrder;
    saleOrderArray.push(_id);
    saleOrderArrayBySeller[msg.sender].push(_id);
    tokenOnSale[_packageTokenId] = true;
    spaceTokenLastOrderId[_packageTokenId] = _id;
    openSaleOrderIndex[_id] = openSaleOrderArray.length;
    openSaleOrderArray.push(_id);

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
    require(saleOrder.seller == msg.sender, "Only the seller is allowed to modify ask price");

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

    require(saleOrder.seller == msg.sender, "Only the seller is allowed to modify ask price");
    require(saleOffer.ask == saleOffer.bid, "Offer ask and bid prices should match");

    saleOrder.lastBuyer = _buyer;

//    removeSaleOrderFromOpenList(sleOrder.id);

    changeSaleOrderStatus(saleOrder, SaleOrderStatus.LOCKED);
    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.MATCH);
  }

  function cancelSaleOffer(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.MATCH, "MATCH offer status required");

    require(
      msg.sender == saleOrder.seller || msg.sender == saleOffer.buyer,
      "Either seller or buyer are allowed to perform this action");

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.CANCELLED);
  }

  function attachSpaceToken(
    bytes32 _orderId,
    address _buyer
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.seller == msg.sender, "Only the seller is allowed attaching space token");
    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.MATCH, "Only the seller is allowed to modify ask price");
    require(spaceToken.ownerOf(saleOrder.packageTokenId) == msg.sender, "Sender doesn't own Space Token with the given ID");

    spaceToken.transferFrom(msg.sender, address(this), saleOrder.packageTokenId);

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
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.buyer == msg.sender, "Only the buyer is allowed attaching payment");
    require(saleOffer.status == SaleOfferStatus.MATCH, "Only the seller is allowed to modify ask price");
    require(saleOffer.paymentAttached == false, "Payment is already attached");

    if (saleOrder.escrowCurrency == EscrowCurrency.ETH) {
      require(msg.value == saleOffer.ask, "Incorrect payment");
    } else {
      require(msg.value == 0, "ERC20 token payment required");
      saleOrder.tokenContract.transferFrom(msg.sender, address(this), saleOffer.ask);
    }

    saleOffer.paymentAttached = true;

    if (spaceToken.ownerOf(saleOrder.packageTokenId) == address(this)) {
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
      "Either seller or buyer are allowed to perform this action");

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.AUDIT_REQUIRED);
    changeAuditorStatus(saleOrder, _buyer, ValidationStatus.PENDING);
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

    require(saleOffer.status == SaleOfferStatus.AUDIT_REQUIRED, "AUDIT_REQUIRED offer status required");

    validators.ensureValidatorActive(msg.sender);
    require(validators.hasRole(msg.sender, PE_AUDITOR_ROLE), "PE_AUDITOR_ROLE required to lock");

    saleOffer.auditor.addr = msg.sender;

    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.AUDIT);
    changeAuditorStatus(saleOrder, _buyer, ValidationStatus.LOCKED);
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

    validators.ensureValidatorActive(msg.sender);
    require(validators.hasRole(msg.sender, PE_AUDITOR_ROLE), "PE_AUDITOR_ROLE required to reject");
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

    validators.ensureValidatorActive(msg.sender);
    require(validators.hasRole(msg.sender, PE_AUDITOR_ROLE), "PE_AUDITOR_ROLE required to approve");
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

    require(saleOrder.seller == msg.sender, "Only seller is allowed withdrawing Space token");

    require(spaceToken.ownerOf(saleOrder.packageTokenId) == address(this), "Space token doesn't belong to this contract");

    spaceToken.safeTransferFrom(address(this), msg.sender, saleOrder.packageTokenId);

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

    require(saleOffer.buyer == msg.sender, "Only buyer is allowed withdrawing payment");

    if (spaceToken.ownerOf(saleOrder.packageTokenId) != address(this)) {
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
      spaceToken.ownerOf(saleOrder.packageTokenId) != address(this) && saleOffer.paymentAttached == false,
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

    if (PlotEscrowLib.resolveHelper(saleOrder, plotCustodianManager, _buyer)) {
      changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.RESOLVED);
    }
  }

  /**
   * @dev Transfer the token to PlotCustodianContract on behalf of owner
   */
  function applyCustodianAssignment(
    bytes32 _orderId,
    address _buyer,
    address _chosenCustodian,
    uint256 _applicationFeeInGalt
  )
    external
    payable
  {
    SaleOrder storage saleOrder = saleOrders[_orderId];
    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");
    SaleOffer storage saleOffer = saleOrder.offers[_buyer];
    require(saleOffer.status == SaleOfferStatus.ESCROW, "ESCROW offer status required");

    require(saleOrder.seller == msg.sender, "Only seller is allowed applying custodian assignment");

    require(spaceToken.ownerOf(saleOrder.packageTokenId) == address(this), "Space token doesn't belong to this contract");

    spaceToken.approve(address(plotCustodianManager), saleOrder.packageTokenId);
    saleOffer.custodianApplicationId = plotCustodianManager.submitApplicationFromEscrow.value(msg.value)(
      saleOrder.packageTokenId,
      PlotCustodianManager.Action.ATTACH,
      _chosenCustodian,
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

    require(saleOrder.seller == msg.sender, "Only seller is allowed withdrawing token back");

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
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.RESOLVED, "RESOLVED offer status required");

    require(saleOffer.buyer == msg.sender, "Only buyer is allowed withdrawing Space token");

    require(spaceToken.ownerOf(saleOrder.packageTokenId) == address(this), "Space token doesn't belong to this contract");

    spaceToken.safeTransferFrom(address(this), msg.sender, saleOrder.packageTokenId);

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
    SaleOrder storage saleOrder = saleOrders[_orderId];

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");

    SaleOffer storage saleOffer = saleOrder.offers[_buyer];

    require(saleOffer.status == SaleOfferStatus.RESOLVED, "RESOLVED offer status required");

    require(saleOrder.seller == msg.sender, "Only seller is allowed withdrawing payment");

    if (spaceToken.ownerOf(saleOrder.packageTokenId) != address(this)) {
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
    require(saleOrder.seller == msg.sender, "Only seller is allowed canceling the order");
    tokenOnSale[saleOrder.packageTokenId] == false;

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
    bytes32 rId = saleOrder.id;

    require(saleOrder.status == SaleOrderStatus.LOCKED, "LOCKED order status required");
    require(saleOrder.seller == msg.sender, "Only seller is allowed canceling the order");
    require(saleOffer.status == SaleOfferStatus.EMPTY, "EMPTY offer status required");

    tokenOnSale[saleOrder.packageTokenId] = true;
    openSaleOrderIndex[rId] = openSaleOrderArray.length;
    openSaleOrderArray.push(rId);

    changeSaleOrderStatus(saleOrder, SaleOrderStatus.OPEN);
    changeSaleOfferStatus(saleOrder, _buyer, SaleOfferStatus.OPEN);
  }

  function claimValidatorReward(
    bytes32 _rId
  )
    external
  {
    SaleOrder storage saleOrder = saleOrders[_rId];
    SaleOffer storage saleOffer = saleOrder.offers[saleOrder.lastBuyer];

    require(
      saleOrder.status == SaleOrderStatus.CLOSED ||
      saleOrder.status == SaleOrderStatus.CANCELLED,
      "CLOSED or CANCELLED order status required");

    require(saleOffer.auditor.addr == msg.sender, "Only the last acted auditor is eligible claiming the reward");
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
    require(msg.sender == galtSpaceRewardsAddress, "The method call allowed only for galtSpace address");

    SaleOrder storage saleOrder = saleOrders[_rId];
    SaleOffer storage saleOffer = saleOrder.offers[saleOrder.lastBuyer];

    require(
      saleOrder.status == SaleOrderStatus.CLOSED ||
      saleOrder.status == SaleOrderStatus.CANCELLED,
      "CLOSED or CANCELLED order status required");

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
      uint256 packageTokenId,
      uint256 createdAt,
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
      r.packageTokenId,
      r.createdAt,
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
      uint256 createdAt
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
      r.createdAt
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

  function getSaleOrderArrayByBuyerLength(address _buyer) external view returns (uint256) {
    return saleOrderArrayByBuyer[_buyer].length;
  }

  function getSaleOrderArrayBySellerLength(address _seller) external view returns (uint256) {
    return saleOrderArrayBySeller[_seller].length;
  }

  function getOpenSaleOrdersLength() external view returns (uint256) {
    return openSaleOrderArray.length;
  }

  function getSellerOrders(address _seller) external view returns (bytes32[]) {
    return saleOrderArrayBySeller[_seller];
  }

  function getBuyerOrders(address _buyer) external view returns (bytes32[]) {
    return saleOrderArrayByBuyer[_buyer];
  }

  function closeOrderHelper(SaleOrder storage saleOrder, address _buyer) internal {
    tokenOnSale[saleOrder.packageTokenId] == false;
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
    emit LogAuditorStatusChanged(_r.id, _buyer, PE_AUDITOR_ROLE, _status);

    _r.offers[_buyer].auditor.status = _status;
  }
}
