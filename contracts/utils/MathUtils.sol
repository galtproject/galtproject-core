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

library MathUtils {
  function INT256_MIN() internal pure returns (int256) {
    return int256((uint256(1) << 255));
  }

  function INT256_MAX() internal pure returns (int256) {
    return int256(~((uint256(1) << 255)));
  }

  function UINT256_MIN() internal pure returns (uint256) {
    return 0;
  }

  function UINT256_MAX() internal pure returns (uint256) {
    return ~uint256(0);
  }

  function EPS() internal pure returns (int256) {
    return 1000000000;
    //    return 0;
  }

  function abs(int number) internal pure returns (int) {
    return number > 0 ? number : number * (- 1);
  }

  function between(int a, int b, int c) internal pure returns (bool) {
    return (a - EPS() <= b) && (b <= c + EPS());
  }

  function minInt(int a, int b) internal pure returns (int) {
    return a < b ? a : b;
  }

  function maxInt(int a, int b) internal pure returns (int) {
    return a > b ? a : b;
  }

  function sqrtInt(int x) internal view returns (int y) {
    int z = (x + 1) / 2;
    y = x;
    while (abs(z) < abs(y)) {
      y = z;
      z = (x / z + z) / 2;
    }
    y *= 10 ** 9;
  }
  
  function floorInt(int x) internal view returns (int) {
    return (x / 1 ether) * 1 ether;
  }
  
  function toFixedInt(int x, int precision) internal view returns (int) {
    if(precision == 18) {
      return x;
    }
    return (x / int(uint(10) ** uint(18 - precision))) * int(uint(10) ** uint(18 - precision));
  }
  
  uint256 constant private MAX_UINT256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

  /**
     * 2^127.
     */
  uint128 internal constant TWO127 = 0x80000000000000000000000000000000;

  /**
   * 2^128 - 1.
   */
  uint128 internal constant TWO128_1 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

  /**
   * 2^128.
   */
  uint256 internal constant TWO128 = 0x100000000000000000000000000000000;

  /**
   * 2^256 - 1.
   */
  uint256 internal constant TWO256_1 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

  /**
   * 2^255.
   */
  uint256 internal constant TWO255 = 0x8000000000000000000000000000000000000000000000000000000000000000;

  /**
   * -2^255.
   */
  int256 internal constant MINUS_TWO255 = -0x8000000000000000000000000000000000000000000000000000000000000000;

  /**
   * 2^255 - 1.
   */
  int256 internal constant TWO255_1 = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

  /**
   * ln(2) * 2^128.
   */
  uint128 internal constant LN2 = 0xb17217f7d1cf79abc9e3b39803f2f6af;

  /**
   * Return index of most significant non-zero bit in given non-zero 256-bit
   * unsigned integer value.
   *
   * @param x value to get index of most significant non-zero bit in
   * @return index of most significant non-zero bit in given number
   */
  function mostSignificantBit (uint256 x) view internal returns (uint8) {
    require (x > 0);

    uint8 l = 0;
    uint8 h = 255;

    while (h > l) {
      uint8 m = uint8 ((uint16 (l) + uint16 (h)) >> 1);
      uint256 t = x >> m;
      if (t == 0) h = m - 1;
      else if (t > 1) l = m + 1;
      else return m;
    }

    return h;
  }

  /**
   * Calculate log_2 (x / 2^128) * 2^128.
   *
   * @param x parameter value
   * @return log_2 (x / 2^128) * 2^128
   */
  function log_2 (uint256 x) view internal returns (int256) {
    require (x > 0);

    uint8 msb = mostSignificantBit (x);

    if (msb > 128) x >>= msb - 128;
    else if (msb < 128) x <<= 128 - msb;

    x &= TWO128_1;

    int256 result = (int256 (msb) - 128) << 128; // Integer part of log_2

    int256 bit = TWO127;
    for (uint8 i = 0; i < 128 && x > 0; i++) {
      x = (x << 1) + ((x * x + TWO127) >> 128);
      if (x > TWO128_1) {
        result |= bit;
        x = (x >> 1) - TWO127;
      }
      bit >>= 1;
    }

    return result;
  }

  event LnLog(string v, uint256 a);
  /**
   * Calculate ln (x / 2^128) * 2^128.
   *
   * @param x parameter value
   * @return ln (x / 2^128) * 2^128
   */
  function ln (uint256 x) internal returns (int256) {
    require (x > 0);

    emit LnLog("input", x);
    
    int256 l2 = log_2 (x);
    if (l2 == 0) return 0;
    else {
      uint256 al2 = uint256 (l2 > 0 ? l2 : -l2);
      uint8 msb = mostSignificantBit (al2);
      if (msb > 127) al2 >>= msb - 127;
      al2 = (al2 * LN2 + TWO127) >> 128;
      if (msb > 127) al2 <<= msb - 127;

      emit LnLog("output", uint256(l2 >= 0 ? al2 : -al2));
      emit LnLog("output << 128", uint256(l2 >= 0 ? al2 : -al2) << 128);
      emit LnLog("output >> 128", uint256(l2 >= 0 ? al2 : -al2) >> 128);
      emit LnLog("fpMul(1, output)", fpMul(1, uint256(l2 >= 0 ? al2 : -al2)));
      return int256 (l2 >= 0 ? al2 : -al2);
    }
  }

  /**
   * Calculate x * y / 2^128.
   *
   * @param x parameter x
   * @param y parameter y
   * @return x * y / 2^128
   */
  function fpMul (uint256 x, uint256 y) view internal returns (uint256) {
    uint256 xh = x >> 128;
    uint256 xl = x & TWO128_1;
    uint256 yh = y >> 128;
    uint256 yl = y & TWO128_1;

    uint256 result = xh * yh;
    require (result <= TWO128_1);
    result <<= 128;

    result = safeAdd (result, xh * yl);
    result = safeAdd (result, xl * yh);
    result = safeAdd (result, (xl * yl) >> 128);

    return result;
  }

  /**
   * Calculate x * y.
   *
   * @param x parameter x
   * @param y parameter y
   * @return high and low words of x * y
   */
  function longMul (uint256 x, uint256 y)
  view internal returns (uint256 h, uint256 l) {
    uint256 xh = x >> 128;
    uint256 xl = x & TWO128_1;
    uint256 yh = y >> 128;
    uint256 yl = y & TWO128_1;

    h = xh * yh;
    l = xl * yl;

    uint256 m1 = xh * yl;
    uint256 m2 = xl * yh;

    h += m1 >> 128;
    h += m2 >> 128;

    m1 <<= 128;
    m2 <<= 128;

    if (l > TWO256_1 - m1) h += 1;
    l += m1;

    if (l > TWO256_1 - m2) h += 1;
    l += m2;
  }

  /**
   * Calculate x * y / 2^128.
   *
   * @param x parameter x
   * @param y parameter y
   * @return x * y / 2^128
   */
  function fpMulI (int256 x, int256 y) view internal returns (int256) {
    bool negative = (x ^ y) < 0; // Whether result is negative

    uint256 result = fpMul (
      x < 0 ? uint256 (-1 - x) + 1 : uint256 (x),
      y < 0 ? uint256 (-1 - y) + 1 : uint256 (y));

    if (negative) {
      require (result <= TWO255);
      return result == 0 ? 0 : -1 - int256 (result - 1);
    } else {
      require (result < TWO255);
      return int256 (result);
    }
  }
  
  /**
     * Add two uint256 values, throw in case of overflow.
     *
     * @param x first value to add
     * @param y second value to add
     * @return x + y
     */
  function safeAdd (uint256 x, uint256 y) constant internal returns (uint256 z) {
    assert (x <= MAX_UINT256 - y);
    return x + y;
  }

  /**
   * Calculate x + y, throw in case of over-/underflow.
   *
   * @param x parameter x
   * @param y parameter y
   * @return x + y
   */
  function safeAddI (int256 x, int256 y) view internal returns (int256) {
    if (x < 0 && y < 0)
      assert (x >= MINUS_TWO255 - y);

    if (x > 0 && y > 0)
      assert (x <= TWO255_1 - y);

    return x + y;
  }

  /**
   * Calculate x / y * 2^128.
   *
   * @param x parameter x
   * @param y parameter y
   * @return  x / y * 2^128
   */
  function fpDiv (uint256 x, uint256 y) view internal returns (uint256) {
    require (y > 0, "Division by zero is forbidden"); // Division by zero is forbidden

    uint8 maxShiftY = mostSignificantBit (y);
    if (maxShiftY >= 128) maxShiftY -= 127;
    else maxShiftY = 0;

    uint256 result = 0;

    while (true) {
      uint256 rh = x >> 128;
      uint256 rl = x << 128;

      uint256 ph;
      uint256 pl;

      (ph, pl) = longMul (result, y);
      if (rl < pl) {
        ph = safeAdd (ph, 1);
      }

      rl -= pl;
      rh -= ph;

      if (rh == 0) {
        result = safeAdd (result, rl / y);
        break;
      } else {
        uint256 reminder = (rh << 128) + (rl >> 128);

        // How many bits to shift reminder left
        uint8 shiftReminder = 255 - mostSignificantBit (reminder);
        if (shiftReminder > 128) shiftReminder = 128;

        // How many bits to shift result left
        uint8 shiftResult = 128 - shiftReminder;

        // How many bits to shift Y right
        uint8 shiftY = maxShiftY;
        if (shiftY > shiftResult) shiftY = shiftResult;

        shiftResult -= shiftY;

        uint256 r = (reminder << shiftReminder) / (((y - 1) >> shiftY) + 1);

        uint8 msbR = mostSignificantBit (r);
        require (msbR <= 255 - shiftResult, "msbR <= 255 - shiftResult");

        result = safeAdd (result, r << shiftResult);
      }
    }

    return result;
  }
}
