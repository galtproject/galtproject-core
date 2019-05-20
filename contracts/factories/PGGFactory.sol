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


contract PGGFactory is Ownable, Initializable {
  event BuildPGGFirstStep(
    bytes32 groupId,
    address pggConfig,
    address pggMultiSig,
    address pggOracleStakeAccounting
  );

  event BuildPGGSecondStep(
    bytes32 groupId,
    address pggArbitratorStakeAccounting,
    address pggMultiSigCandidateTop
  );

  event BuildPGGThirdStep(
    bytes32 groupId,
    address modifyThresholdProposalManager,
    address modifyMofNProposalManager,
    address modifyArbitratorStakeProposalManager
  );

  event BuildPGGFourthStep(
    bytes32 groupId,
    address modifyContractAddressProposalManager,
    address revokeArbitratorsProposalManager
  );

  event BuildPGGFifthStep(
    bytes32 groupId,
    address modifyApplicationConfigProposalManager
  );

  event BuildPGGSeventhStep(
    bytes32 groupId,
    address pggDelegateSpaceVoting,
    address pggDelegateGaltVoting,
    address pggOracleStakeVoting
  );

  event BuildPGGEighthStep(
    bytes32 groupId,
    address createGlobalProposal,
    address supportGlobalProposal
  );

  event BuildPGGNinthStep(
    bytes32 groupId,
    address pggOracles
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

  bytes32 public constant FEE_KEY = bytes32("PGG_FACTORY");

  struct PGGContractGroup {
    address creator;
    Step nextStep;
    PGGMultiSig pggMultiSig;
    PGGMultiSigCandidateTop pggMultiSigCandidateTop;
    PGGConfig pggConfig;
    PGGArbitratorStakeAccounting pggArbitratorStakeAccounting;
    PGGOracleStakeAccounting pggOracleStakeAccounting;
    IPGGOracleStakeVoting pggOracleStakeVoting;
    IPGGDelegateReputationVoting pggDelegateSpaceVoting;
    IPGGDelegateReputationVoting pggDelegateGaltVoting;

    PGGProposalContracts proposalContracts;
  }

  struct PGGProposalContracts {
    IProposalManager modifyThresholdProposalManager;
    IProposalManager modifyMofNProposalManager;
    IProposalManager modifyArbitratorStakeProposalManager;
    IProposalManager modifyContractAddressProposalManager;
    IProposalManager modifyApplicationConfigProposalManager;
    IProposalManager revokeArbitratorsProposalManager;
  }

  GaltGlobalRegistry public ggr;

  PGGConfigFactory pggConfigFactory;
  PGGMultiSigFactory pggMultiSigFactory;
  PGGMultiSigCandidateTopFactory pggMultiSigCandidateTopFactory;
  PGGArbitratorStakeAccountingFactory pggArbitratorStakeAccountingFactory;
  PGGOracleFactory pggArbitrationOracleFactory;
  PGGOracleStakeAccountingFactory pggOracleStakeAccountingFactory;
  PGGDelegateReputationVotingFactory pggDelegateReputationVotingFactory;
  PGGOracleStakeVotingFactory pggOracleStakeVotingFactory;

  ArbitrationModifyThresholdProposalFactory arbitrationModifyThresholdProposalFactory;
  ArbitrationModifyMofNProposalFactory arbitrationModifyMofNProposalFactory;
  ArbitrationModifyArbitratorStakeProposalFactory arbitrationModifyArbitratorStakeProposalFactory;
  ArbitrationModifyContractAddressProposalFactory arbitrationModifyContractAddressProposalFactory;
  ArbitrationRevokeArbitratorsProposalFactory arbitrationRevokeArbitratorsProposalFactory;
  ArbitrationModifyApplicationConfigProposalFactory arbitrationModifyApplicationConfigProposalFactory;
  ArbitrationCreateGlobalProposalProposalManagerFactory arbitrationCreateGlobalProposalProposalManagerFactory;
  ArbitrationSupportGlobalProposalProposalManagerFactory arbitrationSupportGlobalProposalProposalManagerFactory;

  mapping(bytes32 => PGGContractGroup) private pggs;

  constructor (
    GaltGlobalRegistry _ggr,
    PGGMultiSigFactory _pggMultiSigFactory,
    PGGMultiSigCandidateTopFactory _pggMultiSigCandidateTopFactory,
    PGGArbitratorStakeAccountingFactory _pggArbitratorStakeAccountingFactory,
    PGGOracleStakeAccountingFactory _pggOracleStakeAccountingFactory,
    PGGConfigFactory _pggConfigFactory,
    PGGOracleFactory _pggOracleFactory,
    PGGDelegateReputationVotingFactory _delegateReputationVotingFactory,
    PGGOracleStakeVotingFactory _pggOracleStakeVotingFactory
  ) public {
    pggOracleStakeVotingFactory = _pggOracleStakeVotingFactory;
    pggDelegateReputationVotingFactory = _delegateReputationVotingFactory;

    pggArbitrationOracleFactory = _pggOracleFactory;
    pggConfigFactory = _pggConfigFactory;
    pggOracleStakeAccountingFactory = _pggOracleStakeAccountingFactory;
    pggArbitratorStakeAccountingFactory = _pggArbitratorStakeAccountingFactory;
    pggMultiSigCandidateTopFactory = _pggMultiSigCandidateTopFactory;
    pggMultiSigFactory = _pggMultiSigFactory;

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

    PGGContractGroup storage g = pggs[groupId];

    require(g.nextStep == Step.FIRST, "Requires FIRST step");

    PGGConfig pggConfig = pggConfigFactory.build(
      ggr,
      _m,
      _n,
      _minimalArbitratorStake,
      _thresholds
    );

    PGGMultiSig pggMultiSig = pggMultiSigFactory.build(_initialOwners, _initialMultiSigRequired, pggConfig);
    PGGOracleStakeAccounting pggOracleStakeAccounting = pggOracleStakeAccountingFactory.build(pggConfig);

    address claimManager = ggr.getClaimManagerAddress();
    pggMultiSig.addRoleTo(claimManager, pggMultiSig.ROLE_PROPOSER());

    g.creator = msg.sender;
    g.pggMultiSig = pggMultiSig;
    g.pggOracleStakeAccounting = pggOracleStakeAccounting;
    g.pggConfig = pggConfig;
    g.nextStep = Step.SECOND;

    emit BuildPGGFirstStep(groupId, address(pggConfig), address(pggMultiSig), address(pggOracleStakeAccounting));
  }

  function buildSecondStep(
    bytes32 _groupId,
    uint256 _periodLength
  )
    external
  {
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.SECOND, "SECOND step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    PGGArbitratorStakeAccounting pggArbitratorStakeAccounting = pggArbitratorStakeAccountingFactory.build(
      g.pggConfig,
      _periodLength
    );
    PGGMultiSigCandidateTop pggMultiSigCandidateTop = pggMultiSigCandidateTopFactory.build(g.pggConfig);

    g.pggMultiSig.addRoleTo(address(pggMultiSigCandidateTop), g.pggMultiSig.ROLE_ARBITRATOR_MANAGER());

    g.pggArbitratorStakeAccounting = pggArbitratorStakeAccounting;
    g.pggMultiSigCandidateTop = pggMultiSigCandidateTop;

    g.nextStep = Step.THIRD;

    emit BuildPGGSecondStep(_groupId, address(pggArbitratorStakeAccounting), address(pggMultiSigCandidateTop));
  }

  function buildThirdStep(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.THIRD, "THIRD step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IProposalManager thresholdProposals = arbitrationModifyThresholdProposalFactory.build(g.pggConfig);
    IProposalManager mOfNProposals = arbitrationModifyMofNProposalFactory.build(g.pggConfig);
    IProposalManager arbitratorStakeProposals = arbitrationModifyArbitratorStakeProposalFactory.build(g.pggConfig);

    g.pggConfig.addRoleTo(address(thresholdProposals), g.pggConfig.THRESHOLD_MANAGER());
    g.pggConfig.addRoleTo(address(mOfNProposals), g.pggConfig.M_N_MANAGER());
    g.pggConfig.addRoleTo(address(arbitratorStakeProposals), g.pggConfig.MINIMAL_ARBITRATOR_STAKE_MANAGER());

    g.proposalContracts.modifyThresholdProposalManager = thresholdProposals;
    g.proposalContracts.modifyMofNProposalManager = mOfNProposals;
    g.proposalContracts.modifyArbitratorStakeProposalManager = arbitratorStakeProposals;

    g.nextStep = Step.FOURTH;

    emit BuildPGGThirdStep(
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
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.FOURTH, "FOURTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IProposalManager changeAddressProposals = arbitrationModifyContractAddressProposalFactory.build(g.pggConfig);
    IProposalManager revokeArbitratorsProposals = arbitrationRevokeArbitratorsProposalFactory.build(g.pggConfig);

    g.pggConfig.addRoleTo(address(changeAddressProposals), g.pggConfig.CONTRACT_ADDRESS_MANAGER());
    g.pggMultiSig.addRoleTo(address(revokeArbitratorsProposals), g.pggMultiSig.ROLE_REVOKE_MANAGER());

    g.proposalContracts.modifyContractAddressProposalManager = changeAddressProposals;
    g.proposalContracts.revokeArbitratorsProposalManager = revokeArbitratorsProposals;

    g.nextStep = Step.FIFTH;

    emit BuildPGGFourthStep(
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
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.FIFTH, "FIFTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IProposalManager modifyApplicationConfigProposals = arbitrationModifyApplicationConfigProposalFactory.build(g.pggConfig);

    g.pggConfig.addRoleTo(address(modifyApplicationConfigProposals), g.pggConfig.APPLICATION_CONFIG_MANAGER());

    g.proposalContracts.modifyApplicationConfigProposalManager = modifyApplicationConfigProposals;

    g.nextStep = Step.SIXTH;

    emit BuildPGGFifthStep(
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

    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.SIXTH, "SIXTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    g.pggConfig.addRoleTo(address(this), g.pggConfig.APPLICATION_CONFIG_MANAGER());
    for (uint256 i = 0; i < _keys.length; i++) {
      g.pggConfig.setApplicationConfigValue(_keys[i], _values[i]);
    }
    g.pggConfig.removeRoleFrom(address(this), g.pggConfig.APPLICATION_CONFIG_MANAGER());
  }

  function buildSixthStepDone(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.SIXTH, "SIXTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    g.nextStep = Step.SEVENTH;
  }

  function buildSeventhStep(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.SEVENTH, "SEVENTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IPGGOracleStakeVoting oracleStakeVoting = pggOracleStakeVotingFactory.build(g.pggConfig);
    IPGGDelegateReputationVoting delegateSpaceVoting = pggDelegateReputationVotingFactory.build(
      g.pggConfig,
      "SPACE_REPUTATION_NOTIFIER"
    );
    IPGGDelegateReputationVoting delegateGaltVoting = pggDelegateReputationVotingFactory.build(
      g.pggConfig,
      "GALT_REPUTATION_NOTIFIER"
    );

    g.nextStep = Step.EIGHTH;
    g.pggDelegateSpaceVoting = delegateSpaceVoting;
    g.pggDelegateGaltVoting = delegateGaltVoting;
    g.pggOracleStakeVoting = oracleStakeVoting;

    emit BuildPGGSeventhStep(
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
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.EIGHTH, "EIGHTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    IProposalManager createGlobalProposal = arbitrationCreateGlobalProposalProposalManagerFactory.build(
      g.pggConfig
    );

    IProposalManager supportGlobalProposal = arbitrationSupportGlobalProposalProposalManagerFactory.build(
      g.pggConfig
    );

    g.pggConfig.addRoleTo(address(this), g.pggConfig.APPLICATION_CONFIG_MANAGER());
    g.pggConfig.addRoleTo(address(createGlobalProposal), g.pggConfig.CREATE_GLOBAL_PROPOSAL_MANAGER());
    g.pggConfig.addRoleTo(address(supportGlobalProposal), g.pggConfig.SUPPORT_GLOBAL_PROPOSAL_MANAGER());
    g.pggConfig.removeRoleFrom(address(this), g.pggConfig.APPLICATION_CONFIG_MANAGER());

    g.pggConfig.addRoleTo(address(this), g.pggConfig.EXTERNAL_ROLE_MANAGER());
    g.pggConfig.addExternalRoleTo(address(createGlobalProposal), g.pggConfig.GLOBAL_PROPOSAL_CREATOR_ROLE());
    g.pggConfig.addExternalRoleTo(address(g.pggOracleStakeAccounting), g.pggConfig.STAKE_TRACKER_NOTIFIER_ROLE());
    g.pggConfig.removeRoleFrom(address(this), g.pggConfig.EXTERNAL_ROLE_MANAGER());

    g.nextStep = Step.NINTH;

    emit BuildPGGEighthStep(
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
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.NINTH, "NINTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    PGGOracles oracles = pggArbitrationOracleFactory.build(g.pggConfig);

    g.pggConfig.initialize(
      g.pggMultiSig,
      g.pggMultiSigCandidateTop,
      g.pggArbitratorStakeAccounting,
      g.pggOracleStakeAccounting,
      oracles,
      g.pggDelegateSpaceVoting,
      g.pggDelegateGaltVoting,
      g.pggOracleStakeVoting
    );

    // TODO: initialize proposal contracts too

    // Revoke role management permissions from this factory address
    g.pggMultiSigCandidateTop.removeRoleFrom(address(this), "role_manager");
    g.pggMultiSig.removeRoleFrom(address(this), "role_manager");
    g.pggOracleStakeAccounting.removeRoleFrom(address(this), "role_manager");
    g.pggConfig.removeRoleFrom(address(this), "role_manager");
    oracles.removeRoleFrom(address(this), "role_manager");

    g.proposalContracts.modifyThresholdProposalManager.removeRoleFrom(address(this), "role_manager");
    g.proposalContracts.modifyMofNProposalManager.removeRoleFrom(address(this), "role_manager");
    g.proposalContracts.modifyArbitratorStakeProposalManager.removeRoleFrom(address(this), "role_manager");
    g.proposalContracts.modifyContractAddressProposalManager.removeRoleFrom(address(this), "role_manager");
    g.proposalContracts.revokeArbitratorsProposalManager.removeRoleFrom(address(this), "role_manager");
    g.proposalContracts.modifyApplicationConfigProposalManager.removeRoleFrom(address(this), "role_manager");

    IPGGRegistry(ggr.getPggRegistryAddress()).addPgg(g.pggConfig);

    g.nextStep = Step.DONE;

    emit BuildPGGNinthStep(
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
    PGGContractGroup storage g = pggs[_groupId];
    return (g.nextStep, g.creator);
  }
}
