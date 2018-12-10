pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/LandUtils.sol";
import "../utils/PolygonUtils.sol";

contract MockPolygonUtils {
  event LogAreaResult(uint256 result);
  
  PolygonUtils.CoorsPolygon polygon;
  
  constructor() public {

  }
  
  function addPoint(int256[2] point) public {
    polygon.points.push(point);
  }
  
  function getArea() public returns(uint256 area) {
    area = PolygonUtils.ringArea(polygon);
    emit LogAreaResult(area);
  }
}
