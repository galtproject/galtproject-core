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
import "@galtproject/libs/contracts/traits/Initializable.sol";
import "../registries/GaltGlobalRegistry.sol";
import "../registries/interfaces/IPGGRegistry.sol";
import "../registries/interfaces/IFeeRegistry.sol";
import "../applications/ClaimManager.sol";
import "../pgg/PGGConfig.sol";
import "../pgg/proposals/interfaces/IProposalManager.sol";
import "../pgg/voting/interfaces/IPGGOracleStakeVoting.sol";
import "../pgg/voting/interfaces/IPGGDelegateReputationVoting.sol";
import "../pgg/voting/interfaces/IPGGMultiSigCandidateTop.sol";
import "../pgg/voting/PGGMultiSigCandidateTop.sol";
import "../pgg/interfaces/IPGGOracles.sol";
// Arbitration Factories
import "./pgg/PGGMultiSigFactory.sol";
import "./pgg/PGGArbitratorStakeAccountingFactory.sol";
import "./pgg/PGGOracleStakeAccountingFactory.sol";
import "./pgg/PGGConfigFactory.sol";
import "./pgg/PGGMultiSigCandidateTopFactory.sol";
import "./pgg/PGGOracleFactory.sol";
import "./pgg/PGGDelegateReputationVotingFactory.sol";
import "./pgg/PGGOracleStakeVotingFactory.sol";
// Arbitration Proposal Factories
import "./pgg/proposals/ArbitrationModifyThresholdProposalFactory.sol";
import "./pgg/proposals/ArbitrationModifyMofNProposalFactory.sol";
import "./pgg/proposals/ArbitrationModifyArbitratorStakeProposalFactory.sol";
import "./pgg/proposals/ArbitrationRevokeArbitratorsProposalFactory.sol";
import "./pgg/proposals/ArbitrationModifyContractAddressProposalFactory.sol";
import "./pgg/proposals/ArbitrationModifyApplicationConfigProposalFactory.sol";
import "./pgg/proposals/ArbitrationCreateGlobalProposalProposalManagerFactory.sol";
import "./pgg/proposals/ArbitrationSupportGlobalProposalProposalManagerFactory.sol";


contract MultiSigFactory is Ownable, Initializable {
  event BuildMultiSigFirstStep(
    bytes32 groupId,
    address arbitrationConfig,
    address arbitratorMultiSig,
    address oracleStakesAccounting
  );

  event BuildMultiSigSecondStep(
    bytes32 groupId,
    address arbitratorStakeAccounting,
    address arbitrationCandidateTop
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

  event BuildMultiSigFifthStep(
    bytes32 groupId,
    address modifyApplicationConfigProposalManager
  );

  event BuildMultiSigSeventhStep(
    bytes32 groupId,
    address delegateSpaceVoting,
    address delegateGaltVoting,
    address oracleStakeVoting
  );

  event BuildMultiSigEighthStep(
    bytes32 groupId,
    address createGlobalProposal,
    address supportGlobalProposal
  );

  event BuildMultiSigNinthStep(
    bytes32 groupId,
    address oracles
  );

  enum Step {
    FIRST,
    SECOND,
    THIRD,
    FOURTH,
    FIFTH,
    SIXTH,
    SEVENTH,
    EIGHTH,
    NINTH,
    DONE
  }

  bytes32 public constant FEE_KEY = bytes32("MULTI_SIG_FACTORY");

  struct PGGContractGroup {
    address creator;
    Step nextStep;
    PGGMultiSig arbitratorMultiSig;
    PGGMultiSigCandidateTop arbitrationCandidateTop;
    PGGConfig arbitrationConfig;
    PGGArbitratorStakeAccounting arbitratorStakeAccounting;
    PGGOracleStakeAccounting oracleStakesAccounting;
    IPGGOracleStakeVoting oracleStakeVoting;
    IPGGDelegateReputationVoting delegateSpaceVoting;
    IPGGDelegateReputationVoting delegateGaltVoting;

    MultiSigProposalContracts proposalContracts;
  }

  struct MultiSigProposalContracts {
    IProposalManager modifyThresholdProposalManager;
    IProposalManager modifyMofNProposalManager;
    IProposalManager modifyArbitratorStakeProposalManager;
    IProposalManager modifyContractAddressProposalManager;
    IProposalManager modifyApplicationConfigProposalManager;
    IProposalManager revokeArbitratorsProposalManager;
  }

  GaltGlobalRegistry public ggr;

  PGGConfigFactory arbitrationConfigFactory;
  PGGMultiSigFactory arbitratorMultiSigFactory;
  PGGMultiSigCandidateTopFactory arbitrationCandidateTopFactory;
  PGGArbitratorStakeAccountingFactory arbitratorStakeAccountingFactory;
  PGGOracleFactory arbitrationOracleFactory;
  PGGOracleStakeAccountingFactory oracleStakesAccountingFactory;
  PGGDelegateReputationVotingFactory delegateReputationVotingFactory;
  PGGOracleStakeVotingFactory oracleStakeVotingFactory;

  ArbitrationModifyThresholdProposalFactory arbitrationModifyThresholdProposalFactory;
  ArbitrationModifyMofNProposalFactory arbitrationModifyMofNProposalFactory;
  ArbitrationModifyArbitratorStakeProposalFactory arbitrationModifyArbitratorStakeProposalFactory;
  ArbitrationModifyContractAddressProposalFactory arbitrationModifyContractAddressProposalFactory;
  ArbitrationRevokeArbitratorsProposalFactory arbitrationRevokeArbitratorsProposalFactory;
  ArbitrationModifyApplicationConfigProposalFactory arbitrationModifyApplicationConfigProposalFactory;
  ArbitrationCreateGlobalProposalProposalManagerFactory arbitrationCreateGlobalProposalProposalManagerFactory;
  ArbitrationSupportGlobalProposalProposalManagerFactory arbitrationSupportGlobalProposalProposalManagerFactory;

  mapping(bytes32 => PGGContractGroup) private multiSigContractGroups;

  constructor (
    GaltGlobalRegistry _ggr,
    PGGMultiSigFactory _arbitratorMultiSigFactory,
    PGGMultiSigCandidateTopFactory _arbitrationCandidateTopFactory,
    PGGArbitratorStakeAccountingFactory _arbitratorStakeAccountingFactory,
    PGGOracleStakeAccountingFactory _oracleStakesAccountingFactory,
    PGGConfigFactory _arbitrationConfigFactory,
    PGGOracleFactory _arbitrationOracleFactory,
    PGGDelegateReputationVotingFactory _delegateReputationVotingFactory,
    PGGOracleStakeVotingFactory _oracleStakeVotingFactory
  ) public {
    oracleStakeVotingFactory = _oracleStakeVotingFactory;
    delegateReputationVotingFactory = _delegateReputationVotingFactory;

    arbitrationOracleFactory = _arbitrationOracleFactory;
    arbitrationConfigFactory = _arbitrationConfigFactory;
    oracleStakesAccountingFactory = _oracleStakesAccountingFactory;
    arbitratorStakeAccountingFactory = _arbitratorStakeAccountingFactory;
    arbitrationCandidateTopFactory = _arbitrationCandidateTopFactory;
    arbitratorMultiSigFactory = _arbitratorMultiSigFactory;

    ggr = _ggr;
  }

  modifier onlyFeeCollector() {
    require(ggr.getFeeCollectorAddress() == msg.sender, "Only fee collector allowed");
    _;
  }

  function initialize(
    ArbitrationModifyThresholdProposalFactory _arbitrationModifyThresholdProposalFactory,
    ArbitrationModifyMofNProposalFactory _arbitrationModifyMofNProposalFactory,
    ArbitrationModifyArbitratorStakeProposalFactory _arbitrationModifyArbitratorStakeProposalFactory,
    ArbitrationModifyContractAddressProposalFactory _arbitrationModifyContractAddressProposalFactory,
    ArbitrationRevokeArbitratorsProposalFactory _arbitrationRevokeArbitratorsProposalFactory,
    ArbitrationModifyApplicationConfigProposalFactory _arbitrationModifyApplicationConfigProposalFactory,
    ArbitrationCreateGlobalProposalProposalManagerFactory _arbitrationCreateGlobalProposalProposalManagerFactory,
    ArbitrationSupportGlobalProposalProposalManagerFactory _arbitrationSupportGlobalProposalProposalManagerFactory
  )
    external
    isInitializer
    onlyOwner
  {
    arbitrationSupportGlobalProposalProposalManagerFactory = _arbitrationSupportGlobalProposalProposalManagerFactory;
    arbitrationCreateGlobalProposalProposalManagerFactory = _arbitrationCreateGlobalProposalProposalManagerFactory;
    arbitrationModifyApplicationConfigProposalFactory = _arbitrationModifyApplicationConfigProposalFactory;
    arbitrationRevokeArbitratorsProposalFactory = _arbitrationRevokeArbitratorsProposalFactory;
    arbitrationModifyContractAddressProposalFactory = _arbitrationModifyContractAddressProposalFactory;
    arbitrationModifyArbitratorStakeProposalFactory = _arbitrationModifyArbitratorStakeProposalFactory;
    arbitrationModifyMofNProposalFactory = _arbitrationModifyMofNProposalFactory;
    arbitrationModifyThresholdProposalFactory = _arbitrationModifyThresholdProposalFactory;
  }

  function _acceptPayment() internal {
    if (msg.value == 0) {
      uint256 fee = IFeeRegistry(ggr.getFeeRegistryAddress()).getGaltFeeOrRevert(FEE_KEY);
      ggr.getGaltToken().transferFrom(msg.sender, address(this), fee);
    } else {
      uint256 fee = IFeeRegistry(ggr.getFeeRegistryAddress()).getEthFeeOrRevert(FEE_KEY);
      require(msg.value == fee, "Fee and msg.value not equal");
    }
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
    payable
    returns (bytes32 groupId)
  {
    _acceptPayment();

    groupId = keccak256(abi.encode(blockhash(block.number - 1), _initialMultiSigRequired, msg.sender));

    PGGContractGroup storage g = multiSigContractGroups[groupId];

    require(g.nextStep == Step.FIRST, "Requires FIRST step");

    PGGConfig arbitrationConfig = arbitrationConfigFactory.build(
      ggr,
      _m,
      _n,
      _minimalArbitratorStake,
      _thresholds
    );

    PGGMultiSig arbitratorMultiSig = arbitratorMultiSigFactory.build(_initialOwners, _initialMultiSigRequired, arbitrationConfig);
    PGGOracleStakeAccounting oracleStakesAccounting = oracleStakesAccountingFactory.build(arbitrationConfig);

    address claimManager = ggr.getClaimManagerAddress();
    arbitratorMultiSig.addRoleTo(claimManager, arbitratorMultiSig.ROLE_PROPOSER());

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
    PGGContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.SECOND, "SECOND step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    PGGArbitratorStakeAccounting arbitratorStakeAccounting = arbitratorStakeAccountingFactory.build(
      g.arbitrationConfig,
      _periodLength
    );
    PGGMultiSigCandidateTop arbitrationCandidateTop = arbitrationCandidateTopFactory.build(g.arbitrationConfig);

    g.arbitratorMultiSig.addRoleTo(address(arbitrationCandidateTop), g.arbitratorMultiSig.ROLE_ARBITRATOR_MANAGER());

    g.arbitratorStakeAccounting = arbitratorStakeAccounting;
    g.arbitrationCandidateTop = arbitrationCandidateTop;

    g.nextStep = Step.THIRD;

    emit BuildMultiSigSecondStep(_groupId, address(arbitratorStakeAccounting), address(arbitrationCandidateTop));
  }

  function buildThirdStep(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.THIRD, "THIRD step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IProposalManager thresholdProposals = arbitrationModifyThresholdProposalFactory.build(g.arbitrationConfig);
    IProposalManager mOfNProposals = arbitrationModifyMofNProposalFactory.build(g.arbitrationConfig);
    IProposalManager arbitratorStakeProposals = arbitrationModifyArbitratorStakeProposalFactory.build(g.arbitrationConfig);

    g.arbitrationConfig.addRoleTo(address(thresholdProposals), g.arbitrationConfig.THRESHOLD_MANAGER());
    g.arbitrationConfig.addRoleTo(address(mOfNProposals), g.arbitrationConfig.M_N_MANAGER());
    g.arbitrationConfig.addRoleTo(address(arbitratorStakeProposals), g.arbitrationConfig.MINIMAL_ARBITRATOR_STAKE_MANAGER());

    g.proposalContracts.modifyThresholdProposalManager = thresholdProposals;
    g.proposalContracts.modifyMofNProposalManager = mOfNProposals;
    g.proposalContracts.modifyArbitratorStakeProposalManager = arbitratorStakeProposals;

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
    PGGContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.FOURTH, "FOURTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IProposalManager changeAddressProposals = arbitrationModifyContractAddressProposalFactory.build(g.arbitrationConfig);
    IProposalManager revokeArbitratorsProposals = arbitrationRevokeArbitratorsProposalFactory.build(g.arbitrationConfig);

    g.arbitrationConfig.addRoleTo(address(changeAddressProposals), g.arbitrationConfig.CONTRACT_ADDRESS_MANAGER());
    g.arbitratorMultiSig.addRoleTo(address(revokeArbitratorsProposals), g.arbitratorMultiSig.ROLE_REVOKE_MANAGER());

    g.proposalContracts.modifyContractAddressProposalManager = changeAddressProposals;
    g.proposalContracts.revokeArbitratorsProposalManager = revokeArbitratorsProposals;

    g.nextStep = Step.FIFTH;

    emit BuildMultiSigFourthStep(
      _groupId,
      address(changeAddressProposals),
      address(revokeArbitratorsProposals)
    );
  }

  function buildFifthStep(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.FIFTH, "FIFTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IProposalManager modifyApplicationConfigProposals = arbitrationModifyApplicationConfigProposalFactory.build(g.arbitrationConfig);

    g.arbitrationConfig.addRoleTo(address(modifyApplicationConfigProposals), g.arbitrationConfig.APPLICATION_CONFIG_MANAGER());

    g.proposalContracts.modifyApplicationConfigProposalManager = modifyApplicationConfigProposals;

    g.nextStep = Step.SIXTH;

    emit BuildMultiSigFifthStep(
      _groupId,
      address(modifyApplicationConfigProposals)
    );
  }

  // can be called multiple times
  function buildSixthStep(
    bytes32 _groupId,
    bytes32[] calldata _keys,
    bytes32[] calldata _values
  )
    external
  {
    require(_keys.length == _values.length, "Keys and values arrays should have the same lengths");

    PGGContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.SIXTH, "SIXTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    g.arbitrationConfig.addRoleTo(address(this), g.arbitrationConfig.APPLICATION_CONFIG_MANAGER());
    for (uint256 i = 0; i < _keys.length; i++) {
      g.arbitrationConfig.setApplicationConfigValue(_keys[i], _values[i]);
    }
    g.arbitrationConfig.removeRoleFrom(address(this), g.arbitrationConfig.APPLICATION_CONFIG_MANAGER());
  }

  function buildSixthStepDone(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.SIXTH, "SIXTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    g.nextStep = Step.SEVENTH;
  }

  function buildSeventhStep(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.SEVENTH, "SEVENTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IPGGOracleStakeVoting oracleStakeVoting = oracleStakeVotingFactory.build(g.arbitrationConfig);
    IPGGDelegateReputationVoting delegateSpaceVoting = delegateReputationVotingFactory.build(
      g.arbitrationConfig,
      "SPACE_REPUTATION_NOTIFIER"
    );
    IPGGDelegateReputationVoting delegateGaltVoting = delegateReputationVotingFactory.build(
      g.arbitrationConfig,
      "GALT_REPUTATION_NOTIFIER"
    );

    g.nextStep = Step.EIGHTH;
    g.delegateSpaceVoting = delegateSpaceVoting;
    g.delegateGaltVoting = delegateGaltVoting;
    g.oracleStakeVoting = oracleStakeVoting;

    emit BuildMultiSigSeventhStep(
      _groupId,
      address(delegateSpaceVoting),
      address(delegateGaltVoting),
      address(oracleStakeVoting)
    );
  }

  function buildEighthStep(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.EIGHTH, "EIGHTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IProposalManager createGlobalProposal = arbitrationCreateGlobalProposalProposalManagerFactory.build(
      g.arbitrationConfig
    );

    IProposalManager supportGlobalProposal = arbitrationSupportGlobalProposalProposalManagerFactory.build(
      g.arbitrationConfig
    );

    g.arbitrationConfig.addRoleTo(address(this), g.arbitrationConfig.APPLICATION_CONFIG_MANAGER());
    g.arbitrationConfig.addRoleTo(address(createGlobalProposal), g.arbitrationConfig.CREATE_GLOBAL_PROPOSAL_MANAGER());
    g.arbitrationConfig.addRoleTo(address(supportGlobalProposal), g.arbitrationConfig.SUPPORT_GLOBAL_PROPOSAL_MANAGER());
    g.arbitrationConfig.removeRoleFrom(address(this), g.arbitrationConfig.APPLICATION_CONFIG_MANAGER());

    g.arbitrationConfig.addRoleTo(address(this), g.arbitrationConfig.EXTERNAL_ROLE_MANAGER());
    g.arbitrationConfig.addExternalRoleTo(address(createGlobalProposal), g.arbitrationConfig.GLOBAL_PROPOSAL_CREATOR_ROLE());
    g.arbitrationConfig.addExternalRoleTo(address(g.oracleStakesAccounting), g.arbitrationConfig.STAKE_TRACKER_NOTIFIER_ROLE());
    g.arbitrationConfig.removeRoleFrom(address(this), g.arbitrationConfig.EXTERNAL_ROLE_MANAGER());

    g.nextStep = Step.NINTH;

    emit BuildMultiSigEighthStep(
      _groupId,
      address(createGlobalProposal),
      address(supportGlobalProposal)
    );
  }

  function buildNinthStep(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.NINTH, "NINTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    PGGOracles oracles = arbitrationOracleFactory.build(g.arbitrationConfig);

    g.arbitrationConfig.initialize(
      g.arbitratorMultiSig,
      g.arbitrationCandidateTop,
      g.arbitratorStakeAccounting,
      g.oracleStakesAccounting,
      oracles,
      g.delegateSpaceVoting,
      g.delegateGaltVoting,
      g.oracleStakeVoting
    );

    // TODO: initialize proposal contracts too

    // Revoke role management permissions from this factory address
    g.arbitrationCandidateTop.removeRoleFrom(address(this), "role_manager");
    g.arbitratorMultiSig.removeRoleFrom(address(this), "role_manager");
    g.oracleStakesAccounting.removeRoleFrom(address(this), "role_manager");
    g.arbitrationConfig.removeRoleFrom(address(this), "role_manager");
    oracles.removeRoleFrom(address(this), "role_manager");

    g.proposalContracts.modifyThresholdProposalManager.removeRoleFrom(address(this), "role_manager");
    g.proposalContracts.modifyMofNProposalManager.removeRoleFrom(address(this), "role_manager");
    g.proposalContracts.modifyArbitratorStakeProposalManager.removeRoleFrom(address(this), "role_manager");
    g.proposalContracts.modifyContractAddressProposalManager.removeRoleFrom(address(this), "role_manager");
    g.proposalContracts.revokeArbitratorsProposalManager.removeRoleFrom(address(this), "role_manager");
    g.proposalContracts.modifyApplicationConfigProposalManager.removeRoleFrom(address(this), "role_manager");

    IPGGRegistry(ggr.getPggRegistryAddress()).addPgg(g.arbitratorMultiSig, g.arbitrationConfig);

    g.nextStep = Step.DONE;

    emit BuildMultiSigNinthStep(
      _groupId,
      address(oracles)
    );
  }

  function withdrawEthFees() external onlyFeeCollector {
    msg.sender.transfer(address(this).balance);
  }

  function withdrawGaltFees() external onlyFeeCollector {
    IERC20 galtToken = ggr.getGaltToken();
    galtToken.transfer(msg.sender, galtToken.balanceOf(address(this)));
  }

  function getGroup(bytes32 _groupId) external view returns (Step nextStep, address creator) {
    PGGContractGroup storage g = multiSigContractGroups[_groupId];
    return (g.nextStep, g.creator);
  }
}
