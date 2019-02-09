const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const ArbitratorStakeAccounting = artifacts.require('./MockArbitratorStakeAccounting.sol');
const AddressLinkedList = artifacts.require('./AddressLinkedList.sol');
const VotingLinkedList = artifacts.require('./VotingLinkedList.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const ArbitratorVoting = artifacts.require('./ArbitratorVoting.sol');
const ArbitrationConfig = artifacts.require('./ArbitrationConfig.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const Oracles = artifacts.require('./Oracles.sol');
const ClaimManager = artifacts.require('./ClaimManager.sol');
const MockSRA = artifacts.require('./MockSRA.sol');
const SpaceLockerRegistry = artifacts.require('./SpaceLockerRegistry.sol');

const Web3 = require('web3');
const galt = require('@galtproject/utils');

const { assertRevert, ether, initHelperWeb3 } = require('../../helpers');
const { deployMultiSigFactory } = require('../../deploymentHelpers');

const { utf8ToHex, hexToUtf8 } = Web3.utils;
const bytes32 = utf8ToHex;
const web3 = new Web3(GaltToken.web3.currentProvider);

initHelperWeb3(web3);

// eslint-disable-next-line no-underscore-dangle
const _ES = bytes32('');
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');

const NICK = bytes32('Nick');
const MIKE = bytes32('Mike');
const OLIVER = bytes32('Oliver');

const PC_CUSTODIAN_ORACLE_TYPE = bytes32('PC_CUSTODIAN_ORACLE_TYPE');
const PC_AUDITOR_ORACLE_TYPE = bytes32('PC_AUDITOR_ORACLE_TYPE');

const MY_APPLICATION = '0x70042f08921e5b7de231736485f834c3bda2cd3587936c6a668d44c1ccdeddf0';

const ClaimApplicationStatus = {
  NOT_EXISTS: 0,
  SUBMITTED: 1,
  APPROVED: 2,
  REJECTED: 3,
  REVERTED: 4
};

contract('Arbitrator Stake Slashing', accounts => {
  const [
    coreTeam,
    slashManager,
    feeManager,
    applicationTypeManager,
    oracleManager,
    sraAddress,
    galtSpaceOrg,

    // initial arbitrators
    a1,
    a2,
    a3,

    // arbitrators
    alice,
    bob,
    charlie,
    dan,
    eve,

    // oracles
    mike,
    nick,
    oliver,

    // claimer
    zack,

    // unauthorized
    unauthorized
  ] = accounts;

  beforeEach(async function() {
    this.attachedDocuments = [
      'QmYNQJoKGNHTpPxCBPh9KkDpaExgd2duMa3aF6ytMpHdao',
      'QmeveuwF5wWBSgUXLG6p1oxF3GKkgjEnhA6AAwHUoVsx6E',
      'QmSrPmbaUKA3ZodhzPWZnpFgcPMFWF4QsxXbkWfEptTBJd'
    ];

    // Setup Galt token
    await (async () => {
      this.galtToken = await GaltToken.new({ from: coreTeam });

      await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(charlie, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(dan, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(eve, ether(10000000), { from: coreTeam });

      await this.galtToken.mint(mike, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(nick, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(oliver, ether(10000000), { from: coreTeam });

      await this.galtToken.mint(zack, ether(10000000), { from: coreTeam });
    })();

    // Create and initialize contracts
    await (async () => {
      this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
      this.oracles = await Oracles.new({ from: coreTeam });
      this.claimManager = await ClaimManager.new({ from: coreTeam });

      this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
      this.spaceLockerRegistry = await SpaceLockerRegistry.new({ from: coreTeam });

      this.sra = await MockSRA.new(
        this.spaceToken.address,
        this.multiSigRegistry.address,
        this.spaceLockerRegistry.address,
        { from: coreTeam }
      );

      this.multiSigFactory = await deployMultiSigFactory(
        this.galtToken.address,
        this.oracles,
        this.claimManager.address,
        this.multiSigRegistry,
        this.sra.address,
        coreTeam
      );

      await this.claimManager.initialize(
        this.oracles.address,
        this.galtToken.address,
        this.multiSigRegistry.address,
        galtSpaceOrg,
        {
          from: coreTeam
        }
      );
    })();

    // Setup multiSig
    await (async () => {
      await this.galtToken.approve(this.multiSigFactory.address, ether(20), { from: alice });

      let res = await this.multiSigFactory.buildFirstStep([a1, a2, a3], 2, 7, 10, ether(1000), [80, 80, 70, 90], {
        from: alice
      });
      this.abMultiSigX = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);
      this.oracleStakesAccountingX = await OracleStakesAccounting.at(res.logs[0].args.oracleStakesAccounting);
      this.multiSigXGroupId = res.logs[0].args.groupId;

      res = await this.multiSigFactory.buildSecondStep(this.multiSigXGroupId, 60, { from: alice });
      this.abVotingX = await ArbitratorVoting.at(res.logs[0].args.arbitratorVoting);
      this.arbitratorStakeAccountingX = await ArbitratorStakeAccounting.at(res.logs[0].args.arbitratorStakeAccounting);

      this.mX = this.abMultiSigX.address;
    })();

    // Setup roles and fees
    await (async () => {
      await this.claimManager.addRoleTo(feeManager, await this.claimManager.ROLE_FEE_MANAGER(), {
        from: coreTeam
      });
      await this.claimManager.addRoleTo(galtSpaceOrg, await this.claimManager.ROLE_GALT_SPACE(), {
        from: coreTeam
      });
      await this.oracles.addRoleTo(applicationTypeManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
        from: coreTeam
      });
      await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_TYPE_MANAGER(), {
        from: coreTeam
      });
      await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_MANAGER(), {
        from: coreTeam
      });
      await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_STAKES_MANAGER(), {
        from: coreTeam
      });

      await this.claimManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
      await this.claimManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
      await this.claimManager.setGaltSpaceEthShare(33, { from: feeManager });
      await this.claimManager.setGaltSpaceGaltShare(13, { from: feeManager });
      await this.claimManager.setMofN(2, 3, { from: galtSpaceOrg });
    })();

    // Mint and distribute SRA reputation using mock
    await (async () => {
      await this.sra.mintAll([alice, bob, charlie, dan, eve], 500);
      assert.equal(await this.sra.balanceOf(alice), 500);
      await this.sra.lockReputation(this.mX, 500, { from: alice });
      await this.sra.lockReputation(this.mX, 500, { from: bob });
      await this.sra.delegate(charlie, dan, 500, { from: dan });
      await this.sra.lockReputation(this.mX, 1000, { from: charlie });
      await this.sra.lockReputation(this.mX, 500, { from: eve });
    })();

    // Vote for arbitrators
    await (async () => {
      await this.abVotingX.grantReputation(alice, 500, { from: bob });
      await this.abVotingX.grantReputation(charlie, 500, { from: alice });
      await this.abVotingX.grantReputation(alice, 500, { from: charlie });
      await this.abVotingX.grantReputation(bob, 500, { from: charlie });
      await this.abVotingX.grantReputation(eve, 500, { from: eve });

      assert.equal(await this.abVotingX.getSpaceReputation(alice), 1000);

      await this.abVotingX.recalculate(alice, { from: unauthorized });
      await this.abVotingX.recalculate(bob, { from: unauthorized });
      await this.abVotingX.recalculate(charlie, { from: unauthorized });
      await this.abVotingX.recalculate(dan, { from: unauthorized });
      await this.abVotingX.recalculate(eve, { from: unauthorized });

      assert.equal(await this.abVotingX.getWeight(alice), 100000);

      let res = await this.abVotingX.getSize();
      assert.equal(res, 4);

      res = await this.abVotingX.getCandidates();
      assert.sameMembers(res, [alice, bob, charlie, eve]);
      res = await this.abVotingX.getCandidatesWithStakes();
      assert.sameMembers(res, []);

      await assertRevert(this.abVotingX.pushArbitrators());
    })();
  });

  describe('#slashing ()', () => {
    it.only('should slash', async function() {
      // Arbitrator Stake Slashing
      //
      // * 4 Arbitrator makes their stake
      // * 3 Oracles added by oracleManager
      // * Unknown user makes a new claim using Claim Manager
      // * Arbitrator 1 makes his proposal to fine [Oracle 1] and Arbitrator [2, 3]
      // * Proposal is accepted
      // * Verify that oracles were punished
      // * Verify that arbitrator was punished
      // * Re-push a new arbitrators list
      // * Check that Arbitrator () 2 was excluded from the list and Arbitrator 3 still remain (his stake wasn’t reduced before the minimum level)
      // No way to push arbitrators without stake

      // > 4 arbitrators make their stake...
      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(2000), { from: alice });
      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(2000), { from: bob });
      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(2000), { from: charlie });
      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(2000), { from: dan });
      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(2000), { from: eve });

      await this.arbitratorStakeAccountingX.stake(alice, ether(2000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(bob, ether(2000), { from: bob });
      await this.arbitratorStakeAccountingX.stake(charlie, ether(2000), { from: charlie });
      await this.arbitratorStakeAccountingX.stake(dan, ether(2000), { from: dan });
      await this.arbitratorStakeAccountingX.stake(eve, ether(2000), { from: eve });

      let res = await this.arbitratorStakeAccountingX.balanceOf(alice);
      assert.equal(res, ether(2000));

      res = await this.abVotingX.getCandidates();
      assert.sameMembers(res, [alice, bob, charlie, eve]);
      res = await this.abVotingX.getCandidatesWithStakes();
      assert.sameMembers(res, [alice, bob, charlie, eve]);

      this.abVotingX.pushArbitrators();

      res = await this.abMultiSigX.getOwners();
      assert.sameMembers(res, [alice, bob, charlie, eve]);

      // > Setup an application, its roles and shares
      await this.oracles.setApplicationTypeOracleTypes(
        MY_APPLICATION,
        [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
        [50, 50],
        [_ES, _ES],
        {
          from: applicationTypeManager
        }
      );

      await this.oracles.setOracleTypeMinimalDeposit(PC_CUSTODIAN_ORACLE_TYPE, ether(200), {
        from: applicationTypeManager
      });
      await this.oracles.setOracleTypeMinimalDeposit(PC_AUDITOR_ORACLE_TYPE, ether(200), {
        from: applicationTypeManager
      });

      // > 3 oracles are added by oracleManager
      await this.oracles.addOracle(this.mX, mike, MIKE, MN, [_ES], [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE], {
        from: oracleManager
      });
      await this.oracles.addOracle(this.mX, nick, NICK, MN, [_ES], [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE], {
        from: oracleManager
      });
      await this.oracles.addOracle(
        this.mX,
        oliver,
        OLIVER,
        MN,
        [_ES],
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
        {
          from: oracleManager
        }
      );

      await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(3000), { from: alice });
      await this.oracleStakesAccountingX.stake(mike, PC_AUDITOR_ORACLE_TYPE, ether(350), { from: alice });
      await this.oracleStakesAccountingX.stake(nick, PC_AUDITOR_ORACLE_TYPE, ether(350), { from: alice });
      await this.oracleStakesAccountingX.stake(oliver, PC_AUDITOR_ORACLE_TYPE, ether(350), { from: alice });
      await this.oracleStakesAccountingX.stake(mike, PC_CUSTODIAN_ORACLE_TYPE, ether(350), { from: alice });
      await this.oracleStakesAccountingX.stake(nick, PC_CUSTODIAN_ORACLE_TYPE, ether(350), { from: alice });
      await this.oracleStakesAccountingX.stake(oliver, PC_CUSTODIAN_ORACLE_TYPE, ether(350), { from: alice });

      // > Asserting that oracles have all their roles active
      res = await this.oracles.getOracle(mike);
      assert.sameMembers(
        res.assignedOracleTypes.map(hexToUtf8),
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE].map(hexToUtf8)
      );
      assert.sameMembers(
        res.activeOracleTypes.map(hexToUtf8),
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE].map(hexToUtf8)
      );

      res = await this.oracles.getOracle(nick);
      assert.sameMembers(
        res.assignedOracleTypes.map(hexToUtf8),
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE].map(hexToUtf8)
      );
      assert.sameMembers(
        res.activeOracleTypes.map(hexToUtf8),
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE].map(hexToUtf8)
      );

      // > Unknown user makes a new claim using Claim Manager
      res = await this.claimManager.submit(
        this.mX,
        alice,
        ether(35),
        this.attachedDocuments.map(galt.ipfsHashToBytes32),
        0,
        { from: alice, value: ether(7) }
      );

      this.cId = res.logs[0].args.id;

      await this.claimManager.lock(this.cId, { from: alice });
      await this.claimManager.lock(this.cId, { from: bob });
      await this.claimManager.lock(this.cId, { from: charlie });

      // > Arbitrator 1 makes his proposal to fine [Oracle 1, 2] and Arbitrator [2, 3]
      res = await this.claimManager.proposeApproval(
        this.cId,
        'looks good',
        ether(30),
        [mike, nick],
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
        [ether(200), ether(50)],
        [alice, bob],
        [ether(200), ether(1500)],
        { from: charlie }
      );
      this.pId2 = res.logs[0].args.proposalId;

      // > make proposal accepted
      await this.claimManager.vote(this.cId, this.pId2, { from: bob });

      res = await this.claimManager.claim(this.cId);
      assert.equal(res.status, ClaimApplicationStatus.APPROVED);

      // > Check that oracles were punished
      res = await this.oracleStakesAccountingX.stakeOf(mike, PC_AUDITOR_ORACLE_TYPE);
      assert.equal(res, ether(350));
      res = await this.oracleStakesAccountingX.stakeOf(mike, PC_CUSTODIAN_ORACLE_TYPE);
      assert.equal(res, ether(150));
      res = await this.oracles.getOracle(mike);

      assert.sameMembers(
        res.assignedOracleTypes.map(hexToUtf8),
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE].map(hexToUtf8)
      );
      assert.sameMembers(res.activeOracleTypes.map(hexToUtf8), [PC_AUDITOR_ORACLE_TYPE].map(hexToUtf8));

      res = await this.oracles.getOracle(nick);
      assert.sameMembers(
        res.assignedOracleTypes.map(hexToUtf8),
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE].map(hexToUtf8)
      );
      assert.sameMembers(
        res.activeOracleTypes.map(hexToUtf8),
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE].map(hexToUtf8)
      );

      // > Check that arbitrators were punished
      res = await this.arbitratorStakeAccountingX.balanceOf(alice);
      assert.equal(res, ether(1800));
      res = await this.arbitratorStakeAccountingX.balanceOf(bob);
      assert.equal(res, ether(500));

      // > Re-push the arbitrators list
      // one of the punished arbitrators is kicked of the arbitrators list
      res = await this.abVotingX.getCandidates();
      assert.sameMembers(res, [alice, bob, charlie, eve]);
      res = await this.abVotingX.getCandidatesWithStakes();
      assert.sameMembers(res, [alice, charlie, eve]);

      this.abVotingX.pushArbitrators();

      res = await this.abMultiSigX.getOwners();
      assert.sameMembers(res, [alice, charlie, eve]);
    });
  });

  // TODO: describe limits
});
