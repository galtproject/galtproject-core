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

import "./MathUtils.sol";
import "./GeohashUtils.sol";
import "./TrigonometryUtils.sol";

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

library LandUtils {
  
  struct LatLonData {
    mapping(uint256 => int256[2]) latLonByGeohash;
    mapping(bytes32 => mapping(uint8 => uint256)) geohashByLatLonHash;
    
    mapping(uint256 => int256[3]) utmByGeohash;
    mapping(bytes32 => int256[3]) utmByLatLonHash;
  }
  
  function latLonIntervalToLatLon(
    int256[2] latInterval,
    int256[2] lonInterval
  )
  public
  pure
  returns (int256 lat, int256 lon)
  {
    lat = (latInterval[0] + latInterval[1]) / 2;
    lon = (lonInterval[0] + lonInterval[1]) / 2;
  }

  function geohash5ToLatLonArr(uint256 _geohash5) public pure returns (int256[2]) {
    (int256 lat, int256 lon) = geohash5ToLatLon(_geohash5);
    return [lat, lon];
  }

  /**
    Decode the geohash to its exact values, including the error
    margins of the result.  Returns four float values: latitude,
    longitude, the plus/minus error for latitude (as a positive
    number) and the plus/minus error for longitude (as a positive
    number).
  **/
  function geohash5ToLatLon(uint256 _geohash5) public pure returns (int256 lat, int256 lon) {
    if (_geohash5 > GeohashUtils.maxGeohashNumber()) {
      revert("Number exceeds the limit");
    }

    int256[2] memory lat_interval = [int256(- 90 ether), int256(90 ether)];
    int256[2] memory lon_interval = [int256(- 180 ether), int256(180 ether)];
    // int256 lat_err = 90 ether;
    // int256 lon_err = 180 ether;

    uint8[5] memory mask_arr = [16, 8, 4, 2, 1];

    bool is_even = true;

    uint256 capacity = GeohashUtils.geohash5Precision(_geohash5);
    uint256 num;
    uint256 cd;
    uint8 mask;

    while (capacity > 0) {
      capacity--;

      num = _geohash5 >> 5 * capacity;
      cd = uint256(bytes32(num) & bytes32(31));

      for (uint8 i = 0; i < mask_arr.length; i++) {
        mask = mask_arr[i];

        if (is_even) {
          // adds longitude info
          // lon_err /= 2;
          if (cd & mask != 0) {
            lon_interval[0] = (lon_interval[0] + lon_interval[1]) / 2;
          } else {
            lon_interval[1] = (lon_interval[0] + lon_interval[1]) / 2;
          }
        } else {
          // adds latitude info
          // lat_err /= 2;
          if (cd & mask != 0) {
            lat_interval[0] = (lat_interval[0] + lat_interval[1]) / 2;
          } else {
            lat_interval[1] = (lat_interval[0] + lat_interval[1]) / 2;
          }
        }

        is_even = !is_even;
      }
    }

    return latLonIntervalToLatLon(lat_interval, lon_interval);
  }

  function latLonToGeohash5(int256 _lat, int256 _lon, uint8 _precision) public returns (uint256) {
    int256[2] memory lat_interval = [int256(- 90 ether), int256(90 ether)];
    int256[2] memory lon_interval = [int256(- 180 ether), int256(180 ether)];

    uint8[5] memory bits = [16, 8, 4, 2, 1];

    uint8 bit = 0;
    uint8 ch = 0;

    int256 mid;
    bool even = true;

    uint256 geohash;
    uint8 precision = _precision;
    while (precision > 0) {
      if (even) {
        mid = (lon_interval[0] + lon_interval[1]) / 2;
        if (_lon > mid) {
          ch |= bits[bit];
          lon_interval[0] = mid;
        } else {
          lon_interval[1] = mid;
        }
      } else {
        mid = (lat_interval[0] + lat_interval[1]) / 2;
        if (_lat > mid) {
          ch |= bits[bit];
          lat_interval[0] = mid;
        } else {
          lat_interval[1] = mid;
        }
      }

      even = !even;

      if (bit < 4) {
        bit += 1;
      } else {
        precision -= 1;
        geohash += uint256(bytes32(ch) & bytes32(31)) << 5 * precision;
        bit = 0;
        ch = 0;
      }
    }
    return geohash;
  }
  
  function UtmUncompress(int[3] compressedUtm) internal returns (int x, int y, int scale, int latBand, int zone, int isNorth) {
    x = compressedUtm[0];
    y = compressedUtm[1];

    latBand = compressedUtm[2] / (1 ether * 10 ** 9);
    isNorth = compressedUtm[2] / (1 ether * 10 ** 6) - latBand * 10 ** 3;
    zone = compressedUtm[2] / (1 ether * 10 ** 3) - isNorth * 10 ** 3 - latBand * 10 ** 6;
    scale = compressedUtm[2] - (zone * 1 ether * 10 ** 3) - (isNorth * 1 ether * 10 ** 6) - (latBand * 1 ether * 10 ** 9);
  }
}
