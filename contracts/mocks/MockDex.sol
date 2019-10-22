/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


contract MockDex {
  IERC20 galtToken;

  constructor (address _galtToken) public {
    galtToken = IERC20(_galtToken);
  }

  function ethToGalt(uint256 _minReturn) external payable returns (uint256) {
    uint256 balance = galtToken.balanceOf(address(this));
    require(galtToken.transfer(msg.sender, balance) == true, "Failed to send GALT tokens");
    return balance;
  }
}
