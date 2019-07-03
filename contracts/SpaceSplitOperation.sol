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

pragma solidity 0.5.10;

import "@galtproject/geodesic/contracts/utils/WeilerAtherton.sol";
import "@galtproject/geodesic/contracts/utils/PolygonUtils.sol";
import "@galtproject/geodesic/contracts/interfaces/IGeodesic.sol";
import "./interfaces/ISpaceSplitOperation.sol";
import "./interfaces/ISpaceToken.sol";
import "./registries/interfaces/ISpaceGeoDataRegistry.sol";
import "./registries/GaltGlobalRegistry.sol";


contract SpaceSplitOperation is ISpaceSplitOperation {
  using WeilerAtherton for WeilerAtherton.State;

  WeilerAtherton.State private weilerAtherton;

  event InitSplitOperation(address subjectTokenOwner, uint256 subjectTokenId, uint256[] subjectContour, uint256[] clippingContour);

  // TODO: use stages
  enum Stage {
    NONE,
    CONTRACT_INIT,
    POLYGONS_PREPARE,
    POLYGONS_INIT,
    SEGMENTS_ADD,
    MARTINEZ_RUEDA_PROCESS,
    INTERSECT_POINTS_ADD,
    WEILER_ATHERTON_BUILD,
    POLYGONS_FINISH
  }

  Stage public doneStage;

  GaltGlobalRegistry ggr;

  address public subjectTokenOwner;
  uint256 public subjectTokenId;
  uint256[] public subjectContour;
  uint256[] public clippingContour;

  uint256[] public subjectContourOutput;
  uint256[][] public resultContours;

  constructor(GaltGlobalRegistry _ggr, uint256 _subjectTokenId, uint256[] memory _clippingContour) public {
    ggr = _ggr;
    subjectTokenOwner = _ggr.getSpaceToken().ownerOf(_subjectTokenId);
    subjectTokenId = _subjectTokenId;
    subjectContour = ISpaceGeoDataRegistry(_ggr.getSpaceGeoDataRegistryAddress()).getSpaceTokenContour(_subjectTokenId);
    clippingContour = _clippingContour;
  }

  function getSubjectContour() external view returns (uint256[] memory) {
    return subjectContour;
  }

  function getClippingContour() external view returns (uint256[] memory) {
    return clippingContour;
  }

  function init() external {
    require(doneStage == Stage.NONE, "doneStage should be NONE");

    weilerAtherton.initWeilerAtherton();
    ggr.getSpaceToken().approve(ggr.getSplitMergeAddress(), subjectTokenId);
    doneStage = Stage.CONTRACT_INIT;

    emit InitSplitOperation(subjectTokenOwner, subjectTokenId, subjectContour, clippingContour);
  }

  function prepareSubjectPolygon() public {
    require(doneStage == Stage.CONTRACT_INIT, "doneStage should be CONTRACT_INIT");

    convertContourToPoints(subjectContour, weilerAtherton.martinezRueda.subject);

    if (weilerAtherton.martinezRueda.clipping.points.length > 0) {
      doneStage = Stage.POLYGONS_PREPARE;
    }
  }

  function prepareClippingPolygon() public {
    require(doneStage == Stage.CONTRACT_INIT, "doneStage should be CONTRACT_INIT");

    convertContourToPoints(clippingContour, weilerAtherton.martinezRueda.clipping);

    if (weilerAtherton.martinezRueda.subject.points.length > 0) {
      doneStage = Stage.POLYGONS_PREPARE;
    }
  }

  function prepareAllPolygons() external {
    prepareSubjectPolygon();
    prepareClippingPolygon();
  }

  function convertContourToPoints(uint256[] storage geohashesContour, PolygonUtils.CoorsPolygon storage resultPolygon) private {
    require(resultPolygon.points.length == 0, "Contour already converted");

    int256[2] memory point;
    for (uint i = 0; i < geohashesContour.length; i++) {
      point = geodesic().getCachedLatLonByGeohash(geohashesContour[i]);
      if (point[0] == 0 && point[1] == 0) {
        point = geodesic().cacheGeohashToLatLon(geohashesContour[i]);
      }
      resultPolygon.points.push(point);
    }
  }

  function initSubjectPolygon() public {
    require(doneStage == Stage.POLYGONS_PREPARE, "doneStage should be POLYGONS_PREPARE");

    weilerAtherton.initPolygon(weilerAtherton.martinezRueda.subject, weilerAtherton.subjectPolygon);
    if (weilerAtherton.clippingPolygon.startPoint != bytes32(0)) {
      doneStage = Stage.POLYGONS_INIT;
    }
  }

  function initClippingPolygon() public {
    require(doneStage == Stage.POLYGONS_PREPARE, "doneStage should be POLYGONS_PREPARE");

    require(!PolygonUtils.isSelfIntersected(weilerAtherton.martinezRueda.clipping), "Self-intersect polygons don't supporting");

    weilerAtherton.initPolygon(weilerAtherton.martinezRueda.clipping, weilerAtherton.clippingPolygon);
    if (weilerAtherton.subjectPolygon.startPoint != bytes32(0)) {
      doneStage = Stage.POLYGONS_INIT;
    }
  }

  function initAllContours() external {
    initSubjectPolygon();
    initClippingPolygon();
  }

  function prepareAndInitAllPolygons() external {
    prepareSubjectPolygon();
    prepareClippingPolygon();
    initSubjectPolygon();
    initClippingPolygon();
  }

  function addSubjectPolygonSegments() public {
    require(doneStage == Stage.POLYGONS_INIT, "doneStage should be POLYGONS_INIT");

    weilerAtherton.prepareSubjectPolygon();
    if (weilerAtherton.clippingPolygon.segmentsAdded) {
      doneStage = Stage.SEGMENTS_ADD;
    }
  }

  function addClippingPolygonSegments() public {
    require(doneStage == Stage.POLYGONS_INIT, "doneStage should be POLYGONS_INIT");

    weilerAtherton.prepareClippingPolygon();
    if (weilerAtherton.subjectPolygon.segmentsAdded) {
      doneStage = Stage.SEGMENTS_ADD;
    }
  }

  function addAllPolygonsSegments() external {
    addSubjectPolygonSegments();
    addClippingPolygonSegments();
  }

  function processMartinezRueda() external {
    require(doneStage == Stage.SEGMENTS_ADD, "doneStage should be SEGMENTS_ADD");

    weilerAtherton.processMartinezRueda();
    // is Martinez Rueda finished
    if (weilerAtherton.martinezRueda.subdivideSegmentsOver && weilerAtherton.martinezRueda.resultEvents.length != 0) {
      doneStage = Stage.MARTINEZ_RUEDA_PROCESS;
    }
  }

  function addIntersectedPoints() public {
    require(doneStage == Stage.MARTINEZ_RUEDA_PROCESS, "doneStage should be SEGMENTS_ADD");

    weilerAtherton.addIntersectedPoints();
    doneStage = Stage.INTERSECT_POINTS_ADD;
  }

  function getPolygonsLengths() public view returns (uint256 resultPolygonsLength, uint256 subjectOutputPointsLength) {
    resultPolygonsLength = weilerAtherton.resultPolygons.length;
    subjectOutputPointsLength = weilerAtherton.subjectPolygonOutput.points.length;
  }

  function getResultPolygonLength(uint256 polygonIndex) public view returns (uint256) {
    return weilerAtherton.resultPolygons[polygonIndex].points.length;
  }

  function getResultPolygonPoint(uint256 polygonIndex, uint256 pointIndex) public view returns (int256[2] memory) {
    return weilerAtherton.resultPolygons[polygonIndex].points[pointIndex];
  }

  function getSubjectPolygonOutputPoint(uint256 pointIndex) public view returns (int256[2] memory) {
    return weilerAtherton.subjectPolygonOutput.points[pointIndex];
  }

  function buildResultPolygon() public {
    require(doneStage == Stage.INTERSECT_POINTS_ADD, "doneStage should be SEGMENTS_ADD");

    weilerAtherton.buildResultPolygon();
  }

  function isBuildResultFinished() external view returns(bool) {
    /* solium-disable-next-line */
    return weilerAtherton.subjectPolygon.handledIntersectionPoints == weilerAtherton.subjectPolygon.intersectionPoints.length
    /* solium-disable-next-line */
        && weilerAtherton.clippingPolygon.handledIntersectionPoints == weilerAtherton.clippingPolygon.intersectionPoints.length;
  }

  function buildSubjectPolygonOutput() public {
    require(doneStage == Stage.INTERSECT_POINTS_ADD, "doneStage should be SEGMENTS_ADD");
    require(
      weilerAtherton.subjectPolygon.handledIntersectionPoints == weilerAtherton.subjectPolygon.intersectionPoints.length,
      "buildResultPolygon not finished"
    );
    require(
      weilerAtherton.clippingPolygon.handledIntersectionPoints == weilerAtherton.clippingPolygon.intersectionPoints.length,
      "buildResultPolygon not finished"
    );

    weilerAtherton.buildSubjectPolygonOutput();

    doneStage = Stage.WEILER_ATHERTON_BUILD;
  }

  function processWeilerAtherton() external {
    addIntersectedPoints();
    buildResultPolygon();
    buildSubjectPolygonOutput();
  }

  function convertPointsToContour(PolygonUtils.CoorsPolygon storage latLonPolygon) private returns (uint256[] memory geohashContour) {
    geohashContour = new uint256[](latLonPolygon.points.length);

    uint256 geohash;
    for (uint i = 0; i < latLonPolygon.points.length; i++) {
      geohash = geodesic().getCachedGeohashByLatLon(latLonPolygon.points[i], 12);
      if (geohash == 0) {
        geohash = geodesic().cacheLatLonToGeohash(latLonPolygon.points[i], 12);
      }

      geohashContour[i] = geohash;
    }
  }

  function finishSubjectPolygon() public {
    require(doneStage == Stage.WEILER_ATHERTON_BUILD, "doneStage should be WEILER_ATHERTON_BUILD");
    require(subjectContourOutput.length == 0, "Clipping polygons already finished");

    subjectContourOutput = convertPointsToContour(weilerAtherton.subjectPolygonOutput);
    if (resultContours.length > 0) {
      doneStage = Stage.POLYGONS_FINISH;
    }
  }

  function finishClippingPolygons() public {
    require(doneStage == Stage.WEILER_ATHERTON_BUILD, "doneStage should be WEILER_ATHERTON_BUILD");
    require(resultContours.length == 0, "Clipping polygons already finished");

    for (uint i = 0; i < weilerAtherton.resultPolygons.length; i++) {
      resultContours.push(convertPointsToContour(weilerAtherton.resultPolygons[i]));
    }
    if (subjectContourOutput.length > 0) {
      doneStage = Stage.POLYGONS_FINISH;
    }
  }

  function finishAllPolygons() external {
    finishSubjectPolygon();
    finishClippingPolygons();
  }

  function geodesic() internal returns (IGeodesic) {
    return IGeodesic(ggr.getGeodesicAddress());
  }

  function getResultContour(uint256 contourIndex) external view returns (uint256[] memory) {
    return resultContours[contourIndex];
  }

  function getFinishInfo() external view returns (uint256[] memory subjectContourResult, address tokenOwner, uint256 resultContoursCount) {
    require(doneStage == Stage.POLYGONS_FINISH, "SpaceSplitOperation not finished");
    subjectContourResult = subjectContourOutput;
    tokenOwner = subjectTokenOwner;
    resultContoursCount = resultContours.length;
  }
}
