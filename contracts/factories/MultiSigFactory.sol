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

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../Oracles.sol";
import "../SpaceReputationAccounting.sol";
import "../registries/MultiSigRegistry.sol";
import "../applications/ClaimManager.sol";
import "../multisig/ArbitrationConfig.sol";
import "../multisig/proposals/interfaces/IProposalManager.sol";
// Arbitration Factories
import "./ArbitratorsMultiSigFactory.sol";
import "./ArbitratorVotingFactory.sol";
import "./ArbitratorStakeAccountingFactory.sol";
import "./OracleStakesAccountingFactory.sol";
import "./ArbitrationConfigFactory.sol";
// Arbitration Proposal Factories
import "./arbitration/ArbitrationModifyThresholdProposalFactory.sol";
import "./arbitration/ArbitrationModifyMofNProposalFactory.sol";
import "./arbitration/ArbitrationModifyArbitratorStakeProposalFactory.sol";
import "./arbitration/ArbitrationRevokeArbitratorsProposalFactory.sol";
import "./arbitration/ArbitrationModifyContractAddressProposalFactory.sol";


contract MultiSigFactory is Ownable {
  event BuildMultiSigFirstStep(
    bytes32 groupId,
    address arbitrationConfig,
    address arbitratorMultiSig,
    address oracleStakesAccounting
  );

  event BuildMultiSigSecondStep(
    bytes32 groupId,
    address arbitratorStakeAccounting,
    address arbitratorVoting
  );

  event BuildMultiSigThirdStep(
    bytes32 groupId,
    address modifyThresholdProposalManager,
    address modifyMofNProposalManager,
    address modifyArbitratorStakeProposalManager
  );

  event BuildMultiSigFourthStep(
    bytes32 groupId,
    address modifyContractAddressProposalManager,
    address revokeArbitratorsProposalManager
  );

  enum Step {
    FIRST,
    SECOND,
    THIRD,
    FOURTH,
    DONE
  }

  struct MultiSigContractGroup {
    address creator;
    Step nextStep;
    ArbitratorsMultiSig arbitratorMultiSig;
    ArbitratorVoting arbitratorVoting;
    ArbitrationConfig arbitrationConfig;
    ArbitratorStakeAccounting arbitratorStakeAccounting;
    OracleStakesAccounting oracleStakesAccounting;

    IProposalManager modifyThresholdProposalManager;
    IProposalManager modifyMofNProposalManager;
    IProposalManager modifyArbitratorStakeProposalManager;
    IProposalManager modifyContractAddressProposalManager;
    IProposalManager revokeArbitratorsProposalManager;
  }

  MultiSigRegistry multiSigRegistry;
  ClaimManager claimManager;

  IERC20 galtToken;
  Oracles oracles;
  SpaceReputationAccounting spaceReputationAccounting;

  ArbitrationConfigFactory arbitrationConfigFactory;
  ArbitratorsMultiSigFactory arbitratorMultiSigFactory;
  ArbitratorVotingFactory arbitratorVotingFactory;
  ArbitratorStakeAccountingFactory arbitratorStakeAccountingFactory;
  OracleStakesAccountingFactory oracleStakesAccountingFactory;

  ArbitrationModifyThresholdProposalFactory arbitrationModifyThresholdProposalFactory;
  ArbitrationModifyMofNProposalFactory arbitrationModifyMofNProposalFactory;
  ArbitrationModifyArbitratorStakeProposalFactory arbitrationModifyArbitratorStakeProposalFactory;
  ArbitrationModifyContractAddressProposalFactory arbitrationModifyContractAddressProposalFactory;
  ArbitrationRevokeArbitratorsProposalFactory arbitrationRevokeArbitratorsProposalFactory;

  mapping(bytes32 => MultiSigContractGroup) public multiSigContractGroups;

  uint256 commission;

  constructor (
    MultiSigRegistry _multiSigRegistry,
    IERC20 _galtToken,
    Oracles _oracles,
    ClaimManager _claimManager,
    SpaceReputationAccounting _spaceReputationAccounting,
    ArbitratorsMultiSigFactory _arbitratorMultiSigFactory,
    ArbitratorVotingFactory _arbitratorVotingFactory,
    ArbitratorStakeAccountingFactory _arbitratorStakeAccountingFactory,
    OracleStakesAccountingFactory _oracleStakesAccountingFactory,
    ArbitrationConfigFactory _arbitrationConfigFactory,
    ArbitrationModifyThresholdProposalFactory _arbitrationModifyThresholdProposalFactory,
    ArbitrationModifyMofNProposalFactory _arbitrationModifyMofNProposalFactory,
    ArbitrationModifyArbitratorStakeProposalFactory _arbitrationModifyArbitratorStakeProposalFactory,
    ArbitrationModifyContractAddressProposalFactory _arbitrationModifyContractAddressProposalFactory,
    ArbitrationRevokeArbitratorsProposalFactory _arbitrationRevokeArbitratorsProposalFactory
  ) public {
    commission = 10 ether;

    multiSigRegistry = _multiSigRegistry;
    galtToken = _galtToken;
    oracles = _oracles;
    claimManager = _claimManager;
    spaceReputationAccounting = _spaceReputationAccounting;

    arbitratorMultiSigFactory = _arbitratorMultiSigFactory;
    arbitratorVotingFactory = _arbitratorVotingFactory;
    arbitratorStakeAccountingFactory = _arbitratorStakeAccountingFactory;
    oracleStakesAccountingFactory = _oracleStakesAccountingFactory;
    arbitrationConfigFactory = _arbitrationConfigFactory;

    arbitrationModifyThresholdProposalFactory = _arbitrationModifyThresholdProposalFactory;
    arbitrationModifyMofNProposalFactory = _arbitrationModifyMofNProposalFactory;
    arbitrationModifyArbitratorStakeProposalFactory = _arbitrationModifyArbitratorStakeProposalFactory;
    arbitrationModifyContractAddressProposalFactory = _arbitrationModifyContractAddressProposalFactory;
    arbitrationRevokeArbitratorsProposalFactory = _arbitrationRevokeArbitratorsProposalFactory;
  }

  function buildFirstStep(
    address[] calldata _initialOwners,
    uint256 _initialMultiSigRequired,
    uint256 _m,
    uint256 _n,
    uint256 _minimalArbitratorStake,
  // 0 - SET_THRESHOLD_THRESHOLD
  // 1 - SET_M_OF_N_THRESHOLD
  // 2 - REVOKE_ARBITRATORS_THRESHOLD
  // 3 - CHANGE_CONTRACT_ADDRESS_THRESHOLD
    uint256[] calldata _thresholds
  )
    external
    returns (bytes32 groupId)
  {
    galtToken.transferFrom(msg.sender, address(this), commission);

    groupId = keccak256(abi.encode(block.timestamp, _initialMultiSigRequired, msg.sender));

    MultiSigContractGroup storage g = multiSigContractGroups[groupId];

    require(g.nextStep == Step.FIRST, "Requires FIRST step");

    ArbitrationConfig arbitrationConfig = arbitrationConfigFactory.build(
      _m,
      _n,
      _minimalArbitratorStake,
      _thresholds
    );

    ArbitratorsMultiSig arbitratorMultiSig = arbitratorMultiSigFactory.build(_initialOwners, _initialMultiSigRequired, arbitrationConfig);
    OracleStakesAccounting oracleStakesAccounting = oracleStakesAccountingFactory.build(oracles, galtToken, arbitrationConfig);

    arbitratorMultiSig.addRoleTo(address(claimManager), arbitratorMultiSig.ROLE_PROPOSER());
    oracleStakesAccounting.addRoleTo(address(claimManager), oracleStakesAccounting.ROLE_SLASH_MANAGER());
    oracles.addOracleNotifierRoleTo(address(oracleStakesAccounting));

    g.creator = msg.sender;
    g.arbitratorMultiSig = arbitratorMultiSig;
    g.oracleStakesAccounting = oracleStakesAccounting;
    g.arbitrationConfig = arbitrationConfig;
    g.nextStep = Step.SECOND;

    emit BuildMultiSigFirstStep(groupId, address(arbitrationConfig), address(arbitratorMultiSig), address(oracleStakesAccounting));
  }

  function buildSecondStep(
    bytes32 _groupId,
    uint256 _periodLength
  )
    external
  {
    MultiSigContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.SECOND, "SECOND step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    ArbitratorStakeAccounting arbitratorStakeAccounting = arbitratorStakeAccountingFactory.build(galtToken, g.arbitratorMultiSig, _periodLength);
    ArbitratorVoting arbitratorVoting = arbitratorVotingFactory.build(g.arbitrationConfig);

    arbitratorStakeAccounting.addRoleTo(address(claimManager), arbitratorStakeAccounting.ROLE_SLASH_MANAGER());
    g.arbitratorMultiSig.addRoleTo(address(arbitratorVoting), g.arbitratorMultiSig.ROLE_ARBITRATOR_MANAGER());
    arbitratorVoting.addRoleTo(address(
        g.oracleStakesAccounting), arbitratorVoting.ORACLE_STAKES_NOTIFIER());
    arbitratorVoting.addRoleTo(address(spaceReputationAccounting), arbitratorVoting.SPACE_REPUTATION_NOTIFIER());

    g.arbitratorStakeAccounting = arbitratorStakeAccounting;
    g.arbitratorVoting = arbitratorVoting;

    g.nextStep = Step.THIRD;

    emit BuildMultiSigSecondStep(_groupId, address(arbitratorStakeAccounting), address(arbitratorVoting));
  }

  function buildThirdStep(
    bytes32 _groupId
  )
    external
  {
    MultiSigContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.THIRD, "THIRD step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IProposalManager thresholdProposals = arbitrationModifyThresholdProposalFactory.build(g.arbitrationConfig);
    IProposalManager mOfNProposals = arbitrationModifyMofNProposalFactory.build(g.arbitrationConfig);
    IProposalManager arbitratorStakeProposals = arbitrationModifyArbitratorStakeProposalFactory.build(g.arbitrationConfig);

    g.arbitrationConfig.addRoleTo(address(thresholdProposals), g.arbitrationConfig.THRESHOLD_MANAGER());
    g.arbitrationConfig.addRoleTo(address(mOfNProposals), g.arbitrationConfig.M_N_MANAGER());
    g.arbitrationConfig.addRoleTo(address(arbitratorStakeProposals), g.arbitrationConfig.MINIMAL_ARBITRATOR_STAKE_MANAGER());

    g.modifyThresholdProposalManager = thresholdProposals;
    g.modifyMofNProposalManager = mOfNProposals;
    g.modifyArbitratorStakeProposalManager = arbitratorStakeProposals;

    g.nextStep = Step.FOURTH;

    emit BuildMultiSigThirdStep(
      _groupId,
      address(thresholdProposals),
      address(mOfNProposals),
      address(arbitratorStakeProposals)
    );
  }

  function buildFourthStep(
    bytes32 _groupId
  )
    external
  {
    MultiSigContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.FOURTH, "FOURTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IProposalManager changeAddressProposals = arbitrationModifyContractAddressProposalFactory.build(g.arbitrationConfig);
    IProposalManager revokeArbitratorsProposals = arbitrationRevokeArbitratorsProposalFactory.build(g.arbitrationConfig);

    g.arbitrationConfig.addRoleTo(address(changeAddressProposals), g.arbitrationConfig.CONTRACT_ADDRESS_MANAGER());
    g.arbitratorMultiSig.addRoleTo(address(revokeArbitratorsProposals), g.arbitratorMultiSig.ROLE_REVOKE_MANAGER());

    g.modifyContractAddressProposalManager = changeAddressProposals;
    g.revokeArbitratorsProposalManager = revokeArbitratorsProposals;

    g.arbitrationConfig.initialize(
      g.arbitratorMultiSig,
      g.arbitratorVoting,
      g.arbitratorStakeAccounting,
      g.oracleStakesAccounting,
      spaceReputationAccounting
    );

    // TODO: initialize proposal contracts too

    // Revoke role management permissions from this factory address
    g.arbitratorVoting.removeRoleFrom(address(this), "role_manager");
    g.arbitratorStakeAccounting.removeRoleFrom(address(this), "role_manager");
    g.arbitratorMultiSig.removeRoleFrom(address(this), "role_manager");
    g.oracleStakesAccounting.removeRoleFrom(address(this), "role_manager");
    g.arbitrationConfig.removeRoleFrom(address(this), "role_manager");

    g.modifyThresholdProposalManager.removeRoleFrom(address(this), "role_manager");
    g.modifyMofNProposalManager.removeRoleFrom(address(this), "role_manager");
    g.modifyArbitratorStakeProposalManager.removeRoleFrom(address(this), "role_manager");
    changeAddressProposals.removeRoleFrom(address(this), "role_manager");
    revokeArbitratorsProposals.removeRoleFrom(address(this), "role_manager");

    multiSigRegistry.addMultiSig(g.arbitratorMultiSig, g.arbitrationConfig);

    g.nextStep = Step.DONE;

    emit BuildMultiSigFourthStep(
      _groupId,
      address(changeAddressProposals),
      address(revokeArbitratorsProposals)
    );
  }

  function setCommission(uint256 _commission) external onlyOwner {
    commission = _commission;
  }

  function getGroup(bytes32 _groupId) external view returns (Step nextStep, address creator) {
    MultiSigContractGroup storage g = multiSigContractGroups[_groupId];
    return (g.nextStep, g.creator);
  }
}
