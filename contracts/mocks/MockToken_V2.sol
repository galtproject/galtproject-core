pragma solidity 0.5.10;

import "./MockToken.sol";


/* solium-disable-next-line */
contract MockToken_V2 is MockToken {
  constructor() public {
  }

  function faucet() public {
    uint256 _amount = 87 ether;
    _mint(msg.sender, _amount);
  }
}
