pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental ABIEncoderV2;

import "../utils/BentleyOttman.sol";

contract MockBentleyOttman {
  using BentleyOttman for BentleyOttman.State;

  BentleyOttman.State private bentleyOttman;
  
  event LogSetSegments(int256[2][2] firstItem);
  
  constructor() public {
    bentleyOttman.init();
  }

  function setSegments(int256[2][2][] value) public {
    bentleyOttman.setSegments(value);
  }
  
  function handleQueuePoints() public {
    bentleyOttman.handleQueuePoints();
  }
}
