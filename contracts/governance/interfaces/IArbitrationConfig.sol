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

import "./IArbitratorsMultiSig.sol";
import "./IArbitratorStakeAccounting.sol";
import "./IArbitrationOracles.sol";
import "./IOracleStakesAccounting.sol";
import "../voting/interfaces/IArbitrationCandidateTop.sol";
import "../voting/interfaces/IDelegateReputationVoting.sol";
import "../voting/interfaces/IOracleStakeVoting.sol";
import "../../registries/GaltGlobalRegistry.sol";


interface IArbitrationConfig {
  function ggr() external view returns(GaltGlobalRegistry);
  function globalProposalSupport(uint256) external view returns(bool);
  function setThreshold(bytes32 _key, uint256 _value) external;
  function setMofN(uint256 _m, uint256 _n) external;
  function setMinimalArbitratorStake(uint256 _value) external;
  function setContractAddress(bytes32 _key, address _address) external;
  function applicationConfig(bytes32) external view returns (bytes32);
  function getMultiSig() external view returns (IArbitratorsMultiSig);
  function getArbitratorStakes() external view returns (IArbitratorStakeAccounting);
  function getOracleStakes() external view returns (IOracleStakesAccounting);
  function getOracles() external view returns (IArbitrationOracles);
  function getArbitrationCandidateTop() external view returns (IArbitrationCandidateTop);
  function getDelegateSpaceVoting() external view returns (IDelegateReputationVoting);
  function getDelegateGaltVoting() external view returns (IDelegateReputationVoting);
  function getOracleStakeVoting() external view returns (IOracleStakeVoting);
  function getExternalRoles(bytes32 _role) external view returns(address[] memory);
  function hasExternalRole(bytes32 _role, address _address) external view returns(bool);
}
