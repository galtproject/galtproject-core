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
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

// This contract will be included into the current one
import "../multisig/ArbitratorStakeAccounting.sol";
import "../multisig/ArbitrationConfig.sol";


contract ArbitratorStakeAccountingFactory is Ownable {
  function build(
    ArbitrationConfig _arbitrationConfig,
    uint256 _periodLength
  )
    external
    returns (ArbitratorStakeAccounting arbitratorStakeAccounting)
  {
    arbitratorStakeAccounting = new ArbitratorStakeAccounting(_arbitrationConfig, _periodLength);
  }
}
