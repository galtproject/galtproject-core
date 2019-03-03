const MultiSigFactory = artifacts.require('./MultiSigFactory.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const Oracles = artifacts.require('./Oracles.sol');
const ArbitratorsMultiSigFactory = artifacts.require('./ArbitratorsMultiSigFactory.sol');
const ArbitratorVotingFactory = artifacts.require('./ArbitratorVotingFactory.sol');
const ArbitratorStakeAccountingFactory = artifacts.require('./ArbitratorStakeAccountingFactory.sol');
const OracleStakesAccountingFactory = artifacts.require('./OracleStakesAccountingFactory.sol');
const ArbitrationConfigFactory = artifacts.require('./ArbitrationConfigFactory.sol');

const ArbitrationModifyThresholdProposalFactory = artifacts.require('./ArbitrationModifyThresholdProposalFactory.sol');
const ArbitrationModifyApplicationConfigProposalFactory = artifacts.require('./ArbitrationModifyApplicationConfigProposalFactory.sol');
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

const ArbitratorStakeAccounting = artifacts.require('./MockArbitratorStakeAccounting.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const ArbitratorVoting = artifacts.require('./ArbitratorVoting.sol');
const ArbitrationConfig = artifacts.require('./ArbitrationConfig.sol');
const ModifyThresholdProposalManager = artifacts.require('./ModifyThresholdProposalManager.sol');
const ModifyApplicationConfigProposalManager = artifacts.require('./ModifyApplicationConfigProposalManager.sol');
const ModifyMofNProposalManager = artifacts.require('./ModifyMofNProposalManager.sol');
const ModifyMinimalArbitratrorStakeProposalManager = artifacts.require(
  './ModifyMinimalArbitratorStakeProposalManager.sol'
);
const ModifyContractAddressProposalManager = artifacts.require('./ModifyContractAddressProposalManager.sol');
const RevokeArbitratorsProposalManager = artifacts.require('./RevokeArbitratorsProposalManager.sol');

const Helpers = {
  async deployMultiSigFactory(
    ggr,
    owner
  ) {
    const multiSig = await ArbitratorsMultiSigFactory.new({ from: owner });

    const voting = await ArbitratorVotingFactory.new({ from: owner });
    const oracleStakes = await OracleStakesAccountingFactory.new({ from: owner });
    const arbitratorStakes = await ArbitratorStakeAccountingFactory.new({ from: owner });
    const arbitrationConfig = await ArbitrationConfigFactory.new({ from: owner });

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
    const arbitrationModifyApplicationConfigProposalFactory = await ArbitrationModifyApplicationConfigProposalFactory.new({
      from: owner
    });

    const multiSigFactory = await MultiSigFactory.new(
      ggr.address,
      multiSig.address,
      voting.address,
      arbitratorStakes.address,
      oracleStakes.address,
      arbitrationConfig.address,
      arbitrationModifyThresholdProposalFactory.address,
      arbitrationModifyMofNProposalFactory.address,
      arbitrationModifyArbitratorStakeProposalFactory.address,
      arbitrationModifyContractAddressProposalFactory.address,
      arbitrationRevokeArbitratorsProposalFactory.address,
      arbitrationModifyApplicationConfigProposalFactory.address,
      { from: owner }
    );

    const multiSigRegistryContract = await MultiSigRegistry.at(await ggr.getMultiSigRegistryAddress());
    const oraclesContract = await Oracles.at(await ggr.getOraclesAddress());

    await multiSigRegistryContract.addRoleTo(multiSigFactory.address, await multiSigRegistryContract.ROLE_FACTORY(), {
      from: owner
    });
    await oraclesContract.addRoleTo(
      multiSigFactory.address,
      await oraclesContract.ROLE_ORACLE_STAKES_NOTIFIER_MANAGER(),
      {
        from: owner
      }
    );

    return multiSigFactory;
  },
  async buildArbitration(
    factory,
    initialOwners,
    initialRequired,
    m,
    n,
    periodLength,
    minimalArbitratorStake,
    thresholds,
    owner
  ) {
    let res = await factory.buildFirstStep(initialOwners, initialRequired, m, n, minimalArbitratorStake, thresholds, {
      from: owner
    });
    const multiSig = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);
    const config = await ArbitrationConfig.at(res.logs[0].args.arbitrationConfig);
    const oracleStakeAccounting = await OracleStakesAccounting.at(res.logs[0].args.oracleStakesAccounting);
    const { groupId } = res.logs[0].args;

    res = await factory.buildSecondStep(groupId, periodLength, { from: owner });
    const voting = await ArbitratorVoting.at(res.logs[0].args.arbitratorVoting);
    const arbitratorStakeAccounting = await ArbitratorStakeAccounting.at(res.logs[0].args.arbitratorStakeAccounting);

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

    return {
      groupId,
      multiSig,
      config,
      voting,
      oracleStakeAccounting,
      arbitratorStakeAccounting,
      modifyThresholdProposalManager,
      modifyMofNProposalManager,
      modifyArbitratorStakeProposalManager,
      modifyContractAddressProposalManager,
      modifyApplicationConfigProposalManager,
      revokeArbitratorsProposalManager
    };
  }
};

module.exports = Helpers;
