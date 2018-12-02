pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/WeilerAtherton.sol";
import "../utils/PolygonUtils.sol";

contract MockWeilerAtherton {
  using WeilerAtherton for WeilerAtherton.State;

  WeilerAtherton.State private weilerAtherton;
  
  constructor() public {
    weilerAtherton.initWeilerAtherton();
  }
  
  function addPointToBasePolygon(int256[2] point) public {
    weilerAtherton.martinezRueda.subject.points.push(point);
  }

  function addPointToCropPolygon(int256[2] point) public {
    weilerAtherton.martinezRueda.clipping.points.push(point);
  }
  
  function initBasePolygon() public {
    weilerAtherton.initPolygon(weilerAtherton.martinezRueda.subject, weilerAtherton.basePolygon);
  }

  function initCropPolygon() public {
    weilerAtherton.initPolygon(weilerAtherton.martinezRueda.clipping, weilerAtherton.cropPolygon);
  }

  function initAllPolygons() public {
    initBasePolygon();
    initCropPolygon();
  }

  function addBasePolygonSegments() public {
    weilerAtherton.prepareBasePolygon();
  }

  function addCropPolygonSegments() public {
    weilerAtherton.prepareCropPolygon();
  }
  
  function processMartinezRueda() public {
    weilerAtherton.processMartinezRueda();
  }

  function isMartinezRuedaFinished() public returns(bool) {
    return weilerAtherton.isMartinezRuedaFinished();
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
}
