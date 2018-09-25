pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./GaltToken.sol";
import "./SpaceToken.sol";
import "./PlotValuation.sol";
import "./PlotCustodianManager.sol";

contract SpaceDex is Initializable, Ownable {
  using SafeMath for uint256;

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
    
    uint256 _galtToSend = getSpaceTokenPriceForSell(_spaceTokenId);
    bytes32 _previousOperation = lastOperationByTokenId[_spaceTokenId];

    operationsDetails[_operationId] = OperationDetails({
      spaceTokenId: _spaceTokenId,
      galtAmount: _galtToSend,
      user: msg.sender,
      custodian: getSpaceTokenCustodian(_spaceTokenId),
      previousOperation: _previousOperation,
      direction: OperationDirection.SPACE_TO_GALT,
      timestamp: now
    });

    spaceToken.transferFrom(msg.sender, address(this), _spaceTokenId);
    galtToken.transfer(msg.sender, _galtToSend);

    lastOperationByTokenId[_spaceTokenId] = _operationId;

    operationsByTokenArray[_spaceTokenId].push(_operationId);
    operationsArray.push(_operationId);

    spaceToGaltSum += 1;
    spacePriceOnSaleSum += _galtToSend;
  }

  function exchangeGaltToSpace(uint256 _spaceTokenId) public {
    uint256 _galtToSend = getSpaceTokenPriceForBuy(_spaceTokenId);
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
      galtAmount: _galtToSend,
      user: msg.sender,
      custodian: getSpaceTokenCustodian(_spaceTokenId),
      previousOperation: _previousOperation,
      direction: OperationDirection.GALT_TO_SPACE,
      timestamp: now
    });

    galtToken.transferFrom(msg.sender, address(this), _galtToSend);
    spaceToken.transferFrom(address(this), msg.sender, _spaceTokenId);

    lastOperationByTokenId[_spaceTokenId] = _operationId;

    operationsArray.push(_operationId);
    operationsByTokenArray[_spaceTokenId].push(_operationId);

    galtToSpaceSum += _galtToSend;
    spacePriceOnSaleSum -= _galtToSend;
  }

  function getSpaceTokensOnSale() public view returns (uint256[]) {
    return spaceToken.tokensOfOwner(address(this));
  }
  
  function getSpaceTokenActualPrice(uint256 tokenId) public view returns (uint256) {
    if(spaceToken.ownerOf(tokenId) == address(this)){
      return getSpaceTokenPriceForBuy(tokenId);
    } else {
      return getSpaceTokenPriceForSell(tokenId);
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
}
