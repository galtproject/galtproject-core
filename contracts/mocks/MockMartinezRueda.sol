pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/MartinezRueda.sol";

contract MockMartinezRueda {
  using MartinezRueda for MartinezRueda.State;

  MartinezRueda.State private martinezRueda;
  
  event LogSetSegment(int256[2][2] firstItem);
  
  constructor() public {
    martinezRueda.initMartinezRueda();
  }
  
  function addPointToSubject(int256[2] point) public {
    martinezRueda.subject.points.push(point);
  }

  function addPointToClipping(int256[2] point) public {
    martinezRueda.clipping.points.push(point);
  }
  
  function processAllPolygons() public {
    martinezRueda.processAllPolygons();
  }

  function processSubjectPolygon() public {
    martinezRueda.processSubjectPolygon();
  }

  function processClippingPolygon() public {
    martinezRueda.processClippingPolygon();
  }

  function subdivideSegments() public {
    martinezRueda.subdivideSegments();
  }

  function isSubdivideSegmentsOver() public returns(bool) {
    return martinezRueda.isSubdivideSegmentsOver();
  }

  function getResultEventsLength() public view returns(uint256) {
    return martinezRueda.resultEvents.length;
  }

  function getResultResultEventPoint(uint256 eventIndex) public view returns(int256[2]) {
    return martinezRueda.store.sweepById[martinezRueda.resultEvents[eventIndex]].point;
  }

  function orderEvents() public {
    martinezRueda.orderEvents();
  }

//  function connectEdges() public {
//    martinezRueda.connectEdges();
//  }

  function getResultContoursLength() public view returns(uint256) {
    return martinezRueda.resultContours.length;
  }

  function getResultContourItemLength(uint256 contourIndex) public view returns(uint256) {
    return martinezRueda.resultContours[contourIndex].length;
  }
  
  function getResultContourPoint(uint256 contourIndex, uint256 pointIndex) public view returns(int256[2]) {
    return martinezRueda.resultContours[contourIndex][pointIndex];
  }
}
