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

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

// This contract will be included into the current one
import "../../fund/RSRA.sol";
import "../../fund/FundStorage.sol";
import "../../registries/SpaceLockerRegistry.sol";
import "../../SpaceToken.sol";


contract RSRAFactory is Ownable {
  function build(
    SpaceToken spaceToken,
    SpaceLockerRegistry spaceLockerRegistry,
    FundStorage fundStorage
  )
    external
    returns (RSRA)
  {
    RSRA rsra = new RSRA(
      spaceToken,
      spaceLockerRegistry,
      fundStorage
    );

    rsra.addRoleTo(msg.sender, "role_manager");
    rsra.removeRoleFrom(address(this), "role_manager");

    return rsra;
  }
}
