pragma solidity 0.5.7;

import "../GlobalGovernance.sol";


/* solium-disable-next-line */
contract MockGlobalGovernance_V2 is GlobalGovernance {
  function foo() public view returns(string memory) {
    return "bar";
  }
}
