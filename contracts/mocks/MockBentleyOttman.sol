pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental ABIEncoderV2;

import "../utils/BentleyOttman.sol";

contract MockBentleyOttman {
  using BentleyOttman for BentleyOttman.State;

  BentleyOttman.State private bentleyOttmanState;
  
  event LogSetSegments(int256[2][2] firstItem);
  
  constructor() public {
    bentleyOttmanState.init();
  }

  function setSegments(int256[2][2][] value) public {
    bentleyOttmanState.setSegments(value);
  }
}
