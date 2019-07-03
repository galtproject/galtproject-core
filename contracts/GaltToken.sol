/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster),
 * [Valery Litvin](https://github.com/litvintech) by
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and
 * Galt•Space Society Construction and Terraforming Company by
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
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
