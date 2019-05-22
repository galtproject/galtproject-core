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

pragma solidity 0.5.7;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@galtproject/geodesic/contracts/interfaces/IGeodesic.sol";
import "@galtproject/geodesic/contracts/utils/GeohashUtils.sol";
import "@galtproject/libs/contracts/traits/Initializable.sol";
import "./interfaces/ISpaceSplitOperationFactory.sol";
import "./interfaces/ISpaceSplitOperation.sol";
import "./interfaces/ISpaceToken.sol";
import "./interfaces/ISpaceGeoData.sol";
import "./registries/GaltGlobalRegistry.sol";
import "./SpaceGeoDataLib.sol";


contract SpaceGeoData is ISpaceGeoData, Initializable {
  using SafeMath for uint256;

  // TODO: set MIN_CONTOUR_GEOHASH_PRECISION 12
  uint8 public constant MIN_CONTOUR_GEOHASH_PRECISION = 1;
  uint8 public constant MAX_CONTOUR_GEOHASH_COUNT = 100;

  bytes32 public constant ROLE_GEO_DATA_MANAGER = bytes32("GEO_DATA_MANAGER");

  GaltGlobalRegistry internal ggr;

  event SpaceTokenInit(bytes32 id, address owner);
  event SpaceTokenHeightsChange(bytes32 id, int256[] heights);
  event SpaceTokenContourChange(bytes32 id, uint256[] contour);
  event SpaceTokenLevelChange(bytes32 id, int256 level);
  event SpaceTokenAreaChange(bytes32 id, uint256 area);
  event SplitOperationStart(uint256 spaceTokenId, address splitOperation);
  event NewSplitSpaceToken(uint256 id);

  mapping(uint256 => uint256[]) public spaceTokenContour;
  mapping(uint256 => int256[]) public spaceTokenHeight;
  mapping(uint256 => int256) public spaceTokenLevel;

  mapping(uint256 => uint256) public spaceTokenArea;
  mapping(uint256 => AreaSource) public spaceTokenAreaSource;

  mapping(address => bool) public activeSplitOperations;
  mapping(uint256 => address[]) public tokenIdToSplitOperations;
  address[] public allSplitOperations;

  struct SpaceTokenInfo {
    bytes32 ledgerIdentifier;
    string description;
  }

  mapping(uint256 => SpaceTokenInfo) public spaceTokenInfo;
  
  function initialize(GaltGlobalRegistry _ggr) public isInitializer {
    ggr = _ggr;
  }

  modifier onlySpaceTokenOwner(uint256 _spaceTokenId) {
    address ownerOfToken = spaceToken().ownerOf(_spaceTokenId);

    require(
    /* solium-disable-next-line */
      ownerOfToken == msg.sender ||
      spaceToken().isApprovedForAll(ownerOfToken, msg.sender) ||
      spaceToken().getApproved(_spaceTokenId) == msg.sender,
      "This action not permitted");
    _;
  }

  modifier onlyGeoDataManager() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_GEO_DATA_MANAGER),
      "Only GEO_DATA_MANAGER role allowed"
    );

    _;
  }

  function initSpaceToken(address spaceTokenOwner)
    public onlyGeoDataManager()
    returns (uint256)
  {
    uint256 _spaceTokenId = spaceToken().mint(spaceTokenOwner);

    emit SpaceTokenInit(bytes32(_spaceTokenId), spaceTokenOwner);

    return _spaceTokenId;
  }

  function setSpaceTokenContour(uint256 _spaceTokenId, uint256[] memory _geohashesContour)
    public onlyGeoDataManager()
  {
    require(_geohashesContour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(
      _geohashesContour.length <= MAX_CONTOUR_GEOHASH_COUNT,
      "Number of contour elements should be equal or less than MAX_CONTOUR_GEOHASH_COUNT"
    );

    for (uint8 i = 0; i < _geohashesContour.length; i++) {
      require(_geohashesContour[i] > 0, "Contour element geohash should not be a zero");
      require(
        GeohashUtils.geohash5Precision(_geohashesContour[i]) >= MIN_CONTOUR_GEOHASH_PRECISION,
        "Contour element geohash should have at least MIN_CONTOUR_GEOHASH_PRECISION precision"
      );
    }

    spaceTokenContour[_spaceTokenId] = _geohashesContour;
    emit SpaceTokenContourChange(bytes32(_spaceTokenId), _geohashesContour);
  }

  function setSpaceTokenHeights(uint256 _spaceTokenId, int256[] memory _heightsList)
    public onlyGeoDataManager()
  {
    require(_heightsList.length == getSpaceTokenContour(_spaceTokenId).length, "Number of height elements should be equal contour length");

    spaceTokenHeight[_spaceTokenId] = _heightsList;
    emit SpaceTokenHeightsChange(bytes32(_spaceTokenId), _heightsList);
  }

  function setSpaceTokenLevel(uint256 _spaceTokenId, int256 _level)
    public onlyGeoDataManager()
  {
    spaceTokenLevel[_spaceTokenId] = _level;
    emit SpaceTokenLevelChange(bytes32(_spaceTokenId), _level);
  }

  // TODO: add SpaceSplitOperationFactory for migrations between versions
  function startSplitOperation(uint256 _spaceTokenId, uint256[] calldata _clippingContour)
    external
    onlySpaceTokenOwner(_spaceTokenId)
    returns (address)
  {
    require(spaceTokenAreaSource[_spaceTokenId] == AreaSource.CONTRACT, "Split available only for contract calculated token's area");
    
    address spaceTokenOwner = spaceToken().ownerOf(_spaceTokenId);

    address newSplitOperationAddress = ISpaceSplitOperationFactory(
      ggr.getSpaceSplitOperationFactoryAddress()).build(_spaceTokenId, _clippingContour
    );
    activeSplitOperations[newSplitOperationAddress] = true;
    tokenIdToSplitOperations[_spaceTokenId].push(newSplitOperationAddress);
    allSplitOperations.push(newSplitOperationAddress);

    spaceToken().transferFrom(spaceTokenOwner, newSplitOperationAddress, _spaceTokenId);
    ISpaceSplitOperation(newSplitOperationAddress).init();

    emit SplitOperationStart(_spaceTokenId, newSplitOperationAddress);
    return newSplitOperationAddress;
  }

  function getCurrentSplitOperation(uint256 _spaceTokenId) external returns (address) {
    return tokenIdToSplitOperations[_spaceTokenId][tokenIdToSplitOperations[_spaceTokenId].length - 1];
  }

  function getSplitOperationsCount(uint256 _spaceTokenId) external returns (uint256) {
    return tokenIdToSplitOperations[_spaceTokenId].length;
  }

  function finishSplitOperation(uint256 _spaceTokenId) external {
    require(tokenIdToSplitOperations[_spaceTokenId].length > 0, "Split operations for this token not exists");
    address splitOperationAddress = tokenIdToSplitOperations[_spaceTokenId][tokenIdToSplitOperations[_spaceTokenId].length - 1];
    require(activeSplitOperations[splitOperationAddress], "Method should be called for active SpaceSplitOperation contract");
    ISpaceSplitOperation splitOperation = ISpaceSplitOperation(splitOperationAddress);

    (uint256[] memory subjectContourOutput, address subjectTokenOwner, uint256 resultContoursLength) = splitOperation.getFinishInfo();

    spaceTokenContour[_spaceTokenId] = subjectContourOutput;
    emit SpaceTokenContourChange(bytes32(_spaceTokenId), subjectContourOutput);

    int256 minHeight = spaceTokenHeight[_spaceTokenId][0];

    int256[] memory subjectSpaceTokenHeights = new int256[](spaceTokenContour[_spaceTokenId].length);
    for (uint i = 0; i < spaceTokenContour[_spaceTokenId].length; i++) {
      if (i + 1 > spaceTokenHeight[_spaceTokenId].length) {
        subjectSpaceTokenHeights[i] = minHeight;
      } else {
        if (spaceTokenHeight[_spaceTokenId][i] < minHeight) {
          minHeight = spaceTokenHeight[_spaceTokenId][i];
        }
        subjectSpaceTokenHeights[i] = spaceTokenHeight[_spaceTokenId][i];
      }
    }

    spaceTokenHeight[_spaceTokenId] = subjectSpaceTokenHeights;
    emit SpaceTokenHeightsChange(bytes32(_spaceTokenId), subjectSpaceTokenHeights);

    spaceToken().transferFrom(splitOperationAddress, subjectTokenOwner, _spaceTokenId);

    for (uint j = 0; j < resultContoursLength; j++) {
      uint256 newSpaceTokenId = spaceToken().mint(subjectTokenOwner);
      
      spaceTokenContour[newSpaceTokenId] = splitOperation.getResultContour(j);
      emit SpaceTokenContourChange(bytes32(newSpaceTokenId), spaceTokenContour[newSpaceTokenId]);

      spaceTokenArea[newSpaceTokenId] = calculateSpaceTokenArea(newSpaceTokenId);
      emit SpaceTokenAreaChange(bytes32(newSpaceTokenId), spaceTokenArea[newSpaceTokenId]);
      spaceTokenAreaSource[newSpaceTokenId] = AreaSource.CONTRACT;

      for (uint k = 0; k < spaceTokenContour[newSpaceTokenId].length; k++) {
        spaceTokenHeight[newSpaceTokenId].push(minHeight);
      }
      emit SpaceTokenHeightsChange(bytes32(newSpaceTokenId), spaceTokenHeight[newSpaceTokenId]);
      
      spaceTokenLevel[newSpaceTokenId] = getSpaceTokenLevel(_spaceTokenId);
      emit SpaceTokenLevelChange(bytes32(newSpaceTokenId), spaceTokenLevel[newSpaceTokenId]);
      
      emit NewSplitSpaceToken(newSpaceTokenId);
    }

    spaceTokenArea[_spaceTokenId] = calculateSpaceTokenArea(_spaceTokenId);
    spaceTokenAreaSource[_spaceTokenId] = AreaSource.CONTRACT;
    emit SpaceTokenAreaChange(bytes32(_spaceTokenId), spaceTokenArea[_spaceTokenId]);

    activeSplitOperations[splitOperationAddress] = false;
  }

  function cancelSplitSpaceToken(uint256 _spaceTokenId) external {
    address splitOperationAddress = tokenIdToSplitOperations[_spaceTokenId][tokenIdToSplitOperations[_spaceTokenId].length - 1];
    require(activeSplitOperations[splitOperationAddress], "Method should be called from active SpaceSplitOperation contract");
    require(tokenIdToSplitOperations[_spaceTokenId].length > 0, "Split operations for this token not exists");

    ISpaceSplitOperation splitOperation = ISpaceSplitOperation(splitOperationAddress);
    require(splitOperation.subjectTokenOwner() == msg.sender, "This action not permitted");
    spaceToken().transferFrom(splitOperationAddress, splitOperation.subjectTokenOwner(), _spaceTokenId);
    activeSplitOperations[splitOperationAddress] = false;
  }

  function mergeSpaceToken(
    uint256 _sourceSpaceTokenId,
    uint256 _destinationSpaceTokenId,
    uint256[] calldata _destinationSpaceContour
  )
    external
    onlySpaceTokenOwner(_sourceSpaceTokenId)
    onlySpaceTokenOwner(_destinationSpaceTokenId)
  {
    require(spaceTokenAreaSource[_sourceSpaceTokenId] == AreaSource.CONTRACT, "Merge available only for contract calculated token's area");
    require(spaceTokenAreaSource[_destinationSpaceTokenId] == AreaSource.CONTRACT, "Merge available only for contract calculated token's area");
    require(
      getSpaceTokenLevel(_sourceSpaceTokenId) == getSpaceTokenLevel(_destinationSpaceTokenId),
      "Space tokens levels should be equal"
    );
    SpaceGeoDataLib.checkMergeContours(
      getSpaceTokenContour(_sourceSpaceTokenId),
      getSpaceTokenContour(_destinationSpaceTokenId),
      _destinationSpaceContour
    );

    spaceTokenContour[_destinationSpaceTokenId] = _destinationSpaceContour;
    emit SpaceTokenContourChange(bytes32(_destinationSpaceTokenId), _destinationSpaceContour);

    int256[] memory sourceSpaceTokenHeights = getSpaceTokenHeights(_sourceSpaceTokenId);

    int256[] memory newSpaceTokenHeights = new int256[](_destinationSpaceContour.length);
    for (uint i = 0; i < _destinationSpaceContour.length; i++) {
      if (i + 1 > sourceSpaceTokenHeights.length) {
        newSpaceTokenHeights[i] = spaceTokenHeight[_destinationSpaceTokenId][i - sourceSpaceTokenHeights.length];
      } else {
        newSpaceTokenHeights[i] = sourceSpaceTokenHeights[i];
      }
    }
    spaceTokenHeight[_destinationSpaceTokenId] = newSpaceTokenHeights;
    emit SpaceTokenHeightsChange(bytes32(_destinationSpaceTokenId), spaceTokenHeight[_destinationSpaceTokenId]);

    spaceTokenArea[_destinationSpaceTokenId] = calculateSpaceTokenArea(_destinationSpaceTokenId);
    emit SpaceTokenAreaChange(bytes32(_destinationSpaceTokenId), spaceTokenArea[_destinationSpaceTokenId]);
    spaceTokenAreaSource[_destinationSpaceTokenId] = AreaSource.CONTRACT;
    
    delete spaceTokenContour[_sourceSpaceTokenId];
    emit SpaceTokenContourChange(bytes32(_sourceSpaceTokenId), spaceTokenContour[_sourceSpaceTokenId]);
    
    delete spaceTokenHeight[_sourceSpaceTokenId];
    emit SpaceTokenHeightsChange(bytes32(_sourceSpaceTokenId), spaceTokenHeight[_sourceSpaceTokenId]);

    delete spaceTokenLevel[_sourceSpaceTokenId];
    emit SpaceTokenLevelChange(bytes32(_sourceSpaceTokenId), spaceTokenLevel[_sourceSpaceTokenId]);

    spaceTokenArea[_sourceSpaceTokenId] = 0;
    emit SpaceTokenAreaChange(bytes32(_sourceSpaceTokenId), spaceTokenArea[_sourceSpaceTokenId]);
    spaceTokenAreaSource[_sourceSpaceTokenId] = AreaSource.CONTRACT;
    
    spaceToken().burn(_sourceSpaceTokenId);
  }

  function checkMergeContours(
    uint256[] memory sourceContour,
    uint256[] memory mergeContour,
    uint256[] memory resultContour
  )
    public
  {
    SpaceGeoDataLib.checkMergeContours(sourceContour, mergeContour, resultContour);
  }

  function spaceToken() internal view returns (ISpaceToken) {
    return ISpaceToken(ggr.getSpaceTokenAddress());
  }

  function getSpaceTokenContour(uint256 _spaceTokenId) public view returns (uint256[] memory) {
    return spaceTokenContour[_spaceTokenId];
  }

  function getSpaceTokenHeights(uint256 _spaceTokenId) public view returns (int256[] memory) {
    return spaceTokenHeight[_spaceTokenId];
  }

  function getSpaceTokenLevel(uint256 _spaceTokenId) public view returns (int256) {
    return spaceTokenLevel[_spaceTokenId];
  }
  
  function calculateSpaceTokenArea(uint256 _spaceTokenId) public returns (uint256) {
    return IGeodesic(ggr.getGeodesicAddress()).calculateContourArea(spaceTokenContour[_spaceTokenId]);
  }

  function setSpaceTokenArea(uint256 _spaceTokenId, uint256 _area, AreaSource _areaSource) external onlyGeoDataManager {
    spaceTokenArea[_spaceTokenId] = _area;
    spaceTokenAreaSource[_spaceTokenId] = _areaSource;
    emit SpaceTokenAreaChange(bytes32(_spaceTokenId), _area);
  }

  function getSpaceTokenArea(uint256 _spaceTokenId) external view returns (uint256) {
    return spaceTokenArea[_spaceTokenId];
  }

  function setSpaceTokenInfo(uint256 _spaceTokenId, bytes32 _ledgerIdentifier, string calldata _description) external onlyGeoDataManager {
    SpaceTokenInfo storage ti = spaceTokenInfo[_spaceTokenId];
    ti.ledgerIdentifier = _ledgerIdentifier;
    ti.description = _description;
  }

  function getSpaceTokenGeoData(uint256 _spaceTokenId) public view returns (
    uint256[] memory contour,
    int256[] memory heights,
    int256 level,
    uint256 area,
    AreaSource areaSource,
    bytes32 ledgerIdentifier,
    string memory description
  )
  {
    SpaceTokenInfo storage ti = spaceTokenInfo[_spaceTokenId];
    return (
      spaceTokenContour[_spaceTokenId],
      spaceTokenHeight[_spaceTokenId],
      spaceTokenLevel[_spaceTokenId],
      spaceTokenArea[_spaceTokenId],
      spaceTokenAreaSource[_spaceTokenId],
      ti.ledgerIdentifier,
      ti.description
    );
  }
}
