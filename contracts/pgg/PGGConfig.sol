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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../registries/GaltGlobalRegistry.sol";
import "./interfaces/IPGGConfig.sol";
import "./interfaces/IPGGArbitratorStakeAccounting.sol";
import "./interfaces/IPGGOracleStakeAccounting.sol";
import "./interfaces/IPGGMultiSig.sol";
import "./interfaces/IPGGProposalManager.sol";
import "./voting/interfaces/IPGGDelegateReputationVoting.sol";
import "./voting/interfaces/IPGGOracleStakeVoting.sol";
import "./voting/interfaces/IPGGMultiSigCandidateTop.sol";
import "./PGGMultiSig.sol";


contract PGGConfig is IPGGConfig {
  using ArraySet for ArraySet.AddressSet;

  // 100% == 10**6
  uint256 public constant DECIMALS = 10**6;

  bytes32 public constant THRESHOLD_MANAGER = bytes32("threshold_manager");
  bytes32 public constant M_N_MANAGER = bytes32("m_n_manager");
  bytes32 public constant MINIMAL_ARBITRATOR_STAKE_MANAGER = bytes32("minimal_arbitrator_stake_manager");
  bytes32 public constant CONTRACT_ADDRESS_MANAGER = bytes32("contract_address_manager");
  bytes32 public constant APPLICATION_CONFIG_MANAGER = bytes32("application_config_manager");

  bytes32 public constant SUPPORT_GLOBAL_PROPOSAL_MANAGER = bytes32("support_global_proposal_manager");
  bytes32 public constant EXTERNAL_ROLE_MANAGER = bytes32("external_role_manager");
  bytes32 public constant INTERNAL_ROLE_MANAGER = bytes32("internal_role_manager");
  bytes32 public constant DEFAULT_PROPOSAL_THRESHOLD_MANAGER = bytes32("default_threshold_manager");

  bytes32 public constant PROPOSAL_MANAGER = bytes32("proposal_manager");

  // "a4db7b4d": "setThreshold(bytes32,uint256)"
  bytes32 public constant SET_THRESHOLD_SIGNATURE = 0xa4db7b4d00000000000000000000000000000000000000000000000000000000;
  // "223e3c82": "setMofN(uint256,uint256)",
  bytes32 public constant SET_M_OF_N_SIGNATURE = 0x223e3c8200000000000000000000000000000000000000000000000000000000;
  // "a8af70c6": "setMinimalArbitratorStake(uint256)",
  bytes32 public constant CHANGE_MINIMAL_ARBITRATOR_STAKE_SIGNATURE = 0xa8af70c600000000000000000000000000000000000000000000000000000000;
  // "e001f841": "setContractAddress(bytes32,address)",
  bytes32 public constant CHANGE_CONTRACT_ADDRESS_SIGNATURE = 0xe001f84100000000000000000000000000000000000000000000000000000000;
  // "ae32c951": "setApplicationConfigValue(bytes32,bytes32)",
  bytes32 public constant APPLICATION_CONFIG_SIGNATURE = 0xae32c95100000000000000000000000000000000000000000000000000000000;
  // "188bcad6": "setGlobalProposalSupport(uint256,bool)",
  bytes32 public constant SUPPORT_GLOBAL_PROPOSAL_SIGNATURE = 0x188bcad600000000000000000000000000000000000000000000000000000000;
  // "2f6049e3": "addExternalRoleTo(address,bytes32)",
  bytes32 public constant ADD_EXTERNAL_ROLE_PROPOSAL_SIGNATURE = 0x2f6049e300000000000000000000000000000000000000000000000000000000;
  // "7e84171b": "removeExternalRoleFrom(address,bytes32)",
  bytes32 public constant REMOVE_EXTERNAL_ROLE_PROPOSAL_SIGNATURE = 0x7e84171b00000000000000000000000000000000000000000000000000000000;
  // "a57df267": "addInternalRole(address,bytes32)",
  bytes32 public constant ADD_INTERNAL_ROLE_PROPOSAL_SIGNATURE = 0xa57df26700000000000000000000000000000000000000000000000000000000;
  // "7ebf217e": "removeInternalRole(address,bytes32)",
  bytes32 public constant REMOVE_INTERNAL_ROLE_PROPOSAL_SIGNATURE = 0x7ebf217e00000000000000000000000000000000000000000000000000000000;
  // "9f6dde5d": "revokeArbitrators()", PGGMultiSig
  bytes32 public constant REVOKE_ARBITRATORS_SIGNATURE = 0x9f6dde5d00000000000000000000000000000000000000000000000000000000;
  // "8a4285f5": "propose(address,address,uint256,bytes)", GlobalGovernance
  bytes32 public constant CREATE_GLOBAL_PROPOSAL_SIGNATURE = 0x8a4285f500000000000000000000000000000000000000000000000000000000;

  bytes32 public constant MULTI_SIG_CONTRACT = bytes32("multi_sig_contract");
  bytes32 public constant ORACLES_CONTRACT = bytes32("oracles_contract");
  bytes32 public constant ORACLE_STAKES_CONTRACT = bytes32("oracle_stakes_contract");
  bytes32 public constant ARBITRATOR_STAKES_CONTRACT = bytes32("arbitrator_stakes_contract");
  bytes32 public constant MULTI_SIG_CANDIDATE_TOP_CONTRACT = bytes32("candidate_top_contract");
  bytes32 public constant DELEGATE_SPACE_VOTING_CONTRACT = bytes32("delegate_space_voting_contract");
  bytes32 public constant DELEGATE_GALT_VOTING_CONTRACT = bytes32("delegate_galt_voting_contract");
  bytes32 public constant ORACLE_STAKE_VOTING_CONTRACT = bytes32("oracle_stake_voting_contract");

  // Notifies StakeTracker about stake changes
  bytes32 public constant STAKE_TRACKER_NOTIFIER_ROLE = bytes32("stake_tracker_notifier");
  // Creates new global governance proposals
  bytes32 public constant GLOBAL_PROPOSAL_CREATOR_ROLE = bytes32("global_proposal_creator");

  event SetThreshold(bytes32 indexed key, uint256 value);
  event SetMofN(uint256 m, uint256 n);
  event SetMinimalArbitratorStake(uint256 value);
  event SetDefaultProposalThreshold(uint256 value);
  event SetContractAddress(bytes32 indexed key, address addr);
  event SetApplicationConfigValue(bytes32 indexed key, bytes32 value);
  event AddExternalRole(bytes32 indexed role, address indexed addr);
  event RemoveExternalRole(bytes32 indexed role, address indexed addr);
  event AddInternalRole(bytes32 indexed role, address indexed addr);
  event RemoveInternalRole(bytes32 indexed role, address indexed addr);
  event SetGlobalProposalSupport(uint256 indexed globalProposalId, bool isSupported);

  // marker => threshold
  mapping(bytes32 => uint256) public thresholds;
  mapping(bytes32 => address) public contracts;
  mapping(bytes32 => bytes32) public applicationConfig;
  mapping(uint256 => bool) public globalProposalSupport;
  mapping(bytes32 => ArraySet.AddressSet) internal externalRoles;
  mapping(bytes32 => ArraySet.AddressSet) internal internalRoles;

  uint256 public minimalArbitratorStake;
  uint256 public defaultProposalThreshold;

  bool internal initialized;

  // initial voting => multiSig required
  uint256 public m;
  // initial voting => multiSig total
  uint256 public n;

  GaltGlobalRegistry public ggr;

  modifier onlyInternalRole(bytes32 _role) {
    require(internalRoles[_role].has(msg.sender) == true, "Denied by PGG internal role check");

    _;
  }

  constructor (
    GaltGlobalRegistry _ggr,
    uint256 _m,
    uint256 _n,
    uint256 _minimalArbitratorStake,
    uint256 _defaultProposalThreshold
  ) public {
    ggr = _ggr;

    m = _m;
    n = _n;
    minimalArbitratorStake = _minimalArbitratorStake;
    defaultProposalThreshold = _defaultProposalThreshold;

    internalRoles[INTERNAL_ROLE_MANAGER].add(msg.sender);
    emit AddInternalRole(INTERNAL_ROLE_MANAGER, msg.sender);
  }

  function initialize(
    IPGGMultiSig _pggMultiSig,
    IPGGMultiSigCandidateTop _candidateVoting,
    IPGGArbitratorStakeAccounting _arbitratorStakeAccounting,
    IPGGOracleStakeAccounting _oracleStakeAccounting,
    IPGGOracles _oracles,
    IPGGDelegateReputationVoting _delegateSpaceVoting,
    IPGGDelegateReputationVoting _delegateGaltVoting,
    IPGGOracleStakeVoting _oracleStakeVoting,
    IPGGProposalManager _proposalManager
  )
    external
  {
    assert(initialized == false);
    assert(hasInternalRole(INTERNAL_ROLE_MANAGER, msg.sender));

    contracts[MULTI_SIG_CONTRACT] = address(_pggMultiSig);
    contracts[MULTI_SIG_CANDIDATE_TOP_CONTRACT] = address(_candidateVoting);
    contracts[ARBITRATOR_STAKES_CONTRACT] = address(_arbitratorStakeAccounting);
    contracts[ORACLE_STAKES_CONTRACT] = address(_oracleStakeAccounting);
    contracts[ORACLES_CONTRACT] = address(_oracles);
    contracts[DELEGATE_SPACE_VOTING_CONTRACT] = address(_delegateSpaceVoting);
    contracts[DELEGATE_GALT_VOTING_CONTRACT] = address(_delegateGaltVoting);
    contracts[ORACLE_STAKE_VOTING_CONTRACT] = address(_oracleStakeVoting);
    contracts[PROPOSAL_MANAGER] = address(_proposalManager);

    initialized = true;
  }

  function setThreshold(bytes32 _key, uint256 _value) external onlyInternalRole(THRESHOLD_MANAGER) {
    require(_value <= DECIMALS, "Invalid threshold value");

    thresholds[_key] = _value;

    emit SetThreshold(_key, _value);
  }

  function setMofN(uint256 _m, uint256 _n) external onlyInternalRole(M_N_MANAGER) {
    require(2 <= _m, "Should satisfy `2 <= m`");
    require(3 <= _n, "Should satisfy `3 <= n`");
    require(_m <= _n, "Should satisfy `m <= n`");

    m = _m;
    n = _n;

    emit SetMofN(_m, _n);
  }

  function setMinimalArbitratorStake(uint256 _value) external onlyInternalRole(MINIMAL_ARBITRATOR_STAKE_MANAGER) {
    minimalArbitratorStake = _value;

    emit SetMinimalArbitratorStake(_value);
  }

  function setDefaultProposalThreshold(uint256 _value) external onlyInternalRole(DEFAULT_PROPOSAL_THRESHOLD_MANAGER) {
    require(_value > 0 && _value <= DECIMALS, "Invalid threshold value");

    defaultProposalThreshold = _value;

    emit SetDefaultProposalThreshold(_value);
  }

  function setContractAddress(bytes32 _key, address _address) external onlyInternalRole(CONTRACT_ADDRESS_MANAGER) {
    contracts[_key] = _address;

    emit SetContractAddress(_key, _address);
  }

  function setApplicationConfigValue(bytes32 _key, bytes32 _value) external onlyInternalRole(APPLICATION_CONFIG_MANAGER) {
    applicationConfig[_key] = _value;

    emit SetApplicationConfigValue(_key, _value);
  }

  function addExternalRole(address _address, bytes32 _role) external onlyInternalRole(EXTERNAL_ROLE_MANAGER) {
    externalRoles[_role].add(_address);

    emit AddExternalRole(_role, _address);
  }

  function removeExternalRole(address _address, bytes32 _role) external onlyInternalRole(EXTERNAL_ROLE_MANAGER) {
    externalRoles[_role].remove(_address);

    emit RemoveExternalRole(_role, _address);
  }

  function addInternalRole(address _address, bytes32 _role) public onlyInternalRole(INTERNAL_ROLE_MANAGER) {
    internalRoles[_role].add(_address);

    emit AddInternalRole(_role, _address);
  }

  function removeInternalRole(address _address, bytes32 _role) external onlyInternalRole(INTERNAL_ROLE_MANAGER) {
    internalRoles[_role].remove(_address);

    emit RemoveInternalRole(_role, _address);
  }

  function setGlobalProposalSupport(
    uint256 _globalProposalId,
    bool _isSupported
  )
    external
    onlyInternalRole(SUPPORT_GLOBAL_PROPOSAL_MANAGER)
  {
    globalProposalSupport[_globalProposalId] = _isSupported;

    emit SetGlobalProposalSupport(_globalProposalId, _isSupported);
  }

  // GETTERS

  function getThresholdMarker(address _destination, bytes memory _data) public pure returns(bytes32 marker) {
    bytes32 methodName;

    assembly {
      methodName := and(mload(add(_data, 0x20)), 0xffffffff00000000000000000000000000000000000000000000000000000000)
    }

    return keccak256(abi.encode(_destination, methodName));
  }

  function getMultiSig() external view returns (IPGGMultiSig) {
    address payable ms = address(uint160(contracts[MULTI_SIG_CONTRACT]));
    return IPGGMultiSig(ms);
  }

  function getMultiSigCandidateTop() external view returns (IPGGMultiSigCandidateTop) {
    return IPGGMultiSigCandidateTop(contracts[MULTI_SIG_CANDIDATE_TOP_CONTRACT]);
  }

  function getArbitratorStakes() external view returns (IPGGArbitratorStakeAccounting) {
    return IPGGArbitratorStakeAccounting(contracts[ARBITRATOR_STAKES_CONTRACT]);
  }

  function getOracles() external view returns (IPGGOracles) {
    return IPGGOracles(contracts[ORACLES_CONTRACT]);
  }

  function getOracleStakes() external view returns (IPGGOracleStakeAccounting) {
    return IPGGOracleStakeAccounting(contracts[ORACLE_STAKES_CONTRACT]);
  }

  function getDelegateSpaceVoting() external view returns (IPGGDelegateReputationVoting) {
    return IPGGDelegateReputationVoting(contracts[DELEGATE_SPACE_VOTING_CONTRACT]);
  }

  function getDelegateGaltVoting() external view returns (IPGGDelegateReputationVoting) {
    return IPGGDelegateReputationVoting(contracts[DELEGATE_GALT_VOTING_CONTRACT]);
  }

  function getOracleStakeVoting() external view returns (IPGGOracleStakeVoting) {
    return IPGGOracleStakeVoting(contracts[ORACLE_STAKE_VOTING_CONTRACT]);
  }

  function getExternalRoles(bytes32 _role) external view returns(address[] memory) {
    return externalRoles[_role].elements();
  }

  function getInternalRoles(bytes32 _role) external view returns(address[] memory) {
    return internalRoles[_role].elements();
  }

  function hasExternalRole(bytes32 _role, address _address) public view returns(bool) {
    return externalRoles[_role].has(_address);
  }

  function hasInternalRole(bytes32 _role, address _address) public view returns(bool) {
    return internalRoles[_role].has(_address);
  }
}
