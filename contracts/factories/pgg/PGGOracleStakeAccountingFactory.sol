/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// This contract will be included into the current one
import "../../pgg/PGGOracleStakeAccounting.sol";
import "../../pgg/PGGConfig.sol";


contract PGGOracleStakeAccountingFactory is Ownable {
  function build(
    PGGConfig _pggConfig
  )
    external
    returns (PGGOracleStakeAccounting oracleStakes)
  {
    oracleStakes = new PGGOracleStakeAccounting(_pggConfig);
  }
}
