pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/MartinezRueda.sol";

contract MockBentleyOttman {
  using BentleyOttman for BentleyOttman.State;

  BentleyOttman.State private bentleyOttman;
  
  event LogSetSegment(int256[2][2] firstItem);
  
  constructor() public {
    bentleyOttman.initBentleyOttman();
  }

//  function setSegments(int256[2][2][] value) public {
//    bentleyOttman.setSegments(value);
//  }
  
  function addSegment(int256[2][2] value) public {
//    emit LogSetSegment(value);
    bentleyOttman.addSegment(value);
  }
  
  function handleQueuePoints() public {
    bentleyOttman.handleQueuePoints();
  }

  function isQueuePointsOver() public returns(bool) {
    return bentleyOttman.isQueuePointsOver();
  }

  function getOutputLength() public returns(uint256) {
    return bentleyOttman.getOutputLength();
  }
  
  function getOutputPoint(uint256 index) public returns(int256[2]) {
    return bentleyOttman.getOutputPoint(index);
  }
}
