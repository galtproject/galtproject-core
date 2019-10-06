/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;


import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

// This contract will be included into the current one
import "../../pgg/PGGArbitratorStakeAccounting.sol";
import "../../pgg/PGGConfig.sol";


contract PGGArbitratorStakeAccountingFactory is Ownable {
  function build(
    PGGConfig _pggConfig,
    uint256 _periodLength
  )
    external
    returns (PGGArbitratorStakeAccounting arbitratorStakeAccounting)
  {
    arbitratorStakeAccounting = new PGGArbitratorStakeAccounting(_pggConfig, _periodLength);
  }
}
