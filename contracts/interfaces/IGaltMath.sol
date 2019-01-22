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

contract IGaltMath {
  function sin(int256 input, bool cache) public returns (int256);

  function cos(int256 input, bool cache) public returns (int256);

  function tan(int256 input, bool cache) public returns (int256);

  function atan(int256 input, bool cache) public returns (int256);

  function atan2(int256 y, int256 x, bool cache) public returns (int256);

  function atanh(int256 input, bool cache) public returns (int256);

  function cosh(int256 input, bool cache) public returns (int256);

  function sinh(int256 input, bool cache) public returns (int256);

  function asinh(int256 input, bool cache) public returns (int256);

  function sqrt(int256 input, bool cache) public returns (int256);

  function exp(int256 input, bool cache) public returns (int256);

  function log(int256 input, bool cache) public returns (int256);

  function log2(int256 input, bool cache) public returns (int256);

  function log10(int256 input, bool cache) public returns (int256);
}
