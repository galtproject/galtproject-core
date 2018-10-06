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

import "./PlotEscrow.sol";
import "./SpaceToken.sol";
import "./AbstractApplication.sol";
import "./PlotCustodianManager.sol";
import "./SplitMerge.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


library PlotEscrowLib {
  using SafeMath for uint256;

  function resolveHelper(
    PlotEscrow.SaleOrder storage saleOrder,
    PlotCustodianManager _plotCustodianManager,
    address _buyer
  )
    external
    returns (bool changeStatus)
  {
    require(saleOrder.status == PlotEscrow.SaleOrderStatus.LOCKED, "LOCKED order status required");

    PlotEscrow.SaleOffer storage saleOffer = saleOrder.offers[_buyer];
    require(saleOffer.status == PlotEscrow.SaleOfferStatus.ESCROW, "ESCROW offer status required");

    if (msg.sender == saleOffer.buyer) {
      saleOffer.resolved = saleOffer.resolved | 1;
    } else if (msg.sender == saleOrder.seller) {
      saleOffer.resolved = saleOffer.resolved | 2;
    } else {
      revert("No permissions to resolve the order");
    }

    bool custodianAssigned = _plotCustodianManager.assignedCustodians(saleOrder.packageTokenId) != address(0);

    if (saleOffer.resolved == 3 && custodianAssigned) {
      changeStatus = true;
    }
  }


  function createSaleOfferHelper(
    PlotEscrow.SaleOrder storage saleOrder,
    uint256 _bid,
    address _msgSender
  )
    external
  {
    require(saleOrder.seller != _msgSender, "Could not apply with the seller's address");
    require(saleOrder.status == PlotEscrow.SaleOrderStatus.OPEN, "SaleOrderStatus should be OPEN");
    require(saleOrder.offers[_msgSender].status == PlotEscrow.SaleOfferStatus.NOT_EXISTS, "Offer for this application already exists");
    require(_bid > 0, "Negative ask price");

    PlotEscrow.SaleOffer memory saleOffer;

    saleOffer.status = PlotEscrow.SaleOfferStatus.OPEN;
    saleOffer.buyer = _msgSender;
    saleOffer.bid = _bid;
    saleOffer.ask = saleOrder.ask;
    saleOffer.lastBidAt = block.timestamp;
    saleOffer.createdAt = block.timestamp;
    saleOffer.index = saleOrder.offerList.length;

    saleOrder.offers[_msgSender] = saleOffer;

    saleOrder.offerList.push(_msgSender);
  }

  function calculateAndStoreFee(
    uint256 _galtSpaceEthShare,
    uint256 _galtSpaceGaltShare,
    PlotEscrow.SaleOrder storage _r,
    uint256 _fee
  )
    external
  {
    uint256 share;

    if (_r.fees.currency == AbstractApplication.Currency.ETH) {
      share = _galtSpaceEthShare;
    } else {
      share = _galtSpaceGaltShare;
    }

    uint256 galtSpaceReward = share.mul(_fee).div(100);
    uint256 auditorReward = _fee.sub(galtSpaceReward);

    assert(auditorReward.add(galtSpaceReward) == _fee);

    _r.fees.totalReward = _fee;
    _r.fees.auditorReward = auditorReward;
    _r.fees.galtSpaceReward = galtSpaceReward;
  }
}
