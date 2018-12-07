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

contract SplitMerge is Initializable, Ownable, RBAC {
  using SafeMath for uint256;

  // TODO: set MIN_CONTOUR_GEOHASH_PRECISION 12
  uint8 public constant MIN_CONTOUR_GEOHASH_PRECISION = 1;
  uint8 public constant MAX_CONTOUR_GEOHASH_COUNT = 100;

  string public constant GEO_DATA_MANAGER = "geo_data_manager";

  event LogFirstStage(uint256[] arr1, int256[] arr2);
  event LogSecondStage(uint256[] arr1, uint256[] arr2);

  //  event CheckMergeContoursSecondStart(uint256[] checkSourceContour, uint256[] checkMergeContour, uint256[] resultContour);
  //  event CheckMergeContoursSecondFinish(uint256[] checkSourceContour, uint256[] checkMergeContour, uint256[] resultContour);

  SpaceToken spaceToken;
  address plotManager;

  event PackageInit(bytes32 id, address owner);
  event SplitOperationStart(uint256 spaceTokenId, address splitOperation);

  mapping(uint256 => uint256[]) public packageToContour;
  mapping(uint256 => int256[]) public packageToHeights;
  mapping(uint256 => int256) public packageToLevel;

  uint256[] allPackages;

  mapping(address => bool) public activeSplitOperations;
  mapping(uint256 => address[]) public tokenIdToSplitOperations;
  address[] public allSplitOperations;

  LandUtils.LatLonData private latLonData;

  event NewSplitSpaceToken(uint256 id);

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

  modifier onlyGeoDataManager() {
    require(
    /* solium-disable-next-line */
      hasRole(msg.sender, GEO_DATA_MANAGER),
      "This action not permitted for msg.sender");
    _;
  }

  function initPackage(address spaceTokenOwner)
    public onlyGeoDataManager()
    returns (uint256)
  {
    uint256 _packageTokenId = spaceToken.mint(spaceTokenOwner);

    emit PackageInit(bytes32(_packageTokenId), spaceTokenOwner);

    return _packageTokenId;
  }

  function setPackageContour(uint256 _packageTokenId, uint256[] _geohashesContour)
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
        LandUtils.geohash5Precision(_geohashesContour[i]) >= MIN_CONTOUR_GEOHASH_PRECISION,
        "Contour element geohash should have at least MIN_CONTOUR_GEOHASH_PRECISION precision"
      );
    }

    packageToContour[_packageTokenId] = _geohashesContour;
  }

  function setPackageHeights(uint256 _packageTokenId, int256[] _heightsList)
    public onlyGeoDataManager()
  {
    require(_heightsList.length == getPackageContour(_packageTokenId).length, "Number of height elements should be equal contour length");

    packageToHeights[_packageTokenId] = _heightsList;
  }

  function setPackageLevel(uint256 _packageTokenId, int256 _level)
    public onlyGeoDataManager()
  {
    packageToLevel[_packageTokenId] = _level;
  }

  function cacheGeohashToLatLon(uint256 _geohash) public returns (int256[2]) {
    latLonData.latLonByGeohash[_geohash] = LandUtils.geohash5ToLatLonArr(_geohash);
    bytes32 pointHash = keccak256(abi.encode(latLonData.latLonByGeohash[_geohash]));
    latLonData.geohashByLatLonHash[pointHash][12] = _geohash;
    return latLonData.latLonByGeohash[_geohash];
  }

  function cacheGeohashListToLatLon(uint256[] _geohashList) public {
    for (uint i = 0; i < _geohashList.length; i++) {
      cacheGeohashToLatLon(_geohashList[i]);
    }
  }
  
  function getCachedLatLonByGeohash(uint256 _geohash) public returns (int256[2]) {
    return latLonData.latLonByGeohash[_geohash];
  }

  function cacheLatLonToGeohash(int256[2] point, uint8 precision) public returns (uint256) {
    bytes32 pointHash = keccak256(abi.encode(point));
    latLonData.geohashByLatLonHash[pointHash][precision] = LandUtils.latLonToGeohash5(point[0], point[1], precision);
    return latLonData.geohashByLatLonHash[pointHash][precision];
  }

  function cacheLatLonListToGeohash(int256[2][] _pointList, uint8 precision) public {
    for (uint i = 0; i < _pointList.length; i++) {
      cacheLatLonToGeohash(_pointList[i], precision);
    }
  }

  function getCachedGeohashByLatLon(int256[2] point, uint8 precision) public returns (uint256) {
    bytes32 pointHash = keccak256(abi.encode(point));
    return latLonData.geohashByLatLonHash[pointHash][precision];
  }

  // TODO: add SpaceSplitOperationFactory for migrations between versions
  function startSplitOperation(
    uint256 _spaceTokenId,
    uint256[] _clippingContour
  )
    external
    onlySpaceTokenOwner(_spaceTokenId)
    returns (address)
  {
    address spaceTokenOwner = spaceToken.ownerOf(_spaceTokenId);

    SpaceSplitOperation newSplitOperation = new SpaceSplitOperation(address(spaceToken), spaceTokenOwner, _spaceTokenId, getPackageContour(_spaceTokenId), _clippingContour);
    activeSplitOperations[address(newSplitOperation)] = true;
    tokenIdToSplitOperations[_spaceTokenId].push(address(newSplitOperation));
    allSplitOperations.push(newSplitOperation);

    spaceToken.transferFrom(spaceTokenOwner, address(newSplitOperation), _spaceTokenId);
    newSplitOperation.init();

    emit SplitOperationStart(_spaceTokenId, address(newSplitOperation));
    return newSplitOperation;
  }

  function finishSplitOperation(uint256 _spaceTokenId) external {
    require(tokenIdToSplitOperations[_spaceTokenId].length > 0, "Split operations for this token not exists");
    address splitOperationAddress = tokenIdToSplitOperations[_spaceTokenId][tokenIdToSplitOperations[_spaceTokenId].length - 1];
    require(activeSplitOperations[splitOperationAddress], "Method should be called from active SpaceSplitOperation contract");
    SpaceSplitOperation splitOperation = SpaceSplitOperation(splitOperationAddress);

    (uint256[] memory subjectContourOutput, address subjectTokenOwner, uint256 resultContoursLength) = splitOperation.getFinishInfo();

    packageToContour[_spaceTokenId] = subjectContourOutput;

    int256 minHeight = packageToHeights[_spaceTokenId][0];

    int256[] memory subjectPackageHeights = new int256[](packageToContour[_spaceTokenId].length);
    for (uint i = 0; i < packageToContour[_spaceTokenId].length; i++) {
      if (i + 1 > packageToHeights[_spaceTokenId].length) {
        subjectPackageHeights[i] = minHeight;
      } else {
        if (packageToHeights[_spaceTokenId][i] < minHeight) {
          minHeight = packageToHeights[_spaceTokenId][i];
        }
        subjectPackageHeights[i] = packageToHeights[_spaceTokenId][i];
      }
    }

    packageToHeights[_spaceTokenId] = subjectPackageHeights;
    
    spaceToken.transferFrom(splitOperationAddress, subjectTokenOwner, _spaceTokenId);
    
    for (uint j = 0; j < resultContoursLength; j++) {
      uint256 newPackageId = spaceToken.mint(subjectTokenOwner);
      packageToContour[newPackageId] = splitOperation.getResultContour(j);

      for (uint k = 0; k < packageToContour[newPackageId].length; k++) {
        packageToHeights[newPackageId].push(minHeight);
      }
      packageToLevel[newPackageId] = getPackageLevel(_spaceTokenId);
      emit NewSplitSpaceToken(newPackageId);
    }

    activeSplitOperations[splitOperationAddress] = false;
  }

  function cancelSplitPackage(uint256 _spaceTokenId) external {
    address splitOperationAddress = tokenIdToSplitOperations[_spaceTokenId][tokenIdToSplitOperations[_spaceTokenId].length - 1];
    require(activeSplitOperations[splitOperationAddress], "Method should be called from active SpaceSplitOperation contract");
    require(tokenIdToSplitOperations[_spaceTokenId].length > 0, "Split operations for this token not exists");

    SpaceSplitOperation splitOperation = SpaceSplitOperation(splitOperationAddress);
    require(splitOperation.subjectTokenOwner() == msg.sender, "This action not permitted for msg.sender");
    spaceToken.transferFrom(splitOperationAddress, splitOperation.subjectTokenOwner(), _spaceTokenId);
    activeSplitOperations[splitOperationAddress] = false;
  }

  function mergePackage(
    uint256 _sourcePackageTokenId,
    uint256 _destinationPackageTokenId,
    uint256[] _destinationPackageContour
  )
    external
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
    
    packageToContour[_destinationPackageTokenId] = _destinationPackageContour;

    int256[] memory sourcePackageHeights = getPackageHeights(_sourcePackageTokenId);

    int256[] memory packageHeights = new int256[](_destinationPackageContour.length);
    for (uint i = 0; i < _destinationPackageContour.length; i++) {
      if (i + 1 > sourcePackageHeights.length) {
        packageHeights[i] = packageToHeights[_destinationPackageTokenId][i - sourcePackageHeights.length];
      } else {
        packageHeights[i] = sourcePackageHeights[i];
      }
    }
    packageToHeights[_destinationPackageTokenId] = packageHeights;

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

  function addRoleTo(address _operator, string _role) external onlyOwner {
    super.addRole(_operator, _role);
  }

  function removeRoleFrom(address _operator, string _role) external onlyOwner {
    super.removeRole(_operator, _role);
  }
}
