/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";


contract GaltToken is ERC20Mintable {
  // solium-disable-next-line uppercase
  string public constant _name = "Galt Token";

  // solium-disable-next-line uppercase
  string public constant _symbol = "GALT";

  // solium-disable-next-line uppercase
  uint256 public constant _decimals = 18;

  uint256 public constant INITIAL_SUPPLY = 0;

  constructor() public {
    _mint(msg.sender, INITIAL_SUPPLY);
  }
}
