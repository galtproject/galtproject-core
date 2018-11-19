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
import "./SpaceToken.sol";
import "./utils/PolygonUtils.sol";
import "./utils/LandUtils.sol";
import "./utils/ArrayUtils.sol";
import "./SpaceSplitOperation.sol";

contract SplitMerge is Initializable, Ownable {
  using SafeMath for uint256;

  // TODO: set MIN_CONTOUR_GEOHASH_PRECISION 12
  uint8 public constant MIN_CONTOUR_GEOHASH_PRECISION = 1;
  uint8 public constant MAX_CONTOUR_GEOHASH_COUNT = 100;

  event LogFirstStage(uint256[] arr1, int256[] arr2);
  event LogSecondStage(uint256[] arr1, uint256[] arr2);

//  event CheckMergeContoursSecondStart(uint256[] checkSourceContour, uint256[] checkMergeContour, uint256[] resultContour);
//  event CheckMergeContoursSecondFinish(uint256[] checkSourceContour, uint256[] checkMergeContour, uint256[] resultContour);

  SpaceToken spaceToken;
  address plotManager;

  event PackageInit(bytes32 id, address owner);

  mapping(uint256 => uint256[]) public packageToContour;
  mapping(uint256 => int256[]) public packageToHeights;
  mapping(uint256 => int256) public packageToLevel;

  uint256[] allPackages;
  
  mapping(address => bool) public activeSplitOperations;
  mapping(uint256 => address[]) public tokenIdToSplitOperations;
  address[] public allSplitOperations;

  LandUtils.LatLonData public latLonData;

  function initialize(SpaceToken _spaceToken, address _plotManager) public isInitializer {
    owner = msg.sender;
    spaceToken = _spaceToken;
    plotManager = _plotManager;
  }

  modifier ownerOrPlotManager() {
    require(plotManager == msg.sender || owner == msg.sender, "No permissions to mint geohash");
    _;
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

  // TODO: restrict for role
  function initPackage(address spaceTokenOwner) public returns (uint256) {
    uint256 _packageTokenId = spaceToken.mint(spaceTokenOwner);
    allPackages.push(_packageTokenId);

    emit PackageInit(bytes32(_packageTokenId), spaceTokenOwner);

    return _packageTokenId;
  }

  // TODO: restrict for role
  function setPackageContour(uint256 _packageTokenId, uint256[] _geohashesContour) 
    public onlySpaceTokenOwner(_packageTokenId) 
  {
    require(_geohashesContour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(
      _geohashesContour.length <= MAX_CONTOUR_GEOHASH_COUNT, 
      "Number of contour elements should be equal or less than MAX_CONTOUR_GEOHASH_COUNT"
    );

    for (uint8 i = 0; i < _geohashesContour.length; i++) {
      require(_geohashesContour[i] > 0, "Contour element geohash should not be a zero");
      require(
        LandUtils.geohash5Precision(_geohashesContour[i]) >= MIN_CONTOUR_GEOHASH_PRECISION, 
        "Contour element geohash should have at least MIN_CONTOUR_GEOHASH_PRECISION precision"
      );
    }

    packageToContour[_packageTokenId] = _geohashesContour;
  }

  // TODO: restrict for role
  function setPackageHeights(uint256 _packageTokenId, int256[] _heightsList)
    public onlySpaceTokenOwner(_packageTokenId)
  {
    require(_heightsList.length == getPackageContour(_packageTokenId).length, "Number of height elements should be equal contour length");

    packageToHeights[_packageTokenId] = _heightsList;
  }

  // TODO: restrict for role
  function setPackageLevel(uint256 _packageTokenId, int256 _level)
    public onlySpaceTokenOwner(_packageTokenId)
  {
    packageToLevel[_packageTokenId] = _level;
  }
  
  function cacheGeohashToLatLon(uint256 _geohash) public {
    latLonData.latLonByGeohash[_geohash] = LandUtils.geohash5ToLatLonArr(_geohash);
  }
  
  function cacheGeohashListToLatLon(uint256[] _geohashList) public {
    for(uint i = 0; i < _geohashList.length; i++) {
      cacheGeohashToLatLon(_geohashList[i]);
    }
  }

  function cacheLatLonToGeohash(uint256[2] point, uint8 precision) public {
    bytes32 pointHash = keccak256(abi.encode(point));
    latLonData.latLonByGeohash[pointHash][precision] = LandUtils.latLonToGeohash5(point, precision);
  }

  function cacheLatLonListToGeohash(uint256[2][] _pointList, uint8 precision) public {
    for(uint i = 0; i < _pointList.length; i++) {
      cacheLatLonToGeohash(_pointList[i], precision);
    }
  }

  // TODO: add SpaceSplitOperationFactory for migrations between versions
  function startSplitOperation(
    uint256 _sourcePackageTokenId, 
    uint256[] _cropContour
  ) 
    public
    onlySpaceTokenOwner(_sourcePackageTokenId)
    returns (address) 
  {
    address spaceTokenOwner = spaceToken.ownerOf(_spaceTokenId);

    SpaceSplitOperation newSplitOperation = new SpaceSplitOperation(spaceTokenOwner, _spaceTokenId, getPackageContour(_sourcePackageTokenId), _cropContour);
    activeSplitOperations[address(newSplitOperation)] = true;
    tokenIdToSplitOperations[_spaceTokenId].push(address(newSplitOperation)); 
    allSplitOperations.push(newSplitOperation);
    
    spaceToken.transferFrom(spaceTokenOwner, address(newSplitOperation), _sourcePackageTokenId);
    return newSplitOperation;
  }
  
  function finishSplitPackage(uint256 _packageId) public {
    require(activeSplitOperations[newSplitOperation], "Method should be called from active SpaceSplitOperation contract");
    require(tokenIdToSplitOperations[_spaceTokenId].length > 0, "Split operations for this token not exists");
    SpaceSplitOperation splitOperation = SpaceSplitOperation(tokenIdToSplitOperations[_spaceTokenId][tokenIdToSplitOperations[_spaceTokenId].length - 1]);

    require(splitOperation.baseContourOutput.length > 0 && splitOperation.resultContours.length > 0, "SpaceSplitOperation should be finished first");
    setPackageContour(_packageId, newSplitOperation.baseContourOutput);

    int256 minHeight = packageToHeights[_packageId][0];

    int256[] memory sourcePackageHeights = new int256[](_sourcePackageContour.length);
    for (uint i = 0; i < _sourcePackageContour.length; i++) {
      if (i + 1 > packageToHeights[_packageId].length) {
        sourcePackageHeights[i] = minHeight;
      } else {
        if (packageToHeights[_packageId][i] < minHeight) {
          minHeight = packageToHeights[_packageId][i];
        }
        sourcePackageHeights[i] = packageToHeights[_packageId][i];
      }
    }
    
    setPackageHeights(_packageId, sourcePackageHeights);

    for(uint i = 0; i < splitOperation.resultContours.length; i++) {
      uint256 newPackageId = initPackage(splitOperation.baseTokenOwner);
      setPackageContour(newPackageId, splitOperation.resultContours[i]);
      
      int256[] memory newPackageHeights = new int256[](splitOperation.resultContours[i].length);
      for (uint i = 0; i < _newPackageContour.length; i++) {
        newPackageHeights[i] = minHeight;
      }

      setPackageHeights(newPackageId, newPackageHeights);
      setPackageLevel(newPackageId, getPackageLevel(_packageId));
    }
    
    activeSplitOperations[newSplitOperation] = false;
  }

  function mergePackage(
    uint256 _sourcePackageTokenId, 
    uint256 _destinationPackageTokenId, 
    uint256[] _destinationPackageContour
  ) 
    public
    onlySpaceTokenOwner(_sourcePackageTokenId)
    onlySpaceTokenOwner(_destinationPackageTokenId)
  {
    require(
      getPackageLevel(_sourcePackageTokenId) == getPackageLevel(_destinationPackageTokenId), 
      "Space tokens levels should be equal"
    );
    checkMergeContours(
      getPackageContour(_sourcePackageTokenId), 
      getPackageContour(_destinationPackageTokenId), 
      _destinationPackageContour
    );
    setPackageContour(_destinationPackageTokenId, _destinationPackageContour);

    int256[] memory sourcePackageHeights = getPackageHeights(_sourcePackageTokenId);
    
    int256[] memory packageHeights = new int256[](_destinationPackageContour.length);
    for (uint i = 0; i < _destinationPackageContour.length; i++) {
      if (i + 1 > sourcePackageHeights.length) {
        packageHeights[i] = packageToHeights[_destinationPackageTokenId][i - sourcePackageHeights.length];
      } else {
        packageHeights[i] = sourcePackageHeights[i];
      }
    }
    setPackageHeights(_destinationPackageTokenId, packageHeights);

    spaceToken.burn(_sourcePackageTokenId);
  }

  function checkMergeContours(
    uint256[] memory sourceContour, 
    uint256[] memory mergeContour, 
    uint256[] memory resultContour
  ) 
    public 
  {
    for (uint i = 0; i < sourceContour.length; i++) {
      for (uint j = 0; j < mergeContour.length; j++) {
        if (sourceContour[i] == mergeContour[j] && sourceContour[i] != 0) {
          sourceContour[i] = 0;
          mergeContour[j] = 0;
        }
      }
    }

    uint256[] memory checkResultContour = new uint256[](resultContour.length);
    for (uint i = 0; i < resultContour.length; i++) {
      checkResultContour[i] = resultContour[i];
    }

//    emit CheckMergeContoursSecondStart(sourceContour, mergeContour, resultContour);

    for (uint i = 0; i < sourceContour.length + mergeContour.length; i++) {
      uint256 el = 0;
      if (i < sourceContour.length) {
        if (sourceContour[i] != 0) {
          el = sourceContour[i];
        }
      } else if (mergeContour[i - sourceContour.length] != 0) {
        el = mergeContour[i - sourceContour.length];
      }

      if (el != 0) {
        int index = ArrayUtils.uintFind(checkResultContour, el);
        require(index != - 1, "Unique element not exists in result contour");
        checkResultContour[uint(index)] = 0;
      }
    }
//    emit CheckMergeContoursSecondFinish(sourceContour, mergeContour, checkResultContour);
  }

  function getPackageContour(uint256 _packageTokenId) public view returns (uint256[]) {
    return packageToContour[_packageTokenId];
  }

  function getPackageHeights(uint256 _packageTokenId) public view returns (int256[]) {
    return packageToHeights[_packageTokenId];
  }

  function getPackageLevel(uint256 _packageTokenId) public view returns (int256) {
    return packageToLevel[_packageTokenId];
  }

  function getPackageGeoData(uint256 _packageTokenId) public view returns (
    uint256[] contour,
    int256[] heights,
    int256 level
  ) 
  {
    return (
      getPackageContour(_packageTokenId),
      getPackageHeights(_packageTokenId),
      getPackageLevel(_packageTokenId)
    );
  }
}
