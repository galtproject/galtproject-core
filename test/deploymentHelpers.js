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
    defaultThreshold,
    customThresholds,
    applicationConfigs,
    owner,
    ethValue = 0
  ) {
    let res = await factory.buildFirstStep(
      initialOwners,
      initialRequired,
      m,
      n,
      minimalArbitratorStake,
      defaultThreshold,
      {
        from: owner,
        value: ethValue
      }
    );
    const multiSig = await PGGMultiSig.at(res.logs[0].args.pggMultiSig);
    const config = await PGGConfig.at(res.logs[0].args.pggConfig);
    const oracleStakeAccounting = await PGGOracleStakeAccounting.at(res.logs[0].args.pggOracleStakeAccounting);
    const { groupId } = res.logs[0].args;

    res = await factory.buildSecondStep(groupId, periodLength, { from: owner });
    const candidateTop = await PGGMultiSigCandidateTop.at(res.logs[0].args.pggMultiSigCandidateTop);
    const arbitratorStakeAccounting = await PGGArbitratorStakeAccounting.at(
      res.logs[0].args.pggArbitratorStakeAccounting
    );

    let keys = Object.keys(applicationConfigs);
    let values = [];

    for (let i = 0; i < keys.length; i++) {
      values[i] = applicationConfigs[keys[i]];
    }

    await factory.buildThirdStep(groupId, keys, values, { from: owner });
    await factory.buildThirdStepDone(groupId, { from: owner });

    res = await factory.buildFourthStep(groupId, { from: owner });
    const delegateSpaceVoting = await PGGDelegateReputationVoting.at(res.logs[0].args.pggDelegateSpaceVoting);
    const delegateGaltVoting = await PGGDelegateReputationVoting.at(res.logs[0].args.pggDelegateGaltVoting);
    const oracleStakeVoting = await PGGOracleStakeVoting.at(res.logs[0].args.pggOracleStakeVoting);

    keys = Object.keys(customThresholds);
    let markers = [];
    let signatures = [];
    values = [];

    signatures = keys.map(k => config[`${k}_SIGNATURE`]());
    signatures = await Promise.all(signatures);

    for (let i = 0; i < keys.length; i++) {
      const val = customThresholds[keys[i]];
      const localKeys = Object.keys(val);
      assert(localKeys.length === 1, 'Invalid threshold keys length');
      const contract = localKeys[0];
      let marker;

      switch (contract) {
        case 'config':
          marker = config.getThresholdMarker(config.address, signatures[i]);
          break;
        case 'multiSig':
          marker = config.getThresholdMarker(multiSig.address, signatures[i]);
          break;
        default:
          marker = config.getThresholdMarker(contract, signatures[i]);
          break;
      }

      markers.push(marker);
      values.push(customThresholds[keys[i]][contract]);
    }

    markers = await Promise.all(markers);

    res = await factory.buildFifthStep(groupId, markers, values, { from: owner });
    await factory.buildFifthStepDone(groupId, { from: owner });

    res = await factory.buildSixthStep(groupId, { from: owner });
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
