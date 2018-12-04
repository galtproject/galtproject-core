pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/TrigonometryUtils.sol";

contract MockTrigonometryUtils {
  event LogSinResult(int result);
  event LogCosResult(int result);
  
  constructor() public {

  }
  
  function getSin(uint16 angle) public returns(int result) {
    result = TrigonometryUtils.sin(angle);
    emit LogSinResult(result);
  }

  function getCos(uint16 angle) public returns(int result) {
    result = TrigonometryUtils.cos(angle);
    emit LogSinResult(result);
  }
}
