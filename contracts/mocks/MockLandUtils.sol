pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/LandUtils.sol";

contract MockLandUtils {
  event LogPointResult(int256[2] result);
  event LogGeohash5Result(uint256 result);
  
  constructor() public {

  }
  
  function geohash5ToLatLonArr(uint256 geohash) public returns(int256[2] point) {
    point = LandUtils.geohash5ToLatLonArr(geohash);
    emit LogPointResult(point);
  }

  function latLonToGeohash5(int256[2] point, uint8 precision) public returns(uint256 geohash5) {
    geohash5 = LandUtils.latLonToGeohash5(point[0], point[1], precision);
    emit LogGeohash5Result(geohash5);
  }

  event ResultUtm(int x, int y, int scale, int latBand, int zone, bool isNorth);
  function latLonToUtm(int256[2] point) public returns(uint256 geohash5) {
    (int x, int y, int scale, int latBand, int zone, bool isNorth) = LandUtils.latLonToUtm(point[0], point[1]);
    emit ResultUtm(x, y, scale, latBand, zone, isNorth);
  }
}
