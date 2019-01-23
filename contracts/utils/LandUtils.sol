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

import "@galtproject/math/contracts/MathUtils.sol";
import "./GeohashUtils.sol";
import "@galtproject/math/contracts/TrigonometryUtils.sol";

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

  function latLonToUtmCompressed(int _lat, int _lon) public returns (int[3]) {
    (int x, int y, int scale, int latBand, int zone, bool isNorth) = latLonToUtm(_lat, _lon);

    return [x, y, scale + (zone * 1 ether * 10 ** 3) + (int(isNorth ? 1 : 0) * 1 ether * 10 ** 6) + (latBand * 1 ether * 10 ** 9)];
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
  int constant eccentricity = 81819190842621490;

  // UTM scale on the central meridian
  // latitude ± from equator
  // longitude ± from central meridian
  function latLonToUtm(int256 _lat, int256 _lon)
  public
  returns
  (
    int x,
    int y,
    int scale,
    int latBand,
    int zone,
    bool isNorth
  )
  {
    require(- 80 ether <= _lat && _lat <= 84 ether, "Outside UTM limits");

    int L0;
    (zone, L0, latBand) = getUTM_L0_zone(_lat, _lon);

    // note a is one-based array (6th order Krüger expressions)
    int[7] memory a = [int(0), 837731820624470, 760852777357, 1197645503, 2429171, 5712, 15];
    int[39] memory variables;

    //  variables[0] - F
    //  variables[1] - t
    //  variables[2] - o
    //  variables[3] - ti
    variables[0] = TrigonometryUtils.degreeToRad(_lat);
    variables[1] = TrigonometryUtils.tan(variables[0]);
    // t ≡ tanF, ti ≡ tanFʹ; prime (ʹ) indicates angles on the conformal sphere
    variables[14] = MathUtils.sqrt(1 ether + (variables[1] * variables[1]) / 1 ether);
    variables[2] = TrigonometryUtils.sinh((eccentricity * TrigonometryUtils.atanh((eccentricity * variables[1]) / variables[14])) / 1 ether);
    variables[3] = (variables[1] * MathUtils.sqrt(1 ether + (variables[2] * variables[2]) / 1 ether)) / 1 ether - (variables[2] * variables[14]) / 1 ether;

    //  variables[4] - tanL
    //  variables[5] - MathUtils.sqrt(((ti * ti) / 1 ether) + ((cosL * cosL) / 1 ether))
    //  variables[6] - Ei
    //  variables[7] - ni
    (variables[4], variables[6], variables[7], variables[5]) = getUTM_tanL_Ei_ni(_lon, L0, variables[3]);

    variables[15] = TrigonometryUtils.sin(2 * 1 * variables[6]);
    variables[16] = TrigonometryUtils.sin(2 * 2 * variables[6]);
    variables[17] = TrigonometryUtils.sin(2 * 3 * variables[6]);
    variables[18] = TrigonometryUtils.sin(2 * 4 * variables[6]);
    variables[19] = TrigonometryUtils.sin(2 * 5 * variables[6]);
    variables[20] = TrigonometryUtils.sin(2 * 6 * variables[6]);

    variables[21] = TrigonometryUtils.cosh(2 * 1 * variables[7]);
    variables[22] = TrigonometryUtils.cosh(2 * 2 * variables[7]);
    variables[23] = TrigonometryUtils.cosh(2 * 3 * variables[7]);
    variables[24] = TrigonometryUtils.cosh(2 * 4 * variables[7]);
    variables[25] = TrigonometryUtils.cosh(2 * 5 * variables[7]);
    variables[26] = TrigonometryUtils.cosh(2 * 6 * variables[7]);

    variables[27] = TrigonometryUtils.cos(2 * 1 * variables[6]);
    variables[28] = TrigonometryUtils.cos(2 * 2 * variables[6]);
    variables[29] = TrigonometryUtils.cos(2 * 3 * variables[6]);
    variables[30] = TrigonometryUtils.cos(2 * 4 * variables[6]);
    variables[31] = TrigonometryUtils.cos(2 * 5 * variables[6]);
    variables[32] = TrigonometryUtils.cos(2 * 6 * variables[6]);

    variables[33] = TrigonometryUtils.sinh(2 * 1 * variables[7]);
    variables[34] = TrigonometryUtils.sinh(2 * 2 * variables[7]);
    variables[35] = TrigonometryUtils.sinh(2 * 3 * variables[7]);
    variables[36] = TrigonometryUtils.sinh(2 * 4 * variables[7]);
    variables[37] = TrigonometryUtils.sinh(2 * 5 * variables[7]);
    variables[38] = TrigonometryUtils.sinh(2 * 6 * variables[7]);

    //  variables[8] - E
    /* solium-disable-next-line */
    variables[8] = variables[6]
    + (a[1] * (variables[15] * variables[21]) / 1 ether) / 1 ether
    + (a[2] * (variables[16] * variables[22]) / 1 ether) / 1 ether
    + (a[3] * (variables[17] * variables[23]) / 1 ether) / 1 ether
    + (a[4] * (variables[18] * variables[24]) / 1 ether) / 1 ether
    + (a[5] * (variables[19] * variables[25]) / 1 ether) / 1 ether
    /* solium-disable-next-line */
    + (a[6] * (variables[20] * variables[26]) / 1 ether) / 1 ether;

    //  variables[9] - n
    /* solium-disable-next-line */
    variables[9] = variables[7]
    + (a[1] * ((variables[27] * variables[33]) / 1 ether)) / 1 ether
    + (a[2] * ((variables[28] * variables[34]) / 1 ether)) / 1 ether
    + (a[3] * ((variables[29] * variables[35]) / 1 ether)) / 1 ether
    + (a[4] * ((variables[30] * variables[36]) / 1 ether)) / 1 ether
    + (a[5] * ((variables[31] * variables[37]) / 1 ether)) / 1 ether
    /* solium-disable-next-line */
    + (a[6] * ((variables[32] * variables[38]) / 1 ether)) / 1 ether;

    x = (((k0 * A) / 1 ether) * variables[9]) / 1 ether;
    y = (((k0 * A) / 1 ether) * variables[8]) / 1 ether;
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
    /* solium-disable-next-line */
    variables[10] = 1 ether
    + 2 * 1 * ((a[1] * (variables[27] * variables[21]) / 1 ether) / 1 ether)
    + 2 * 2 * ((a[2] * (variables[28] * variables[22]) / 1 ether) / 1 ether)
    + 2 * 3 * ((a[3] * (variables[29] * variables[23]) / 1 ether) / 1 ether)
    + 2 * 4 * ((a[4] * (variables[30] * variables[24]) / 1 ether) / 1 ether)
    + 2 * 5 * ((a[5] * (variables[31] * variables[25]) / 1 ether) / 1 ether)
    /* solium-disable-next-line */
    + 2 * 6 * ((a[6] * (variables[32] * variables[26]) / 1 ether) / 1 ether);

    /* solium-disable-next-line */
    variables[11] = 2 * 1 * ((a[1] * ((variables[15] * variables[33]) / 1 ether)) / 1 ether)
    + 2 * 2 * ((a[2] * ((variables[16] * variables[34]) / 1 ether)) / 1 ether)
    + 2 * 3 * ((a[3] * ((variables[17] * variables[35]) / 1 ether)) / 1 ether)
    + 2 * 4 * ((a[4] * ((variables[18] * variables[36]) / 1 ether)) / 1 ether)
    + 2 * 5 * ((a[5] * ((variables[19] * variables[37]) / 1 ether)) / 1 ether)
    /* solium-disable-next-line */
    + 2 * 6 * ((a[6] * ((variables[20] * variables[38]) / 1 ether)) / 1 ether);

    variables[12] = getUTM_V(variables[3], variables[4], variables[11], variables[10]);

    // ---- scale: Karney 2011 Eq 25

    //  variables[13] - k
    variables[13] = getUTM_k(variables[0], variables[14], variables[11], variables[10], variables[5]);

    //    convergence = MathUtils.toFixedInt(TrigonometryUtils.radToDegree(variables[12]), 9);
    scale = MathUtils.toFixedInt(variables[13], 12);

    isNorth = _lat >= 0;
    // hemisphere
  }

  // TrigonometryUtils.degreeToRad(6 ether)
  int constant sixDegreeRad = 104719755119659776;

  // TrigonometryUtils.degreeToRad(((zone - 1) * 6 ether) - 180 ether + 3 ether)
  //TODO: my be used for optimize gas. If not - delete this
  function L0byZone() public view returns (int[61]) {
    return [int(- 3193952531149623000), - 3089232776029963300, - 2984513020910303000, - 2879793265790643700, - 2775073510670984000, - 2670353755551324000, - 2565634000431664600, - 2460914245312004000, - 2356194490192345000, - 2251474735072684800, - 2146754979953025500, - 2042035224833365500, - 1937315469713705700, - 1832595714594046200, - 1727875959474386400, - 1623156204354726400, - 1518436449235066600, - 1413716694115406800, - 1308996938995747300, - 1204277183876087300, - 1099557428756427600, - 994837673636767700, - 890117918517108000, - 785398163397448300, - 680678408277788400, - 575958653158128800, - 471238898038469000, - 366519142918809200, - 261799387799149400, - 157079632679489660, - 52359877559829880, 52359877559829880, 157079632679489660, 261799387799149400, 366519142918809200, 471238898038469000, 575958653158128800, 680678408277788400, 785398163397448300, 890117918517108000, 994837673636767700, 1099557428756427600, 1204277183876087300, 1308996938995747300, 1413716694115406800, 1518436449235066600, 1623156204354726400, 1727875959474386400, 1832595714594046200, 1937315469713705700, 2042035224833365500, 2146754979953025500, 2251474735072684800, 2356194490192345000, 2460914245312004000, 2565634000431664600, 2670353755551324000, 2775073510670984000, 2879793265790643700, 2984513020910303000, 3089232776029963300];
  }

  function getUTM_L0_zone(int _lat, int _lon) public returns (int zone, int L0, int latBand) {
    zone = ((_lon + 180 ether) / 6 ether) + 1;
    // longitudinal zone
    L0 = TrigonometryUtils.degreeToRad(((zone - 1) * 6 ether) - 180 ether + 3 ether);
    // longitude of central meridian

    // ---- handle Norway/Svalbard exceptions
    // grid zones are 8° tall; 0°N is offset 10 into latitude bands array
    latBand = _lat / 8 ether + 10;

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

  function getUTM_tanL_Ei_ni(int _lon, int L0, int ti) public returns (int tanL, int Ei, int ni, int si) {
    int L = TrigonometryUtils.degreeToRad(_lon) - L0;
    int cosL = TrigonometryUtils.cos(L);
    tanL = TrigonometryUtils.tan(L);

    Ei = TrigonometryUtils.atan2(ti, cosL);
    si = MathUtils.sqrt(((ti * ti) / 1 ether) + ((cosL * cosL) / 1 ether));
    ni = TrigonometryUtils.asinh((TrigonometryUtils.sin(L) * 1 ether) / si);
  }

  function getUTM_V(int ti, int tanL, int qi, int pi) public returns (int) {
    return TrigonometryUtils.atan((((ti * 1 ether) / MathUtils.sqrt(1 ether + (ti * ti) / 1 ether)) * tanL) / 1 ether) + TrigonometryUtils.atan2(qi, pi);
  }

  function getUTM_k(int F, int st, int pi, int qi, int si) public returns (int) {
    int sinF = TrigonometryUtils.sin(F);
    return (k0 * (
    /* solium-disable-next-line */
    (((((MathUtils.sqrt(1 ether - (((eccentricity * eccentricity) / 1 ether) * ((sinF * sinF) / 1 ether)) / 1 ether) * st) / si) * A) / ellipsoidalA)
    * MathUtils.sqrt((pi * pi) / 1 ether + (qi * qi) / 1 ether)) / 1 ether
    )) / 1 ether;
  }
}
