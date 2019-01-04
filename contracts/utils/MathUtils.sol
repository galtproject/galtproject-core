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
  int256 constant public longer_fixed_log_e_1_5 =    405465108108164381978013115464349137;
  int256 constant public longer_fixed_1 =            1000000000000000000000000000000000000;
  int256 constant public longer_fixed_log_e_10 =     2302585092994045684017991454684364208;

  int256 constant fixed_1 = 1000000000000000000;
  int256 constant fixed_e = 2718281828459045400;

  int256 constant ln_2 = 693147180559945300;
  int256 constant ln_10 = 2302585092994046000;
  
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

  function logE (int256 v) internal returns (int256) {
    int256 r = 0;
    while(v <= fixed_1 / 10) {
      v = v * 10;
      r -= longer_fixed_log_e_10;
    }
    while(v >= 10 * fixed_1) {
      v = v / 10;
      r += longer_fixed_log_e_10;
    }
    while(v < fixed_1) {
      v = v * fixed_e;
      r -= longer_fixed_1;
    }
    while(v > fixed_e) {
      v = v / fixed_e;
      r += longer_fixed_1;
    }
    if(v == fixed_1) {
      return round_off(r) / fixed_1;
    }
    if(v == fixed_e) {
      return fixed_1 + round_off(r) / fixed_1;
    }
    v *= fixed_1;
    v = v - 3 * longer_fixed_1 / 2;
    r = r + longer_fixed_log_e_1_5;
    int256 m = longer_fixed_1 * v / (v + 3 * longer_fixed_1);
    r = r + 2 * m;
    int256 m_2 = m * m / longer_fixed_1;
    uint8 i = 3;
    while(true) {
      m = m * m_2 / longer_fixed_1;
      r = r + 2 * m / int256(i);
      i += 2;
      if(i >= 3 + 2 * 18) 
        break;
    }
    return round_off(r) / fixed_1;
  }

  function logAny(int256 v, int256 base) internal returns (int256) {
    return (logE(v) * 1 ether) / logE(base);
  }

  function log2(int256 v) internal returns (int256) {
    return (logE(v) * 1 ether) / ln_2;
  }

  function log10(int256 v) internal returns (int256) {
    return (logE(v) * 1 ether) / ln_10;
  }

  function round_off(int256 v) public view returns (int256) {
    int8 sign = 1;
    if(v < 0) {
      sign = -1;
      v = 0 - v;
    }
    if(v % fixed_1 >= fixed_1 / 2) v = v + fixed_1 - v % fixed_1;
    return v * sign;
  }
}
