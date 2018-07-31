pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
// TODO: remove initializer
import "zos-lib/contracts/migrations/Initializable.sol";


contract MockToken is Initializable, MintableToken {
  // solium-disable-next-line uppercase
  string public constant name = "Mock Token";

  // solium-disable-next-line uppercase
  string public constant symbol = "MALT";

  // solium-disable-next-line uppercase
  uint8 public constant decimals = 18;

  uint256 public constant INITIAL_SUPPLY = 0;

  constructor() public {
  }

  function initialize() isInitializer public {
    owner = msg.sender;

    totalSupply_ = INITIAL_SUPPLY;
    balances[msg.sender] = INITIAL_SUPPLY;
    emit Transfer(address(0), msg.sender, INITIAL_SUPPLY);
  }
}
