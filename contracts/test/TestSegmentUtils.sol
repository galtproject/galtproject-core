pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "../utils/SegmentUtils.sol";

contract TestSegmentUtils {
  constructor() public {
    
  }

  function segmentsIntersect(int256[2][2] segment1, int256[2][2] segment2) public returns(bool) {
    return SegmentUtils.segmentsIntersect(segment1, segment2);
  }
}
