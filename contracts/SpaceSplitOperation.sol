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
//pragma experimental ABIEncoderV2;

import "./utils/WeilerAtherton.sol";
import "./utils/PolygonUtils.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";

contract SpaceSplitOperation {
  using WeilerAtherton for WeilerAtherton.State;

  WeilerAtherton.State private weilerAtherton;

  // TODO: use stages
  enum Stage {
    NONE,
    CONTRACT_INIT,
    POLYGONS_PREPARE,
    POLYGONS_INIT,
    SEGMENTS_ADD,
    BENTLEY_OTTMAN_PROCESS,
    INTERSECT_POINTS_ADD,
    WEILER_ATHERTON_BUILD,
    POLYGONS_FINISH
  }

  Stage public doneStage;

  SplitMerge private splitMerge;
  SpaceToken private spaceToken;

  address public baseTokenOwner;
  uint256 public baseTokenId;
  uint256[] public baseContour;
  uint256[] public cropContour;

  uint256[] public baseContourOutput;
  uint256[][] public resultContours;

  constructor(address _spaceToken, address _baseTokenOwner, uint256 _baseTokenId, uint256[] _baseContour, uint256[] _cropContour) public {
    splitMerge = SplitMerge(msg.sender);
    spaceToken = SpaceToken(_spaceToken);

    baseTokenOwner = _baseTokenOwner;
    baseTokenId = _baseTokenId;
    baseContour = _baseContour;
    cropContour = _cropContour;
  }

  function init() public {
    require(doneStage == Stage.NONE, "doneStage should be NONE");

    weilerAtherton.initWeilerAtherton();
    spaceToken.approve(address(splitMerge), baseTokenId);
    doneStage = Stage.CONTRACT_INIT;
  }

  function prepareBasePolygon() public {
    require(doneStage == Stage.CONTRACT_INIT, "doneStage should be CONTRACT_INIT");

    convertContourToPoints(baseContour, weilerAtherton.martinezRueda.subject);

    if (weilerAtherton.martinezRueda.subject.points.length > 0) {
      doneStage = Stage.POLYGONS_PREPARE;
    }
  }

  function prepareCropPolygon() public {
    require(doneStage == Stage.CONTRACT_INIT, "doneStage should be CONTRACT_INIT");

    convertContourToPoints(cropContour, weilerAtherton.martinezRueda.clipping);

    if (weilerAtherton.martinezRueda.clipping.points.length > 0) {
      doneStage = Stage.POLYGONS_PREPARE;
    }
  }

  function prepareAllPolygons() public {
    prepareBasePolygon();
    prepareCropPolygon();
  }

  function convertContourToPoints(uint256[] storage geohashesContour, PolygonUtils.CoorsPolygon storage resultPolygon) private {
    require(resultPolygon.points.length == 0, "Contour already converted");

    int256[2] memory point;
    for (uint i = 0; i < geohashesContour.length; i++) {
      point = splitMerge.getCachedLatLonByGeohash(geohashesContour[i]);
      if (point[0] == 0 && point[1] == 0) {
        point = splitMerge.cacheGeohashToLatLon(geohashesContour[i]);
      }
      resultPolygon.points.push(point);
    }
  }

  function initBasePolygon() public {
    require(doneStage == Stage.POLYGONS_PREPARE, "doneStage should be POLYGONS_PREPARE");

    weilerAtherton.initPolygon(weilerAtherton.martinezRueda.subject, weilerAtherton.basePolygon);
    if (weilerAtherton.cropPolygon.startPoint != bytes32(0)) {
      doneStage = Stage.POLYGONS_INIT;
    }
  }

  function initCropPolygon() public {
    require(doneStage == Stage.POLYGONS_PREPARE, "doneStage should be POLYGONS_PREPARE");

    weilerAtherton.initPolygon(weilerAtherton.martinezRueda.clipping, weilerAtherton.cropPolygon);
    if (weilerAtherton.basePolygon.startPoint != bytes32(0)) {
      doneStage = Stage.POLYGONS_INIT;
    }
  }

  function initAllContours() public {
    initBasePolygon();
    initCropPolygon();
  }

  function prepareAndInitAllPolygons() public {
    prepareBasePolygon();
    prepareCropPolygon();
    initBasePolygon();
    initCropPolygon();
  }

  function addBasePolygonSegments() public {
    require(doneStage == Stage.POLYGONS_INIT, "doneStage should be POLYGONS_INIT");

    weilerAtherton.prepareBasePolygon();
    if (weilerAtherton.cropPolygon.segmentsAdded) {
      doneStage = Stage.SEGMENTS_ADD;
    }
  }

  function addCropPolygonSegments() public {
    require(doneStage == Stage.POLYGONS_INIT, "doneStage should be POLYGONS_INIT");

    weilerAtherton.prepareCropPolygon();
    if (weilerAtherton.basePolygon.segmentsAdded) {
      doneStage = Stage.SEGMENTS_ADD;
    }
  }

  function addAllPolygonsSegments() public {
    addBasePolygonSegments();
    addCropPolygonSegments();
  }

  function processMartinezRueda() public {
    require(doneStage == Stage.SEGMENTS_ADD, "doneStage should be SEGMENTS_ADD");

    weilerAtherton.processMartinezRueda();
    // is Bentley Ottman finished
    if (weilerAtherton.martinezRueda.subdivideSegmentsOver && weilerAtherton.martinezRueda.resultEvents.length == 0) {
      doneStage = Stage.BENTLEY_OTTMAN_PROCESS;
    }
  }

  function addIntersectedPoints() public {
    require(doneStage == Stage.BENTLEY_OTTMAN_PROCESS, "doneStage should be SEGMENTS_ADD");

    weilerAtherton.addIntersectedPoints();
    doneStage = Stage.INTERSECT_POINTS_ADD;
  }

  function getPolygonsLengths() public view returns (uint256 resultPolygonsLength, uint256 baseOutputPointsLength) {
    resultPolygonsLength = weilerAtherton.resultPolygons.length;
    baseOutputPointsLength = weilerAtherton.basePolygonOutput.points.length;
  }

  function getResultPolygonLength(uint256 polygonIndex) public view returns (uint256) {
    return weilerAtherton.resultPolygons[polygonIndex].points.length;
  }

  function getResultPolygonPoint(uint256 polygonIndex, uint256 pointIndex) public view returns (int256[2]) {
    return weilerAtherton.resultPolygons[polygonIndex].points[pointIndex];
  }

  function getBasePolygonOutputPoint(uint256 pointIndex) public view returns (int256[2]) {
    return weilerAtherton.basePolygonOutput.points[pointIndex];
  }

  function buildResultPolygon() public {
    require(doneStage == Stage.INTERSECT_POINTS_ADD, "doneStage should be SEGMENTS_ADD");

    weilerAtherton.buildResultPolygon();
  }

  function buildBasePolygonOutput() public {
    require(doneStage == Stage.INTERSECT_POINTS_ADD, "doneStage should be SEGMENTS_ADD");
    require(weilerAtherton.basePolygon.handledIntersectionPoints == weilerAtherton.basePolygon.intersectionPoints.length, "buildResultPolygon not finished");
    require(weilerAtherton.cropPolygon.handledIntersectionPoints == weilerAtherton.cropPolygon.intersectionPoints.length, "buildResultPolygon not finished");

    weilerAtherton.buildBasePolygonOutput();

    doneStage = Stage.WEILER_ATHERTON_BUILD;
  }

  function processWeilerAtherton() public {
    addIntersectedPoints();
    buildResultPolygon();
    buildBasePolygonOutput();
  }

  function convertPointsToContour(PolygonUtils.CoorsPolygon storage latLonPolygon) private returns (uint256[] geohashContour) {
    geohashContour = new uint256[](latLonPolygon.points.length);

    uint256 geohash;
    for (uint i = 0; i < latLonPolygon.points.length; i++) {
      geohash = splitMerge.getCachedGeohashByLatLon(latLonPolygon.points[i], 12);
      if (geohash == 0) {
        geohash = splitMerge.cacheLatLonToGeohash(latLonPolygon.points[i], 12);
      }

      geohashContour[i] = geohash;
    }
  }

  function finishBasePolygon() public {
    require(doneStage == Stage.WEILER_ATHERTON_BUILD, "doneStage should be WEILER_ATHERTON_BUILD");
    require(baseContourOutput.length == 0, "Crop polygons already finished");

    baseContourOutput = convertPointsToContour(weilerAtherton.basePolygonOutput);
    if (resultContours.length > 0) {
      doneStage = Stage.POLYGONS_FINISH;
    }
  }

  function finishCropPolygons() public {
    require(doneStage == Stage.WEILER_ATHERTON_BUILD, "doneStage should be WEILER_ATHERTON_BUILD");
    require(resultContours.length == 0, "Crop polygons already finished");

    for (uint i = 0; i < weilerAtherton.resultPolygons.length; i++) {
      resultContours.push(convertPointsToContour(weilerAtherton.resultPolygons[i]));
    }
    if (baseContourOutput.length > 0) {
      doneStage = Stage.POLYGONS_FINISH;
    }
  }

  function finishAllPolygons() public {
    finishBasePolygon();
    finishCropPolygons();
  }

  function getResultContour(uint256 contourIndex) public view returns (uint256[]) {
    return resultContours[contourIndex];
  }

  function getFinishInfo() public view returns (uint256[] baseContourResult, address tokenOwner, uint256 resultContoursCount) {
    require(doneStage == Stage.POLYGONS_FINISH, "SpaceSplitOperation not finished");
    baseContourResult = baseContourOutput;
    tokenOwner = baseTokenOwner;
    resultContoursCount = resultContours.length;
  }
}
