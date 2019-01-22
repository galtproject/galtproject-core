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
import "./interfaces/IGaltMath.sol";

contract GaltMath is IGaltMath, Initializable, Ownable, Permissionable {
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

  event CalculateResult(int256 result, bool fromCache);

  function sin(int256 input, bool cache) public returns (int256 result) {
    if (sinCache[input] == 0) {
      result = TrigonometryUtils.sin(input);
      emit CalculateResult(result, false);
      
      if(cache)
        sinCache[input] = result;
    } else {
      result = sinCache[input];
      emit CalculateResult(result, true);
    }
  }

  function cos(int256 input, bool cache) public returns (int256 result) {
    if (cosCache[input] == 0) {
      result = TrigonometryUtils.cos(input);
      emit CalculateResult(result, false);

      if(cache)
        cosCache[input] = result;
    } else {
      result = cosCache[input];
      emit CalculateResult(result, true);
    }
  }


  function tan(int256 input, bool cache) public returns (int256 result) {
    int256 sinResult = sin(input, cache);
    int256 cosResult = cos(input, cache);
    int result = (sinResult * 1 ether) / cosResult;
    emit CalculateResult(result, false);
    return result;
  }

  function atan(int256 input, bool cache) public returns (int256 result) {
    if (atanCache[input] == 0) {
      result = TrigonometryUtils.atan(input);
      emit CalculateResult(result, false);

      if(cache)
        atanCache[input] = result;
    } else {
      result = atanCache[input];
      emit CalculateResult(result, true);
    }
  }

  function atan2(int256 y, int256 x, bool cache) public returns (int256 result) {
    int result = atan(y.mul(1 ether).div(x), cache);
    if (x < 0) {
      result = result > 0 ? result.sub(PI) : result.add(PI);
    }
    emit CalculateResult(result, false);
    return result;
  }

  function atanh(int256 input, bool cache) public returns (int256 result) {
    if (atanhCache[input] == 0) {
      result = TrigonometryUtils.atanh(input);
      emit CalculateResult(result, false);

      if(cache)
        atanhCache[input] = result;
    } else {
      result = atanhCache[input];
      emit CalculateResult(result, true);
    }
  }

  function cosh(int256 input, bool cache) public returns (int256 result) {
    if (coshCache[input] == 0) {
      result = TrigonometryUtils.cosh(input);
      emit CalculateResult(result, false);

      if(cache)
        coshCache[input] = result;
    } else {
      result = coshCache[input];
      emit CalculateResult(result, true);
    }
  }

  function sinh(int256 input, bool cache) public returns (int256 result) {
    if (sinhCache[input] == 0) {
      result = TrigonometryUtils.sinh(input);
      emit CalculateResult(result, false);

      if(cache)
        sinhCache[input] = result;
    } else {
      result = sinhCache[input];
      emit CalculateResult(result, true);
    }
  }

  function asinh(int256 input, bool cache) public returns (int256 result) {
    if (asinhCache[input] == 0) {
      result = TrigonometryUtils.asinh(input);
      emit CalculateResult(result, false);

      if(cache)
        asinhCache[input] = result;
    } else {
      result = asinhCache[input];
      emit CalculateResult(result, true);
    }
  }

  function sqrt(int256 input, bool cache) public returns (int256 result) {
    if (sqrtCache[input] == 0) {
      result = MathUtils.sqrtInt(input);
      emit CalculateResult(result, false);

      if(cache)
        sqrtCache[input] = result;
    } else {
      result = sqrtCache[input];
      emit CalculateResult(result, true);
    }
  }

  function exp(int256 input, bool cache) public returns (int256 result) {
    if (expCache[input] == 0) {
      result = MathUtils.exp(input);
      emit CalculateResult(result, false);

      if(cache)
        expCache[input] = result;
    } else {
      result = expCache[input];
      emit CalculateResult(result, true);
    }
  }

  function log(int256 input, bool cache) public returns (int256 result) {
    if (logCache[input] == 0) {
      result = MathUtils.logE(input);
      emit CalculateResult(result, false);

      if(cache)
        logCache[input] = result;
    } else {
      result = logCache[input];
      emit CalculateResult(result, true);
    }
  }

  function log2(int256 input, bool cache) public returns (int256 result) {
    if (log2Cache[input] == 0) {
      result = MathUtils.log2(input);
      emit CalculateResult(result, false);

      if(cache)
        log2Cache[input] = result;
    } else {
      result = log2Cache[input];
      emit CalculateResult(result, true);
    }
  }

  function log10(int256 input, bool cache) public returns (int256 result) {
    if (log10Cache[input] == 0) {
      result = MathUtils.log10(input);
      emit CalculateResult(result, false);

      if(cache)
        log10Cache[input] = result;
    } else {
      result = log10Cache[input];
      emit CalculateResult(result, true);
    }
  }
}
