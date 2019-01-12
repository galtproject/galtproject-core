pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/LandUtils.sol";
import "../utils/PolygonUtils.sol";

contract MockPolygonUtils {
  event LogAreaResult(uint256 result);
  
  PolygonUtils.UtmPolygon polygon;
  
  constructor() public {

  }
  
  function addPoint(int256[2] point) public {
    (int x, int y, int scale, int zone,) = LandUtils.latLonToUtm(point[0], point[1]);
    polygon.points.push([x, y, scale, zone]);
  }
  
  function getArea() public returns(uint256 area) {
    area = PolygonUtils.getUtmArea(polygon);
    emit LogAreaResult(area);
  }
}
