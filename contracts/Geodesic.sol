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
import "./utils/TrigonometryUtils.sol";
import "./utils/MathUtils.sol";
import "./utils/GeohashUtils.sol";
import "./utils/PolygonUtils.sol";
import "./interfaces/IGeodesic.sol";
import "./interfaces/IgaltMath.sol";

contract Geodesic is IGeodesic, Initializable, Ownable {
  using SafeMath for uint256;

  LandUtils.LatLonData private latLonData;
  event ContourAreaCalculate(uint256[] contour, uint256 area);

  IGaltMath public galtMath;

  function setGaltMath(IGaltMath _galtMath) public onlyOwner {
    galtMath = _galtMath;
  }

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

    latLonData.utmByLatLonHash[pointHash] = latLonToUtmCompressed(latLonData.latLonByGeohash[_geohash][0], latLonData.latLonByGeohash[_geohash][1]);

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
    variables[1] = galtMath.tan(variables[0], false);
    // t ≡ tanF, ti ≡ tanFʹ; prime (ʹ) indicates angles on the conformal sphere
    variables[14] = galtMath.sqrt(1 ether + (variables[1] * variables[1]) / 1 ether, false);
//    return;
    variables[2] = galtMath.sinh((eccentricity * galtMath.atanh((eccentricity * variables[1]) / variables[14], false)) / 1 ether, false);
    variables[3] = (variables[1] * galtMath.sqrt(1 ether + (variables[2] * variables[2]) / 1 ether, false)) / 1 ether - (variables[2] * variables[14]) / 1 ether;

    //  variables[4] - tanL
    //  variables[5] - galtMath.sqrt(((ti * ti) / 1 ether) + ((cosL * cosL) / 1 ether))
    //  variables[6] - Ei
    //  variables[7] - ni
    (variables[4], variables[6], variables[7], variables[5]) = getUTM_tanL_Ei_ni(_lon, L0, variables[3]);

    variables[15] = galtMath.sin(2 * 1 * variables[6], false);
    variables[16] = galtMath.sin(2 * 2 * variables[6], false);
    variables[17] = galtMath.sin(2 * 3 * variables[6], false);
    variables[18] = galtMath.sin(2 * 4 * variables[6], false);
    variables[19] = galtMath.sin(2 * 5 * variables[6], false);
    variables[20] = galtMath.sin(2 * 6 * variables[6], false);

    variables[21] = galtMath.cosh(2 * 1 * variables[7], false);
    variables[22] = galtMath.cosh(2 * 2 * variables[7], false);
    variables[23] = galtMath.cosh(2 * 3 * variables[7], false);
    variables[24] = galtMath.cosh(2 * 4 * variables[7], false);
    variables[25] = galtMath.cosh(2 * 5 * variables[7], false);
    variables[26] = galtMath.cosh(2 * 6 * variables[7], false);

    variables[27] = galtMath.cos(2 * 1 * variables[6], false);
    variables[28] = galtMath.cos(2 * 2 * variables[6], false);
    variables[29] = galtMath.cos(2 * 3 * variables[6], false);
    variables[30] = galtMath.cos(2 * 4 * variables[6], false);
    variables[31] = galtMath.cos(2 * 5 * variables[6], false);
    variables[32] = galtMath.cos(2 * 6 * variables[6], false);

    variables[33] = galtMath.sinh(2 * 1 * variables[7], false);
    variables[34] = galtMath.sinh(2 * 2 * variables[7], false);
    variables[35] = galtMath.sinh(2 * 3 * variables[7], false);
    variables[36] = galtMath.sinh(2 * 4 * variables[7], false);
    variables[37] = galtMath.sinh(2 * 5 * variables[7], false);
    variables[38] = galtMath.sinh(2 * 6 * variables[7], false);

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
    int cosL = galtMath.cos(L, false);
    tanL = galtMath.tan(L, false);

    Ei = galtMath.atan2(ti, cosL, false);
    si = galtMath.sqrt(((ti * ti) / 1 ether) + ((cosL * cosL) / 1 ether), false);
    ni = galtMath.asinh((galtMath.sin(L, false) * 1 ether) / si, false);
  }

  function getUTM_V(int ti, int tanL, int qi, int pi) public returns (int) {
    return galtMath.atan((((ti * 1 ether) / galtMath.sqrt(1 ether + (ti * ti) / 1 ether, false)) * tanL) / 1 ether, false) + galtMath.atan2(qi, pi, false);
  }

  function getUTM_k(int F, int st, int pi, int qi, int si) public returns (int) {
    int sinF = galtMath.sin(F, false);
    return (k0 * (
    /* solium-disable-next-line */
    (((((galtMath.sqrt(1 ether - (((eccentricity * eccentricity) / 1 ether) * ((sinF * sinF) / 1 ether)) / 1 ether, false) * st) / si) * A) / ellipsoidalA)
    * galtMath.sqrt((pi * pi) / 1 ether + (qi * qi) / 1 ether, false)) / 1 ether
    )) / 1 ether;
  }
}
