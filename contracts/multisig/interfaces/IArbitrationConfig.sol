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

pragma solidity 0.5.3;

import "./IArbitratorsMultiSig.sol";
import "./IArbitratorVoting.sol";
import "./IArbitratorStakeAccounting.sol";
import "./IOracleStakesAccounting.sol";


interface IArbitrationConfig {
  function setThreshold(bytes32 _key, uint256 _value) external;
  function setMofN(uint256 _m, uint256 _n) external;
  function setMinimalArbitratorStake(uint256 _value) external;
  function setContractAddress(bytes32 _key, address _address) external;
  function getMultiSig() external view returns (IArbitratorsMultiSig);
  function getArbitratorVoting() external view returns (IArbitratorVoting);
  function getArbitratorStakes() external view returns (IArbitratorStakeAccounting);
  function getOracleStakes() external view returns (IOracleStakesAccounting);
}
