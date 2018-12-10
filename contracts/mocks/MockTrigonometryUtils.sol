pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/TrigonometryUtils.sol";

contract MockTrigonometryUtils {
  event LogSinResult(int result);
  event LogCosResult(int result);
  
  constructor() public {

  }
  
  function getSin(uint32 angle) public returns(int result) {
    result = TrigonometryUtils.sin(angle);
    emit LogSinResult(result);
  }

  function getSinOfEther(uint256 etherAngle) public returns(int result) {
    result = TrigonometryUtils.sin256(etherAngle);
    emit LogSinResult(result);
  }

  function getTrueSinOfEther(int256 etherAngle) public returns(int result) {
    result = TrigonometryUtils.getTrueSinOfInt(etherAngle);
    emit LogSinResult(result);
  }

  function getCos(uint32 angle) public returns(int result) {
    result = TrigonometryUtils.cos(angle);
    emit LogCosResult(result);
  }
}
