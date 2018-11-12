const Auditors = artifacts.require('./Auditors.sol');
const ValidatorStakesMultiSig = artifacts.require('./ValidatorStakesMultiSig.sol');
const Validators = artifacts.require('./Validators.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const pIteration = require('p-iteration');
const { assertRevert, initHelperWeb3 } = require('../helpers');

const web3 = new Web3(Auditors.web3.currentProvider);
const { stringToHex } = Web3.utils;

initHelperWeb3(web3);

chai.use(chaiAsPromised);

const CM_AUDITOR = 'CM_AUDITOR';

// NOTICE: we don't wrap MockToken with a proxy on production
contract('Auditors', ([coreTeam, auditorManager, validatorManager, alice, bob, charlie, dan, eve]) => {
  beforeEach(async function() {
    this.validators = await Validators.new({ from: coreTeam });
    this.vsMultiSig = await ValidatorStakesMultiSig.new(coreTeam, ['0x1', '0x2', '0x3'], 2, { from: coreTeam });
    this.auditors = await Auditors.new(coreTeam, this.vsMultiSig.address, this.validators.address, { from: coreTeam });

    await this.auditors.addRoleTo(coreTeam, await this.auditors.ROLE_MANAGER(), {
      from: coreTeam
    });
    await this.auditors.addRoleTo(auditorManager, await this.auditors.ROLE_AUDITOR_MANAGER(), {
      from: coreTeam
    });
    await this.vsMultiSig.addRoleTo(coreTeam, await this.vsMultiSig.ROLE_MANAGER(), {
      from: coreTeam
    });
    await this.vsMultiSig.addRoleTo(this.auditors.address, await this.vsMultiSig.ROLE_AUDITORS_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(validatorManager, await this.validators.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(this.auditors.address, await this.validators.ROLE_AUDITOR_MANAGER(), {
      from: coreTeam
    });

    this.auditorsWeb3 = new web3.eth.Contract(this.auditors.abi, this.auditors.address);
    this.validatorsWeb3 = new web3.eth.Contract(this.validators.abi, this.validators.address);
    this.vsMultiSigWeb3 = new web3.eth.Contract(this.vsMultiSig.abi, this.vsMultiSig.address);
  });

  it('should have an empty auditors list by default', async function() {
    const res = await this.auditorsWeb3.methods.getAuditors().call();
    assert.equal(res.length, 0);
  });

  it('should have 0 size by default', async function() {
    const res = await this.auditorsWeb3.methods.getSize().call();
    assert.equal(res, 0);
  });

  describe('#addAuditor()', () => {
    it('should add multiple auditors to an empty list', async function() {
      await this.auditors.addAuditor(alice, 320, { from: auditorManager });
      await this.auditors.addAuditor(bob, 280, { from: auditorManager });
      await this.auditors.addAuditor(charlie, 560, { from: auditorManager });

      let res = await this.auditorsWeb3.methods.getAuditors().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, bob, charlie]);

      res = await this.auditorsWeb3.methods.auditorWeight(alice).call();
      assert.equal(res, 320);
      res = await this.auditorsWeb3.methods.auditorWeight(bob).call();
      assert.equal(res, 280);
      res = await this.auditorsWeb3.methods.auditorWeight(charlie).call();
      assert.equal(res, 560);

      res = await this.auditorsWeb3.methods.getSize().call();
      assert.equal(res, 3);
    });

    it('should deny adding the same auditor twice', async function() {
      await this.auditors.addAuditor(alice, 320, { from: auditorManager });
      await assertRevert(this.auditors.addAuditor(alice, 310, { from: auditorManager }));

      const res = await this.auditorsWeb3.methods.getAuditors().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice]);
    });

    it('should deny addition to non-auditor-manager', async function() {
      await assertRevert(this.auditors.addAuditor(coreTeam, 300, { from: coreTeam }));
    });
  });

  describe('#removeAuditor()', () => {
    beforeEach(async function() {
      await this.auditors.addAuditor(alice, 320, { from: auditorManager });
      await this.auditors.addAuditor(bob, 280, { from: auditorManager });
      await this.auditors.addAuditor(charlie, 560, { from: auditorManager });
    });

    it('should allow removing auditor', async function() {
      await this.auditors.removeAuditor(bob, { from: auditorManager });

      let res = await this.auditorsWeb3.methods.getAuditors().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, charlie]);

      res = await this.auditorsWeb3.methods.getSize().call();
      assert.equal(res, 2);

      res = await this.auditorsWeb3.methods.auditorWeight(bob).call();
      assert.equal(res, 0);
    });

    it('should deny removing the same auditor twice', async function() {
      await this.auditors.removeAuditor(bob, { from: auditorManager });
      await assertRevert(this.auditors.removeAuditor(bob, { from: auditorManager }));
    });

    it('should deny removal to non-auditor-manager', async function() {
      await assertRevert(this.auditors.removeAuditor(bob, { from: coreTeam }));
    });
  });

  describe('#setAuditorWeight()', () => {
    beforeEach(async function() {
      await this.auditors.addAuditor(alice, 320, { from: auditorManager });
      await this.auditors.addAuditor(bob, 280, { from: auditorManager });
      await this.auditors.addAuditor(charlie, 560, { from: auditorManager });
    });

    it('should allow setting new auditor weight', async function() {
      let res = await this.auditorsWeb3.methods.auditorWeight(bob).call();
      assert.equal(res, 280);

      await this.auditors.setAuditorWeight(bob, 450, { from: auditorManager });

      res = await this.auditorsWeb3.methods.auditorWeight(bob).call();
      assert.equal(res, 450);
    });

    it('should deny setting weight of non-existing auditor', async function() {
      await assertRevert(this.auditors.setAuditorWeight(coreTeam, 300, { from: auditorManager }));
    });

    it('should deny setting weight to non-auditor-manager address', async function() {
      await assertRevert(this.auditors.setAuditorWeight(bob, 300, { from: coreTeam }));
    });
  });

  describe('#setNofM()', () => {
    it('should allow correct values', async function() {
      await this.auditors.setNofM(2, 5, { from: auditorManager });
    });

    it('should deny n < 2', async function() {
      await assertRevert(this.auditors.setNofM(1, 5, { from: auditorManager }));
    });

    it('should deny n > m', async function() {
      await assertRevert(this.auditors.setNofM(3, 2, { from: auditorManager }));
    });

    it('should deny non-auditor-manager setting values', async function() {
      await assertRevert(this.auditors.setNofM(2, 5, { from: coreTeam }));
    });
  });

  describe('#pushAuditors()', () => {
    beforeEach(async function() {
      await this.auditors.addAuditor(alice, 320, { from: auditorManager });
      await this.auditors.addAuditor(bob, 280, { from: auditorManager });
      await this.auditors.addAuditor(charlie, 560, { from: auditorManager });
      await this.auditors.addAuditor(dan, 120, { from: auditorManager });
      await this.auditors.addAuditor(eve, 700, { from: auditorManager });
      await this.auditors.setNofM(2, 3, { from: auditorManager });
    });

    it('should push auditors', async function() {
      // TODO: add users as a validators
      await this.validators.addValidator(alice, 'Alice', 'MN', [], [], { from: validatorManager });
      await this.validators.addValidator(bob, 'Bob', 'MN', [], [], { from: validatorManager });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], [], { from: validatorManager });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], [], { from: validatorManager });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], [], { from: validatorManager });

      const initialAuditors = [alice, bob, charlie, dan, eve];
      let res = await this.auditorsWeb3.methods.getAuditors().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), initialAuditors);

      let toSort = [];
      await pIteration.forEachSeries(initialAuditors, async auditor => {
        toSort.push({ auditor, weight: await this.auditorsWeb3.methods.auditorWeight(auditor).call() });
      });

      toSort.sort((a, b) => b.weight - a.weight);
      let sortedAuditors = toSort.map(o => o.auditor);

      await this.auditors.pushAuditors(sortedAuditors);

      res = await this.vsMultiSigWeb3.methods.getOwners().call();
      assert.equal(res.length, 3);
      assert.equal(res[0].toLowerCase(), eve);
      assert.equal(res[1].toLowerCase(), charlie);
      assert.equal(res[2].toLowerCase(), alice);

      res = await this.validatorsWeb3.methods.getValidatorsByRole(stringToHex(CM_AUDITOR)).call();
      assert.equal(res.length, 3);
      assert.sameMembers(res.map(a => a.toLowerCase()), sortedAuditors.slice(0, 3));

      // change and recheck
      await this.auditors.setAuditorWeight(charlie, 510, { from: auditorManager });
      await this.auditors.setAuditorWeight(dan, 980, { from: auditorManager });

      toSort = [];
      await pIteration.forEachSeries(initialAuditors, async auditor => {
        toSort.push({ auditor, weight: await this.auditorsWeb3.methods.auditorWeight(auditor).call() });
      });

      toSort.sort((a, b) => b.weight - a.weight);
      sortedAuditors = toSort.map(o => o.auditor);
      await this.auditors.pushAuditors(sortedAuditors);

      res = await this.vsMultiSigWeb3.methods.getOwners().call();
      assert.equal(res.length, 3);
      assert.equal(res[0].toLowerCase(), dan);
      assert.equal(res[1].toLowerCase(), eve);
      assert.equal(res[2].toLowerCase(), charlie);

      res = await this.validatorsWeb3.methods.getValidatorsByRole(stringToHex(CM_AUDITOR)).call();
      // we don't remove doubled values
      assert.equal(res.length, 6);
      // assert.sameMembers(res.map(a => a.toLowerCase()), sortedAuditors.slice(0, 3));
    });

    it('should deny non-sorted auditors list', async function() {
      const initialAuditors = [alice, bob, charlie, dan, eve];
      const res = await this.auditorsWeb3.methods.getAuditors().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), initialAuditors);

      const toSort = [];
      await pIteration.forEachSeries(initialAuditors, async auditor => {
        toSort.push({ auditor, weight: await this.auditorsWeb3.methods.auditorWeight(auditor).call() });
      });

      // toSort.sort((a, b) => b.weight - a.weight);
      const sortedAuditors = toSort.map(o => o.auditor);

      await assertRevert(this.auditors.pushAuditors(sortedAuditors));
    });
  });
});
