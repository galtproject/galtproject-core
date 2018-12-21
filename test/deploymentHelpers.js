const ArbitratorVoting = artifacts.require('./ArbitratorVoting.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');

const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const MultiSigFactory = artifacts.require('./MultiSigFactory.sol');
const ArbitratorsMultiSigFactory = artifacts.require('./ArbitratorsMultiSigFactory.sol');
const ArbitratorVotingFactory = artifacts.require('./ArbitratorVotingFactory.sol');
const OracleStakesAccountingFactory = artifacts.require('./OracleStakesAccountingFactory.sol');

const one = '0x0000000000000000000000000000000000000001';
const two = '0x0000000000000000000000000000000000000002';
const three = '0x0000000000000000000000000000000000000003';

const Helpers = {
  async deployMultiSigFactory(galtTokenAddress, oraclesContract, claimManager, spaceReputationAccounting, owner) {
    const multiSig = await ArbitratorsMultiSigFactory.new({ from: owner });
    const voting = await ArbitratorVotingFactory.new({ from: owner });
    const oracleStakes = await OracleStakesAccountingFactory.new({ from: owner });
    const multiSigRegistry = await MultiSigRegistry.new({ from: owner });

    const multiSigFactory = await MultiSigFactory.new(
      multiSigRegistry.address,
      galtTokenAddress,
      oraclesContract.address,
      claimManager,
      spaceReputationAccounting,
      multiSig.address,
      voting.address,
      oracleStakes.address,
      { from: owner }
    );

    await multiSigRegistry.addRoleTo(multiSigFactory.address, await multiSigRegistry.ROLE_FACTORY(), {
      from: owner
    });
    await oraclesContract.addRoleTo(
      multiSigFactory.address,
      await oraclesContract.ROLE_ORACLE_STAKES_NOTIFIER_MANAGER(),
      {
        from: owner
      }
    );

    return [multiSigFactory, multiSigRegistry];
  },
  async deployMultiSigContracts(
    roleManager,
    claimManager,
    oraclesContract,
    galtTokenAddress,
    spaceReputationAccountingAddress,
    initialOwners = [one, two, three],
    required = 2
  ) {
    const multiSig = await ArbitratorsMultiSig.new(initialOwners, required, { from: roleManager });
    const oracleStakes = await OracleStakesAccounting.new(oraclesContract.address, galtTokenAddress, multiSig.address, {
      from: roleManager
    });
    const voting = await ArbitratorVoting.new(
      multiSig.address,
      spaceReputationAccountingAddress,
      oracleStakes.address,
      {
        from: roleManager
      }
    );

    await multiSig.initialize(voting.address, oracleStakes.address);

    // ASSIGNING ROLES
    await multiSig.addRoleTo(voting.address, await multiSig.ROLE_ARBITRATOR_MANAGER(), {
      from: roleManager
    });
    await oraclesContract.addRoleTo(oracleStakes.address, await oraclesContract.ROLE_ORACLE_STAKES_NOTIFIER(), {
      from: roleManager
    });

    await oracleStakes.addRoleTo(claimManager, await oracleStakes.ROLE_SLASH_MANAGER(), {
      from: roleManager
    });
    await voting.addRoleTo(oracleStakes.address, await voting.ORACLE_STAKES_NOTIFIER(), {
      from: roleManager
    });
    await voting.addRoleTo(spaceReputationAccountingAddress, await voting.SPACE_REPUTATION_NOTIFIER(), {
      from: roleManager
    });

    // LAST HACK
    await oracleStakes.setVotingAddress(voting.address, { from: roleManager });

    return [multiSig, voting, oracleStakes];
  }
};

module.exports = Helpers;
