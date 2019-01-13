pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/GeohashUtils.sol";

contract MockGeohashUtils {
  event LogPrecisionResult(uint8 result);
  
  constructor() public {

  }
  
  function geohash5Precision(uint256 geohash) public returns(uint8 result) {
    result = GeohashUtils.geohash5Precision(geohash);
    emit LogPrecisionResult(result);
  }
}
