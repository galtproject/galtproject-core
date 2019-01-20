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
  
  event UtmPoint(int[3] point);
  event UtmDataToSave(int scale, int zone, int isNorth);
  
  function addPoint(int256[2] point) public {
    (int x, int y, int scale, int latBand, int zone, bool isNorth) = LandUtils.latLonToUtm(point[0], point[1]);

//    emit UtmDataToSave(scale, (zone * 1 ether * 1 szabo), int(isNorth ? 1 : 0) * 1 ether * 1 finney);
    
    polygon.points.push([x, y, scale + (zone * 1 ether * 10 ** 3) + (int(isNorth ? 1 : 0) * 1 ether * 10 ** 6)]);
    emit UtmPoint(polygon.points[polygon.points.length - 1]);
  }
  
  function getArea() public returns(uint256 area) {
    area = PolygonUtils.getUtmArea(polygon);
    emit LogAreaResult(area);
  }
}
