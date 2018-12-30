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
import "./TrigonometryUtils.sol";

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

library LandUtils {
  uint256 constant C1_GEOHASH = 31;
  uint256 constant C2_GEOHASH = 1023;
  uint256 constant C3_GEOHASH = 32767;
  uint256 constant C4_GEOHASH = 1048575;
  uint256 constant C5_GEOHASH = 33554431;
  uint256 constant C6_GEOHASH = 1073741823;
  uint256 constant C7_GEOHASH = 34359738367;
  uint256 constant C8_GEOHASH = 1099511627775;
  uint256 constant C9_GEOHASH = 35184372088831;
  uint256 constant C10_GEOHASH = 1125899906842623;
  uint256 constant C11_GEOHASH = 36028797018963967;
  uint256 constant C12_GEOHASH = 1152921504606846975;

  // bytes32("0123456789bcdefghjkmnpqrstuvwxyz")
  bytes32 constant GEOHASH5_MASK = 0x30313233343536373839626364656667686a6b6d6e707172737475767778797a;

  struct LatLonData {
    mapping(uint256 => int256[2]) latLonByGeohash;
    mapping(bytes32 => mapping(uint8 => uint256)) geohashByLatLonHash;
  }

  function geohash5Precision(uint256 _geohash5) public pure returns (uint256) {
    if (_geohash5 == 0) {
      return 0;
    } else if (_geohash5 <= C1_GEOHASH) {
      return 1;
    } else if (_geohash5 <= C2_GEOHASH) {
      return 2;
    } else if (_geohash5 <= C3_GEOHASH) {
      return 3;
    } else if (_geohash5 <= C4_GEOHASH) {
      return 4;
    } else if (_geohash5 <= C5_GEOHASH) {
      return 5;
    } else if (_geohash5 <= C6_GEOHASH) {
      return 6;
    } else if (_geohash5 <= C7_GEOHASH) {
      return 7;
    } else if (_geohash5 <= C8_GEOHASH) {
      return 8;
    } else if (_geohash5 <= C9_GEOHASH) {
      return 9;
    } else if (_geohash5 <= C10_GEOHASH) {
      return 10;
    } else if (_geohash5 <= C11_GEOHASH) {
      return 11;
    } else if (_geohash5 <= C12_GEOHASH) {
      return 12;
    } else {
      revert("Invalid geohash5");
    }
  }

  function workWithStorage() public pure returns (uint256) {
    return 1;
  }

  function incrementIntervalFirst(int256[2] interval) private pure returns (int256[2]) {
    return;
  }

  function convertIntervalSecond(int256[2] interval) private pure returns (int256[2]) {
    return;
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
    if (_geohash5 > C12_GEOHASH) {
      revert("Number exceeds the limit");
    }

    int256[2] memory lat_interval = [int256(- 90 ether), int256(90 ether)];
    int256[2] memory lon_interval = [int256(- 180 ether), int256(180 ether)];
    // int256 lat_err = 90 ether;
    // int256 lon_err = 180 ether;

    uint8[5] memory mask_arr = [16, 8, 4, 2, 1];

    bool is_even = true;

    uint256 capacity = geohash5Precision(_geohash5);
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

  function geohash5ToGeohashString(uint256 _input) public pure returns (bytes32) {
    if (_input > C12_GEOHASH) {
      revert("Number exceeds the limit");
      return 0x0;
    }

    uint256 num = _input;
    bytes32 output;
    bytes32 fiveOn = bytes32(31);
    uint8 counter = 0;

    while (num != 0) {
      output = output >> 8;
      uint256 d = uint256(bytes32(num) & fiveOn);
      output = output ^ (bytes1(GEOHASH5_MASK[d]));
      num = num >> 5;
      counter++;
    }

    return output;
  }

  // WGS 84: a = 6378137, b = 6356752.314245, f = 1/298.257223563;
  int constant ellipsoidalA = 6378137000000000000000000;
  int constant ellipsoidalB = 6356752314245000000000000;
  int constant ellipsoidalF = 3352810664747481;
  
  int constant falseEasting = 500000;
  int constant falseNorthing = 10000000;
  int constant k0 = 999600000000000000;
  // UTM scale on the central meridian
  
  function latLonToUtm(int256 _lat, int256 _lon) public returns (
    int zone, 
    string h,
    int x,
    int y, 
    int convergence, 
    int scale
  ) {
    require(-80 <= _lat && _lat <= 84, "Outside UTM limits");

    int zone = ((_lon + 180 ether) / 6 ether) + 1;
    // longitudinal zone
    int L0 = TrigonometryUtils.degreeToRad((zone - 1) * (6 - 180 + 3) * 1 ether);
    // longitude of central meridian

    // ---- handle Norway/Svalbard exceptions
    // grid zones are 8° tall; 0°N is offset 10 into latitude bands array
    int latBand = _lat / 8 ether + 10;
    // adjust zone & central meridian for Norway
    if (zone == 31 && latBand == 17 && _lon >= 3) {
      zone++;
      L0 += TrigonometryUtils.degreeToRad(6 ether); //TODO: move to constant
    }
    // adjust zone & central meridian for Svalbard
    if (zone == 32 && (latBand == 19 || latBand == 20) && _lon < 9) {
      zone--;
      L0 -= TrigonometryUtils.degreeToRad(6 ether);
    }
    if (zone == 32 && (latBand == 19 || latBand == 20) && _lon >= 9) {
      zone++;
      L0 += TrigonometryUtils.degreeToRad(6 ether);
    }
    if (zone == 34 && (latBand == 19 || latBand == 20) && _lon < 21) {
      zone--;
      L0 -= TrigonometryUtils.degreeToRad(6 ether);
    }
    if (zone == 34 && (latBand == 19 || latBand == 20) && _lon >= 21) {
      zone++;
      L0 += TrigonometryUtils.degreeToRad(6 ether);
    }
    if (zone == 36 && (latBand == 19 || latBand == 20) && _lon < 33) {
      zone--;
      L0 -= TrigonometryUtils.degreeToRad(6 ether);
    }
    if (zone == 36 && (latBand == 19 || latBand == 20) && _lon >= 33) {
      zone++;
      L0 += TrigonometryUtils.degreeToRad(6 ether);
    }

    // latitude ± from equator
    // longitude ± from central meridian

    // ---- easting, northing: Karney 2011 Eq 7-14, 29, 35:

    int e = MathUtils.sqrtInt(ellipsoidalF * (2 - ellipsoidalF)); //TODO: move to constant
    // eccentricity

    (int A, int[7] memory a) = getUTM_Aa(); // TODO: move to constant
    // compare Horner-form accuracy?

    int F = TrigonometryUtils.degreeToRad(_lat);
    int t = TrigonometryUtils.tan(F);
    // t ≡ tanF, ti ≡ tanFʹ; prime (ʹ) indicates angles on the conformal sphere
    int o = TrigonometryUtils.sinh(e * TrigonometryUtils.atanh(e * t / MathUtils.sqrtInt(1 + t * t)));

    int ti = t * MathUtils.sqrtInt(1 + o * o) - o * MathUtils.sqrtInt(1 + t * t);

    (int tanL, int cosL, int Ei, int ni) = getUTM_tanL_Ei_ni(_lon, L0, ti);
    
    int E = Ei;
    for (int j = 1; j <= 6; j++) {
      E += a[j] * TrigonometryUtils.sin(2 * j * Ei) * TrigonometryUtils.cosh(2 * j * ni);
    }

    int n = ni;
    for (int j = 1; j <= 6; j++) {
      n += a[j] * TrigonometryUtils.cos(2 * j * Ei) * TrigonometryUtils.sinh(2 * j * ni);
    }

    x = k0 * A * n;
    y = k0 * A * E;

    // ---- convergence: Karney 2011 Eq 23, 24

    int qi = getUTM_qi(a, Ei, ni);
    int pi = getUTM_pi(a, Ei, ni);
    int V = getUTM_V(ti, tanL, qi, pi);

    // ---- scale: Karney 2011 Eq 25

    int k = getUTM_k(_lat, e, t, ti, cosL, A, pi, qi);

    // ------------

    // shift x/y to false origins
    x = x + falseEasting;
    // make x relative to false easting
    if (y < 0) {
      y = y + falseNorthing;
      // make y in southern hemisphere relative to false northing
    }

    // round to reasonable precision
    x = MathUtils.toFixedInt(x, 6);
    // nm precision
    y = MathUtils.toFixedInt(y, 6);
    // nm precision
    convergence = MathUtils.toFixedInt(TrigonometryUtils.radToDegree(V), 9);
    scale = MathUtils.toFixedInt(k, 12);

    h = _lat >= 0 ? 'N' : 'S';
    // hemisphere

    return (zone, h, x, y, convergence, scale);
  }

  function getUTM_tanL_Ei_ni(int _lon, int L0, int ti) returns(int tanL, int cosL, int Ei, int ni) {
    int L = TrigonometryUtils.degreeToRad(_lon) - L0;
    cosL = TrigonometryUtils.cos(L);
    int sinL = TrigonometryUtils.sin(L);
    tanL = TrigonometryUtils.tan(L);

    Ei = TrigonometryUtils.atan2(ti, cosL);
    ni = TrigonometryUtils.asinh(sinL / MathUtils.sqrtInt(ti * ti + cosL * cosL));
  }
  
  function getUTM_Aa() returns(int A, int[7] a) {
    int n = ellipsoidalF / (2 - ellipsoidalF); //TODO: move to constant
    // 3rd flattening
    int n2 = n * n;
    int n3 = n * n2;
    int n4 = n * n3;
    int n5 = n * n4;
    int n6 = n * n5;

    A = ellipsoidalA / (1 + n) * (1 + 1 / 4 * n2 + 1 / 64 * n4 + 1 / 256 * n6);
    // 2πA is the circumference of a meridian

    a = [0, // note a is one-based array (6th order Krüger expressions)
      1 / 2 * n - 2 / 3 * n2 + 5 / 16 * n3 + 41 / 180 * n4 - 127 / 288 * n5 + 7891 / 37800 * n6,
      13 / 48 * n2 - 3 / 5 * n3 + 557 / 1440 * n4 + 281 / 630 * n5 - 1983433 / 1935360 * n6,
      61 / 240 * n3 - 103 / 140 * n4 + 15061 / 26880 * n5 + 167603 / 181440 * n6,
      49561 / 161280 * n4 - 179 / 168 * n5 + 6601661 / 7257600 * n6,
      34729 / 80640 * n5 - 3418889 / 1995840 * n6,
      212378941 / 319334400 * n6];
  }

  function getUTM_pi(int[7] memory a, int Ei, int ni) returns(int pi) {
    pi = 1;
    for (int j = 1; j <= 6; j++) {
      pi += 2 * j * a[j] * TrigonometryUtils.cos(2 * j * Ei) * TrigonometryUtils.cosh(2 * j * ni);
    }
  }

  function getUTM_qi(int[7] memory a, int Ei, int ni) returns(int qi) {
    qi = 1;
    for (int j = 1; j <= 6; j++) {
      qi += 2 * j * a[j] * TrigonometryUtils.sin(2 * j * Ei) * TrigonometryUtils.sinh(2 * j * ni);
    }
  }

  function getUTM_V(int ti, int tanL, int qi, int pi) returns(int) {
    int Vi = TrigonometryUtils.atan(ti / MathUtils.sqrtInt(1 + ti * ti) * tanL);
    int Vii = TrigonometryUtils.atan2(qi, pi);

    return Vi + Vii;
  }
  
  function getUTM_k(int F, int e, int t, int ti, int cosL, int A, int pi, int qi) returns(int) {
    int sinF = TrigonometryUtils.sin(F);
//    int ki = MathUtils.sqrtInt(1 - e * e * sinF * sinF) * MathUtils.sqrtInt(1 + t * t) / MathUtils.sqrtInt(ti * ti + cosL * cosL);
//    int kii = A / a * MathUtils.sqrtInt(pi * pi + qi * qi);

    return k0 
      * MathUtils.sqrtInt(1 - e * e * sinF * sinF) * MathUtils.sqrtInt(1 + t * t) / MathUtils.sqrtInt(ti * ti + cosL * cosL) 
      * A / ellipsoidalA * MathUtils.sqrtInt(pi * pi + qi * qi);
  }
}
