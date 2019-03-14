pragma solidity 0.5.3;

import "./MockToken.sol";


contract MockToken_V2 is MockToken {
  constructor() public {
  }

  function faucet() public {
    uint256 _amount = 87 ether;
    _mint(msg.sender, _amount);
  }
}
