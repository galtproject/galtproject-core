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

contract SplitMerge is Initializable, Ownable {
  using SafeMath for uint256;

  // TODO: set MIN_CONTOUR_GEOHASH_PRECISION 12
  uint8 public constant MIN_CONTOUR_GEOHASH_PRECISION = 1;
  uint8 public constant MAX_CONTOUR_GEOHASH_COUNT = 100;

  event LogFirstStage(uint256[] arr1, uint256[] arr2);
  event LogSecondStage(uint256[] arr1, uint256[] arr2);

//  event CheckMergeContoursSecondStart(uint256[] checkSourceContour, uint256[] checkMergeContour, uint256[] resultContour);
//  event CheckMergeContoursSecondFinish(uint256[] checkSourceContour, uint256[] checkMergeContour, uint256[] resultContour);

  SpaceToken spaceToken;
  address plotManager;

  event PackageInit(bytes32 id, address owner);

  mapping(uint256 => uint256[]) public packageToContour;

  uint256[] allPackages;

  PolygonUtils.LatLonData latLonData;

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

  function initPackage() public returns (uint256) {
    uint256 _packageTokenId = spaceToken.mint(msg.sender);
    allPackages.push(_packageTokenId);

    emit PackageInit(bytes32(_packageTokenId), msg.sender);

    return _packageTokenId;
  }

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

  function splitPackage(
    uint256 _sourcePackageTokenId, 
    uint256[] _sourcePackageContour, 
    uint256[] _newPackageContour
  ) 
    public 
    returns (uint256) 
  {

    uint256[] memory currentSourcePackageContour = getPackageContour(_sourcePackageTokenId);
    checkSplitContours(currentSourcePackageContour, _sourcePackageContour, _newPackageContour);

    setPackageContour(_sourcePackageTokenId, _sourcePackageContour);

    uint256 newPackageTokenId = initPackage();
    setPackageContour(newPackageTokenId, _newPackageContour);

    return newPackageTokenId;
  }

  // TODO: Rework, deprecated due to unsafe logic
  function checkSplitContours(
    uint256[] memory sourceContour, 
    uint256[] memory splitContour1, 
    uint256[] memory splitContour2
  ) 
    public
  {
    uint256[] memory checkContour1 = new uint256[](splitContour1.length);
    uint256[] memory checkContour2 = new uint256[](splitContour2.length);

    for (uint i = 0; i < splitContour1.length; i++) {
      for (uint j = 0; j < splitContour2.length; j++) {
        if (splitContour1[i] == splitContour2[j] && splitContour2[j] != 0) {
          require(
            PolygonUtils.isInside(latLonData, splitContour1[i], sourceContour), 
            "Duplicate element not inside source contour"
          );

          checkContour1[i] = 0;
          checkContour2[j] = 0;
        } else {
          if (j == 0) {
            checkContour1[i] = splitContour1[i];
          }
          if (i == 0) {
            checkContour2[j] = splitContour2[j];
          }
        }
      }
    }

    for (uint i = 0; i < checkContour1.length + checkContour2.length; i++) {
      uint256 el = 0;
      if (i < checkContour1.length) {
        if (checkContour1[i] != 0) {
          el = checkContour1[i];
        }
      } else if (checkContour2[i - checkContour1.length] != 0) {
        el = checkContour2[i - checkContour1.length];
      }

      if (el != 0) {
        int index = ArrayUtils.uintFind(sourceContour, el);
        require(index != - 1, "Unique element not exists in source contour");
        sourceContour[uint(index)] = 0;
      }
    }
  }

  function mergePackage(
    uint256 _sourcePackageTokenId, 
    uint256 _destinationPackageTokenId, 
    uint256[] _destinationPackageContour
  ) 
    public 
  {
    checkMergeContours(
      getPackageContour(_sourcePackageTokenId), 
      getPackageContour(_destinationPackageTokenId), 
      _destinationPackageContour
    );
    setPackageContour(_destinationPackageTokenId, _destinationPackageContour);

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
}