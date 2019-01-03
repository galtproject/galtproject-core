pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/MathUtils.sol";

contract MockMathUtils {
  event LogIntResult(int result);
  
  constructor() public {

  }

  function sqrtInt(int256 etherValue) public returns(int result) {
    result = MathUtils.sqrtInt(etherValue);
    emit LogIntResult(result);
  }
}
