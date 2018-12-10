pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/WeilerAtherton.sol";

contract MockWeilerAtherton {
  using WeilerAtherton for WeilerAtherton.State;

  WeilerAtherton.State private weilerAtherton;
  
  constructor() public {
    weilerAtherton.initWeilerAtherton();
  }
  
  function addPointToSubjectPolygon(int256[2] point) public {
    weilerAtherton.martinezRueda.subject.points.push(point);
  }

  function addPointToClippingPolygon(int256[2] point) public {
    weilerAtherton.martinezRueda.clipping.points.push(point);
  }
  
  function initSubjectPolygon() public {
    weilerAtherton.initPolygon(weilerAtherton.martinezRueda.subject, weilerAtherton.subjectPolygon);
  }

  function initClippingPolygon() public {
    weilerAtherton.initPolygon(weilerAtherton.martinezRueda.clipping, weilerAtherton.clippingPolygon);
  }

  function initAllPolygons() public {
    initSubjectPolygon();
    initClippingPolygon();
  }

  function addSubjectPolygonSegments() public {
    weilerAtherton.prepareSubjectPolygon();
  }

  function addClippingPolygonSegments() public {
    weilerAtherton.prepareClippingPolygon();
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

  function buildSubjectPolygonOutput() public {
    weilerAtherton.buildSubjectPolygonOutput();
  }

  function getSubjectPolygonOutputLength() public returns(uint256) {
    return weilerAtherton.subjectPolygonOutput.points.length;
  }

  function getSubjectPolygonOutputPoint(uint256 pointIndex) public returns(int256[2]) {
    return weilerAtherton.subjectPolygonOutput.points[pointIndex];
  }
}
