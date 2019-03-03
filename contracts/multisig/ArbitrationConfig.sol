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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/IArbitrationConfig.sol";
import "./interfaces/IArbitratorStakeAccounting.sol";
import "./interfaces/IOracleStakesAccounting.sol";
import "./interfaces/IArbitratorVoting.sol";
import "./interfaces/IArbitratorsMultiSig.sol";
import "./ArbitratorsMultiSig.sol";
import "../SpaceReputationAccounting.sol";


contract ArbitrationConfig is IArbitrationConfig, Permissionable {
  string public constant THRESHOLD_MANAGER = "threshold_manager";
  string public constant M_N_MANAGER = "m_n_manager";
  string public constant MINIMAL_ARBITRATOR_STAKE_MANAGER = "minimal_arbitrator_stake_manager";
  string public constant CONTRACT_ADDRESS_MANAGER = "contract_address_manager";

  bytes32 public constant SET_THRESHOLD_THRESHOLD = bytes32("set_threshold_threshold");
  bytes32 public constant SET_M_OF_N_THRESHOLD = bytes32("set_m_of_n_threshold");
  bytes32 public constant CHANGE_MINIMAL_ARBITRATOR_STAKE_THRESHOLD = bytes32("arbitrator_stake_threshold");
  bytes32 public constant CHANGE_CONTRACT_ADDRESS_THRESHOLD = bytes32("change_contract_threshold");
  bytes32 public constant REVOKE_ARBITRATORS_THRESHOLD = bytes32("revoke_arbitrators_threshold");

  bytes32 public constant MULTI_SIG_CONTRACT = bytes32("multi_sig_contract");
  bytes32 public constant ORACLE_STAKES_CONTRACT = bytes32("oracle_stakes_contract");
  bytes32 public constant ARBITRATOR_VOTING_CONTRACT = bytes32("arbitrator_voting_contract");
  bytes32 public constant ARBITRATOR_STAKES_CONTRACT = bytes32("arbitrator_stakes_contract");
  bytes32 public constant SPACE_REPUTATION_EXT_CONTRACT = bytes32("space_reputation_ext_contract");

  mapping(bytes32 => uint256) public thresholds;
  mapping(bytes32 => address) public contracts;
  uint256 public minimalArbitratorStake;

  bool initialized;

  // required
  uint256 public m;
  // total
  uint256 public n;

  constructor (
    uint256 _m,
    uint256 _n,
    uint256 _minimalArbitratorStake,
    // 0 - SET_THRESHOLD_THRESHOLD
    // 1 - SET_M_OF_N_THRESHOLD
    // 2 - CHANGE_MINIMAL_ARBITRATOR_STAKE_THRESHOLD
    // 3 - CHANGE_CONTRACT_ADDRESS_THRESHOLD
    // 4 - REVOKE_ARBITRATORS_THRESHOLD
    uint256[] memory _thresholds
  ) public {
    m = _m;
    n = _n;
    minimalArbitratorStake = _minimalArbitratorStake;

    require(_thresholds.length == 5, "Invalid number of thresholds passed in");

    thresholds[SET_THRESHOLD_THRESHOLD] = _thresholds[0];
    thresholds[SET_M_OF_N_THRESHOLD] = _thresholds[1];
    thresholds[CHANGE_MINIMAL_ARBITRATOR_STAKE_THRESHOLD] = _thresholds[2];
    thresholds[CHANGE_CONTRACT_ADDRESS_THRESHOLD] = _thresholds[3];
    thresholds[REVOKE_ARBITRATORS_THRESHOLD] = _thresholds[4];
  }

  function initialize(
    IArbitratorsMultiSig _arbitratorMultiSig,
    IArbitratorVoting _arbitratorVoting,
    IArbitratorStakeAccounting _arbitratorStakeAccounting,
    IOracleStakesAccounting _oracleStakesAccounting,
    SpaceReputationAccounting _spaceReputationAccounting
  )
    external
  {
    assert(initialized == false);
    assert(hasRole(msg.sender, "role_manager"));

    contracts[MULTI_SIG_CONTRACT] = address(_arbitratorMultiSig);
    contracts[ARBITRATOR_VOTING_CONTRACT] = address(_arbitratorVoting);
    contracts[ARBITRATOR_STAKES_CONTRACT] = address(_arbitratorStakeAccounting);
    contracts[ORACLE_STAKES_CONTRACT] = address(_oracleStakesAccounting);
    contracts[SPACE_REPUTATION_EXT_CONTRACT] = address(_spaceReputationAccounting);

    initialized = true;
  }

  function setThreshold(bytes32 _key, uint256 _value) external onlyRole(THRESHOLD_MANAGER) {
    require(_value <= 100, "Value should be less than 100");
    thresholds[_key] = _value;
  }

  function setMofN(uint256 _m, uint256 _n) external onlyRole(M_N_MANAGER) {
    require(2 <= _m, "Should satisfy `2 <= m`");
    require(3 <= _n, "Should satisfy `3 <= n`");
    require(_m <= _n, "Should satisfy `m <= n`");

    m = _m;
    n = _n;
  }

  function setMinimalArbitratorStake(uint256 _value) external onlyRole(MINIMAL_ARBITRATOR_STAKE_MANAGER) {
    minimalArbitratorStake = _value;
  }

  function setContractAddress(bytes32 _key, address _address) external onlyRole(CONTRACT_ADDRESS_MANAGER) {
    contracts[_key] = _address;
  }

  // GETTERS (TODO: replace contract getters with interfaces only)
  function getMultiSig() external view returns (IArbitratorsMultiSig) {
    address payable ms = address(uint160(contracts[MULTI_SIG_CONTRACT]));
    return IArbitratorsMultiSig(ms);
  }

  function getArbitratorVoting() external view returns (IArbitratorVoting) {
    return IArbitratorVoting(contracts[ARBITRATOR_VOTING_CONTRACT]);
  }

  function getArbitratorStakes() external view returns (IArbitratorStakeAccounting) {
    return IArbitratorStakeAccounting(contracts[ARBITRATOR_STAKES_CONTRACT]);
  }

  function getOracleStakes() external view returns (IOracleStakesAccounting) {
    return IOracleStakesAccounting(contracts[ORACLE_STAKES_CONTRACT]);
  }
}
