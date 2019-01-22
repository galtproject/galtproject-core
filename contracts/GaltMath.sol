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
import "./traits/Permissionable.sol";
import "./utils/MathUtils.sol";
import "./utils/TrigonometryUtils.sol";

contract GaltMath is Initializable, Ownable, Permissionable {
  using SafeMath for uint256;
  using SafeMath for int256;

  int constant PI = 3141592653589793300;

  mapping(int256 => int256) public sinCache;
  mapping(int256 => int256) public cosCache;
  mapping(int256 => int256) public tanCache;
  mapping(int256 => int256) public atanCache;
  mapping(int256 => int256) public atanhCache;
  mapping(int256 => int256) public coshCache;
  mapping(int256 => int256) public sinhCache;
  mapping(int256 => int256) public asinhCache;

  mapping(int256 => int256) public sqrtCache;
  mapping(int256 => int256) public expCache;
  mapping(int256 => int256) public logCache;
  mapping(int256 => int256) public log2Cache;
  mapping(int256 => int256) public log10Cache;

  event CalculateResult(int256 result);

  function sin(int256 input) public returns (int256) {
    if (sinCache[input] == 0) {
      sinCache[input] = TrigonometryUtils.sin(input);
    }
    emit CalculateResult(sinCache[input]);
    return sinCache[input];
  }

  function cos(int256 input) public returns (int256) {
    if (cosCache[input] == 0) {
      cosCache[input] = TrigonometryUtils.cos(input);
    }
    emit CalculateResult(cosCache[input]);
    return cosCache[input];
  }

  event Input(int256 input);

  function tan(int256 input) public returns (int256) {
    int256 sinResult = sin(input);
    int256 cosResult = cos(input);
    int result = (sinResult * 1 ether) / cosResult;
    emit CalculateResult(result);
    emit Input(input);
    return result;
  }

  function atan(int256 input) public returns (int256) {
    if (atanCache[input] == 0) {
      atanCache[input] = TrigonometryUtils.atan(input);
    }
    emit CalculateResult(atanCache[input]);
    return atanCache[input];
  }

  function atan2(int256 y, int256 x) public returns (int256) {
    int result = atan(y.mul(1 ether).div(x));
    if (x < 0) {
      result = result > 0 ? result.sub(PI) : result.add(PI);
    }
    emit CalculateResult(result);
    return result;
  }

  function atanh(int256 input) public returns (int256) {
    if (atanhCache[input] == 0) {
      atanhCache[input] = TrigonometryUtils.atanh(input);
    }
    emit CalculateResult(atanhCache[input]);
    return atanhCache[input];
  }

  function cosh(int256 input) public returns (int256) {
    if (coshCache[input] == 0) {
      coshCache[input] = TrigonometryUtils.cosh(input);
    }
    emit CalculateResult(coshCache[input]);
    return coshCache[input];
  }

  function sinh(int256 input) public returns (int256) {
    if (sinhCache[input] == 0) {
      sinhCache[input] = TrigonometryUtils.sinh(input);
    }
    emit CalculateResult(sinhCache[input]);
    return sinhCache[input];
  }

  function asinh(int256 input) public returns (int256) {
    if (asinhCache[input] == 0) {
      asinhCache[input] = TrigonometryUtils.asinh(input);
    }
    emit CalculateResult(asinhCache[input]);
    return asinhCache[input];
  }

  function sqrt(int256 input) public returns (int256) {
    if (sqrtCache[input] == 0) {
      sqrtCache[input] = MathUtils.sqrtInt(input);
    }
    emit CalculateResult(sqrtCache[input]);
    return sqrtCache[input];
  }

  function exp(int256 input) public returns (int256) {
    if (expCache[input] == 0) {
      expCache[input] = MathUtils.exp(input);
    }
    emit CalculateResult(expCache[input]);
    return expCache[input];
  }

  function log(int256 input) public returns (int256) {
    if (logCache[input] == 0) {
      logCache[input] = MathUtils.logE(input);
    }
    emit CalculateResult(logCache[input]);
    return logCache[input];
  }

  function log2(int256 input) public returns (int256) {
    if (log2Cache[input] == 0) {
      log2Cache[input] = MathUtils.log2(input);
    }
    emit CalculateResult(log2Cache[input]);
    return log2Cache[input];
  }

  function log10(int256 input) public returns (int256) {
    if (log10Cache[input] == 0) {
      log10Cache[input] = MathUtils.log10(input);
    }
    emit CalculateResult(log10Cache[input]);
    return log10Cache[input];
  }
}
