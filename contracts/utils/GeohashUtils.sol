library GeohashUtils {
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

  function geohash5Precision(uint256 _geohash5) internal pure returns (uint8) {
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
  
  function maxGeohashNumber() internal pure returns (uint256) {
    return C12_GEOHASH;
  }
}
