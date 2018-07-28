pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";


contract GaltToken is MintableToken {
  // solium-disable-next-line uppercase
  string public constant name = "Galt Token";

  // solium-disable-next-line uppercase
  string public constant symbol = "GALT";

  // solium-disable-next-line uppercase
  uint8 public constant decimals = 18;

  uint256 public constant INITIAL_SUPPLY = 0;

  constructor() public {
    totalSupply_ = INITIAL_SUPPLY;
    balances[msg.sender] = INITIAL_SUPPLY;
    emit Transfer(address(0), msg.sender, INITIAL_SUPPLY);
  }
}