const ArbitratorVoting = artifacts.require('./ArbitratorVoting.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceReputationAccounting = artifacts.require('./SpaceReputationAccounting.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const pIteration = require('p-iteration');
const { ether, assertRevert, initHelperWeb3 } = require('../helpers');

const web3 = new Web3(ArbitratorVoting.web3.currentProvider);
const { utf8ToHex } = web3.utils;

initHelperWeb3(web3);

chai.use(chaiAsPromised);

const TYPE_A = 'TYPE_A';
const TYPE_B = 'TYPE_B';
const TYPE_C = 'TYPE_C';

const MY_APPLICATION = '0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7';

async function buildMultiSigContracts(
  roleManager,
  claimManager,
  oraclesContract,
  galtTokenAddress,
  spaceReputationAccountingAddress,
  initialOwners = ['0x1', '0x2', '0x3'],
  required = 2
) {
  const multiSig = await ArbitratorsMultiSig.new(initialOwners, required, { from: roleManager });
  const oracleStakes = await OracleStakesAccounting.new(oraclesContract.address, galtTokenAddress, multiSig.address, {
    from: roleManager
  });
  const voting = await ArbitratorVoting.new(multiSig.address, spaceReputationAccountingAddress, oracleStakes.address, {
    from: roleManager
  });

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

// NOTICE: we don't wrap MockToken with a proxy on production
contract('ArbitratorVoting', accounts => {
  const [
    coreTeam,
    arbitratorManager,
    oracleManager,
    claimManager,
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
    candidateE
  ] = accounts;

  beforeEach(async function() {
    // CREATING

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.spaceReputationAccounting = await SpaceReputationAccounting.new(this.spaceToken.address, { from: coreTeam });

    const args = [
      coreTeam,
      claimManager,
      this.oracles,
      this.galtToken.address,
      this.spaceReputationAccounting.address,
      ['0x1', '0x2', '0x3'],
      2
    ];

    [this.abMultiSigX, this.abVotingX, this.oracleStakesAccountingX] = await buildMultiSigContracts(...args);
    [this.abMultiSigY, this.abVotingY, this.oracleStakesAccountingY] = await buildMultiSigContracts(...args);
    [this.abMultiSigZ, this.abVotingZ, this.oracleStakesAccountingZ] = await buildMultiSigContracts(...args);

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

    // CONFIGURING
    await this.oracles.setApplicationTypeOracleTypes(
      MY_APPLICATION,
      [TYPE_A, TYPE_B, TYPE_C],
      [50, 25, 25],
      ['', '', ''],
      { from: oracleManager }
    );

    await this.galtToken.mint(alice, ether(100000000), { from: coreTeam });

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
    this.abMultiSigXWeb3 = new web3.eth.Contract(this.abMultiSigX.abi, this.abMultiSigX.address);
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

      let res = await this.abVotingXWeb3.methods.getOracleCandidateWeight(candidateA).call();
      assert.equal(res, ether(200));

      // oracle 2 votes for candidate B
      await this.abVotingX.voteWithOracleStake(candidateB, { from: charlie });

      res = await this.abVotingXWeb3.methods.getOracleCandidateWeight(candidateA).call();
      assert.equal(res, ether(200));

      res = await this.abVotingXWeb3.methods.getOracleCandidateWeight(candidateB).call();
      assert.equal(res, ether(400));

      // oracle 2 change decision and votes for the candidates A
      await this.abVotingX.voteWithOracleStake(candidateA, { from: charlie });

      res = await this.abVotingXWeb3.methods.getOracleCandidateWeight(candidateA).call();
      assert.equal(res, ether(600));

      res = await this.abVotingXWeb3.methods.getOracleCandidateWeight(candidateB).call();
      assert.equal(res, ether(0));

      // oracle 3 change decision and votes for the candidates C
      await this.abVotingX.voteWithOracleStake(candidateC, { from: dan });

      res = await this.abVotingXWeb3.methods.getOracleCandidateWeight(candidateC).call();
      assert.equal(res, ether(700));

      // oracle 3 stake is slashed due some misbehaviour
      await this.oracleStakesAccountingX.slashMultiple([dan, dan], [TYPE_B, TYPE_C], [ether(150), ether(200)], {
        from: claimManager
      });

      res = await this.abVotingXWeb3.methods.getOracleCandidateWeight(candidateA).call();
      assert.equal(res, ether(600));

      res = await this.abVotingXWeb3.methods.getOracleCandidateWeight(candidateB).call();
      assert.equal(res, ether(0));

      res = await this.abVotingXWeb3.methods.getOracleCandidateWeight(candidateC).call();
      assert.equal(res, ether(350));
    });

    // owner 1 claims 2 tokens, 0x1 = 300 and 0x2 = 500 correspondingly
    // owner 2 claims 3 tokens, 0x3 = 400, 0x4 = 700 and 0x5 = 100 correspondingly
    // owner 3 claims 1 tokens, 0x6 = 1000
    // owner 4 claims 1 tokens, 0x7 = 200

    // owner 1 locks 2 tokens to SRA
    // owner 2 locks 2 tokens to SRA
    // owner 3 locks 1 token to SRA
    // owner 4 doesn't lock any token

    // delegates M, N, O, P has 1 SpaceToken each, but don't stake them
    it.only('Scenario #2. Three space owners voting, no oracles', async function() {
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
        this.spaceReputationAccounting.setTokenArea(x1, '300'),
        this.spaceReputationAccounting.setTokenArea(x2, '500'),
        this.spaceReputationAccounting.setTokenArea(x3, '400'),
        this.spaceReputationAccounting.setTokenArea(x4, '700'),
        this.spaceReputationAccounting.setTokenArea(x5, '100'),
        this.spaceReputationAccounting.setTokenArea(x6, '1000'),
        this.spaceReputationAccounting.setTokenArea(x7, '200')
      ];

      await Promise.all(p);

      // STAKE TOKENS AT SRA
      p = [
        this.spaceReputationAccounting.stake(x1, { from: alice }),
        this.spaceReputationAccounting.stake(x2, { from: alice }),
        this.spaceReputationAccounting.stake(x3, { from: bob }),
        this.spaceReputationAccounting.stake(x4, { from: bob }),
        this.spaceReputationAccounting.stake(x5, { from: bob }),
        this.spaceReputationAccounting.stake(x6, { from: charlie }),
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
      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(alice).call();
      assert.equal(res, 0);
      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(alice).call();
      assert.equal(res, 500);

      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(bob).call();
      assert.equal(res, 200);
      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(bob).call();
      assert.equal(res, 500);
      res = await this.abVotingZWeb3.methods.getSpaceReputationBalance(bob).call();
      assert.equal(res, 400);

      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(charlie).call();
      assert.equal(res, 200);
      res = await this.abVotingZWeb3.methods.getSpaceReputationBalance(charlie).call();
      assert.equal(res, 150);

      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(dan).call();
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
      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(alice).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(bob).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(charlie).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(dan).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(candidateA).call();
      assert.equal(res, 200);
      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(candidateB).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(candidateC).call();
      assert.equal(res, 0);
      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(candidateD).call();
      assert.equal(res, 700);
      res = await this.abVotingXWeb3.methods.getSpaceReputationBalance(candidateE).call();
      assert.equal(res, 0);

      // CHECK VOTING Y BALANCES
      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(alice).call();
      assert.equal(res, 0);
      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(bob).call();
      assert.equal(res, 0);
      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(charlie).call();
      assert.equal(res, 100);
      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(dan).call();
      assert.equal(res, 0);
      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(candidateA).call();
      assert.equal(res, 450);
      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(candidateB).call();
      assert.equal(res, 200);
      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(candidateC).call();
      assert.equal(res, 450);
      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(candidateD).call();
      assert.equal(res, 0);
      res = await this.abVotingYWeb3.methods.getSpaceReputationBalance(candidateE).call();
      assert.equal(res, 0);

      // CHECK VOTING Z BALANCES
      res = await this.abVotingZWeb3.methods.getSpaceReputationBalance(alice).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputationBalance(bob).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputationBalance(charlie).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputationBalance(dan).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputationBalance(candidateA).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputationBalance(candidateB).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputationBalance(candidateC).call();
      assert.equal(res, 0);
      res = await this.abVotingZWeb3.methods.getSpaceReputationBalance(candidateD).call();
      assert.equal(res, 300);
      res = await this.abVotingZWeb3.methods.getSpaceReputationBalance(candidateE).call();
      assert.equal(res, 250);
    });
  });

  describe.skip('#setMofN()', () => {
    it('should allow correct values', async function() {
      await this.abVotingX.setMofN(2, 5, { from: arbitratorManager });
    });

    it('should deny n < 2', async function() {
      await assertRevert(this.abVotingX.setMofN(1, 5, { from: arbitratorManager }));
    });

    it('should deny n > m', async function() {
      await assertRevert(this.abVotingX.setMofN(3, 2, { from: arbitratorManager }));
    });

    it('should deny non-arbitrator-manager setting values', async function() {
      await assertRevert(this.abVotingX.setMofN(2, 5, { from: coreTeam }));
    });
  });

  describe.skip('#pushArbitrators()', () => {
    beforeEach(async function() {
      await this.abVotingX.addArbitrator(alice, 320, { from: arbitratorManager });
      await this.abVotingX.addArbitrator(bob, 280, { from: arbitratorManager });
      await this.abVotingX.addArbitrator(charlie, 560, { from: arbitratorManager });
      await this.abVotingX.addArbitrator(dan, 120, { from: arbitratorManager });
      await this.abVotingX.addArbitrator(eve, 700, { from: arbitratorManager });
      await this.abVotingX.setMofN(2, 3, { from: arbitratorManager });
    });

    it('should push arbitrators', async function() {
      const initialArbitrators = [alice, bob, charlie, dan, eve];
      let res = await this.abVotingXWeb3.methods.getArbitrators().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), initialArbitrators);

      let toSort = [];
      await pIteration.forEachSeries(initialArbitrators, async arbitrator => {
        toSort.push({ arbitrator, weight: await this.abVotingXWeb3.methods.arbitratorWeight(arbitrator).call() });
      });

      toSort.sort((a, b) => b.weight - a.weight);
      let sortedArbitrators = toSort.map(o => o.arbitrator);

      await this.abVotingX.pushArbitrators(sortedArbitrators);

      res = await this.abMultiSigXWeb3.methods.getOwners().call();
      assert.equal(res.length, 3);
      assert.equal(res[0].toLowerCase(), eve);
      assert.equal(res[1].toLowerCase(), charlie);
      assert.equal(res[2].toLowerCase(), alice);

      // change and recheck
      await this.abVotingX.setArbitratorWeight(charlie, 510, { from: arbitratorManager });
      await this.abVotingX.setArbitratorWeight(dan, 980, { from: arbitratorManager });

      toSort = [];
      await pIteration.forEachSeries(initialArbitrators, async arbitrator => {
        toSort.push({ arbitrator, weight: await this.abVotingXWeb3.methods.arbitratorWeight(arbitrator).call() });
      });

      toSort.sort((a, b) => b.weight - a.weight);
      sortedArbitrators = toSort.map(o => o.arbitrator);
      await this.abVotingX.pushArbitrators(sortedArbitrators);

      res = await this.abMultiSigXWeb3.methods.getOwners().call();
      assert.equal(res.length, 3);
      assert.equal(res[0].toLowerCase(), dan);
      assert.equal(res[1].toLowerCase(), eve);
      assert.equal(res[2].toLowerCase(), charlie);
    });

    it('should deny non-sorted arbitrators list', async function() {
      const initialArbitrators = [alice, bob, charlie, dan, eve];
      const res = await this.abVotingXWeb3.methods.getArbitrators().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), initialArbitrators);

      const toSort = [];
      await pIteration.forEachSeries(initialArbitrators, async arbitrator => {
        toSort.push({ arbitrator, weight: await this.abVotingXWeb3.methods.arbitratorWeight(arbitrator).call() });
      });

      const sortedArbitrators = toSort.map(o => o.arbitrator);

      await assertRevert(this.abVotingX.pushArbitrators(sortedArbitrators));
    });
  });
});
