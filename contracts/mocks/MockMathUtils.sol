pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/MathUtils.sol";

contract MockMathUtils {
  event LogIntResult(int result);
  event LogUintResult(uint result);
  
  constructor() public {

  }

  function sqrtInt(int256 etherValue) public returns(int result) {
    result = MathUtils.sqrtInt(etherValue);
    emit LogIntResult(result);
  }

  function logE(int256 etherValue) public returns(int result) {
    result = MathUtils.logE(etherValue);
    emit LogIntResult(result);
  }

  function logAny(int256 etherValue, int256 base) public returns(int result) {
    result = MathUtils.logAny(etherValue, base);
    emit LogIntResult(result);
  }

  function log2(int256 etherValue) public returns(int result) {
    result = MathUtils.log2(etherValue);
    emit LogIntResult(result);
  }

  function log10(int256 etherValue) public returns(int result) {
    result = MathUtils.log10(etherValue);
    emit LogIntResult(result);
  }

  function exp(uint etherValue) public returns(uint result) {
    result = MathUtils.exp(etherValue);
    emit LogUintResult(result);
  }
}
