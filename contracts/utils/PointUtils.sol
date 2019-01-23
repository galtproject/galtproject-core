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

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

library PointUtils {

  int256 internal constant EPS = 1000000000;

  function comparePoints(int[2] memory a, int[2] memory b) internal pure returns (int8) {
    if (a[0] - b[0] > EPS || (MathUtils.abs(a[0] - b[0]) < EPS && a[1] - b[1] > EPS)) {
      return 1;
    } else if (b[0] - a[0] > EPS || (MathUtils.abs(a[0] - b[0]) < EPS && b[1] - a[1] > EPS)) {
      return - 1;
    } else if (MathUtils.abs(a[0] - b[0]) < EPS && MathUtils.abs(a[1] - b[1]) < EPS) {
      return 0;
    }
  }

  function isEqual(int[2] memory a, int[2] memory b) internal pure returns (bool) {
    return a[0] == b[0] && a[1] == b[1];
  }

  function isEqualEPS(int[2] memory a, int[2] memory b) internal pure returns (bool) {
    return MathUtils.abs(a[0] - b[0]) < EPS && MathUtils.abs(a[1] - b[1]) < EPS;
  }
}
