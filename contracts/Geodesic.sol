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

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./traits/Initializable.sol";
import "./utils/LandUtils.sol";
import "./utils/GeohashUtils.sol";
import "./utils/PolygonUtils.sol";
import "./interfaces/IGeodesic.sol";

contract Geodesic is IGeodesic, Initializable, Ownable {
  using SafeMath for uint256;

  LandUtils.LatLonData private latLonData;
  event ContourAreaCalculate(uint256[] contour, uint256 area);

  function cacheGeohashToLatLon(uint256 _geohash) public returns (int256[2]) {
    latLonData.latLonByGeohash[_geohash] = LandUtils.geohash5ToLatLonArr(_geohash);
    bytes32 pointHash = keccak256(abi.encode(latLonData.latLonByGeohash[_geohash]));
    latLonData.geohashByLatLonHash[pointHash][GeohashUtils.geohash5Precision(_geohash)] = _geohash;
    return latLonData.latLonByGeohash[_geohash];
  }

  function cacheGeohashListToLatLon(uint256[] _geohashList) public {
    for (uint i = 0; i < _geohashList.length; i++) {
      cacheGeohashToLatLon(_geohashList[i]);
    }
  }

  function cacheGeohashToLatLonAndUtm(uint256 _geohash) public returns (int256[3]) {
    latLonData.latLonByGeohash[_geohash] = LandUtils.geohash5ToLatLonArr(_geohash);
    bytes32 pointHash = keccak256(abi.encode(latLonData.latLonByGeohash[_geohash]));
    latLonData.geohashByLatLonHash[pointHash][GeohashUtils.geohash5Precision(_geohash)] = _geohash;

    latLonData.utmByLatLonHash[pointHash] = LandUtils.latLonToUtmCompressed(latLonData.latLonByGeohash[_geohash][0], latLonData.latLonByGeohash[_geohash][1]);

    latLonData.utmByGeohash[_geohash] = latLonData.utmByLatLonHash[pointHash];

    return latLonData.utmByGeohash[_geohash];
  }

  function cacheGeohashListToLatLonAndUtm(uint256[] _geohashList) public {
    for (uint i = 0; i < _geohashList.length; i++) {
      cacheGeohashToLatLonAndUtm(_geohashList[i]);
    }
  }

  function getCachedLatLonByGeohash(uint256 _geohash) public returns (int256[2]) {
    return latLonData.latLonByGeohash[_geohash];
  }

  function cacheLatLonToGeohash(int256[2] point, uint8 precision) public returns (uint256) {
    bytes32 pointHash = keccak256(abi.encode(point));
    latLonData.geohashByLatLonHash[pointHash][precision] = LandUtils.latLonToGeohash5(point[0], point[1], precision);
    return latLonData.geohashByLatLonHash[pointHash][precision];
  }

  function cacheLatLonListToGeohash(int256[2][] _pointList, uint8 precision) public {
    for (uint i = 0; i < _pointList.length; i++) {
      cacheLatLonToGeohash(_pointList[i], precision);
    }
  }

  function getCachedGeohashByLatLon(int256[2] point, uint8 precision) public returns (uint256) {
    bytes32 pointHash = keccak256(abi.encode(point));
    return latLonData.geohashByLatLonHash[pointHash][precision];
  }

  function calculateContourArea(uint256[] contour) external returns (uint256 area) {
    PolygonUtils.UtmPolygon memory p;
    p.points = new int256[3][](contour.length);

    for (uint i = 0; i < contour.length; i++) {
      if (latLonData.utmByGeohash[contour[i]][0] != 0) {
        p.points[i] = latLonData.utmByGeohash[contour[i]];
      } else {
        p.points[i] = cacheGeohashToLatLonAndUtm(contour[i]);
      }
    }
    area = PolygonUtils.getUtmArea(p);
    emit ContourAreaCalculate(contour, area);
  }
}
