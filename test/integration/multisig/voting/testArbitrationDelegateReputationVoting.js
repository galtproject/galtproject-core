/* eslint-disable prefer-arrow-callback */
const SpaceToken = artifacts.require('./SpaceToken.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const SpaceLocker = artifacts.require('./SpaceLocker.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const {
  ether,
  assertRevert,
  initHelperWeb3,
  initHelperArtifacts,
  deploySplitMergeMock,
  numberToEvmWord,
  paymentMethods
} = require('../../../helpers');

const web3 = new Web3(SpaceToken.web3.currentProvider);
const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;
const { deployMultiSigFactory, buildArbitration } = require('../../../deploymentHelpers');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const TYPE_A = bytes32('TYPE_A');
const TYPE_B = bytes32('TYPE_B');
const TYPE_C = bytes32('TYPE_C');
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');
const EVE = bytes32('Eve');

// NOTICE: we don't wrap MockToken with a proxy on production
contract('ArbitrationDelegateReputationVoting', accounts => {
  const [
    coreTeam,
    oracleModifier,
    claimManager,
    fakeSRA,
    geoDateManagement,
    zeroOwner,
    alice,
    bob,
    charlie,
    dan,
    eve,
    minter,
    candidateA,
    candidateB,
    candidateC,
    candidateD,
    candidateE,
    unauthorized
  ] = accounts;

  before(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    const deployment = await deploySplitMergeMock(this.ggr);
    this.splitMerge = deployment.splitMerge;

    this.spaceLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('SPACE_LOCKER_REGISTRAR'), {
      from: coreTeam
    });
    this.galtLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('GALT_LOCKER_REGISTRAR'), {
      from: coreTeam
    });
    this.spaceLockerFactory = await SpaceLockerFactory.new(this.ggr.address, { from: coreTeam });
    this.galtLockerFactory = await SpaceLockerFactory.new(this.ggr.address, { from: coreTeam });

    this.multiSigRegistry = await MultiSigRegistry.new(this.ggr.address, { from: coreTeam });
    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.feeRegistry.initialize();
    await this.multiSigRegistry.initialize(this.ggr.address);

    await this.spaceToken.addRoleTo(minter, 'minter', {
      from: coreTeam
    });

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.MULTI_SIG_REGISTRY(), this.multiSigRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.CLAIM_MANAGER(), claimManager, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_LOCKER_REGISTRY(), this.spaceLockerRegistry.address, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.GALT_LOCKER_REGISTRY(), this.galtLockerRegistry.address, {
      from: coreTeam
    });

    await this.galtToken.mint(alice, ether(1000000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(1000000000), { from: coreTeam });
    await this.galtToken.mint(charlie, ether(1000000000), { from: coreTeam });
    await this.galtToken.mint(dan, ether(1000000000), { from: coreTeam });

    this.multiSigFactory = await deployMultiSigFactory(this.ggr, coreTeam);

    await this.feeRegistry.setGaltFee(await this.multiSigFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.multiSigFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.multiSigFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });
    await this.feeRegistry.setGaltFee(await this.spaceLockerFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.spaceLockerFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.spaceLockerFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('MULTI_SIG_REGISTRAR'), this.multiSigFactory.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_LOCKER_REGISTRAR'), this.spaceLockerFactory.address, true, {
      from: coreTeam
    });
    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), geoDateManagement, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ORACLE_MODIFIER'), oracleModifier, true, { from: coreTeam });
  });

  describe('Scenarios', () => {
    beforeEach(async function() {
      this.spaceRA = await SpaceRA.new(this.ggr.address, { from: coreTeam });
      await this.spaceRA.initialize(this.ggr.address);
      await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), this.spaceRA.address, true, { from: coreTeam });

      await this.ggr.setContract(await this.ggr.SPACE_RA(), this.spaceRA.address, {
        from: coreTeam
      });

      await this.galtToken.approve(this.multiSigFactory.address, ether(10), { from: alice });
      await this.galtToken.approve(this.multiSigFactory.address, ether(10), { from: bob });
      await this.galtToken.approve(this.multiSigFactory.address, ether(10), { from: charlie });

      const applicationConfig = {};
      applicationConfig[TYPE_A] = numberToEvmWord(ether(200));
      applicationConfig[TYPE_B] = numberToEvmWord(ether(200));
      applicationConfig[TYPE_C] = numberToEvmWord(ether(200));

      // MultiSigX
      this.abX = await buildArbitration(
        this.multiSigFactory,
        [bob, charlie, dan, eve],
        2,
        3,
        4,
        60,
        ether(1000),
        [30, 30, 30, 30, 30, 30, 30, 30],
        applicationConfig,
        alice
      );
      this.abMultiSigX = this.abX.multiSig;
      this.oracleStakesAccountingX = this.abX.oracleStakeAccounting;
      this.delegateSpaceVotingX = this.abX.delegateSpaceVoting;
      this.delegateGaltVotingX = this.abX.delegateGaltVoting;
      this.oracleStakeVotingX = this.abX.oracleStakeVoting;
      this.oraclesX = this.abX.oracles;

      // MultiSigY
      this.abY = await buildArbitration(
        this.multiSigFactory,
        [bob, charlie, dan, eve],
        2,
        3,
        4,
        60,
        ether(1000),
        [30, 30, 30, 30, 30, 30, 30, 30],
        applicationConfig,
        bob
      );
      this.abMultiSigY = this.abY.multiSig;
      this.candidateTopY = this.abY.candidateTop;
      this.delegateSpaceVotingY = this.abY.delegateSpaceVoting;
      // this.oracleStakeVotingY = this.abY.oracleStakeVoting;
      this.oraclesY = this.abY.oracles;

      // MultiSigZ
      this.abZ = await buildArbitration(
        this.multiSigFactory,
        [bob, charlie, dan, eve],
        2,
        3,
        4,
        60,
        ether(1000),
        [30, 30, 30, 30, 30, 30, 30, 30],
        applicationConfig,
        charlie
      );
      this.abMultiSigZ = this.abZ.multiSig;
      // this.abVotingZ = this.abZ.voting;
      this.delegateSpaceVotingZ = this.abZ.delegateSpaceVoting;
      // this.delegateGaltVotingZ = this.abZ.delegateGaltVoting;
      // this.oracleStakeVotingZ = this.abZ.oracleStakeVoting;
      // this.oraclesZ = this.abZ.oracles;

      // CONFIGURING
      await this.oraclesX.addOracle(bob, BOB, MN, [], [TYPE_A], {
        from: oracleModifier
      });
      await this.oraclesX.addOracle(charlie, CHARLIE, MN, [], [TYPE_B, TYPE_C], {
        from: oracleModifier
      });
      await this.oraclesX.addOracle(dan, DAN, MN, [], [TYPE_A, TYPE_B, TYPE_C], {
        from: oracleModifier
      });
      await this.oraclesY.addOracle(eve, EVE, MN, [], [TYPE_A, TYPE_B, TYPE_C], {
        from: oracleModifier
      });

      this.X = this.abMultiSigX.address;
      this.Y = this.abMultiSigY.address;
      this.Z = this.abMultiSigZ.address;
    });

    afterEach(async function() {
      await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), this.spaceRA.address, false, { from: coreTeam });
    });

    it('Delegate SpaceVoting Scenario', async function() {
      // MINT TOKEN
      await this.spaceToken.mint(zeroOwner, { from: minter });
      let res = await this.spaceToken.mint(alice, { from: minter });
      const x1 = res.logs[0].args.tokenId;
      res = await this.spaceToken.mint(alice, { from: minter });
      const x2 = res.logs[0].args.tokenId;
      res = await this.spaceToken.mint(bob, { from: minter });
      const x3 = res.logs[0].args.tokenId;
      res = await this.spaceToken.mint(bob, { from: minter });
      const x4 = res.logs[0].args.tokenId;
      res = await this.spaceToken.mint(bob, { from: minter });
      const x5 = res.logs[0].args.tokenId;
      res = await this.spaceToken.mint(charlie, { from: minter });
      const x6 = res.logs[0].args.tokenId;
      res = await this.spaceToken.mint(dan, { from: minter });
      const x7 = res.logs[0].args.tokenId;

      // SET AREAS
      let p = [
        this.splitMerge.setTokenArea(x1, '300', '0', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x2, '500', '0', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x3, '400', '0', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x4, '700', '0', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x5, '100', '0', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x6, '1000', '0', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x7, '0', '0', { from: geoDateManagement })
      ];

      await Promise.all(p);

      await this.galtToken.approve(this.spaceLockerFactory.address, ether(20), { from: alice });
      await this.galtToken.approve(this.spaceLockerFactory.address, ether(30), { from: bob });
      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: charlie });
      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: dan });

      // BUILD LOCKER CONTRACTS
      res = await this.spaceLockerFactory.build({ from: alice });
      const lockerAddress1 = res.logs[0].args.locker;
      res = await this.spaceLockerFactory.build({ from: alice });
      const lockerAddress2 = res.logs[0].args.locker;
      res = await this.spaceLockerFactory.build({ from: bob });
      const lockerAddress3 = res.logs[0].args.locker;
      res = await this.spaceLockerFactory.build({ from: bob });
      const lockerAddress4 = res.logs[0].args.locker;
      res = await this.spaceLockerFactory.build({ from: bob });
      const lockerAddress5 = res.logs[0].args.locker;
      res = await this.spaceLockerFactory.build({ from: charlie });
      const lockerAddress6 = res.logs[0].args.locker;
      res = await this.spaceLockerFactory.build({ from: dan });
      const lockerAddress7 = res.logs[0].args.locker;

      const locker1 = await SpaceLocker.at(lockerAddress1);
      const locker2 = await SpaceLocker.at(lockerAddress2);
      const locker3 = await SpaceLocker.at(lockerAddress3);
      const locker4 = await SpaceLocker.at(lockerAddress4);
      const locker5 = await SpaceLocker.at(lockerAddress5);
      const locker6 = await SpaceLocker.at(lockerAddress6);
      const locker7 = await SpaceLocker.at(lockerAddress7);

      // APPROVE SPACE TOKENS
      await this.spaceToken.approve(lockerAddress1, x1, { from: alice });
      await this.spaceToken.approve(lockerAddress2, x2, { from: alice });
      await this.spaceToken.approve(lockerAddress3, x3, { from: bob });
      await this.spaceToken.approve(lockerAddress4, x4, { from: bob });
      await this.spaceToken.approve(lockerAddress5, x5, { from: bob });
      await this.spaceToken.approve(lockerAddress6, x6, { from: charlie });
      await this.spaceToken.approve(lockerAddress7, x7, { from: dan });

      // DEPOSIT SPACE TOKENS
      await locker1.deposit(x1, { from: alice });
      await locker2.deposit(x2, { from: alice });
      await locker3.deposit(x3, { from: bob });
      await locker4.deposit(x4, { from: bob });
      await locker5.deposit(x5, { from: bob });
      await locker6.deposit(x6, { from: charlie });
      await locker7.deposit(x7, { from: dan });

      // APPROVE REPUTATION MINT AT ASRA
      p = [
        locker1.approveMint(this.spaceRA.address, { from: alice }),
        locker2.approveMint(this.spaceRA.address, { from: alice }),
        locker3.approveMint(this.spaceRA.address, { from: bob }),
        locker4.approveMint(this.spaceRA.address, { from: bob }),
        locker5.approveMint(this.spaceRA.address, { from: bob }),
        locker6.approveMint(this.spaceRA.address, { from: charlie }),
        locker7.approveMint(this.spaceRA.address, { from: dan })
      ];

      await Promise.all(p);

      // MINT REPUTATION TOKENS AT ASRA
      p = [
        this.spaceRA.mint(lockerAddress1, { from: alice }),
        this.spaceRA.mint(lockerAddress2, { from: alice }),
        this.spaceRA.mint(lockerAddress3, { from: bob }),
        this.spaceRA.mint(lockerAddress4, { from: bob }),
        this.spaceRA.mint(lockerAddress5, { from: bob }),
        this.spaceRA.mint(lockerAddress6, { from: charlie }),
        this.spaceRA.mint(lockerAddress7, { from: dan })
      ];

      await Promise.all(p);

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 800);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 1200);

      res = await this.spaceRA.balanceOf(charlie);
      assert.equal(res, 1000);

      res = await this.spaceRA.balanceOf(dan);
      assert.equal(res, 0);

      // PERMISSION CHECKS
      await assertRevert(this.spaceRA.delegate(charlie, alice, '200', { from: bob }));
      await assertRevert(this.spaceRA.delegate(charlie, alice, '1000', { from: alice }));

      // DELEGATE REPUTATION. ITERATION #1
      p = [
        this.spaceRA.delegate(charlie, alice, '250', { from: alice }),
        this.spaceRA.delegate(bob, alice, '50', { from: alice }),
        // alice keeps 500 reputation tokens minted from token x2 at her delegated balance
        this.spaceRA.delegate(alice, bob, '100', { from: bob }),
        // bob keeps 300 reputation tokens minted from token x3 at his delegated balance
        // bob keeps 700 reputation tokens minted from token x4 at his delegated balance
        this.spaceRA.delegate(charlie, bob, '50', { from: bob }),
        // bob keeps 50 reputation tokens minted from token x5 at his delegated balance
        this.spaceRA.delegate(bob, charlie, '1000', { from: charlie })
      ];

      await Promise.all(p);

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 600);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 2100);

      res = await this.spaceRA.balanceOf(charlie);
      assert.equal(res, 300);

      res = await this.spaceRA.balanceOf(dan);
      assert.equal(res, 0);

      // DELEGATE REPUTATION. ITERATION #2
      p = [
        this.spaceRA.delegate(charlie, bob, '100', { from: alice }),
        this.spaceRA.delegate(alice, charlie, '1000', { from: bob }),
        this.spaceRA.delegate(dan, bob, '50', { from: charlie })
      ];

      await Promise.all(p);

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 1500);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 1100);

      res = await this.spaceRA.balanceOf(charlie);
      assert.equal(res, 350);

      res = await this.spaceRA.balanceOf(dan);
      assert.equal(res, 50);

      // DELEGATE REPUTATION. ITERATION #3
      await this.spaceRA.delegate(dan, charlie, '1000', { from: alice });

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 500);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 1100);

      res = await this.spaceRA.balanceOf(charlie);
      assert.equal(res, 350);

      res = await this.spaceRA.balanceOf(dan);
      assert.equal(res, 1050);

      // LOCK REPUTATION AT VOTING
      await assertRevert(this.spaceRA.lockReputation(this.Y, '600', { from: alice }));
      await assertRevert(this.spaceRA.lockReputation(charlie, '500', { from: alice }));
      p = [
        this.spaceRA.lockReputation(this.Y, '500', { from: alice }),
        this.spaceRA.lockReputation(this.X, '200', { from: bob }),
        this.spaceRA.lockReputation(this.Y, '500', { from: bob }),
        this.spaceRA.lockReputation(this.Z, '400', { from: bob }),
        this.spaceRA.lockReputation(this.Y, '200', { from: charlie }),
        this.spaceRA.lockReputation(this.Z, '150', { from: charlie }),
        this.spaceRA.lockReputation(this.X, '700', { from: dan })
      ];

      await Promise.all(p);

      // CHECK BALANCE AFTER LOCKING
      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 500);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 1100);

      res = await this.spaceRA.balanceOf(charlie);
      assert.equal(res, 350);

      res = await this.spaceRA.balanceOf(dan);
      assert.equal(res, 1050);

      // CHECK LOCKED BALANCE AFTER LOCKING
      res = await this.spaceRA.lockedMultiSigBalanceOf(alice, this.Y);
      assert.equal(res, 500);
      res = await this.spaceRA.lockedMultiSigBalanceOf(alice, this.Z);
      assert.equal(res, 0);

      res = await this.spaceRA.lockedMultiSigBalanceOf(bob, this.X);
      assert.equal(res, 200);
      res = await this.spaceRA.lockedMultiSigBalanceOf(bob, this.Y);
      assert.equal(res, 500);
      res = await this.spaceRA.lockedMultiSigBalanceOf(bob, this.Z);
      assert.equal(res, 400);

      res = await this.spaceRA.lockedMultiSigBalanceOf(charlie, this.Y);
      assert.equal(res, 200);
      res = await this.spaceRA.lockedMultiSigBalanceOf(charlie, this.Z);
      assert.equal(res, 150);

      res = await this.spaceRA.lockedMultiSigBalanceOf(dan, this.X);
      assert.equal(res, 700);

      // CHECK VOTING REPUTATION BALANCE
      res = await this.delegateSpaceVotingX.balanceOf(alice);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingY.balanceOf(alice);
      assert.equal(res, 500);

      res = await this.delegateSpaceVotingX.balanceOf(bob);
      assert.equal(res, 200);
      res = await this.delegateSpaceVotingY.balanceOf(bob);
      assert.equal(res, 500);
      res = await this.delegateSpaceVotingZ.balanceOf(bob);
      assert.equal(res, 400);

      res = await this.delegateSpaceVotingY.balanceOf(charlie);
      assert.equal(res, 200);
      res = await this.delegateSpaceVotingZ.balanceOf(charlie);
      assert.equal(res, 150);

      res = await this.delegateSpaceVotingX.balanceOf(dan);
      assert.equal(res, 700);

      // GRANT REPUTATION
      p = [
        this.delegateSpaceVotingY.grantReputation(candidateA, '200', { from: alice }),
        this.delegateSpaceVotingY.grantReputation(candidateC, '300', { from: alice }),
        this.delegateSpaceVotingX.grantReputation(candidateA, '200', { from: bob }),
        this.delegateSpaceVotingY.grantReputation(candidateA, '150', { from: bob }),
        this.delegateSpaceVotingY.grantReputation(candidateB, '200', { from: bob }),
        this.delegateSpaceVotingY.grantReputation(candidateC, '150', { from: bob }),
        this.delegateSpaceVotingZ.grantReputation(candidateD, '200', { from: bob }),
        this.delegateSpaceVotingZ.grantReputation(candidateE, '200', { from: bob }),
        this.delegateSpaceVotingY.grantReputation(candidateA, '100', { from: charlie }),
        // charlie keeps 100 of his reputation in voting Y not distributed
        this.delegateSpaceVotingZ.grantReputation(candidateD, '100', { from: charlie }),
        this.delegateSpaceVotingZ.grantReputation(candidateE, '50', { from: charlie }),
        this.delegateSpaceVotingX.grantReputation(candidateD, '700', { from: dan })
      ];

      await Promise.all(p);

      // CHECK VOTING X BALANCES
      res = await this.delegateSpaceVotingX.balanceOf(alice);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingX.balanceOf(bob);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingX.balanceOf(charlie);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingX.balanceOf(dan);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingX.balanceOf(candidateA);
      assert.equal(res, 200);
      res = await this.delegateSpaceVotingX.balanceOf(candidateB);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingX.balanceOf(candidateC);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingX.balanceOf(candidateD);
      assert.equal(res, 700);
      res = await this.delegateSpaceVotingX.balanceOf(candidateE);
      assert.equal(res, 0);

      // CHECK VOTING Y BALANCES
      res = await this.delegateSpaceVotingY.balanceOf(alice);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingY.balanceOf(bob);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingY.balanceOf(charlie);
      assert.equal(res, 100);
      res = await this.delegateSpaceVotingY.balanceOf(dan);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingY.balanceOf(candidateA);
      assert.equal(res, 450);
      res = await this.delegateSpaceVotingY.balanceOf(candidateB);
      assert.equal(res, 200);
      res = await this.delegateSpaceVotingY.balanceOf(candidateC);
      assert.equal(res, 450);
      res = await this.delegateSpaceVotingY.balanceOf(candidateD);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingY.balanceOf(candidateE);
      assert.equal(res, 0);

      // CHECK VOTING Z BALANCES
      res = await this.delegateSpaceVotingZ.balanceOf(alice);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingZ.balanceOf(bob);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingZ.balanceOf(charlie);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingZ.balanceOf(dan);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingZ.balanceOf(candidateA);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingZ.balanceOf(candidateB);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingZ.balanceOf(candidateC);
      assert.equal(res, 0);
      res = await this.delegateSpaceVotingZ.balanceOf(candidateD);
      assert.equal(res, 300);
      res = await this.delegateSpaceVotingZ.balanceOf(candidateE);
      assert.equal(res, 250);

      // RECALCULATE VOTES FOR ALL CANDIDATES
      await this.candidateTopY.recalculate(candidateA, { from: unauthorized });
      // CHECK CANDIDATE WEIGHTS
      // CHECK CANDIDATE ORDER
    });
  });

  describe('#onReputationChanged()', () => {
    before(async function() {
      this.spaceRA = await SpaceRA.new(this.ggr.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.SPACE_RA(), this.spaceRA.address, {
        from: coreTeam
      });
      await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), fakeSRA, true, { from: coreTeam });
    });

    beforeEach(async function() {
      await this.galtToken.approve(this.multiSigFactory.address, ether(10), { from: alice });
      // MultiSigF
      this.abF = await buildArbitration(
        this.multiSigFactory,
        [bob, charlie, dan, eve],
        2,
        2,
        3,
        60,
        ether(1000),
        [30, 30, 30, 30, 30, 30, 30, 30],
        {},
        alice
      );
      this.abMultiSigF = this.abF.multiSig;
      this.delegateSpaceVotingF = this.abF.delegateSpaceVoting;
    });

    describe('full reputation revoke', () => {
      it('should revoke reputation from multiple candidates', async function() {
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });
        await this.delegateSpaceVotingF.grantReputation(candidateA, 200, { from: alice });
        await this.delegateSpaceVotingF.grantReputation(candidateB, 300, { from: alice });
        await this.delegateSpaceVotingF.grantReputation(candidateC, 100, { from: alice });

        let res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 200);
        res = await this.delegateSpaceVotingF.balanceOf(candidateA);
        assert.equal(res, 200);
        res = await this.delegateSpaceVotingF.balanceOf(candidateB);
        assert.equal(res, 300);
        res = await this.delegateSpaceVotingF.balanceOf(candidateC);
        assert.equal(res, 100);
        res = await this.delegateSpaceVotingF.totalSupply();
        assert.equal(res, 800);

        // REVOKE
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 0, { from: fakeSRA });

        res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 0);
        res = await this.delegateSpaceVotingF.balanceOf(candidateA);
        assert.equal(res, 0);
        res = await this.delegateSpaceVotingF.balanceOf(candidateB);
        assert.equal(res, 0);
        res = await this.delegateSpaceVotingF.balanceOf(candidateC);
        assert.equal(res, 0);
        res = await this.delegateSpaceVotingF.totalSupply();
        assert.equal(res, 0);
      });

      it('should revoke reputation from single candidate', async function() {
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });
        await this.delegateSpaceVotingF.grantReputation(candidateA, 200, { from: alice });

        let res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 600);
        res = await this.delegateSpaceVotingF.balanceOf(candidateA);
        assert.equal(res, 200);
        res = await this.delegateSpaceVotingF.totalSupply();
        assert.equal(res, 800);

        // REVOKE
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 0, { from: fakeSRA });

        res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 0);
        res = await this.delegateSpaceVotingF.balanceOf(candidateA);
        assert.equal(res, 0);
      });

      it('should revoke reputation only from candidate', async function() {
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });

        let res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 800);
        res = await this.delegateSpaceVotingF.totalSupply();
        assert.equal(res, 800);

        // REVOKE
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 0, { from: fakeSRA });

        res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 0);
      });
    });

    describe('partial reputation revoke', () => {
      it('should revoke reputation from multiple candidates', async function() {
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });
        await this.delegateSpaceVotingF.grantReputation(candidateA, 200, { from: alice });
        await this.delegateSpaceVotingF.grantReputation(candidateB, 300, { from: alice });
        await this.delegateSpaceVotingF.grantReputation(candidateC, 100, { from: alice });

        let res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 200);
        res = await this.delegateSpaceVotingF.balanceOf(candidateA);
        assert.equal(res, 200);
        res = await this.delegateSpaceVotingF.balanceOf(candidateB);
        assert.equal(res, 300);
        res = await this.delegateSpaceVotingF.balanceOf(candidateC);
        assert.equal(res, 100);
        res = await this.delegateSpaceVotingF.totalSupply();
        assert.equal(res, 800);

        // REVOKE
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 200, { from: fakeSRA });

        res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 0);
        res = await this.delegateSpaceVotingF.balanceOf(candidateA);
        assert.equal(res, 0);
        res = await this.delegateSpaceVotingF.balanceOf(candidateB);
        assert.equal(res, 100);
        res = await this.delegateSpaceVotingF.balanceOf(candidateC);
        assert.equal(res, 100);
        res = await this.delegateSpaceVotingF.totalSupply();
        assert.equal(res, 200);
      });

      it('should revoke reputation from single candidate', async function() {
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });
        await this.delegateSpaceVotingF.grantReputation(candidateA, 200, { from: alice });

        let res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 600);
        res = await this.delegateSpaceVotingF.balanceOf(candidateA);
        assert.equal(res, 200);
        res = await this.delegateSpaceVotingF.totalSupply();
        assert.equal(res, 800);

        // REVOKE
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 100, { from: fakeSRA });

        res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 0);
        res = await this.delegateSpaceVotingF.balanceOf(candidateA);
        assert.equal(res, 100);
        res = await this.delegateSpaceVotingF.totalSupply();
        assert.equal(res, 100);
      });

      it('should revoke reputation only from candidate', async function() {
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });

        let res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 800);
        res = await this.delegateSpaceVotingF.totalSupply();
        assert.equal(res, 800);

        // REVOKE
        await this.delegateSpaceVotingF.onDelegateReputationChanged(alice, 300, { from: fakeSRA });

        res = await this.delegateSpaceVotingF.balanceOf(alice);
        assert.equal(res, 300);
        res = await this.delegateSpaceVotingF.totalSupply();
        assert.equal(res, 300);
      });
    });
  });
});
