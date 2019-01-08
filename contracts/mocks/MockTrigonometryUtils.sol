pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/TrigonometryUtils.sol";

contract MockTrigonometryUtils {
  event LogSinResult(int result);
  event LogCosResult(int result);
  event LogAtanResult(int result);
  
  constructor() public {

  }

  function getSinOfRad(int256 etherRad) public returns(int result) {
    result = TrigonometryUtils.getSinOfRad(etherRad);
    emit LogSinResult(result);
  }

  function getSinOfDegree(int256 etherDegree) public returns(int result) {
    result = TrigonometryUtils.getSinOfDegree(etherDegree);
    emit LogSinResult(result);
  }

  function atan(int256 etherRad) public returns(int result) {
    result = TrigonometryUtils.atan(etherRad);
    emit LogAtanResult(result);
  }
}
