const Arbitrators = artifacts.require('./Arbitrators.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const Oracles = artifacts.require('./Oracles.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const pIteration = require('p-iteration');
const { assertRevert, initHelperWeb3 } = require('../helpers');

const web3 = new Web3(Arbitrators.web3.currentProvider);

initHelperWeb3(web3);

chai.use(chaiAsPromised);

// NOTICE: we don't wrap MockToken with a proxy on production
contract('Arbitrators', ([coreTeam, arbitratorManager, oracleManager, alice, bob, charlie, dan, eve]) => {
  beforeEach(async function() {
    this.oracles = await Oracles.new({ from: coreTeam });
    this.abMultiSig = await ArbitratorsMultiSig.new(['0x1', '0x2', '0x3'], 2, { from: coreTeam });
    this.arbitrators = await Arbitrators.new(this.abMultiSig.address, { from: coreTeam });

    await this.arbitrators.addRoleTo(arbitratorManager, await this.arbitrators.ROLE_ARBITRATOR_MANAGER(), {
      from: coreTeam
    });
    await this.abMultiSig.addRoleTo(this.arbitrators.address, await this.abMultiSig.ROLE_ARBITRATOR_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });

    this.arbitratorsWeb3 = new web3.eth.Contract(this.arbitrators.abi, this.arbitrators.address);
    this.abMultiSigWeb3 = new web3.eth.Contract(this.abMultiSig.abi, this.abMultiSig.address);
  });

  it('should have an empty arbitrators list by default', async function() {
    const res = await this.arbitratorsWeb3.methods.getArbitrators().call();
    assert.equal(res.length, 0);
  });

  it('should have 0 size by default', async function() {
    const res = await this.arbitratorsWeb3.methods.getSize().call();
    assert.equal(res, 0);
  });

  describe('#addArbitrator()', () => {
    it('should add multiple arbitrators to an empty list', async function() {
      await this.arbitrators.addArbitrator(alice, 320, { from: arbitratorManager });
      await this.arbitrators.addArbitrator(bob, 280, { from: arbitratorManager });
      await this.arbitrators.addArbitrator(charlie, 560, { from: arbitratorManager });

      let res = await this.arbitratorsWeb3.methods.getArbitrators().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, bob, charlie]);

      res = await this.arbitratorsWeb3.methods.arbitratorWeight(alice).call();
      assert.equal(res, 320);
      res = await this.arbitratorsWeb3.methods.arbitratorWeight(bob).call();
      assert.equal(res, 280);
      res = await this.arbitratorsWeb3.methods.arbitratorWeight(charlie).call();
      assert.equal(res, 560);

      res = await this.arbitratorsWeb3.methods.getSize().call();
      assert.equal(res, 3);
    });

    it('should deny adding the same arbitrator twice', async function() {
      await this.arbitrators.addArbitrator(alice, 320, { from: arbitratorManager });
      await assertRevert(this.arbitrators.addArbitrator(alice, 310, { from: arbitratorManager }));

      const res = await this.arbitratorsWeb3.methods.getArbitrators().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice]);
    });

    it('should deny addition to non-arbitrator-manager', async function() {
      await assertRevert(this.arbitrators.addArbitrator(coreTeam, 300, { from: coreTeam }));
    });
  });

  describe('#removeArbitrator()', () => {
    beforeEach(async function() {
      await this.arbitrators.addArbitrator(alice, 320, { from: arbitratorManager });
      await this.arbitrators.addArbitrator(bob, 280, { from: arbitratorManager });
      await this.arbitrators.addArbitrator(charlie, 560, { from: arbitratorManager });
    });

    it('should allow removing arbitrator', async function() {
      await this.arbitrators.removeArbitrator(bob, { from: arbitratorManager });

      let res = await this.arbitratorsWeb3.methods.getArbitrators().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, charlie]);

      res = await this.arbitratorsWeb3.methods.getSize().call();
      assert.equal(res, 2);

      res = await this.arbitratorsWeb3.methods.arbitratorWeight(bob).call();
      assert.equal(res, 0);
    });

    it('should deny removing the same arbitrator twice', async function() {
      await this.arbitrators.removeArbitrator(bob, { from: arbitratorManager });
      await assertRevert(this.arbitrators.removeArbitrator(bob, { from: arbitratorManager }));
    });

    it('should deny removal to non-arbitrator-manager', async function() {
      await assertRevert(this.arbitrators.removeArbitrator(bob, { from: coreTeam }));
    });
  });

  describe('#setArbitratorWeight()', () => {
    beforeEach(async function() {
      await this.arbitrators.addArbitrator(alice, 320, { from: arbitratorManager });
      await this.arbitrators.addArbitrator(bob, 280, { from: arbitratorManager });
      await this.arbitrators.addArbitrator(charlie, 560, { from: arbitratorManager });
    });

    it('should allow setting new arbitrator weight', async function() {
      let res = await this.arbitratorsWeb3.methods.arbitratorWeight(bob).call();
      assert.equal(res, 280);

      await this.arbitrators.setArbitratorWeight(bob, 450, { from: arbitratorManager });

      res = await this.arbitratorsWeb3.methods.arbitratorWeight(bob).call();
      assert.equal(res, 450);
    });

    it('should deny setting weight of non-existing arbitrator', async function() {
      await assertRevert(this.arbitrators.setArbitratorWeight(coreTeam, 300, { from: arbitratorManager }));
    });

    it('should deny setting weight to non-arbitrator-manager address', async function() {
      await assertRevert(this.arbitrators.setArbitratorWeight(bob, 300, { from: coreTeam }));
    });
  });

  describe('#setMofN()', () => {
    it('should allow correct values', async function() {
      await this.arbitrators.setMofN(2, 5, { from: arbitratorManager });
    });

    it('should deny n < 2', async function() {
      await assertRevert(this.arbitrators.setMofN(1, 5, { from: arbitratorManager }));
    });

    it('should deny n > m', async function() {
      await assertRevert(this.arbitrators.setMofN(3, 2, { from: arbitratorManager }));
    });

    it('should deny non-arbitrator-manager setting values', async function() {
      await assertRevert(this.arbitrators.setMofN(2, 5, { from: coreTeam }));
    });
  });

  describe('#pushArbitrators()', () => {
    beforeEach(async function() {
      await this.arbitrators.addArbitrator(alice, 320, { from: arbitratorManager });
      await this.arbitrators.addArbitrator(bob, 280, { from: arbitratorManager });
      await this.arbitrators.addArbitrator(charlie, 560, { from: arbitratorManager });
      await this.arbitrators.addArbitrator(dan, 120, { from: arbitratorManager });
      await this.arbitrators.addArbitrator(eve, 700, { from: arbitratorManager });
      await this.arbitrators.setMofN(2, 3, { from: arbitratorManager });
    });

    it('should push arbitrators', async function() {
      const initialArbitrators = [alice, bob, charlie, dan, eve];
      let res = await this.arbitratorsWeb3.methods.getArbitrators().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), initialArbitrators);

      let toSort = [];
      await pIteration.forEachSeries(initialArbitrators, async arbitrator => {
        toSort.push({ arbitrator, weight: await this.arbitratorsWeb3.methods.arbitratorWeight(arbitrator).call() });
      });

      toSort.sort((a, b) => b.weight - a.weight);
      let sortedArbitrators = toSort.map(o => o.arbitrator);

      await this.arbitrators.pushArbitrators(sortedArbitrators);

      res = await this.abMultiSigWeb3.methods.getOwners().call();
      assert.equal(res.length, 3);
      assert.equal(res[0].toLowerCase(), eve);
      assert.equal(res[1].toLowerCase(), charlie);
      assert.equal(res[2].toLowerCase(), alice);

      // change and recheck
      await this.arbitrators.setArbitratorWeight(charlie, 510, { from: arbitratorManager });
      await this.arbitrators.setArbitratorWeight(dan, 980, { from: arbitratorManager });

      toSort = [];
      await pIteration.forEachSeries(initialArbitrators, async arbitrator => {
        toSort.push({ arbitrator, weight: await this.arbitratorsWeb3.methods.arbitratorWeight(arbitrator).call() });
      });

      toSort.sort((a, b) => b.weight - a.weight);
      sortedArbitrators = toSort.map(o => o.arbitrator);
      await this.arbitrators.pushArbitrators(sortedArbitrators);

      res = await this.abMultiSigWeb3.methods.getOwners().call();
      assert.equal(res.length, 3);
      assert.equal(res[0].toLowerCase(), dan);
      assert.equal(res[1].toLowerCase(), eve);
      assert.equal(res[2].toLowerCase(), charlie);
    });

    it('should deny non-sorted arbitrators list', async function() {
      const initialArbitrators = [alice, bob, charlie, dan, eve];
      const res = await this.arbitratorsWeb3.methods.getArbitrators().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), initialArbitrators);

      const toSort = [];
      await pIteration.forEachSeries(initialArbitrators, async arbitrator => {
        toSort.push({ arbitrator, weight: await this.arbitratorsWeb3.methods.arbitratorWeight(arbitrator).call() });
      });

      const sortedArbitrators = toSort.map(o => o.arbitrator);

      await assertRevert(this.arbitrators.pushArbitrators(sortedArbitrators));
    });
  });
});
