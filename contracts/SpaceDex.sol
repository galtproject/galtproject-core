pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./GaltToken.sol";
import "./SpaceToken.sol";

contract SpaceDex is Initializable, Ownable {
  using SafeMath for uint256;

  enum OperationDirection {
    SPACE_TO_GALT,
    GALT_TO_SPACE
  }
  
  GaltToken galtToken;
  SpaceToken spaceToken;

  uint256 public spaceToGaltSum;
  uint256 public galtToSpaceSum;
  
  uint256 public spacePriceOnSaleSum;
  
  bytes23[] public operationsArray;
  mapping(uint256 => bytes23) public lastOperationByTokenId;
  mapping(bytes23 => OperationDetails) public operationsDetails;

  struct OperationDetails {
    uint256 spaceTokenId;
    uint256 galtAmount;
    address user;
    bytes23 previousOperation;
    OperationDirection direction;
  }
  
  constructor () public {}

  function initialize(
    GaltToken _galtToken,
    SpaceToken _spaceToken
  )
    public
    isInitializer
  {
    owner = msg.sender;
    galtToken = _galtToken;
    spaceToken = _spaceToken;
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
    
    require(availableForSale(_spaceTokenId), "Not available for sale");
    
    bytes32 _operationId = keccak256(
      abi.encodePacked(
        _spaceTokenId,
        now,
        msg.sender
      )
    );
    
    uint256 _galtToSend = getSpaceTokenPrice(_spaceTokenId);
    bytes32 _previousOperation = lastOperationByTokenId[_spaceTokenId];

    operationsDetails[_operationId] = OperationDetails({
      spaceTokenId: _spaceTokenId,
      galtAmount: _galtToSend,
      user: msg.sender,
      previousOperation: _previousOperation,
      direction: OperationDirection.SPACE_TO_GALT
    });

    spaceToken.transferFrom(msg.sender, address(this), _spaceTokenId);
    galtToken.transferFrom(address(this), msg.sender, _galtToSend);

    lastOperationByTokenId[_spaceTokenId] = _operationId;

    operationsArray.push(_operationId);

    spaceToGaltSum += 1;
    spacePriceOnSaleSum += _galtToSend;
  }
  
  function getSpaceTokensOnSale(){
    return spaceToken.tokensOfOwner(address(this));
  }

  function exchangeGaltToSpace(uint256 _spaceTokenId) public {
    uint256 _galtToSend = getSpaceTokenPrice(_spaceTokenId);
    require(galtToken.allowance(msg.sender, address(this)) >= _galtToSend, "Not enough galt allowance");

    bytes32 _operationId = keccak256(
      abi.encodePacked(
        _spaceTokenId,
        now,
        msg.sender
      )
    );
    
    bytes32 _previousOperation = lastOperationByTokenId[_spaceTokenId];
    
    OperationDetails memory _previousOperationDetails = operationsDetails[_previousOperation];

    operationsDetails[_operationId] = OperationDetails({
      spaceTokenId: _spaceTokenId,
      galtAmount: _galtToSend,
      user: msg.sender,
      previousOperation: _previousOperation,
      direction: OperationDirection.GALT_TO_SPACE
    });

    galtToken.transferFrom(msg.sender, address(this), _galtToSend);
    spaceToken.transferFrom(address(this), msg.sender, _spaceTokenId);

    lastOperationByTokenId[_spaceTokenId] = _operationId;

    operationsArray.push(_operationId);

    galtToSpaceSum += _galtToSend;
    spacePriceOnSaleSum -= _previousOperationDetails.galtAmount;
  }
  
  function getSpaceTokenPrice(uint256 tokenId) {
    require(tokenId > 0, "tokenId cant be null");
    return 10 ether;
  }

  function availableForSale(uint256 tokenId) {
    require(tokenId > 0, "tokenId cant be null");
    return true;
  }
}
