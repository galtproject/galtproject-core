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

    function geohash5Precision(uint256 _geohash5) public pure returns (uint256) {
        if (_geohash5 == 0) {
            revert("Invalid geohash5");
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
        return [(interval[0] + interval[1]) / 2, interval[1]];
    }

    function convertIntervalSecond(int256[2] interval) private pure returns (int256[2]) {
        return [interval[0], (interval[0] + interval[1]) / 2];
    }

    function convertIntervalByCdAndMask(uint256 cd, uint8 mask, int256[2] interval) private pure returns (int256[2]) {
        if (cd & mask != 0) {
            return incrementIntervalFirst(interval);
        } else {
            return convertIntervalSecond(interval);
        }
    }

    function latLonIntervalToLatLon(int256[2] latInterval, int256[2] lonInterval) public pure returns (int256 lat, int256 lon) {
        int256 lat = (latInterval[0] + latInterval[1]) / 2;
        int256 lon = (lonInterval[0] + lonInterval[1]) / 2;
        return (lat, lon);
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

        bytes32 fiveOn = bytes32(31);

        int256[2] memory lat_interval = [int256(- 90 ether), int256(90 ether)];
        int256[2] memory lon_interval = [int256(- 180 ether), int256(180 ether)];
        // int256 lat_err = 90 ether;
        // int256 lon_err = 180 ether;

        uint8[5] memory mask_arr = [16, 8, 4, 2, 1];

        bool is_even = true;

        uint256 capacity = geohash5Precision(_geohash5);

        while (capacity > 0) {
            capacity--;

            uint256 num = _geohash5 >> 5 * capacity;
            uint256 cd = uint256(bytes32(num) & fiveOn);

            for (uint8 i = 0; i < mask_arr.length; i++) {
                uint8 mask = mask_arr[i];

                if (is_even) {
                    // adds longitude info
                    // lon_err /= 2;
                    lon_interval = convertIntervalByCdAndMask(cd, mask, lon_interval);
                } else {
                    // adds latitude info
                    // lat_err /= 2;
                    lat_interval = convertIntervalByCdAndMask(cd, mask, lat_interval);
                }

                is_even = !is_even;
            }
        }

        return latLonIntervalToLatLon(lat_interval, lon_interval);
    }
}
