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

pragma solidity 0.5.7;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

// This contract will be included into the current one
import "../../pgg/PGGConfig.sol";
import "../../pgg/PGGMultiSig.sol";


contract PGGMultiSigFactory is Ownable {
  function build(
    address[] calldata _initialOwners,
    uint256 _multiSigRequired,
    PGGConfig _pggConfig
  )
    external
    returns (PGGMultiSig multiSig)
  {
    multiSig = new PGGMultiSig(_initialOwners, _multiSigRequired, _pggConfig);

    multiSig.addRoleTo(msg.sender, "role_manager");
    multiSig.removeRoleFrom(address(this), "role_manager");
  }
}