const MultiSigFactory = artifacts.require('./MultiSigFactory.sol');
const ArbitratorsMultiSigFactory = artifacts.require('./ArbitratorsMultiSigFactory.sol');
const ArbitratorVotingFactory = artifacts.require('./ArbitratorVotingFactory.sol');
const ArbitratorStakeAccountingFactory = artifacts.require('./ArbitratorStakeAccountingFactory.sol');
const OracleStakesAccountingFactory = artifacts.require('./OracleStakesAccountingFactory.sol');
const ArbitrationConfigFactory = artifacts.require('./ArbitrationConfigFactory.sol');
const ArbitrationProposalsFactory = artifacts.require('./ArbitrationProposalsFactory.sol');
const AddressLinkedList = artifacts.require('./AddressLinkedList.sol');
const VotingLinkedList = artifacts.require('./VotingLinkedList.sol');

const Helpers = {
  async deployMultiSigFactory(
    galtTokenAddress,
    oraclesContract,
    claimManagerAddress,
    multiSigRegistryContract,
    spaceReputationAccountingAddress,
    owner
  ) {
    const multiSig = await ArbitratorsMultiSigFactory.new({ from: owner });

    VotingLinkedList.link('AddressLinkedList', (await AddressLinkedList.new()).address);
    const votingLinkedList = await VotingLinkedList.new();
    ArbitratorVotingFactory.link('VotingLinkedList', votingLinkedList.address);

    const voting = await ArbitratorVotingFactory.new({ from: owner });
    const oracleStakes = await OracleStakesAccountingFactory.new({ from: owner });
    const arbitratorStakes = await ArbitratorStakeAccountingFactory.new({ from: owner });
    const arbitrationConfig = await ArbitrationConfigFactory.new({ from: owner });
    const arbitrationProposals = await ArbitrationProposalsFactory.new({ from: owner });

    const multiSigFactory = await MultiSigFactory.new(
      multiSigRegistryContract.address,
      galtTokenAddress,
      oraclesContract.address,
      claimManagerAddress,
      spaceReputationAccountingAddress,
      multiSig.address,
      voting.address,
      arbitratorStakes.address,
      oracleStakes.address,
      arbitrationConfig.address,
      arbitrationProposals.address,
      { from: owner }
    );

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
  }
};

module.exports = Helpers;
