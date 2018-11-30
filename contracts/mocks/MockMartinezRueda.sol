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
    martinezRueda.subject.push(point);
  }

  function addPointToClipping(int256[2] point) public {
    martinezRueda.clipping.push(point);
  }
  
  function processAllPolygons() public {
    martinezRueda.processAllPolygons();
  }

  function subdivideSegments() public {
    martinezRueda.subdivideSegments();
  }

  function isSubdivideSegmentsOver() public returns(bool) {
    return martinezRueda.isSubdivideSegmentsOver();
  }

  function getResultContoursLength() public returns(uint256) {
    return martinezRueda.resultContours.length;
  }

  function getResultContourItemLength(uint256 contourIndex) public returns(uint256) {
    return martinezRueda.resultContours[contourIndex].length;
  }
  
  function getResultContourPoint(uint256 contourIndex, uint256 pointIndex) public returns(int256[2]) {
    return martinezRueda.resultContours[contourIndex][pointIndex];
  }
}
