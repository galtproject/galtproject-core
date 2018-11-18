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

  SplitMerge private splitMerge;
  SpaceToken private spaceToken;
  
  uint256 public baseTokenId;
  uint256[] public baseContour;
  uint256[] public cropContour;
  
  uint256[] public baseContourOutput;
  uint256[][] public resultContours;
  
  constructor(uint256 _baseTokenId, uint256[] _baseContour, uint256[] _cropContour) public {
    splitMerge = msg.sender;
    
    baseTokenId = _baseTokenId;
    baseContour = _baseContour;
    cropContour = _cropContour;
    weilerAtherton.init();
  }
  
  function prepareBasePolygon() public {
    convertContourToPoints(baseContour, weilerAtherton.basePolygonInput);
  }

  function prepareCropPolygon() public {
    convertContourToPoints(cropContour, weilerAtherton.cropPolygonInput);
  }

  function prepareAllPolygons() public {
    prepareBasePolygon();
    prepareCropPolygon();
  }
  
  function convertContourToPoints(uint256[] storage geohashesContour, PolygonUtils.CoorsPolygon storage resultPolygon) private {
    require(resultPolygon.points.length == 0, "Contour already converted");

    for(uint i = 0; i < geohashesContour.length; i++) {
      if(splitMerge.latLonData.latLonByGeohash[geohashesContour[i]][0] == 0 && splitMerge.latLonData.latLonByGeohash[geohashesContour[i]][1] == 0) {
        splitMerge.cacheGeohashToLatLon(geohashesContour[i]);
      }
      resultPolygon.points.push(splitMerge.latLonData.latLonByGeohash[geohashesContour[i]]);
    }
  }
  
  function initBasePolygon() public {
    weilerAtherton.initPolygon(basePolygon, weilerAtherton.basePolygon);
  }

  function initCropPolygon() public {
    weilerAtherton.initPolygon(cropPolygon, weilerAtherton.cropPolygon);
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
    weilerAtherton.addPolygonSegments(weilerAtherton.basePolygon);
  }

  function addCropPolygonSegments() public {
    weilerAtherton.addPolygonSegments(weilerAtherton.cropPolygon);
  }

  function addAllPolygonsSegments() public {
    addBasePolygonSegments();
    addCropPolygonSegments();
  }
  
  function processBentleyOttman() public {
    weilerAtherton.processBentleyOttman();
  }

  function isBentleyOttmanFinished() public returns(bool) {
    return weilerAtherton.isBentleyOttmanFinished();
  }
  
  function addIntersectedPoints() public {
    weilerAtherton.addIntersectedPoints();
  }

  function buildResultPolygon() public {
    weilerAtherton.buildResultPolygon();
  }

  function getResultPolygonsCount() public returns(uint256) {
    return weilerAtherton.resultPolygons.length;
  }

  function getResultPolygonLength(uint256 polygonIndex) public returns(uint256) {
    return weilerAtherton.resultPolygons[polygonIndex].points.length;
  }

  function getResultPolygonPoint(uint256 polygonIndex, uint256 pointIndex) public returns(int256[2]) {
    return weilerAtherton.resultPolygons[polygonIndex].points[pointIndex];
  }

  function buildBasePolygonOutput() public {
    weilerAtherton.buildBasePolygonOutput();
  }

  function getBasePolygonOutputLength() public returns(uint256) {
    return weilerAtherton.basePolygonOutput.points.length;
  }

  function getBasePolygonOutputPoint(uint256 pointIndex) public returns(int256[2]) {
    return weilerAtherton.basePolygonOutput.points[pointIndex];
  }
  
  function processWeilerAtherton(){
    addIntersectedPoints();
    buildResultPolygon();
    buildBasePolygonOutput();
  }
  
  
}
