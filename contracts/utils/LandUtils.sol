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
  
  int constant falseEasting = 500000 ether;
  int constant falseNorthing = 10000000 ether;
  int constant k0 = 999600000000000000;

  // 2πA is the circumference of a meridian
  int constant A = 6367449145823415000000000;
  // eccentricity
  int constant e = 81819190842621490;
  
  // UTM scale on the central meridian
  // latitude ± from equator
  // longitude ± from central meridian
  event ResultUtm(int x, int y);
  event LogVar(string s, int v);
  function latLonToUtm(int256 _lat, int256 _lon) public returns (
    int x,
    int y,
    int scale,
    int zone, 
    bool isNorth,
    int convergence
  ) {
    require(-80 ether <= _lat && _lat <= 84 ether, "Outside UTM limits");

    int L0;
    (zone, L0) = getUTM_L0_zone(_lat, _lon);
    
    // note a is one-based array (6th order Krüger expressions)
    int[7] memory a = [int(0), 837731820624470, 760852777357, 1197645503, 2429171, 5712, 15];
    int[14] memory variables;
    
    //  variables[0] - F
    //  variables[1] - t
    //  variables[2] - o
    //  variables[3] - ti
    variables[0] = TrigonometryUtils.degreeToRad(_lat);
    variables[1] = TrigonometryUtils.tan(variables[0]);
    // t ≡ tanF, ti ≡ tanFʹ; prime (ʹ) indicates angles on the conformal sphere
    variables[2] = TrigonometryUtils.sinh((e * TrigonometryUtils.atanh((e * variables[1]) / MathUtils.sqrtInt(1 ether + (variables[1] * variables[1]) / 1 ether))) / 1 ether);
    variables[3] = (variables[1] * MathUtils.sqrtInt(1 ether + (variables[2] * variables[2]) / 1 ether)) / 1 ether - (variables[2] * MathUtils.sqrtInt(1 ether + (variables[1] * variables[1]) / 1 ether)) / 1 ether;

    //  variables[4] - tanL
    //  variables[5] - cosL
    //  variables[6] - Ei
    //  variables[7] - ni
    (variables[4], variables[5], variables[6], variables[7]) = getUTM_tanL_Ei_ni(_lon, L0, variables[3]);
//    emit LogVar("Ei", variables[6]);
//    emit LogVar("ni", variables[7]);

    //  variables[8] - E
    variables[8] = variables[6];
    for (int j = 1; j <= 6; j++) {
      variables[8] += (a[uint(j)] * (TrigonometryUtils.sin(2 * j * variables[6]) * TrigonometryUtils.cosh(2 * j * variables[7])) / 1 ether) / 1 ether;
    }
//    emit LogVar("E", variables[8]);

    //  variables[9] - n
    variables[9] = variables[7];
    for (int j = 1; j <= 6; j++) {
      variables[9] += (a[uint(j)] * ((TrigonometryUtils.cos(2 * j * variables[6]) * TrigonometryUtils.sinh(2 * j * variables[7])) / 1 ether)) / 1 ether;
    }
//    emit LogVar("n", variables[9]);

    x = (((k0 * A) / 1 ether) * variables[9]) / 1 ether;
    y = (((k0 * A) / 1 ether) * variables[8]) / 1 ether;
//    emit LogVar("x", x);
//    emit LogVar("y", y);
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

    // ---- convergence: Karney 2011 Eq 23, 24

    //  variables[10] - pi
    //  variables[11] - qi
    //  variables[12] - V
    variables[10] = getUTM_pi(a, variables[6], variables[7]);
    variables[11] = getUTM_qi(a, variables[6], variables[7]);
    variables[12] = getUTM_V(variables[3], variables[4], variables[11], variables[10]);
    emit LogVar("pi", variables[10]);
    emit LogVar("qi", variables[11]);
    emit LogVar("V", variables[12]);

    // ---- scale: Karney 2011 Eq 25

    //  variables[13] - k
    variables[13] = getUTM_k(variables[0], variables[1], variables[3], variables[5], variables[11], variables[10]);
    emit LogVar("k", variables[13]);

    convergence = MathUtils.toFixedInt(TrigonometryUtils.radToDegree(variables[12]), 9);
    scale = MathUtils.toFixedInt(variables[13], 12);

    isNorth = _lat >= 0;
    // hemisphere
  }  
  
  // TrigonometryUtils.degreeToRad(6 ether)
  int constant sixDegreeRad = 104719755119659776;
  
  // TrigonometryUtils.degreeToRad(((zone - 1) * 6 ether) - 180 ether + 3 ether)
  //TODO: my be used for optimize gas
  function L0byZone() public view returns(int[61]) {
    return [int(-3193952531149623000), -3089232776029963300, -2984513020910303000, -2879793265790643700, -2775073510670984000, -2670353755551324000, -2565634000431664600, -2460914245312004000, -2356194490192345000, -2251474735072684800, -2146754979953025500, -2042035224833365500, -1937315469713705700, -1832595714594046200, -1727875959474386400, -1623156204354726400, -1518436449235066600, -1413716694115406800, -1308996938995747300, -1204277183876087300, -1099557428756427600, -994837673636767700, -890117918517108000, -785398163397448300, -680678408277788400, -575958653158128800, -471238898038469000, -366519142918809200, -261799387799149400, -157079632679489660, -52359877559829880, 52359877559829880, 157079632679489660, 261799387799149400, 366519142918809200, 471238898038469000, 575958653158128800, 680678408277788400, 785398163397448300, 890117918517108000, 994837673636767700, 1099557428756427600, 1204277183876087300, 1308996938995747300, 1413716694115406800, 1518436449235066600, 1623156204354726400, 1727875959474386400, 1832595714594046200, 1937315469713705700, 2042035224833365500, 2146754979953025500, 2251474735072684800, 2356194490192345000, 2460914245312004000, 2565634000431664600, 2670353755551324000, 2775073510670984000, 2879793265790643700, 2984513020910303000, 3089232776029963300];
  }
  
  function getUTM_L0_zone(int _lat, int _lon) public returns(int zone, int L0) {
    zone = ((_lon + 180 ether) / 6 ether) + 1;
    // longitudinal zone
    L0 = TrigonometryUtils.degreeToRad(((zone - 1) * 6 ether) - 180 ether + 3 ether);
    // longitude of central meridian

    // ---- handle Norway/Svalbard exceptions
    // grid zones are 8° tall; 0°N is offset 10 into latitude bands array
    int latBand = _lat / 8 ether + 10;

//    emit LogVar("", TrigonometryUtils.degreeToRad(6 ether));
    // adjust zone & central meridian for Norway
    if (zone == 31 && latBand == 17 && _lon >= 3) {
      zone++;
      L0 += sixDegreeRad;
    }
    // adjust zone & central meridian for Svalbard
    if (zone == 32 && (latBand == 19 || latBand == 20) && _lon < 9 ether) {
      zone--;
      L0 -= sixDegreeRad;
    }
    if (zone == 32 && (latBand == 19 || latBand == 20) && _lon >= 9 ether) {
      zone++;
      L0 += sixDegreeRad;
    }
    if (zone == 34 && (latBand == 19 || latBand == 20) && _lon < 21 ether) {
      zone--;
      L0 -= sixDegreeRad;
    }
    if (zone == 34 && (latBand == 19 || latBand == 20) && _lon >= 21 ether) {
      zone++;
      L0 += sixDegreeRad;
    }
    if (zone == 36 && (latBand == 19 || latBand == 20) && _lon < 33 ether) {
      zone--;
      L0 -= sixDegreeRad;
    }
    if (zone == 36 && (latBand == 19 || latBand == 20) && _lon >= 33 ether) {
      zone++;
      L0 += sixDegreeRad;
    }
  }
//
  
  function getUTM_tanL_Ei_ni(int _lon, int L0, int ti) public returns(int tanL, int cosL, int Ei, int ni) {
    int L = TrigonometryUtils.degreeToRad(_lon) - L0;
    cosL = TrigonometryUtils.cos(L);
    tanL = TrigonometryUtils.tan(L);

    Ei = TrigonometryUtils.atan2(ti, cosL);
    ni = TrigonometryUtils.asinh((TrigonometryUtils.sin(L) * 1 ether) / MathUtils.sqrtInt(((ti * ti) / 1 ether) + ((cosL * cosL) / 1 ether)));
  }
  
  function getUTM_pi(int[7] memory a, int Ei, int ni) public returns(int) {
    return 1 ether 
      + 2 * 1 * ((a[1] * (TrigonometryUtils.cos(2 * 1 * Ei) * TrigonometryUtils.cosh(2 * 1 * ni)) / 1 ether) / 1 ether)
      + 2 * 2 * ((a[2] * (TrigonometryUtils.cos(2 * 2 * Ei) * TrigonometryUtils.cosh(2 * 2 * ni)) / 1 ether) / 1 ether)
      + 2 * 3 * ((a[3] * (TrigonometryUtils.cos(2 * 3 * Ei) * TrigonometryUtils.cosh(2 * 3 * ni)) / 1 ether) / 1 ether)
      + 2 * 4 * ((a[4] * (TrigonometryUtils.cos(2 * 4 * Ei) * TrigonometryUtils.cosh(2 * 4 * ni)) / 1 ether) / 1 ether)
      + 2 * 5 * ((a[5] * (TrigonometryUtils.cos(2 * 5 * Ei) * TrigonometryUtils.cosh(2 * 5 * ni)) / 1 ether) / 1 ether)
      + 2 * 6 * ((a[6] * (TrigonometryUtils.cos(2 * 6 * Ei) * TrigonometryUtils.cosh(2 * 6 * ni)) / 1 ether) / 1 ether);
//    for (int j = 1; j <= 6; j++) {
//      pi += 2 * j * ((a[uint(j)] * (TrigonometryUtils.cos(2 * j * Ei) * TrigonometryUtils.cosh(2 * j * ni)) / 1 ether) / 1 ether);
//    }
  }

  function getUTM_qi(int[7] memory a, int Ei, int ni) public returns(int) {
    return 2 * 1 * ((a[1] * ((TrigonometryUtils.sin(2 * 1 * Ei) * TrigonometryUtils.sinh(2 * 1 * ni)) / 1 ether)) / 1 ether)
       + 2 * 2 * ((a[2] * ((TrigonometryUtils.sin(2 * 2 * Ei) * TrigonometryUtils.sinh(2 * 2 * ni)) / 1 ether)) / 1 ether)
       + 2 * 3 * ((a[3] * ((TrigonometryUtils.sin(2 * 3 * Ei) * TrigonometryUtils.sinh(2 * 3 * ni)) / 1 ether)) / 1 ether)
       + 2 * 4 * ((a[4] * ((TrigonometryUtils.sin(2 * 4 * Ei) * TrigonometryUtils.sinh(2 * 4 * ni)) / 1 ether)) / 1 ether)
       + 2 * 5 * ((a[5] * ((TrigonometryUtils.sin(2 * 5 * Ei) * TrigonometryUtils.sinh(2 * 5 * ni)) / 1 ether)) / 1 ether)
       + 2 * 6 * ((a[6] * ((TrigonometryUtils.sin(2 * 6 * Ei) * TrigonometryUtils.sinh(2 * 6 * ni)) / 1 ether)) / 1 ether);
//    for (int j = 1; j <= 6; j++) {
//      qi += 2 * j * ((a[uint(j)] * ((TrigonometryUtils.sin(2 * j * Ei) * TrigonometryUtils.sinh(2 * j * ni)) / 1 ether)) / 1 ether);
//    }
  }
  
  function getUTM_V(int ti, int tanL, int qi, int pi) public returns(int) {
    return TrigonometryUtils.atan((((ti * 1 ether) / MathUtils.sqrtInt(1 ether + (ti * ti) / 1 ether)) * tanL) / 1 ether) + TrigonometryUtils.atan2(qi, pi);
  }

  function getUTM_k(int F, int t, int ti, int cosL, int pi, int qi) public returns(int) {
    int sinF = TrigonometryUtils.sin(F);
    return (k0 * (
      (((((MathUtils.sqrtInt(1 ether - (((e * e) / 1 ether) * ((sinF * sinF) / 1 ether)) / 1 ether) * MathUtils.sqrtInt(1 ether + (t * t) / 1 ether)) / MathUtils.sqrtInt((ti * ti) / 1 ether + (cosL * cosL) / 1 ether)) * A) / ellipsoidalA) 
      * MathUtils.sqrtInt((pi * pi) / 1 ether + (qi * qi) / 1 ether)) / 1 ether
    )) / 1 ether;
  }
}
