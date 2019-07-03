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

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/traits/Initializable.sol";
import "../registries/GaltGlobalRegistry.sol";
import "../registries/interfaces/IPGGRegistry.sol";
import "../registries/interfaces/IFeeRegistry.sol";
import "../applications/ClaimManager.sol";
import "../pgg/PGGConfig.sol";
import "../pgg/interfaces/IPGGProposalManager.sol";
import "../pgg/voting/interfaces/IPGGOracleStakeVoting.sol";
import "../pgg/voting/interfaces/IPGGDelegateReputationVoting.sol";
import "../pgg/voting/interfaces/IPGGMultiSigCandidateTop.sol";
import "../pgg/voting/PGGMultiSigCandidateTop.sol";
import "../pgg/interfaces/IPGGOracles.sol";
import "../pgg/interfaces/IPGGProposalManager.sol";
import "../pgg/PGGProposalManager.sol";
// Arbitration Factories
import "./pgg/PGGMultiSigFactory.sol";
import "./pgg/PGGArbitratorStakeAccountingFactory.sol";
import "./pgg/PGGOracleStakeAccountingFactory.sol";
import "./pgg/PGGConfigFactory.sol";
import "./pgg/PGGMultiSigCandidateTopFactory.sol";
import "./pgg/PGGOracleFactory.sol";
import "./pgg/PGGDelegateReputationVotingFactory.sol";
import "./pgg/PGGOracleStakeVotingFactory.sol";
import "./pgg/PGGProposalManagerFactory.sol";


contract PGGFactory is Initializable {
  event BuildPGGFirstStep(
    bytes32 indexed groupId,
    address pggConfig,
    address pggMultiSig,
    address pggOracleStakeAccounting
  );

  event BuildPGGSecondStep(
    bytes32 indexed groupId,
    address pggArbitratorStakeAccounting,
    address pggMultiSigCandidateTop
  );

  event BuildPGGThirdStep(bytes32 indexed groupId);
  event BuildPGGThirdStepDone(bytes32 indexed groupId);
  event BuildPGGFourthStep(
    bytes32 indexed groupId,
    address pggDelegateSpaceVoting,
    address pggDelegateGaltVoting,
    address pggOracleStakeVoting
  );
  event BuildPGGFifthStep(bytes32 indexed groupId);
  event BuildPGGFifthStepDone(bytes32 indexed groupId);

  event BuildPGGSixthStep(
    bytes32 indexed groupId,
    address pggOracles,
    address pggProposalManager
  );

  enum Step {
    FIRST,
    SECOND,
    THIRD,
    FOURTH,
    FIFTH,
    SIXTH,
    DONE
  }

  bytes32 public constant FEE_KEY = bytes32("PGG_FACTORY");
  bytes32 public constant ROLE_FEE_COLLECTOR = bytes32("FEE_COLLECTOR");

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
    IPGGProposalManager modifyThresholdProposalManager;
    IPGGProposalManager modifyMofNProposalManager;
    IPGGProposalManager modifyArbitratorStakeProposalManager;
    IPGGProposalManager modifyContractAddressProposalManager;
    IPGGProposalManager modifyApplicationConfigProposalManager;
    IPGGProposalManager revokeArbitratorsProposalManager;
  }

  GaltGlobalRegistry public ggr;

  PGGConfigFactory internal pggConfigFactory;
  PGGMultiSigFactory internal pggMultiSigFactory;
  PGGMultiSigCandidateTopFactory internal pggMultiSigCandidateTopFactory;
  PGGArbitratorStakeAccountingFactory internal pggArbitratorStakeAccountingFactory;
  PGGOracleFactory internal pggArbitrationOracleFactory;
  PGGOracleStakeAccountingFactory internal pggOracleStakeAccountingFactory;
  PGGDelegateReputationVotingFactory internal pggDelegateReputationVotingFactory;
  PGGOracleStakeVotingFactory internal pggOracleStakeVotingFactory;

  PGGProposalManagerFactory internal pggProposalManagerFactory;

  mapping(bytes32 => PGGContractGroup) internal pggs;

  constructor (
    GaltGlobalRegistry _ggr,
    PGGMultiSigFactory _pggMultiSigFactory,
    PGGMultiSigCandidateTopFactory _pggMultiSigCandidateTopFactory,
    PGGArbitratorStakeAccountingFactory _pggArbitratorStakeAccountingFactory,
    PGGOracleStakeAccountingFactory _pggOracleStakeAccountingFactory,
    PGGConfigFactory _pggConfigFactory,
    PGGOracleFactory _pggOracleFactory,
    PGGDelegateReputationVotingFactory _delegateReputationVotingFactory,
    PGGOracleStakeVotingFactory _pggOracleStakeVotingFactory,
    PGGProposalManagerFactory _pggProposalManagerFactory
  ) public {
    pggOracleStakeVotingFactory = _pggOracleStakeVotingFactory;
    pggDelegateReputationVotingFactory = _delegateReputationVotingFactory;

    pggArbitrationOracleFactory = _pggOracleFactory;
    pggConfigFactory = _pggConfigFactory;
    pggOracleStakeAccountingFactory = _pggOracleStakeAccountingFactory;
    pggArbitratorStakeAccountingFactory = _pggArbitratorStakeAccountingFactory;
    pggMultiSigCandidateTopFactory = _pggMultiSigCandidateTopFactory;
    pggMultiSigFactory = _pggMultiSigFactory;
    pggProposalManagerFactory = _pggProposalManagerFactory;

    ggr = _ggr;
  }

  modifier onlyFeeCollector() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_FEE_COLLECTOR),
      "Only FEE_COLLECTOR role allowed"
    );
    _;
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
    uint256 _defaultProposalThreshold
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
      _defaultProposalThreshold
    );

    PGGMultiSig pggMultiSig = pggMultiSigFactory.build(_initialOwners, _initialMultiSigRequired, pggConfig);
    PGGOracleStakeAccounting pggOracleStakeAccounting = pggOracleStakeAccountingFactory.build(pggConfig);

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

    g.pggConfig.addInternalRole(address(pggMultiSigCandidateTop), g.pggMultiSig.ROLE_ARBITRATOR_MANAGER());

    g.pggArbitratorStakeAccounting = pggArbitratorStakeAccounting;
    g.pggMultiSigCandidateTop = pggMultiSigCandidateTop;

    g.nextStep = Step.THIRD;

    emit BuildPGGSecondStep(_groupId, address(pggArbitratorStakeAccounting), address(pggMultiSigCandidateTop));
  }

  // can be called multiple times
  function buildThirdStep(
    bytes32 _groupId,
    bytes32[] calldata _keys,
    bytes32[] calldata _values
  )
    external
  {
    require(_keys.length == _values.length, "Keys and values arrays should have the same lengths");

    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.THIRD, "THIRD step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    g.pggConfig.addInternalRole(address(this), g.pggConfig.APPLICATION_CONFIG_MANAGER());
    for (uint256 i = 0; i < _keys.length; i++) {
      g.pggConfig.setApplicationConfigValue(_keys[i], _values[i]);
    }
    g.pggConfig.removeInternalRole(address(this), g.pggConfig.APPLICATION_CONFIG_MANAGER());

    emit BuildPGGThirdStep(_groupId);
  }

  function buildThirdStepDone(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.THIRD, "THIRD step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    g.nextStep = Step.FOURTH;

    emit BuildPGGThirdStepDone(_groupId);
  }

  function buildFourthStep(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.FOURTH, "FOURTH step required");
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

    g.pggConfig.addInternalRole(address(g.pggOracleStakeAccounting), oracleStakeVoting.ROLE_ORACLE_STAKE_NOTIFIER());

    g.nextStep = Step.FIFTH;
    g.pggDelegateSpaceVoting = delegateSpaceVoting;
    g.pggDelegateGaltVoting = delegateGaltVoting;
    g.pggOracleStakeVoting = oracleStakeVoting;

    emit BuildPGGFourthStep(
      _groupId,
      address(delegateSpaceVoting),
      address(delegateGaltVoting),
      address(oracleStakeVoting)
    );
  }

  function buildFifthStep(
    bytes32 _groupId,
    bytes32[] calldata _thresholdKeys,
    uint256[] calldata _thresholdValues
  )
    external
  {
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.FIFTH, "FIFTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    uint256 len = _thresholdValues.length;
    require(len == _thresholdKeys.length, "Thresholds key and value array lengths mismatch");
    PGGConfig pggConfig = g.pggConfig;

    pggConfig.addInternalRole(address(this), pggConfig.THRESHOLD_MANAGER());

    for (uint256 i = 0; i < len; i++) {
      pggConfig.setThreshold(_thresholdKeys[i], _thresholdValues[i]);
    }

    g.pggConfig.removeInternalRole(address(this), g.pggConfig.THRESHOLD_MANAGER());

    emit BuildPGGFifthStep(_groupId);
  }

  function buildFifthStepDone(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.FIFTH, "FIFTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    g.nextStep = Step.SIXTH;

    emit BuildPGGFifthStepDone(_groupId);
  }

  function buildSixthStep(
    bytes32 _groupId
  )
    external
  {
    PGGContractGroup storage g = pggs[_groupId];
    require(g.nextStep == Step.SIXTH, "SIXTH step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    PGGOracles oracles = pggArbitrationOracleFactory.build(g.pggConfig);
    IPGGProposalManager proposalManager = pggProposalManagerFactory.build(g.pggConfig);

    g.pggConfig.addInternalRole(address(proposalManager), g.pggConfig.CONTRACT_ADDRESS_MANAGER());
    g.pggConfig.addInternalRole(address(proposalManager), g.pggConfig.THRESHOLD_MANAGER());
    g.pggConfig.addInternalRole(address(proposalManager), g.pggConfig.M_N_MANAGER());
    g.pggConfig.addInternalRole(address(proposalManager), g.pggConfig.MINIMAL_ARBITRATOR_STAKE_MANAGER());
    g.pggConfig.addInternalRole(address(proposalManager), g.pggConfig.APPLICATION_CONFIG_MANAGER());
    g.pggConfig.addInternalRole(address(proposalManager), g.pggConfig.SUPPORT_GLOBAL_PROPOSAL_MANAGER());
    g.pggConfig.addInternalRole(address(proposalManager), g.pggConfig.DEFAULT_PROPOSAL_THRESHOLD_MANAGER());
    g.pggConfig.addInternalRole(address(proposalManager), g.pggConfig.EXTERNAL_ROLE_MANAGER());
    g.pggConfig.addInternalRole(address(proposalManager), g.pggConfig.INTERNAL_ROLE_MANAGER());
    g.pggConfig.addInternalRole(address(proposalManager), g.pggMultiSig.ROLE_REVOKE_MANAGER());

    g.pggConfig.addInternalRole(address(this), g.pggConfig.EXTERNAL_ROLE_MANAGER());
    g.pggConfig.addExternalRole(address(proposalManager), g.pggConfig.GLOBAL_PROPOSAL_CREATOR_ROLE());
    g.pggConfig.addExternalRole(address(g.pggOracleStakeAccounting), g.pggConfig.STAKE_TRACKER_NOTIFIER_ROLE());
    g.pggConfig.removeInternalRole(address(this), g.pggConfig.EXTERNAL_ROLE_MANAGER());

    g.pggConfig.initialize(
      g.pggMultiSig,
      g.pggMultiSigCandidateTop,
      g.pggArbitratorStakeAccounting,
      g.pggOracleStakeAccounting,
      oracles,
      g.pggDelegateSpaceVoting,
      g.pggDelegateGaltVoting,
      g.pggOracleStakeVoting,
      proposalManager
    );

    g.pggConfig.removeInternalRole(address(this), g.pggConfig.INTERNAL_ROLE_MANAGER());

    IPGGRegistry(ggr.getPggRegistryAddress()).addPgg(g.pggConfig);

    g.nextStep = Step.DONE;

    emit BuildPGGSixthStep(
      _groupId,
      address(oracles),
      address(proposalManager)
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
