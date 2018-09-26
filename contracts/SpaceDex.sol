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

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./GaltToken.sol";
import "./SpaceToken.sol";
import "./PlotValuation.sol";
import "./PlotCustodianManager.sol";

contract SpaceDex is Initializable, Ownable, RBAC {
  using SafeMath for uint256;
  
  string public constant FEE_MANAGER = "fee_manager";

  enum OperationDirection {
    SPACE_TO_GALT,
    GALT_TO_SPACE
  }
  
  GaltToken galtToken;
  SpaceToken spaceToken;
  PlotValuation plotValuation;
  PlotCustodianManager plotCustodian;

  uint256 public spaceToGaltSum;
  uint256 public galtToSpaceSum;
  
  uint256 public spacePriceOnSaleSum;
  
  uint256 public fee;
  uint256 public constant feePrecision = 1 szabo;
  uint256 public feePayout;
  uint256 public feeTotalPayout;
  
  bytes32[] public operationsArray;
  mapping(uint256 => bytes32[]) public operationsByTokenArray;
  mapping(uint256 => bytes32) public lastOperationByTokenId;
  mapping(bytes32 => OperationDetails) public operationsDetails;

  struct OperationDetails {
    uint256 spaceTokenId;
    uint256 galtAmount;
    address user;
    address custodian;
    bytes32 previousOperation;
    uint256 timestamp;
    OperationDirection direction;
  }
  
  constructor () public {}

  function initialize(
    GaltToken _galtToken,
    SpaceToken _spaceToken,
    PlotValuation _plotValuation,
    PlotCustodianManager _plotCustodian
  )
    public
    isInitializer
  {
    owner = msg.sender;
    galtToken = _galtToken;
    spaceToken = _spaceToken;
    plotValuation = _plotValuation;
    plotCustodian = _plotCustodian;
  }

  modifier onlySpaceTokenOwner(uint256 _spaceTokenId) {
    address ownerOfToken = spaceToken.ownerOf(_spaceTokenId);

    require(
      /* solium-disable-next-line */
      ownerOfToken == msg.sender ||
      spaceToken.isApprovedForAll(ownerOfToken, msg.sender) ||
      spaceToken.getApproved(_spaceTokenId) == msg.sender,
      "This action not permitted for msg.sender");
    _;
  }

  modifier onlyFeeManager() {
    checkRole(msg.sender, FEE_MANAGER);
    _;
  }

  function exchangeSpaceToGalt(uint256 _spaceTokenId) public {
    require(
      /* solium-disable-next-line */
      spaceToken.isApprovedForAll(spaceToken.ownerOf(_spaceTokenId), address(this)) ||
      spaceToken.getApproved(_spaceTokenId) == address(this), 
      "Not allowed space for sale"
    );

    require(availableForSell(_spaceTokenId), "Not available for sale");
    
    bytes32 _operationId = keccak256(
      abi.encodePacked(
        _spaceTokenId,
        now,
        msg.sender
      )
    );
    
    uint256 _spacePrice = getSpaceTokenPriceForSell(_spaceTokenId);
    bytes32 _previousOperation = lastOperationByTokenId[_spaceTokenId];

    operationsDetails[_operationId] = OperationDetails({
      spaceTokenId: _spaceTokenId,
      galtAmount: _spacePrice,
      user: msg.sender,
      custodian: getSpaceTokenCustodian(_spaceTokenId),
      previousOperation: _previousOperation,
      direction: OperationDirection.SPACE_TO_GALT,
      timestamp: now
    });

    spaceToken.transferFrom(msg.sender, address(this), _spaceTokenId);
    uint256 _feeAmount = getFeeForAmount(_spacePrice);
    uint256 _galtToSend = _spacePrice.sub(_feeAmount);
    galtToken.transfer(msg.sender, _galtToSend);

    feePayout = feePayout.add(_feeAmount);
    feeTotalPayout = feeTotalPayout.add(_feeAmount);

    lastOperationByTokenId[_spaceTokenId] = _operationId;

    operationsByTokenArray[_spaceTokenId].push(_operationId);
    operationsArray.push(_operationId);

    spaceToGaltSum = spaceToGaltSum.add(1);
    spacePriceOnSaleSum = spacePriceOnSaleSum.add(_spacePrice);
  }

  function exchangeGaltToSpace(uint256 _spaceTokenId) public {
    uint256 _spacePrice = getSpaceTokenPriceForBuy(_spaceTokenId);
    uint256 _feeAmount = getFeeForAmount(_spacePrice);
    uint256 _galtToSend = _spacePrice.add(_feeAmount);
    
    require(galtToken.allowance(msg.sender, address(this)) >= _galtToSend, "Not enough galt allowance");

    require(availableForBuy(_spaceTokenId), "Not available for sale");

    bytes32 _operationId = keccak256(
      abi.encodePacked(
        _spaceTokenId,
        now,
        msg.sender
      )
    );
    
    bytes32 _previousOperation = lastOperationByTokenId[_spaceTokenId];

    operationsDetails[_operationId] = OperationDetails({
      spaceTokenId: _spaceTokenId,
      galtAmount: _spacePrice,
      user: msg.sender,
      custodian: getSpaceTokenCustodian(_spaceTokenId),
      previousOperation: _previousOperation,
      direction: OperationDirection.GALT_TO_SPACE,
      timestamp: now
    });


    galtToken.transferFrom(msg.sender, address(this), _galtToSend);

    feePayout = feePayout.add(_feeAmount);
    feeTotalPayout = feeTotalPayout.add(_feeAmount);
    
    spaceToken.transferFrom(address(this), msg.sender, _spaceTokenId);

    lastOperationByTokenId[_spaceTokenId] = _operationId;

    operationsArray.push(_operationId);
    operationsByTokenArray[_spaceTokenId].push(_operationId);

    galtToSpaceSum = galtToSpaceSum.add(_spacePrice);
    spacePriceOnSaleSum = spacePriceOnSaleSum.sub(_spacePrice);
  }

  function getSpaceTokensOnSale() public view returns (uint256[]) {
    return spaceToken.tokensOfOwner(address(this));
  }
  
  function getSpaceTokenActualPrice(uint256 tokenId) public view returns (uint256) {
    if (spaceToken.ownerOf(tokenId) == address(this)) {
      return getSpaceTokenPriceForBuy(tokenId);
    } else {
      return getSpaceTokenPriceForSell(tokenId);
    }
  }

  function getSpaceTokenActualPriceWithFee(uint256 tokenId) public view returns (uint256) {
    uint256 geohashPrice = getSpaceTokenActualPrice(tokenId);
    uint256 feeAmount = getFeeForAmount(geohashPrice);
    
    if (spaceToken.ownerOf(tokenId) == address(this)) {
      return geohashPrice.add(feeAmount);
    } else {
      return geohashPrice.sub(feeAmount);
    }
  }
  
  function getSpaceTokenPriceForSell(uint256 tokenId) public view returns (uint256) {
    require(tokenId > 0, "tokenId cant be null");
    return plotValuation.plotValuations(tokenId);
  }

  function getSpaceTokenPriceForBuy(uint256 tokenId) public view returns (uint256) {
    require(tokenId > 0, "tokenId cant be null");
    bytes32 lastOperation = lastOperationByTokenId[tokenId];
    OperationDetails memory lastOperationDetails = operationsDetails[lastOperation];
    return lastOperationDetails.galtAmount;
  }

  function getSpaceTokenCustodian(uint256 tokenId) public view returns (address) {
    require(tokenId > 0, "tokenId cant be null");
    return plotCustodian.assignedCustodians(tokenId);
  }

  function availableForSell(uint256 tokenId) public view returns (bool) {
    require(tokenId > 0, "tokenId cant be null");
    return getSpaceTokenPriceForSell(tokenId) > 0 && getSpaceTokenCustodian(tokenId) != address(0);
  }

  function availableForBuy(uint256 tokenId) public view returns (bool) {
    require(tokenId > 0, "tokenId cant be null");
    return spaceToken.ownerOf(tokenId) == address(this);
  }
  
  function getFeeForAmount(uint256 amount) public view returns(uint256) {
    if (fee > 0) {
      return amount.div(100).mul(fee).div(feePrecision);
    } else {
      return amount;
    }
  }

  function setFee(uint256 _fee) public onlyFeeManager {
    fee = _fee;
  }

  function withdrawFee() public onlyFeeManager {
    galtToken.transfer(msg.sender, feePayout);
    feePayout = 0;
  }
  
  function addRoleTo(address _operator, string _role) public onlyOwner {
    super.addRole(_operator, _role);
  }

  function removeRoleFrom(address _operator, string _role) public onlyOwner {
    super.removeRole(_operator, _role);
  }
}
