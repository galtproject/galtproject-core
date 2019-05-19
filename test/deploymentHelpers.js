const PGGFactory = artifacts.require('./PGGFactory.sol');
const PGGMultiSigFactory = artifacts.require('./PGGMultiSigFactory.sol');
const PGGMultiSigCandidateTopFactory = artifacts.require('./PGGMultiSigCandidateTopFactory.sol');
const PGGArbitratorStakeAccountingFactory = artifacts.require('./PGGArbitratorStakeAccountingFactory.sol');
const PGGOracleStakeAccountingFactory = artifacts.require('./PGGOracleStakeAccountingFactory.sol');
const PGGConfigFactory = artifacts.require('./PGGConfigFactory.sol');
const PGGOracleFactory = artifacts.require('./PGGOracleFactory.sol');
const PGGDelegateReputationVotingFactory = artifacts.require('./PGGDelegateReputationVotingFactory.sol');
const PGGOracleStakeVotingFactory = artifacts.require('./PGGOracleStakeVotingFactory.sol');

const ArbitrationModifyThresholdProposalFactory = artifacts.require('./ArbitrationModifyThresholdProposalFactory.sol');
const ArbitrationModifyApplicationConfigProposalFactory = artifacts.require(
  './ArbitrationModifyApplicationConfigProposalFactory.sol'
);
const ArbitrationModifyMofNProposalFactory = artifacts.require('./ArbitrationModifyMofNProposalFactory.sol');
const ArbitrationModifyArbitratorStakeProposalFactory = artifacts.require(
  './ArbitrationModifyArbitratorStakeProposalFactory.sol'
);
const ArbitrationModifyContractAddressProposalFactory = artifacts.require(
  './ArbitrationModifyContractAddressProposalFactory.sol'
);
const ArbitrationRevokeArbitratorsProposalFactory = artifacts.require(
  './ArbitrationRevokeArbitratorsProposalFactory.sol'
);
const ArbitrationCreateGlobalProposalProposalManagerFactory = artifacts.require(
  './ArbitrationCreateGlobalProposalProposalManagerFactory.sol'
);
const ArbitrationSupportGlobalProposalProposalManagerFactory = artifacts.require(
  './ArbitrationSupportGlobalProposalProposalManagerFactory.sol'
);

const PGGArbitratorStakeAccounting = artifacts.require('./PGGArbitratorStakeAccounting.sol');
const PGGOracleStakeAccounting = artifacts.require('./PGGOracleStakeAccounting.sol');
const PGGMultiSig = artifacts.require('./PGGMultiSig.sol');
const PGGMultiSigCandidateTop = artifacts.require('./PGGMultiSigCandidateTop.sol');
const PGGConfig = artifacts.require('./PGGConfig.sol');
const PGGOracles = artifacts.require('./PGGOracles.sol');
const PGGDelegateReputationVoting = artifacts.require('./PGGDelegateReputationVoting.sol');
const PGGOracleStakeVoting = artifacts.require('./PGGOracleStakeVoting.sol');
const ModifyThresholdProposalManager = artifacts.require('./ModifyThresholdProposalManager.sol');
const ModifyApplicationConfigProposalManager = artifacts.require('./ModifyApplicationConfigProposalManager.sol');
const ModifyMofNProposalManager = artifacts.require('./ModifyMofNProposalManager.sol');
const ModifyMinimalArbitratrorStakeProposalManager = artifacts.require(
  './ModifyMinimalArbitratorStakeProposalManager.sol'
);
const CreateGlobalProposalProposalManager = artifacts.require('./CreateGlobalProposalProposalManager.sol');
const SupportGlobalProposalProposalManager = artifacts.require('./SupportGlobalProposalProposalManager.sol');
const ModifyContractAddressProposalManager = artifacts.require('./ModifyContractAddressProposalManager.sol');
const RevokeArbitratorsProposalManager = artifacts.require('./RevokeArbitratorsProposalManager.sol');

PGGMultiSigCandidateTop.numberFormat = 'String';

const Helpers = {
  async deployPGGFactory(ggr, owner) {
    const pggMultiSigFactory = await PGGMultiSigFactory.new({ from: owner });
    const pggMultiSigCandidateTopFactory = await PGGMultiSigCandidateTopFactory.new({ from: owner });
    const pggOracleStakeFactory = await PGGOracleStakeAccountingFactory.new({ from: owner });
    const pggArbitratorStakeFactory = await PGGArbitratorStakeAccountingFactory.new({ from: owner });
    const pggConfigFactory = await PGGConfigFactory.new({ from: owner });
    const pggOracleFactory = await PGGOracleFactory.new({ from: owner });
    const pggDelegateReputationVotingFactory = await PGGDelegateReputationVotingFactory.new({ from: owner });
    const pggOracleStakeVotingFactory = await PGGOracleStakeVotingFactory.new({ from: owner });

    const arbitrationModifyThresholdProposalFactory = await ArbitrationModifyThresholdProposalFactory.new({
      from: owner
    });
    const arbitrationModifyMofNProposalFactory = await ArbitrationModifyMofNProposalFactory.new({ from: owner });
    const arbitrationModifyArbitratorStakeProposalFactory = await ArbitrationModifyArbitratorStakeProposalFactory.new({
      from: owner
    });
    const arbitrationModifyContractAddressProposalFactory = await ArbitrationModifyContractAddressProposalFactory.new({
      from: owner
    });
    const arbitrationRevokeArbitratorsProposalFactory = await ArbitrationRevokeArbitratorsProposalFactory.new({
      from: owner
    });
    // eslint-disable-next-line
    const arbitrationModifyApplicationConfigProposalFactory = await ArbitrationModifyApplicationConfigProposalFactory.new(
      {
        from: owner
      }
    );
    // eslint-disable-next-line
    const arbitrationCreateGlobalProposalProposalManagerFactory = await ArbitrationCreateGlobalProposalProposalManagerFactory.new(
      {
        from: owner
      }
    );
    // eslint-disable-next-line
    const arbitrationSupportGlobalProposalProposalManagerFactory = await ArbitrationSupportGlobalProposalProposalManagerFactory.new(
      {
        from: owner
      }
    );

    const pggFactory = await PGGFactory.new(
      ggr.address,
      pggMultiSigFactory.address,
      pggMultiSigCandidateTopFactory.address,
      pggArbitratorStakeFactory.address,
      pggOracleStakeFactory.address,
      pggConfigFactory.address,
      pggOracleFactory.address,
      pggDelegateReputationVotingFactory.address,
      pggOracleStakeVotingFactory.address,
      { from: owner }
    );

    await pggFactory.initialize(
      arbitrationModifyThresholdProposalFactory.address,
      arbitrationModifyMofNProposalFactory.address,
      arbitrationModifyArbitratorStakeProposalFactory.address,
      arbitrationModifyContractAddressProposalFactory.address,
      arbitrationRevokeArbitratorsProposalFactory.address,
      arbitrationModifyApplicationConfigProposalFactory.address,
      arbitrationCreateGlobalProposalProposalManagerFactory.address,
      arbitrationSupportGlobalProposalProposalManagerFactory.address
    );

    return pggFactory;
  },
  async buildPGG(
    factory,
    initialOwners,
    initialRequired,
    m,
    n,
    periodLength,
    minimalArbitratorStake,
    thresholds,
    applicationConfigs,
    owner,
    ethValue = 0
  ) {
    let res = await factory.buildFirstStep(initialOwners, initialRequired, m, n, minimalArbitratorStake, thresholds, {
      from: owner,
      value: ethValue
    });
    const multiSig = await PGGMultiSig.at(res.logs[0].args.pggMultiSig);
    const config = await PGGConfig.at(res.logs[0].args.pggConfig);
    const oracleStakeAccounting = await PGGOracleStakeAccounting.at(res.logs[0].args.pggOracleStakeAccounting);
    const { groupId } = res.logs[0].args;

    res = await factory.buildSecondStep(groupId, periodLength, { from: owner });
    const candidateTop = await PGGMultiSigCandidateTop.at(res.logs[0].args.pggMultiSigCandidateTop);
    const arbitratorStakeAccounting = await PGGArbitratorStakeAccounting.at(
      res.logs[0].args.pggArbitratorStakeAccounting
    );

    res = await factory.buildThirdStep(groupId, { from: owner });
    const modifyThresholdProposalManager = await ModifyThresholdProposalManager.at(
      res.logs[0].args.modifyThresholdProposalManager
    );
    const modifyMofNProposalManager = await ModifyMofNProposalManager.at(res.logs[0].args.modifyMofNProposalManager);
    const modifyArbitratorStakeProposalManager = await ModifyMinimalArbitratrorStakeProposalManager.at(
      res.logs[0].args.modifyArbitratorStakeProposalManager
    );

    res = await factory.buildFourthStep(groupId, { from: owner });
    const modifyContractAddressProposalManager = await ModifyContractAddressProposalManager.at(
      res.logs[0].args.modifyContractAddressProposalManager
    );
    const revokeArbitratorsProposalManager = await RevokeArbitratorsProposalManager.at(
      res.logs[0].args.revokeArbitratorsProposalManager
    );

    res = await factory.buildFifthStep(groupId, { from: owner });
    const modifyApplicationConfigProposalManager = await ModifyApplicationConfigProposalManager.at(
      res.logs[0].args.modifyApplicationConfigProposalManager
    );

    const keys = Object.keys(applicationConfigs);
    const values = [];

    for (let i = 0; i < keys.length; i++) {
      values[i] = applicationConfigs[keys[i]];
    }

    await factory.buildSixthStep(groupId, keys, values, { from: owner });
    await factory.buildSixthStepDone(groupId, { from: owner });

    res = await factory.buildSeventhStep(groupId, { from: owner });
    const delegateSpaceVoting = await PGGDelegateReputationVoting.at(res.logs[0].args.pggDelegateSpaceVoting);
    const delegateGaltVoting = await PGGDelegateReputationVoting.at(res.logs[0].args.pggDelegateGaltVoting);
    const oracleStakeVoting = await PGGOracleStakeVoting.at(res.logs[0].args.pggOracleStakeVoting);

    res = await factory.buildEighthStep(groupId, { from: owner });
    const createGlobalProposalProposalManager = await CreateGlobalProposalProposalManager.at(
      res.logs[0].args.createGlobalProposal
    );
    const supportGlobalProposalProposalManager = await SupportGlobalProposalProposalManager.at(
      res.logs[0].args.supportGlobalProposal
    );

    res = await factory.buildNinthStep(groupId, { from: owner });
    const oracles = await PGGOracles.at(res.logs[0].args.pggOracles);

    return {
      groupId,
      multiSig,
      config,
      candidateTop,
      oracleStakeAccounting,
      arbitratorStakeAccounting,
      modifyThresholdProposalManager,
      modifyMofNProposalManager,
      modifyArbitratorStakeProposalManager,
      modifyContractAddressProposalManager,
      modifyApplicationConfigProposalManager,
      revokeArbitratorsProposalManager,
      createGlobalProposalProposalManager,
      supportGlobalProposalProposalManager,
      delegateSpaceVoting,
      delegateGaltVoting,
      oracleStakeVoting,
      oracles
    };
  }
};

module.exports = Helpers;
