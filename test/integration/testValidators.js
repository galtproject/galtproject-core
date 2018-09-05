const Validators = artifacts.require('./Validators.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { assertRevert, initHelperWeb3 } = require('../helpers');

const { hexToUtf8 } = Web3.utils;
const web3 = new Web3(Validators.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

const NEW_APPLICATION = '0x41e691fcbdc41a0c9c62caec68dbbdb99b245cbb72f06df6f40fa1bd1b4d97d9';
const NON_EXISTING_APPLICATION = '0x0000000000000000000000000000000000000000000000000000000000000000';

// NOTICE: we don't wrap MockToken with a proxy on production
contract('Validators', ([coreTeam, alice, bob]) => {
  beforeEach(async function() {
    this.validators = await Validators.new({ from: coreTeam, gas: 6700000 });
  });

  describe('roles management', () => {
    beforeEach(async function() {
      this.res = await this.validators.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['human', 'cat', 'dog'],
        [25, 30, 45],
        ['', '', ''],
        { from: coreTeam }
      );
    });

    it('should provide an ability to set roles for the given type', async function() {
      let res = await this.validators.getApplicationTypeRoles(NEW_APPLICATION);
      assert.sameMembers(res.map(hexToUtf8), ['human', 'cat', 'dog']);
      res = await this.validators.getApplicationTypeRolesCount(NEW_APPLICATION);
      assert.equal(res.toString(), '3');

      assert.equal(await this.validators.getRoleApplicationType('human'), NEW_APPLICATION);
      assert.equal(await this.validators.getRoleApplicationType('cat'), NEW_APPLICATION);
      assert.equal(await this.validators.getRoleApplicationType('dog'), NEW_APPLICATION);

      assert.equal(await this.validators.getRoleRewardShare('human'), 25);
      assert.equal(await this.validators.getRoleRewardShare('cat'), 30);
      assert.equal(await this.validators.getRoleRewardShare('dog'), 45);
    });

    it('should prevent non-owner from overwriting an existing application type', async function() {
      await assertRevert(
        this.validators.setApplicationTypeRoles(NEW_APPLICATION, ['foo', 'bar', 'buzz'], [30, 30, 40], ['', '', ''], {
          from: bob
        })
      );
    });

    it('should prevent an owner owerwriting existing application type', async function() {
      await assertRevert(
        this.validators.setApplicationTypeRoles(NEW_APPLICATION, ['foo', 'bar', 'buzz'], [30, 30, 40], ['', '', ''], {
          from: coreTeam
        })
      );
      let res = await this.validators.getApplicationTypeRoles(NEW_APPLICATION);
      assert.sameMembers(res.map(hexToUtf8), ['human', 'cat', 'dog']);
      res = await this.validators.getApplicationTypeRolesCount(NEW_APPLICATION);
      assert.equal(res.toString(), '3');
    });

    it('should provide an ability to delete all roles of the given type', async function() {
      assert.equal(await this.validators.getRoleRewardShare('human'), '25');

      await this.validators.deleteApplicationType(NEW_APPLICATION, { from: coreTeam });

      const res = await this.validators.getApplicationTypeRoles(NEW_APPLICATION);
      assert.equal(res.length, 0);

      assert.equal(await this.validators.getRoleApplicationType('human'), NON_EXISTING_APPLICATION);
      assert.equal(await this.validators.getRoleApplicationType('cat'), NON_EXISTING_APPLICATION);
      assert.equal(await this.validators.getRoleApplicationType('dog'), NON_EXISTING_APPLICATION);

      assert.equal(await this.validators.getRoleRewardShare('human'), 0);
      assert.equal(await this.validators.getRoleRewardShare('cat'), 0);
      assert.equal(await this.validators.getRoleRewardShare('dog'), 0);
    });

    it('should allow add a brand new list of roles after deletion', async function() {
      await this.validators.deleteApplicationType(NEW_APPLICATION, { from: coreTeam });
      await this.validators.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['foo', 'bar', 'buzz'],
        [30, 30, 40],
        ['', '', ''],
        { from: coreTeam }
      );
      assert.equal(await this.validators.getRoleApplicationType('foo'), NEW_APPLICATION);
      assert.equal(await this.validators.getRoleApplicationType('bar'), NEW_APPLICATION);
      assert.equal(await this.validators.getRoleApplicationType('buzz'), NEW_APPLICATION);

      assert.equal(await this.validators.getRoleRewardShare('foo'), 30);
      assert.equal(await this.validators.getRoleRewardShare('bar'), 30);
      assert.equal(await this.validators.getRoleRewardShare('buzz'), 40);
    });
  });

  describe('validators management', () => {
    beforeEach(async function() {
      const res = await this.validators.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['🦄', '🦆', '🦋'],
        [30, 30, 40],
        ['', '', ''],
        { from: coreTeam }
      );
      assert.isNotNull(res);
    });

    describe('#addValidator()', () => {
      it('should allow an owner to assign validators', async function() {
        await this.validators.addValidator(alice, 'Alice', 'sezu06', [], ['🦄'], { from: coreTeam });
      });

      it('should deny an owner to assign validator with non-existent role', async function() {
        await assertRevert(
          this.validators.addValidator(alice, 'Alice', 'sezu06', [], ['🦄', '🦆️'], { from: coreTeam })
        );
      });

      it('should deny any other person than owner to assign validators', async function() {
        await assertRevert(this.validators.addValidator(alice, 'Alice', 'sezu06', [], ['🦄'], { from: alice }));
      });
    });

    describe('#removeValidator()', () => {
      it('should allow an ower to remove validators', async function() {
        await this.validators.removeValidator(alice, { from: coreTeam });
      });

      it('should deny any other person than owner to remove validators', async function() {
        await assertRevert(this.validators.removeValidator(alice, { from: alice }));
      });
    });

    describe('#isValidatorActive()', () => {
      it('return true if validator is active', async function() {
        assert(!(await this.validators.isValidatorActive(alice)));
        await this.validators.addValidator(alice, 'Alice', 'IN', [], ['🦄'], { from: coreTeam });
        assert(await this.validators.isValidatorActive(alice));
        await this.validators.removeValidator(alice, { from: coreTeam });
        assert(!(await this.validators.isValidatorActive(alice)));
      });
    });
  });
});
