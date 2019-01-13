/* eslint-disable prefer-arrow-callback */
const ArbitratorVoting = artifacts.require('./ArbitratorVoting.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceReputationAccounting = artifacts.require('./SpaceReputationAccounting.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const SpaceLockerRegistry = artifacts.require('./SpaceLockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const SpaceLocker = artifacts.require('./SpaceLocker.sol');
const Web3 = require('web3');
const { ether, assertRevert, initHelperWeb3, initHelperArtifacts, deploySplitMerge } = require('../helpers');

const web3 = new Web3(ArbitratorVoting.web3.currentProvider);
const { deployMultiSigFactory } = require('../deploymentHelpers');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const TYPE_A = 'TYPE_A';
const TYPE_B = 'TYPE_B';
const TYPE_C = 'TYPE_C';

const MY_APPLICATION = '0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7';

// NOTICE: we don't wrap MockToken with a proxy on production
contract('ArbitratorVoting', accounts => {
  const [
    coreTeam,
    arbitratorManager,
    oracleManager,
    claimManager,
    geoDateManagement,
    fakeSRA,
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
    candidateF,
    a1,
    a2,
    a3,
    unauthorized
  ] = accounts;

  beforeEach(async function() {
    // CREATING

    // console.log('A', candidateA);
    // console.log('B', candidateB);
    // console.log('C', candidateC);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.splitMerge = await deploySplitMerge(this.spaceToken.address);

    this.spaceLockerRegistry = await SpaceLockerRegistry.new({ from: coreTeam });
    this.spaceLockerFactory = await SpaceLockerFactory.new(
      this.spaceLockerRegistry.address,
      this.galtToken.address,
      this.spaceToken.address,
      this.splitMerge.address,
      { from: coreTeam }
    );

    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    this.spaceReputationAccounting = await SpaceReputationAccounting.new(
      this.spaceToken.address,
      this.multiSigRegistry.address,
      this.spaceLockerRegistry.address,
      { from: coreTeam }
    );
    this.multiSigFactory = await deployMultiSigFactory(
      this.galtToken.address,
      this.oracles,
      claimManager,
      this.multiSigRegistry,
      this.spaceReputationAccounting.address,
      coreTeam
    );
    this.multiSigFactoryF = await deployMultiSigFactory(
      this.galtToken.address,
      this.oracles,
      claimManager,
      this.multiSigRegistry,
      fakeSRA,
      coreTeam
    );

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(charlie, ether(10000000), { from: coreTeam });
    await this.galtToken.approve(this.multiSigFactory.address, ether(30), { from: alice });
    await this.galtToken.approve(this.multiSigFactoryF.address, ether(10), { from: alice });

    let res = await this.multiSigFactory.build([bob, charlie, dan, eve], 2, { from: alice });
    this.abMultiSigX = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);
    this.abVotingX = await ArbitratorVoting.at(res.logs[0].args.arbitratorVoting);
    this.oracleStakesAccountingX = await OracleStakesAccounting.at(res.logs[0].args.oracleStakesAccounting);

    res = await this.multiSigFactory.build([bob, charlie, dan, eve], 2, { from: alice });
    this.abMultiSigY = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);
    this.abVotingY = await ArbitratorVoting.at(res.logs[0].args.arbitratorVoting);
    this.oracleStakesAccountingY = await OracleStakesAccounting.at(res.logs[0].args.oracleStakesAccounting);

    res = await this.multiSigFactory.build([bob, charlie, dan, eve], 2, { from: alice });
    this.abMultiSigZ = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);
    this.abVotingZ = await ArbitratorVoting.at(res.logs[0].args.arbitratorVoting);
    this.oracleStakesAccountingZ = await OracleStakesAccounting.at(res.logs[0].args.oracleStakesAccounting);

    res = await this.multiSigFactoryF.build([a1, a2, a3], 2, { from: alice });
    this.abMultiSigF = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);
    this.abVotingF = await ArbitratorVoting.at(res.logs[0].args.arbitratorVoting);
    this.oracleStakesAccountingF = await OracleStakesAccounting.at(res.logs[0].args.oracleStakesAccounting);

    // ASSIGNING ROLES
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.spaceToken.addRoleTo(minter, 'minter', {
      from: coreTeam
    });
    await this.splitMerge.addRoleTo(geoDateManagement, 'geo_data_manager', {
      from: coreTeam
    });
    await this.spaceLockerRegistry.addRoleTo(
      this.spaceLockerFactory.address,
      await this.spaceLockerRegistry.ROLE_FACTORY(),
      {
        from: coreTeam
      }
    );

    // CONFIGURING
    await this.oracles.setApplicationTypeOracleTypes(
      MY_APPLICATION,
      [TYPE_A, TYPE_B, TYPE_C],
      [50, 25, 25],
      ['', '', ''],
      { from: oracleManager }
    );

    await this.oracles.setOracleTypeMinimalDeposit(TYPE_A, 200, { from: oracleManager });
    await this.oracles.setOracleTypeMinimalDeposit(TYPE_B, 200, { from: oracleManager });
    await this.oracles.setOracleTypeMinimalDeposit(TYPE_C, 200, { from: oracleManager });

    await this.oracles.addOracle(this.abMultiSigX.address, bob, 'Bob', 'MN', [], [TYPE_A], {
      from: oracleManager
    });
    await this.oracles.addOracle(this.abMultiSigX.address, charlie, 'Charlie', 'MN', [], [TYPE_B, TYPE_C], {
      from: oracleManager
    });
    await this.oracles.addOracle(this.abMultiSigX.address, dan, 'Dan', 'MN', [], [TYPE_A, TYPE_B, TYPE_C], {
      from: oracleManager
    });
    await this.oracles.addOracle(this.abMultiSigY.address, eve, 'Eve', 'MN', [], [TYPE_A, TYPE_B, TYPE_C], {
      from: oracleManager
    });

    // CREATING WEB3 1.X INSTANCES
    this.abVotingXWeb3 = new web3.eth.Contract(this.abVotingX.abi, this.abVotingX.address);
    this.abVotingYWeb3 = new web3.eth.Contract(this.abVotingY.abi, this.abVotingY.address);
    this.abVotingZWeb3 = new web3.eth.Contract(this.abVotingZ.abi, this.abVotingZ.address);
    this.abVotingFWeb3 = new web3.eth.Contract(this.abVotingF.abi, this.abVotingF.address);
    this.abMultiSigXWeb3 = new web3.eth.Contract(this.abMultiSigX.abi, this.abMultiSigX.address);
    this.abMultiSigFWeb3 = new web3.eth.Contract(this.abMultiSigF.abi, this.abMultiSigF.address);
    this.oracleStakesXWeb3 = new web3.eth.Contract(
      this.oracleStakesAccountingX.abi,
      this.oracleStakesAccountingX.address
    );
    this.spaceReputationAccountingWeb3 = new web3.eth.Contract(
      this.spaceReputationAccounting.abi,
      this.spaceReputationAccounting.address
    );

    // SHORT LINKS
    this.X = this.abMultiSigX.address;
    this.Y = this.abMultiSigY.address;
    this.Z = this.abMultiSigZ.address;
  });

  describe('scenarios', () => {
    // oracle 1 votes for candidate A without stake and fails
    // oracle 1 deposit stake for role L 200
    // oracle 2 deposit stake for role M 200
    // oracle 2 deposit stake for role L 200
    // oracle 3 deposit insufficient stake for role M 150
    // oracle 3 deposit stake for role L 200
    // oracle 3 deposit stake for role N 200

    // oracle 1 votes for candidate A
    // oracle 2 votes for candidate B
    // oracle 2 revotes for candidate A
    // oracle 3 votes for candidate C

    it('Scenario #1. Three oracles voting, no space owners', async function() {
      await this.galtToken.approve(this.oracleStakesAccountingY.address, ether(2000), { from: alice });
      await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(2000), { from: alice });

      await this.oracleStakesAccountingX.stake(charlie, TYPE_B, ether(200), { from: alice });
      await this.oracleStakesAccountingX.stake(charlie, TYPE_C, ether(200), { from: alice });
      await this.oracleStakesAccountingX.stake(dan, TYPE_A, ether(200), { from: alice });
      await this.oracleStakesAccountingX.stake(dan, TYPE_B, ether(200), { from: alice });
      await this.oracleStakesAccountingX.stake(dan, TYPE_C, ether(300), { from: alice });

      await assertRevert(this.abVotingX.voteWithOracleStake(candidateA, { from: bob }));

      await this.oracleStakesAccountingX.stake(bob, TYPE_A, ether(200), { from: alice });

      await this.abVotingX.voteWithOracleStake(candidateA, { from: bob });
      // TODO: check candidates

      let res = await this.abVotingXWeb3.methods.getOracleStakes(candidateA).call();
      assert.equal(res, ether(200));

      // oracle 2 votes for candidate B
      await this.abVotingX.voteWithOracleStake(candidateB, { from: charlie });

      res = await this.abVotingXWeb3.methods.getOracleStakes(candidateA).call();
      assert.equal(res, ether(200));

      res = await this.abVotingXWeb3.methods.getOracleStakes(candidateB).call();
      assert.equal(res, ether(400));

      // oracle 2 change decision and votes for the candidates A
      await this.abVotingX.voteWithOracleStake(candidateA, { from: charlie });

      res = await this.abVotingXWeb3.methods.getOracleStakes(candidateA).call();
      assert.equal(res, ether(600));

      res = await this.abVotingXWeb3.methods.getOracleStakes(candidateB).call();
      assert.equal(res, ether(0));

      // oracle 3 change decision and votes for the candidates C
      await this.abVotingX.voteWithOracleStake(candidateC, { from: dan });

      res = await this.abVotingXWeb3.methods.getOracleStakes(candidateC).call();
      assert.equal(res, ether(700));

      // oracle 3 stake is slashed due some misbehaviour
      await this.oracleStakesAccountingX.slashMultiple([dan, dan], [TYPE_B, TYPE_C], [ether(150), ether(200)], {
        from: claimManager
      });

      res = await this.abVotingXWeb3.methods.getOracleStakes(candidateA).call();
      assert.equal(res, ether(600));

      res = await this.abVotingXWeb3.methods.getOracleStakes(candidateB).call();
      assert.equal(res, ether(0));

      res = await this.abVotingXWeb3.methods.getOracleStakes(candidateC).call();
      assert.equal(res, ether(350));
    });

    it('Scenario #2. Three space owners voting, no oracles', async function() {
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
        this.splitMerge.setTokenArea(x1, '300', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x2, '500', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x3, '400', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x4, '700', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x5, '100', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x6, '1000', { from: geoDateManagement }),
        this.splitMerge.setTokenArea(x7, '200', { from: geoDateManagement })
      ];

      await Promise.all(p);

      await this.galtToken.approve(this.spaceLockerFactory.address, ether(20), { from: alice });
      await this.galtToken.approve(this.spaceLockerFactory.address, ether(30), { from: bob });
      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: charlie });

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

      const locker1 = await SpaceLocker.at(lockerAddress1);
      const locker2 = await SpaceLocker.at(lockerAddress2);
      const locker3 = await SpaceLocker.at(lockerAddress3);
      const locker4 = await SpaceLocker.at(lockerAddress4);
      const locker5 = await SpaceLocker.at(lockerAddress5);
      const locker6 = await SpaceLocker.at(lockerAddress6);

      // APPROVE SPACE TOKENS
      await this.spaceToken.approve(lockerAddress1, x1, { from: alice });
      await this.spaceToken.approve(lockerAddress2, x2, { from: alice });
      await this.spaceToken.approve(lockerAddress3, x3, { from: bob });
      await this.spaceToken.approve(lockerAddress4, x4, { from: bob });
      await this.spaceToken.approve(lockerAddress5, x5, { from: bob });
      await this.spaceToken.approve(lockerAddress6, x6, { from: charlie });

      // DEPOSIT SPACE TOKENS
      await locker1.deposit(x1, { from: alice });
      await locker2.deposit(x2, { from: alice });
      await locker3.deposit(x3, { from: bob });
      await locker4.deposit(x4, { from: bob });
      await locker5.deposit(x5, { from: bob });
      await locker6.deposit(x6, { from: charlie });

      // APPROVE REPUTATION MINT AT ASRA
      p = [
        locker1.approveMint(this.spaceReputationAccounting.address, { from: alice }),
        locker2.approveMint(this.spaceReputationAccounting.address, { from: alice }),
        locker3.approveMint(this.spaceReputationAccounting.address, { from: bob }),
        locker4.approveMint(this.spaceReputationAccounting.address, { from: bob }),
        locker5.approveMint(this.spaceReputationAccounting.address, { from: bob }),
        locker6.approveMint(this.spaceReputationAccounting.address, { from: charlie })
      ];

      await Promise.all(p);

      // MINT REPUTATION TOKENS AT ASRA
      p = [
        this.spaceReputationAccounting.mint(lockerAddress1, { from: alice }),
        this.spaceReputationAccounting.mint(lockerAddress2, { from: alice }),
        this.spaceReputationAccounting.mint(lockerAddress3, { from: bob }),
        this.spaceReputationAccounting.mint(lockerAddress4, { from: bob }),
        this.spaceReputationAccounting.mint(lockerAddress5, { from: bob }),
        this.spaceReputationAccounting.mint(lockerAddress6, { from: charlie })
      ];

      await Promise.all(p);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 800);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 1200);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 1000);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(dan).call();
      assert.equal(res, 0);

      // PERMISSION CHECKS
      await assertRevert(this.spaceReputationAccounting.delegate(charlie, alice, '200', { from: bob }));
      await assertRevert(this.spaceReputationAccounting.delegate(charlie, alice, '1000', { from: alice }));

      // DELEGATE REPUTATION. ITERATION #1
      p = [
        this.spaceReputationAccounting.delegate(charlie, alice, '250', { from: alice }),
        this.spaceReputationAccounting.delegate(bob, alice, '50', { from: alice }),
        // alice keeps 500 reputation tokens minted from token x2 at her delegated balance
        this.spaceReputationAccounting.delegate(alice, bob, '100', { from: bob }),
        // bob keeps 300 reputation tokens minted from token x3 at his delegated balance
        // bob keeps 700 reputation tokens minted from token x4 at his delegated balance
        this.spaceReputationAccounting.delegate(charlie, bob, '50', { from: bob }),
        // bob keeps 50 reputation tokens minted from token x5 at his delegated balance
        this.spaceReputationAccounting.delegate(bob, charlie, '1000', { from: charlie })
      ];

      await Promise.all(p);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 600);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 2100);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 300);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(dan).call();
      assert.equal(res, 0);

      // DELEGATE REPUTATION. ITERATION #2
      p = [
        this.spaceReputationAccounting.delegate(charlie, bob, '100', { from: alice }),
        this.spaceReputationAccounting.delegate(alice, charlie, '1000', { from: bob }),
        this.spaceReputationAccounting.delegate(dan, bob, '50', { from: charlie })
      ];

      await Promise.all(p);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 1500);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 1100);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 350);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(dan).call();
      assert.equal(res, 50);

      // DELEGATE REPUTATION. ITERATION #3
      await this.spaceReputationAccounting.delegate(dan, charlie, '1000', { from: alice });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 500);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 1100);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 350);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(dan).call();
      assert.equal(res, 1050);

      // LOCK REPUTATION AT VOTING
      await assertRevert(this.spaceReputationAccounting.lockReputation(this.Y, '600', { from: alice }));
      await assertRevert(this.spaceReputationAccounting.lockReputation(charlie, '500', { from: alice }));
      p = [
        this.spaceReputationAccounting.lockReputation(this.Y, '500', { from: alice }),
        this.spaceReputationAccounting.lockReputation(this.X, '200', { from: bob }),
        this.spaceReputationAccounting.lockReputation(this.Y, '500', { from: bob }),
        this.spaceReputationAccounting.lockReputation(this.Z, '400', { from: bob }),
        this.spaceReputationAccounting.lockReputation(this.Y, '200', { from: charlie }),
        this.spaceReputationAccounting.lockReputation(this.Z, '150', { from: charlie }),
        this.spaceReputationAccounting.lockReputation(this.X, '700', { from: dan })
      ];

      await Promise.all(p);

      // CHECK BALANCE AFTER LOCKING
      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 0);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 0);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 0);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(dan).call();
      assert.equal(res, 350);

      // CHECK LOCKED BALANCE AFTER LOCKING
      res = await this.spaceReputationAccountingWeb3.methods.lockedBalanceOf(alice, this.Y).call();
      assert.equal(res, 500);
      res = await this.spaceReputationAccountingWeb3.methods.lockedBalanceOf(alice, this.Z).call();
      assert.equal(res, 0);

      res = await this.spaceReputationAccountingWeb3.methods.lockedBalanceOf(bob, this.X).call();
      assert.equal(res, 200);
      res = await this.spaceReputationAccountingWeb3.methods.lockedBalanceOf(bob, this.Y).call();
      assert.equal(res, 500);
      res = await this.spaceReputationAccountingWeb3.methods.lockedBalanceOf(bob, this.Z).call();
      assert.equal(res, 400);

      res = await this.spaceReputationAccountingWeb3.methods.lockedBalanceOf(charlie, this.Y).call();
      assert.equal(res, 200);
      res = await this.spaceReputationAccountingWeb3.methods.lockedBalanceOf(charlie, this.Z).call();
      assert.equal(res, 150);

      res = await this.spaceReputationAccountingWeb3.methods.lockedBalanceOf(dan, this.X).call();
      assert.equal(res, 700);

      // CHECK VOTING REPUTATION BALANCE
      res = await this.abVotingXWeb3.methods.getSpaceReputation(alice).call();
      assert.equal(res, 0);
      res = await this.abVotingYWeb3.methods.getSpaceReputation(alice).call();
      assert.equal(res, 500);

      res = await this.abVotingXWeb3.methods.getSpaceReputation(bob).call();
      assert.equal(res, 200);
      res = await this.abVotingYWeb3.methods.getSpaceReputation(bob).call();
      assert.equal(res, 500);
      res = await this.abVotingZWeb3.methods.getSpaceReputation(bob).call();
      assert.equal(res, 400);

      res = await this.abVotingYWeb3.methods.getSpaceReputation(charlie).call();
      assert.equal(res, 200);
      res = await this.abVotingZWeb3.methods.getSpaceReputation(charlie).call();
      assert.equal(res, 150);

      res = await this.abVotingXWeb3.methods.getSpaceReputation(dan).call();
      assert.equal(res, 700);

      // GRANT REPUTATION
      p = [
        this.abVotingY.grantReputation(candidateA, '200', { from: alice }),
        this.abVotingY.grantReputation(candidateC, '300', { from: alice }),
        this.abVotingX.grantReputation(candidateA, '200', { from: bob }),
        this.abVotingY.grantReputation(candidateA, '150', { from: bob }),
        this.abVotingY.grantReputation(candidateB, '200', { from: bob }),
        this.abVotingY.grantReputation(candidateC, '150', { from: bob }),
        this.abVotingZ.grantReputation(candidateD, '200', { from: bob }),
        this.abVotingZ.grantReputation(candidateE, '200', { from: bob }),
        this.abVotingY.grantReputation(candidateA, '100', { from: charlie }),
        // charlie keeps 100 of his reputation in voting Y not distributed
        this.abVotingZ.grantReputation(candidateD, '100', { from: charlie }),
        this.abVotingZ.grantReputation(candidateE, '50', { from: charlie }),
        this.abVotingX.grantReputation(candidateD, '700', { from: dan })
      ];

      await Promise.all(p);

      // CHECK VOTING X BALANCES
      res = await this.abVotingXWeb3.methods.getSpaceReputation(alice).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputation(bob).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputation(charlie).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputation(dan).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputation(candidateA).call();
      assert.equal(res, 200);
      res = await this.abVotingXWeb3.methods.getSpaceReputation(candidateB).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputation(candidateC).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputation(candidateD).call();
      assert.equal(res, 700);
      res = await this.abVotingXWeb3.methods.getSpaceReputation(candidateE).call();
      assert.equal(res, 0);

      // CHECK VOTING Y BALANCES
      res = await this.abVotingYWeb3.methods.getSpaceReputation(alice).call();
      assert.equal(res, 0);
      res = await this.abVotingYWeb3.methods.getSpaceReputation(bob).call();
      assert.equal(res, 0);
      res = await this.abVotingYWeb3.methods.getSpaceReputation(charlie).call();
      assert.equal(res, 100);
      res = await this.abVotingYWeb3.methods.getSpaceReputation(dan).call();
      assert.equal(res, 0);
      res = await this.abVotingYWeb3.methods.getSpaceReputation(candidateA).call();
      assert.equal(res, 450);
      res = await this.abVotingYWeb3.methods.getSpaceReputation(candidateB).call();
      assert.equal(res, 200);
      res = await this.abVotingYWeb3.methods.getSpaceReputation(candidateC).call();
      assert.equal(res, 450);
      res = await this.abVotingYWeb3.methods.getSpaceReputation(candidateD).call();
      assert.equal(res, 0);
      res = await this.abVotingYWeb3.methods.getSpaceReputation(candidateE).call();
      assert.equal(res, 0);

      // CHECK VOTING Z BALANCES
      res = await this.abVotingZWeb3.methods.getSpaceReputation(alice).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputation(bob).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputation(charlie).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputation(dan).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputation(candidateA).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputation(candidateB).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputation(candidateC).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputation(candidateD).call();
      assert.equal(res, 300);
      res = await this.abVotingZWeb3.methods.getSpaceReputation(candidateE).call();
      assert.equal(res, 250);

      // RECALCULATE VOTES FOR ALL CANDIDATES
      this.abVotingX.recalculate(candidateA, { from: unauthorized });
      // CHECK CANDIDATE WEIGHTS
      // CHECK CANDIDATE ORDER
    });
  });

  describe('recalculation & sorting', () => {
    let voting;
    let votingWeb3;
    beforeEach(async function() {
      voting = this.abVotingF;
      votingWeb3 = this.abVotingFWeb3;
    });

    describe('0 weight', () => {
      describe('not in list', () => {
        it('should not affect on the list', async () => {
          await voting.recalculate(alice);
          let res = await votingWeb3.methods.getCandidates().call();
          assert.sameMembers(res, []);
          res = await votingWeb3.methods.getSize().call();
          assert.equal(res, 0);
        });
      });

      describe('in list', () => {
        beforeEach(async () => {
          const p = [
            voting.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA }),
            voting.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA }),
            voting.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA })
          ];

          await Promise.all(p);
        });

        describe('1-element list', () => {
          // The first element is always HEAD
          it('should clear the list if this element is the only element of the list', async function() {
            await voting.recalculate(candidateA);

            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameMembers(res.map(a => a.toLowerCase()), [candidateA]);
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);

            await voting.onDelegateReputationChanged(candidateA, 0, { from: fakeSRA });

            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);

            await voting.recalculate(candidateA);

            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameMembers(res, []);
          });
        });

        describe('2-element list', () => {
          // The 1st element is HEAD and the second is TAIL
          beforeEach(async () => {
            const p = [voting.recalculate(candidateA), voting.recalculate(candidateB)];

            await Promise.all(p);
          });

          it('should move tail to head if the element is the HEAD', async () => {
            // CHECK LIST
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // ACTION
            await voting.onDelegateReputationChanged(candidateB, 0, { from: fakeSRA });

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2300);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            await voting.recalculate(candidateB);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2300);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 0);
          });

          it('should remove tail if the element is the TAIL', async function() {
            // CHECK LIST
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // ACTION
            await voting.onDelegateReputationChanged(candidateA, 0, { from: fakeSRA });

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            await voting.recalculate(candidateA);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 0);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);
          });
        });

        describe('3-element list', () => {
          // The 1st element is HEAD and the second is TAIL
          beforeEach(async () => {
            const p = [voting.recalculate(candidateA), voting.recalculate(candidateB), voting.recalculate(candidateC)];

            await Promise.all(p);
          });

          it('should move head down if the element is the HEAD', async function() {
            // CHECK LIST
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // ACTION
            await voting.onDelegateReputationChanged(candidateC, 0, { from: fakeSRA });

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2000);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            await voting.recalculate(candidateC);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2000);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 0);
          });

          it('should move link elements correctly if the element is the middle', async function() {
            // CHECK LIST
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // ACTION
            await voting.onDelegateReputationChanged(candidateB, 0, { from: fakeSRA });

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2300);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            await voting.recalculate(candidateB);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2300);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 0);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);
          });

          it('should move tail up if the element is the TAIL', async function() {
            // CHECK LIST
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // ACTION
            await voting.onDelegateReputationChanged(candidateA, 0, { from: fakeSRA });

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // UNEXPECTED ACTION
            await voting.recalculate(candidateB);

            // CHECK LIST
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 222222);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // ACTION
            await voting.recalculate(candidateA);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 0);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 222222);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // ACTION
            await voting.recalculate(candidateC);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 0);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 222222);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 277777);
          });
        });
      });
    });

    describe('> 0 weight', () => {
      describe('into', () => {
        describe('1-element list', () => {
          it('should not affect the list if this element is the HEAD element of the list ', async function() {
            await voting.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });
            await voting.recalculate(candidateA);

            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);

            // CHANGE
            await voting.onDelegateReputationChanged(candidateA, 700, { from: fakeSRA });

            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);

            // RECALCULATE
            await voting.recalculate(candidateA);
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);
          });

          describe('and the element isnt the first element', () => {
            beforeEach(async function() {
              await voting.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
              await voting.recalculate(candidateA);
              await voting.recalculate(candidateB);
            });

            describe('recalculate older one first', () => {
              it('should insert element to the HEAD if its weight >= the HEAD and move HEAD to TAIL', async function() {
                await voting.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 0);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 0);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);
              });

              it('should insert element to the TAIL if its weight < the HEAD', async function() {
                await voting.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 300000);

                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 200000);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 300000);
              });
            });

            describe('recalculate new one first', () => {
              it('should insert element to the HEAD if its weight >= the HEAD and move HEAD to TAIL', async function() {
                await voting.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 0);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);
              });

              it('should insert element to the TAIL if its weight < the HEAD', async function() {
                await voting.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 200000);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 200000);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 300000);
              });
            });
          });
        });

        describe('2-element list', () => {
          beforeEach(async function() {
            await voting.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
            await voting.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });

            await voting.recalculate(candidateB);
            await voting.recalculate(candidateC);
          });

          describe('and the element is HEAD', () => {
            describe('and its new weight E >= HEAD', () => {
              it('should keep array as is when recalculates changed one first', async function() {
                await voting.onDelegateReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 312500);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 187500);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 312500);
              });

              it('should keep array as is when recalculates old one first', async function() {
                await voting.onDelegateReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 187500);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 187500);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 312500);
              });
            });

            describe('and its new weight TAIL < E < HEAD', async function() {
              it('should keep array as is when recalculates changed one first', async function() {
                await voting.onDelegateReputationChanged(candidateC, 1201, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });

              it('should keep array as is when recalculates new one first', async function() {
                await voting.onDelegateReputationChanged(candidateC, 1201, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });
            });
            describe('and its new weight E < TAIL', async function() {
              it('should reverse array as is when recalculates changed one first', async function() {
                await voting.onDelegateReputationChanged(candidateC, 1199, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1199);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 249895);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 250104);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1199);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 249895);
              });

              it('should reverse array as is when recalculates new one first', async function() {
                await voting.onDelegateReputationChanged(candidateC, 1199, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 250104);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1199);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 250104);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1199);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 249895);
              });
            });
          });

          describe('and the element is TAIL', () => {
            describe('and its new weight E >= HEAD', () => {
              it('should reverse array as is when recalculates changed one first', async function() {
                await voting.onDelegateReputationChanged(candidateB, 1501, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3001);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3001);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });

              it('should reverse array as is when recalculates not changed one first', async function() {
                await voting.onDelegateReputationChanged(candidateB, 1501, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3001);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3001);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });
            });

            describe('and its new weight TAIL < E < HEAD', () => {
              it('should keep array as is when recalculates changed one first', async function() {
                await voting.onDelegateReputationChanged(candidateB, 1201, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2701);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2701);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });

              it('should keep array as is when recalculates not changed one first', async function() {
                await voting.onDelegateReputationChanged(candidateB, 1201, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2701);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2701);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });
            });

            describe('and its new weight E < TAIL', () => {
              it('should keep array as is when recalculates changed one first', async function() {
                await voting.onDelegateReputationChanged(candidateB, 1199, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2699);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2699);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });

              it('should keep array as is when recalculates not changed one first', async function() {
                await voting.onDelegateReputationChanged(candidateB, 1199, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2699);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2699);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });
            });
          });

          describe('and the element is a new one', () => {
            describe('recalculate order A => B => C', () => {
              it('should push it as HEAD', async function() {
                await voting.onDelegateReputationChanged(candidateA, 1501, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateA, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 142823);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateA, candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 142823);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 178528);
              });

              it('should push into the middle', async function() {
                await voting.onDelegateReputationChanged(candidateA, 1201, { from: fakeSRA });

                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateA, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3901);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should push as tail', async function() {
                await voting.onDelegateReputationChanged(candidateA, 1199, { from: fakeSRA });

                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3899);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });
            });

            describe('recalculate order C => A => B', () => {
              it('should push it as HEAD', async function() {
                await voting.onDelegateReputationChanged(candidateA, 1501, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 178528);

                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateA, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 178528);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateA, candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 142823);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 178528);
              });

              it('should push into the middle', async function() {
                await voting.onDelegateReputationChanged(candidateA, 1201, { from: fakeSRA });

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateA, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3901);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should push as tail', async function() {
                await voting.onDelegateReputationChanged(candidateA, 1199, { from: fakeSRA });

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3899);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });
            });

            describe('recalculate order B => C => A', () => {
              it('should push it as HEAD', async function() {
                await voting.onDelegateReputationChanged(candidateA, 1501, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateA, candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 142823);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 178528);
              });

              it('should push into the middle', async function() {
                await voting.onDelegateReputationChanged(candidateA, 1201, { from: fakeSRA });

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE A
                await voting.recalculate(candidateA);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateA, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3901);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should push as tail', async function() {
                await voting.onDelegateReputationChanged(candidateA, 1199, { from: fakeSRA });

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE A
                await voting.recalculate(candidateA);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3899);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });
            });
          });
        });

        describe('3-element list', () => {
          beforeEach(async function() {
            await voting.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });
            await voting.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
            await voting.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });

            await voting.recalculate(candidateB);
            await voting.recalculate(candidateC);
            await voting.recalculate(candidateA);
          });

          describe('and the element is HEAD', () => {
            describe('and its new weight E >= HEAD', () => {
              it('should keep array after C => B => A recalculation', async function() {
                await voting.onDelegateReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE a
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 100000);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 150000);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 250000);
              });

              it('should keep array after A => B => C recalculation', async function() {
                await voting.onDelegateReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should keep array after B => A => C recalculation', async function() {
                await voting.onDelegateReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });
            });
            describe('and its new weight E >= (HEAD - 1)', () => {
              it('should keep array after uncommon case', async function() {
                await voting.onDelegateReputationChanged(candidateC, 802, { from: fakeSRA });
                await voting.onDelegateReputationChanged(candidateB, 801, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2403);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2403);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 114285);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 801);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 171428);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 802);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 166874);

                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2403);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 166458);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 801);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 171428);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 802);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 166874);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2403);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 166458);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 801);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 166666);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 802);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 166874);
              });
            });

            describe('and its new weight TAIL < E < HEAD', async function() {
              it('should keep array after C => B => A recalculation', async function() {
                await voting.onDelegateReputationChanged(candidateC, 1000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should keep array after A => B => C recalculation', async function() {
                await voting.onDelegateReputationChanged(candidateC, 1000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should keep array after B => A => C recalculation', async function() {
                await voting.onDelegateReputationChanged(candidateC, 1000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateC, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });
            });
          });
        });

        describe('when limit is reached', () => {
          beforeEach(async function() {
            await voting.setMofN(2, 3, { from: fakeSRA });

            await voting.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });
            await voting.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
            await voting.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });

            await voting.recalculate(candidateB);
            await voting.recalculate(candidateC);
            await voting.recalculate(candidateA);
          });

          it('should remove last element when E > HEAD was pushed', async function() {
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            await voting.onDelegateReputationChanged(candidateD, 2000, { from: fakeSRA });

            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 5500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            await voting.recalculate(candidateD);

            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateC, candidateD, candidateB]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 5500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);
          });
        });
      });
    });

    it('should sort basic case', async () => {
      await voting.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });
      await voting.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
      await voting.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });
      await voting.onDelegateReputationChanged(candidateD, 300, { from: fakeSRA });
      await voting.onDelegateReputationChanged(candidateE, 600, { from: fakeSRA });

      let res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
      assert.equal(res, 800);
      res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
      assert.equal(res, 1200);
      res = await votingWeb3.methods.getCandidates().call();
      assert.sameMembers(res, []);

      await voting.recalculate(alice);
      await voting.recalculate(candidateA);

      res = await votingWeb3.methods.getCandidates().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [candidateA]);

      await voting.recalculate(candidateB);
      res = await votingWeb3.methods.getCandidates().call();
      assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateB, candidateA]);
      // assert.fail('');
      // TODO: fetch list
    });
  });

  describe('#onReputationChanged()', () => {
    describe('full reputation revoke', () => {
      it('should revoke reputation from multiple candidates', async function() {
        await this.abVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });
        await this.abVotingF.grantReputation(candidateA, 200, { from: alice });
        await this.abVotingF.grantReputation(candidateB, 300, { from: alice });
        await this.abVotingF.grantReputation(candidateC, 100, { from: alice });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateB).call();
        assert.equal(res, 300);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateC).call();
        assert.equal(res, 100);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onDelegateReputationChanged(alice, 0, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateB).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateC).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 0);
      });

      it('should revoke reputation from single candidate', async function() {
        await this.abVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });
        await this.abVotingF.grantReputation(candidateA, 200, { from: alice });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 600);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onDelegateReputationChanged(alice, 0, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 0);
      });

      it('should revoke reputation only from candidate', async function() {
        await this.abVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 800);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onDelegateReputationChanged(alice, 0, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 0);
      });
    });

    describe('partial reputation revoke', () => {
      it('should revoke reputation from multiple candidates', async function() {
        await this.abVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });
        await this.abVotingF.grantReputation(candidateA, 200, { from: alice });
        await this.abVotingF.grantReputation(candidateB, 300, { from: alice });
        await this.abVotingF.grantReputation(candidateC, 100, { from: alice });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateB).call();
        assert.equal(res, 300);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateC).call();
        assert.equal(res, 100);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onDelegateReputationChanged(alice, 200, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateB).call();
        assert.equal(res, 100);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateC).call();
        assert.equal(res, 100);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 200);
      });

      it('should revoke reputation from single candidate', async function() {
        await this.abVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });
        await this.abVotingF.grantReputation(candidateA, 200, { from: alice });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 600);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onDelegateReputationChanged(alice, 100, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 100);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 100);
      });

      it('should revoke reputation only from candidate', async function() {
        await this.abVotingF.onDelegateReputationChanged(alice, 800, { from: fakeSRA });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 800);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onDelegateReputationChanged(alice, 300, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 300);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 300);
      });
    });
  });

  describe('#pushArbitrators()', () => {
    let voting;
    let votingWeb3;
    let multiSigWeb3;

    beforeEach(async function() {
      voting = this.abVotingF;
      votingWeb3 = this.abVotingFWeb3;
      multiSigWeb3 = this.abMultiSigFWeb3;

      await voting.setMofN(3, 5, { from: arbitratorManager });

      await voting.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });
      await voting.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
      await voting.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });
      await voting.onDelegateReputationChanged(candidateD, 300, { from: fakeSRA });
      await voting.onDelegateReputationChanged(candidateE, 600, { from: fakeSRA });
      await voting.onDelegateReputationChanged(candidateF, 900, { from: fakeSRA });

      await voting.recalculate(candidateA);
      await voting.recalculate(candidateB);
      await voting.recalculate(candidateC);
      await voting.recalculate(candidateD);
      await voting.recalculate(candidateE);
      await voting.recalculate(candidateF);

      let res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
      assert.equal(res, 800);
      res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
      assert.equal(res, 1200);
      res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
      assert.equal(res, 1500);
      res = await votingWeb3.methods.getSpaceReputation(candidateD).call();
      assert.equal(res, 300);
      res = await votingWeb3.methods.getSpaceReputation(candidateE).call();
      assert.equal(res, 600);
      res = await votingWeb3.methods.getSpaceReputation(candidateF).call();
      assert.equal(res, 900);

      res = await votingWeb3.methods.getCandidates().call();
      assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [
        candidateC,
        candidateB,
        candidateF,
        candidateA,
        candidateE
      ]);
      res = await votingWeb3.methods.totalSpaceReputation().call();
      assert.equal(res, 5300);
      res = await votingWeb3.methods.getSize().call();
      assert.equal(res, 5);
    });

    it('should push arbitrators', async function() {
      let res = await multiSigWeb3.methods.getArbitrators().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [a1, a2, a3]);

      await voting.pushArbitrators();

      res = await multiSigWeb3.methods.getArbitrators().call();
      assert.equal(res.length, 5);
      assert.equal(res[0].toLowerCase(), candidateC);
      assert.equal(res[1].toLowerCase(), candidateB);
      assert.equal(res[2].toLowerCase(), candidateF);
      assert.equal(res[3].toLowerCase(), candidateA);
      assert.equal(res[4].toLowerCase(), candidateE);
    });

    it('should deny pushing list with < 3 elements', async function() {
      await voting.onDelegateReputationChanged(candidateA, 0, { from: fakeSRA });
      await voting.onDelegateReputationChanged(candidateB, 0, { from: fakeSRA });
      await voting.onDelegateReputationChanged(candidateC, 0, { from: fakeSRA });

      await voting.recalculate(candidateA);
      await voting.recalculate(candidateB);
      await voting.recalculate(candidateC);

      const res = await votingWeb3.methods.getCandidates().call();
      assert.sameOrderedMembers(res.map(a => a.toLowerCase()), [candidateF, candidateE]);
      await assertRevert(voting.pushArbitrators());
    });
  });
});
