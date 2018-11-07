pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "../utils/SegmentUtils.sol";

contract TestSegmentUtils {
  event BoolResult(bool result);
  event PointResult(int256[2] result);
  
  constructor() public {
    
  }

  function segmentsIntersect(int256[2][2] segment1, int256[2][2] segment2) public returns(bool) {
    bool result = SegmentUtils.segmentsIntersect(segment1, segment2);
    emit BoolResult(result);
    return result;
  }

  function findSegmentsIntersection(int256[2][2] segment1, int256[2][2] segment2) public returns(int256[2]) {
    int256[2] memory result = SegmentUtils.findSegmentsIntersection(segment1, segment2);
    emit PointResult(result);
    return result;
  }
}
