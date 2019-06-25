const PGGFactory = artifacts.require('./PGGFactory.sol');
const PGGMultiSigFactory = artifacts.require('./PGGMultiSigFactory.sol');
const PGGMultiSigCandidateTopFactory = artifacts.require('./PGGMultiSigCandidateTopFactory.sol');
const PGGArbitratorStakeAccountingFactory = artifacts.require('./PGGArbitratorStakeAccountingFactory.sol');
const PGGOracleStakeAccountingFactory = artifacts.require('./PGGOracleStakeAccountingFactory.sol');
const PGGConfigFactory = artifacts.require('./PGGConfigFactory.sol');
const PGGOracleFactory = artifacts.require('./PGGOracleFactory.sol');
const PGGDelegateReputationVotingFactory = artifacts.require('./PGGDelegateReputationVotingFactory.sol');
const PGGOracleStakeVotingFactory = artifacts.require('./PGGOracleStakeVotingFactory.sol');
const PGGProposalManagerFactory = artifacts.require('./PGGProposalManagerFactory.sol');

const PGGArbitratorStakeAccounting = artifacts.require('./PGGArbitratorStakeAccounting.sol');
const PGGOracleStakeAccounting = artifacts.require('./PGGOracleStakeAccounting.sol');
const PGGMultiSig = artifacts.require('./PGGMultiSig.sol');
const PGGMultiSigCandidateTop = artifacts.require('./PGGMultiSigCandidateTop.sol');
const PGGConfig = artifacts.require('./PGGConfig.sol');
const PGGOracles = artifacts.require('./PGGOracles.sol');
const PGGDelegateReputationVoting = artifacts.require('./PGGDelegateReputationVoting.sol');
const PGGOracleStakeVoting = artifacts.require('./PGGOracleStakeVoting.sol');
const PGGProposalManager = artifacts.require('./PGGProposalManager.sol');

PGGMultiSigCandidateTop.numberFormat = 'String';
PGGOracleStakeVoting.numberFormat = 'String';
PGGOracleStakeAccounting.numberFormat = 'String';
PGGProposalManager.numberFormat = 'String';

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
    const pggProposalManagerFactory = await PGGProposalManagerFactory.new({ from: owner });

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
      pggProposalManagerFactory.address,
      { from: owner }
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
    let res = await factory.buildFirstStep(initialOwners, initialRequired, m, n, minimalArbitratorStake, {
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

    const keys = Object.keys(applicationConfigs);
    const values = [];

    for (let i = 0; i < keys.length; i++) {
      values[i] = applicationConfigs[keys[i]];
    }

    await factory.buildThirdStep(groupId, keys, values, { from: owner });
    await factory.buildThirdStepDone(groupId, { from: owner });

    res = await factory.buildFourthStep(groupId, { from: owner });
    const delegateSpaceVoting = await PGGDelegateReputationVoting.at(res.logs[0].args.pggDelegateSpaceVoting);
    const delegateGaltVoting = await PGGDelegateReputationVoting.at(res.logs[0].args.pggDelegateGaltVoting);
    const oracleStakeVoting = await PGGOracleStakeVoting.at(res.logs[0].args.pggOracleStakeVoting);

    res = await factory.buildFifthStep(groupId, thresholds, { from: owner });
    const oracles = await PGGOracles.at(res.logs[0].args.pggOracles);
    const proposalManager = await PGGProposalManager.at(res.logs[0].args.pggProposalManager);

    return {
      groupId,
      multiSig,
      config,
      candidateTop,
      oracleStakeAccounting,
      arbitratorStakeAccounting,
      proposalManager,
      delegateSpaceVoting,
      delegateGaltVoting,
      oracleStakeVoting,
      oracles
    };
  }
};

module.exports = Helpers;
