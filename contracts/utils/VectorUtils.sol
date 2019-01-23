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

library VectorUtils {
  function onSegment(int[2] a, int[2] b, int[2] c) internal pure returns (bool) {
    /* solium-disable-next-line */
    return (MathUtils.minInt(a[0], b[0]) <= c[0]) && (c[0] <= MathUtils.maxInt(a[0], b[0])) &&
    /* solium-disable-next-line */
    (MathUtils.minInt(a[1], b[1]) <= c[1]) && (c[1] <= MathUtils.maxInt(a[1], b[1]));
  }

  function direction(int[2] a, int[2] b, int[2] c) internal pure returns (int256) {
    return (c[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (c[1] - a[1]);
  }
}
