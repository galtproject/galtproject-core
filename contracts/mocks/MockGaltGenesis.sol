pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "../GaltGenesis.sol";
import "../GaltToken.sol";
import "../GaltDex.sol";

contract MockGaltGenesis is GaltGenesis {

  constructor(GaltToken _galtToken, GaltDex _galtDex) public GaltGenesis(_galtToken, _galtDex) {
  }

  function hackClose() public {
    closingTime = block.timestamp;
  }
}
