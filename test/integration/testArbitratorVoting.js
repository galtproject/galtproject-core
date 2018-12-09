const ArbitratorVoting = artifacts.require('./ArbitratorVoting.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
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

  // LAST HACK
  await oracleStakes.setVotingAddress(voting.address, { from: roleManager });

  return [multiSig, voting, oracleStakes];
}

// NOTICE: we don't wrap MockToken with a proxy on production
contract('ArbitratorVoting', accounts => {
  const [
    coreTeam,
    arbitratorManager,
    spaceToken,
    oracleManager,
    claimManager,
    alice,
    bob,
    charlie,
    dan,
    eve,
    candidateA,
    candidateB,
    candidateC
  ] = accounts;

  beforeEach(async function() {
    // CREATING

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.spaceReputationAccounting = await SpaceReputationAccounting.new(spaceToken, { from: coreTeam });

    const args = [
      coreTeam,
      claimManager,
      this.oracles,
      this.galtToken.address,
      this.spaceReputationAccounting.address,
      ['0x1', '0x2', '0x3'],
      2
    ];

    [this.abMultiSig_1, this.abVoting_1, this.oracleStakesAccounting_1] = await buildMultiSigContracts(...args);
    [this.abMultiSig_2, this.abVoting_2, this.oracleStakesAccounting_2] = await buildMultiSigContracts(...args);

    // ASSIGNING ROLES
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_MANAGER(), {
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

    await this.oracles.addOracle(this.abMultiSig_1.address, bob, 'Bob', 'MN', [], [TYPE_A], {
      from: oracleManager
    });
    await this.oracles.addOracle(this.abMultiSig_1.address, charlie, 'Charlie', 'MN', [], [TYPE_B, TYPE_C], {
      from: oracleManager
    });
    await this.oracles.addOracle(this.abMultiSig_1.address, dan, 'Dan', 'MN', [], [TYPE_A, TYPE_B, TYPE_C], {
      from: oracleManager
    });
    await this.oracles.addOracle(this.abMultiSig_2.address, eve, 'Eve', 'MN', [], [TYPE_A, TYPE_B, TYPE_C], {
      from: oracleManager
    });

    // CREATING WEB3 1.X INSTANCES
    this.abVoting_1Web3 = new web3.eth.Contract(this.abVoting_1.abi, this.abVoting_1.address);
    this.abMultiSigWeb3 = new web3.eth.Contract(this.abMultiSig_1.abi, this.abMultiSig_1.address);
    this.oracleStakesWeb3 = new web3.eth.Contract(
      this.oracleStakesAccounting_1.abi,
      this.oracleStakesAccounting_1.address
    );
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

    it.only('Scenario #1. Three oracles voting, no space owners', async function() {
      await this.galtToken.approve(this.oracleStakesAccounting_2.address, ether(2000), { from: alice });
      await this.galtToken.approve(this.oracleStakesAccounting_1.address, ether(2000), { from: alice });

      await this.oracleStakesAccounting_1.stake(charlie, TYPE_B, ether(200), { from: alice });
      await this.oracleStakesAccounting_1.stake(charlie, TYPE_C, ether(200), { from: alice });
      await this.oracleStakesAccounting_1.stake(dan, TYPE_A, ether(200), { from: alice });
      await this.oracleStakesAccounting_1.stake(dan, TYPE_B, ether(200), { from: alice });
      await this.oracleStakesAccounting_1.stake(dan, TYPE_C, ether(300), { from: alice });

      await assertRevert(this.abVoting_1.voteWithOracleStake(candidateA, { from: bob }));

      await this.oracleStakesAccounting_1.stake(bob, TYPE_A, ether(200), { from: alice });

      await this.abVoting_1.voteWithOracleStake(candidateA, { from: bob });
      // TODO: check candidates

      let res = await this.abVoting_1Web3.methods.getOracleCandidateWeight(candidateA).call();
      assert.equal(res, ether(200));

      // oracle 2 votes for candidate B
      await this.abVoting_1.voteWithOracleStake(candidateB, { from: charlie });

      res = await this.abVoting_1Web3.methods.getOracleCandidateWeight(candidateA).call();
      assert.equal(res, ether(200));

      res = await this.abVoting_1Web3.methods.getOracleCandidateWeight(candidateB).call();
      assert.equal(res, ether(400));

      // oracle 2 change decision and votes for the candidates A
      await this.abVoting_1.voteWithOracleStake(candidateA, { from: charlie });

      res = await this.abVoting_1Web3.methods.getOracleCandidateWeight(candidateA).call();
      assert.equal(res, ether(600));

      res = await this.abVoting_1Web3.methods.getOracleCandidateWeight(candidateB).call();
      assert.equal(res, ether(0));

      // oracle 3 change decision and votes for the candidates C
      await this.abVoting_1.voteWithOracleStake(candidateC, { from: dan });

      res = await this.abVoting_1Web3.methods.getOracleCandidateWeight(candidateC).call();
      assert.equal(res, ether(700));

      // oracle 3 stake is slashed due some misbehaviour
      await this.oracleStakesAccounting_1.slashMultiple([dan, dan], [TYPE_B, TYPE_C], [ether(150), ether(200)], {
        from: claimManager
      });

      res = await this.abVoting_1Web3.methods.getOracleCandidateWeight(candidateA).call();
      assert.equal(res, ether(600));

      res = await this.abVoting_1Web3.methods.getOracleCandidateWeight(candidateB).call();
      assert.equal(res, ether(0));

      res = await this.abVoting_1Web3.methods.getOracleCandidateWeight(candidateC).call();
      assert.equal(res, ether(350));
    });
  });

  describe.skip('#setMofN()', () => {
    it('should allow correct values', async function() {
      await this.abVoting_1.setMofN(2, 5, { from: arbitratorManager });
    });

    it('should deny n < 2', async function() {
      await assertRevert(this.abVoting_1.setMofN(1, 5, { from: arbitratorManager }));
    });

    it('should deny n > m', async function() {
      await assertRevert(this.abVoting_1.setMofN(3, 2, { from: arbitratorManager }));
    });

    it('should deny non-arbitrator-manager setting values', async function() {
      await assertRevert(this.abVoting_1.setMofN(2, 5, { from: coreTeam }));
    });
  });

  describe.skip('#pushArbitrators()', () => {
    beforeEach(async function() {
      await this.abVoting_1.addArbitrator(alice, 320, { from: arbitratorManager });
      await this.abVoting_1.addArbitrator(bob, 280, { from: arbitratorManager });
      await this.abVoting_1.addArbitrator(charlie, 560, { from: arbitratorManager });
      await this.abVoting_1.addArbitrator(dan, 120, { from: arbitratorManager });
      await this.abVoting_1.addArbitrator(eve, 700, { from: arbitratorManager });
      await this.abVoting_1.setMofN(2, 3, { from: arbitratorManager });
    });

    it('should push arbitrators', async function() {
      const initialArbitrators = [alice, bob, charlie, dan, eve];
      let res = await this.abVoting_1Web3.methods.getArbitrators().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), initialArbitrators);

      let toSort = [];
      await pIteration.forEachSeries(initialArbitrators, async arbitrator => {
        toSort.push({ arbitrator, weight: await this.abVoting_1Web3.methods.arbitratorWeight(arbitrator).call() });
      });

      toSort.sort((a, b) => b.weight - a.weight);
      let sortedArbitrators = toSort.map(o => o.arbitrator);

      await this.abVoting_1.pushArbitrators(sortedArbitrators);

      res = await this.abMultiSigWeb3.methods.getOwners().call();
      assert.equal(res.length, 3);
      assert.equal(res[0].toLowerCase(), eve);
      assert.equal(res[1].toLowerCase(), charlie);
      assert.equal(res[2].toLowerCase(), alice);

      // change and recheck
      await this.abVoting_1.setArbitratorWeight(charlie, 510, { from: arbitratorManager });
      await this.abVoting_1.setArbitratorWeight(dan, 980, { from: arbitratorManager });

      toSort = [];
      await pIteration.forEachSeries(initialArbitrators, async arbitrator => {
        toSort.push({ arbitrator, weight: await this.abVoting_1Web3.methods.arbitratorWeight(arbitrator).call() });
      });

      toSort.sort((a, b) => b.weight - a.weight);
      sortedArbitrators = toSort.map(o => o.arbitrator);
      await this.abVoting_1.pushArbitrators(sortedArbitrators);

      res = await this.abMultiSigWeb3.methods.getOwners().call();
      assert.equal(res.length, 3);
      assert.equal(res[0].toLowerCase(), dan);
      assert.equal(res[1].toLowerCase(), eve);
      assert.equal(res[2].toLowerCase(), charlie);
    });

    it('should deny non-sorted arbitrators list', async function() {
      const initialArbitrators = [alice, bob, charlie, dan, eve];
      const res = await this.abVoting_1Web3.methods.getArbitrators().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), initialArbitrators);

      const toSort = [];
      await pIteration.forEachSeries(initialArbitrators, async arbitrator => {
        toSort.push({ arbitrator, weight: await this.abVoting_1Web3.methods.arbitratorWeight(arbitrator).call() });
      });

      const sortedArbitrators = toSort.map(o => o.arbitrator);

      await assertRevert(this.abVoting_1.pushArbitrators(sortedArbitrators));
    });
  });
});
