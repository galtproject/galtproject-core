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

  function latLonToUtm(int256 _lat, int256 _lon) public returns (
    uint zone, 
    uint h,
    uint x,
    uint y, 
    uint datum, 
    uint convergence, 
    uint scale
  ) {
    require(-80 <= _lat && _lat <= 84, "Outside UTM limits");

    //    var falseEasting = 500e3, falseNorthing = 10000e3;

    uint zone = Math.floor((_lon + 180) / 6) + 1;
    // longitudinal zone
    uint L0 = ((zone - 1) * 6 - 180 + 3).toRadians();
    // longitude of central meridian

    // ---- handle Norway/Svalbard exceptions
    // grid zones are 8° tall; 0°N is offset 10 into latitude bands array
    uint latBand = Math.floor(_lat / 8 + 10);
    // adjust zone & central meridian for Norway
    if (zone == 31 && latBand == 17 && _lon >= 3) {
      zone++;
      L0 += (6).toRadians();
    }
    // adjust zone & central meridian for Svalbard
    if (zone == 32 && (latBand == 19 || latBand == 20) && _lon < 9) {
      zone--;
      L0 -= (6).toRadians();
    }
    if (zone == 32 && (latBand == 19 || latBand == 20) && _lon >= 9) {
      zone++;
      L0 += (6).toRadians();
    }
    if (zone == 34 && (latBand == 19 || latBand == 20) && _lon < 21) {
      zone--;
      L0 -= (6).toRadians();
    }
    if (zone == 34 && (latBand == 19 || latBand == 20) && _lon >= 21) {
      zone++;
      L0 += (6).toRadians();
    }
    if (zone == 36 && (latBand == 19 || latBand == 20) && _lon < 33) {
      zone--;
      L0 -= (6).toRadians();
    }
    if (zone == 36 && (latBand == 19 || latBand == 20) && _lon >= 33) {
      zone++;
      L0 += (6).toRadians();
    }

    uint F = _lat.toRadians();
    // latitude ± from equator
    uint L = _lon.toRadians() - L0;
    // longitude ± from central meridian

    uint a = this.datum.ellipsoid.a;
    uint f = this.datum.ellipsoid.f;
    // WGS 84: a = 6378137, b = 6356752.314245, f = 1/298.257223563;

    uint k0 = 0.9996;
    // UTM scale on the central meridian

    // ---- easting, northing: Karney 2011 Eq 7-14, 29, 35:

    uint e = Math.sqrt(f * (2 - f));
    // eccentricity
    uint n = f / (2 - f);
    // 3rd flattening
    uint n2 = n * n;
    uint n3 = n * n2;
    uint n4 = n * n3;
    uint n5 = n * n4;
    uint n6 = n * n5;
    // TODO: compare Horner-form accuracy?

    uint cosL = Math.cos(L);
    uint sinL = Math.sin(L);
    uint tanL = Math.tan(L);

    uint t = Math.tan(F);
    // t ≡ tanF, ti ≡ tanFʹ; prime (ʹ) indicates angles on the conformal sphere
    uint o = Math.sinh(e * Math.atanh(e * t / Math.sqrt(1 + t * t)));

    uint ti = t * Math.sqrt(1 + o * o) - o * Math.sqrt(1 + t * t);

    uint Ei = Math.atan2(ti, cosL);
    uint ni = Math.asinh(sinL / Math.sqrt(ti * ti + cosL * cosL));

    uint A = a / (1 + n) * (1 + 1 / 4 * n2 + 1 / 64 * n4 + 1 / 256 * n6);
    // 2πA is the circumference of a meridian

    uint a = [0, // note a is one-based array (6th order Krüger expressions)
    1 / 2 * n - 2 / 3 * n2 + 5 / 16 * n3 + 41 / 180 * n4 - 127 / 288 * n5 + 7891 / 37800 * n6,
    13 / 48 * n2 - 3 / 5 * n3 + 557 / 1440 * n4 + 281 / 630 * n5 - 1983433 / 1935360 * n6,
    61 / 240 * n3 - 103 / 140 * n4 + 15061 / 26880 * n5 + 167603 / 181440 * n6,
    49561 / 161280 * n4 - 179 / 168 * n5 + 6601661 / 7257600 * n6,
    34729 / 80640 * n5 - 3418889 / 1995840 * n6,
    212378941 / 319334400 * n6];

    uint E = Ei;
    for (uint j = 1; j <= 6; j++) {
      E += a[j] * Math.sin(2 * j * Ei) * Math.cosh(2 * j * ni);
    }

    uint n = ni;
    for (uint j = 1; j <= 6; j++) {
      n += a[j] * Math.cos(2 * j * Ei) * Math.sinh(2 * j * ni);
    }

    uint x = k0 * A * n;
    uint y = k0 * A * E;

    // ---- convergence: Karney 2011 Eq 23, 24

    uint pi = 1;
    for (uint j = 1; j <= 6; j++) {
      pi += 2 * j * a[j] * Math.cos(2 * j * Ei) * Math.cosh(2 * j * ni);
    }
    uint qi = 0;
    for (uint j = 1; j <= 6; j++) {
      qi += 2 * j * a[j] * Math.sin(2 * j * Ei) * Math.sinh(2 * j * ni);
    }

    uint Vi = Math.atan(ti / Math.sqrt(1 + ti * ti) * tanL);
    uint Vii = Math.atan2(qi, pi);

    uint V = Vi + Vii;

    // ---- scale: Karney 2011 Eq 25

    uint sinF = Math.sin(F);
    uint ki = Math.sqrt(1 - e * e * sinF * sinF) * Math.sqrt(1 + t * t) / Math.sqrt(ti * ti + cosL * cosL);
    uint kii = A / a * Math.sqrt(pi * pi + qi * qi);

    uint k = k0 * ki * kii;

    // ------------

    // shift x/y to false origins
    x = x + falseEasting;
    // make x relative to false easting
    if (y < 0) {
      y = y + falseNorthing;
      // make y in southern hemisphere relative to false northing
    }

    // round to reasonable precision
    x = Number(x.toFixed(6));
    // nm precision
    y = Number(y.toFixed(6));
    // nm precision
    uint convergence = Number(V.toDegrees().toFixed(9));
    uint scale = Number(k.toFixed(12));

    uint h = _lat >= 0 ? 'N' : 'S';
    // hemisphere

    return (zone, h, x, y, this.datum, convergence, scale);
  }
}
