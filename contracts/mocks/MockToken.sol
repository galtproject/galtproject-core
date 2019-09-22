pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "@galtproject/libs/contracts/traits/Initializable.sol";


contract MockToken is Initializable, ERC20Mintable {
  // solium-disable-next-line uppercase
  string public constant name = "Mock Token";

  // solium-disable-next-line uppercase
  string public constant symbol = "MALT";

  // solium-disable-next-line uppercase
  uint256 public constant decimals = 18;

  uint256 public constant INITIAL_SUPPLY = 0;

  constructor() public {
  }

  function initialize() public isInitializer {
    _mint(msg.sender, INITIAL_SUPPLY);
  }
}
