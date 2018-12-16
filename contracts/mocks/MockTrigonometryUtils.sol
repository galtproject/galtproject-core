pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/TrigonometryUtils.sol";

contract MockTrigonometryUtils {
  event LogSinResult(int result);
  event LogCosResult(int result);
  
  constructor() public {

  }

  function getSinOfRad(int256 etherRad) public returns(int result) {
    result = TrigonometryUtils.getSinOfRad(etherRad);
    emit LogSinResult(result);
  }

  function getSinOfAngle(int256 etherAngle) public returns(int result) {
    result = TrigonometryUtils.getSinOfAngle(etherAngle);
    emit LogSinResult(result);
  }
}
