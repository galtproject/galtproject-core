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

  function sqrtInt(int x) internal pure returns (int y) {
    int z = (x + 1) / 2;
    y = x;
    while (abs(z) < abs(y)) {
      y = z;
      z = (x / z + z) / 2;
    }
  }
  
  function floorInt(int x) internal pure returns (int) {
    return (x / 1 ether) * 1 ether;
  }
  
  function toFixedInt(int x, int precision) internal pure returns (int) {
    if(precision == 18) {
      return x;
    }
    return (x / (10 ** (18 - precision))) * (10 ** (18 - precision));
  }
}
