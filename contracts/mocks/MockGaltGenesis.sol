pragma solidity 0.5.3;

import "../GaltGenesis.sol";
import "../GaltToken.sol";
import "../GaltDex.sol";

contract MockGaltGenesis is GaltGenesis {

  constructor(GaltToken _galtToken, GaltDex _galtDex, IWETH _weth) public GaltGenesis(_galtToken, _galtDex, _weth) {
  }

  function hackClose() public {
    closingTime = block.timestamp;
  }
}
