/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster),
 * [Valery Litvin](https://github.com/litvintech) by
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and
 * Galt•Space Society Construction and Terraforming Company by
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "../utils/LandUtils.sol";

contract IGeodesic {
  LandUtils.LatLonData private geodesicData;
  event ContourAreaCalculate(uint256[] contour, uint256 area);

  function cacheGeohashToLatLon(uint256 _geohash) public returns (int256[2]);

  function cacheGeohashListToLatLon(uint256[] _geohashList) public;

  function cacheGeohashToLatLonAndUtm(uint256 _geohash) public returns (int256[3]);

  function getCachedLatLonByGeohash(uint256 _geohash) public returns (int256[2]);

  function cacheLatLonToGeohash(int256[2] point, uint8 precision) public returns (uint256);

  function cacheLatLonListToGeohash(int256[2][] _pointList, uint8 precision) public;

  function getCachedGeohashByLatLon(int256[2] point, uint8 precision) public returns (uint256);

  function calculateContourArea(uint256[] contour) external returns (uint256 area);
}
