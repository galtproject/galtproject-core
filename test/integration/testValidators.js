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
contract('Validators', ([coreTeam, validatorManager, applicationTypeManager, validatorStakes, alice, bob]) => {
  beforeEach(async function() {
    this.oracles = await Validators.new({ from: coreTeam });

    await this.oracles.addRoleTo(applicationTypeManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(validatorManager, await this.oracles.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleStakeAccounting, await this.oracles.ROLE_VALIDATOR_STAKES(), {
      from: coreTeam
    });
  });

  describe('roles management', () => {
    beforeEach(async function() {
      this.res = await this.oracles.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['human', 'cat', 'dog'],
        [25, 30, 45],
        ['', '', ''],
        { from: applicationTypeManager }
      );
    });

    it('should provide an ability to set roles for the given type', async function() {
      let res = await this.oracles.getApplicationTypeRoles(NEW_APPLICATION);
      assert.sameMembers(res.map(hexToUtf8), ['human', 'cat', 'dog']);
      res = await this.oracles.getApplicationTypeRolesCount(NEW_APPLICATION);
      assert.equal(res.toString(), '3');

      assert.equal(await this.oracles.getRoleApplicationType('human'), NEW_APPLICATION);
      assert.equal(await this.oracles.getRoleApplicationType('cat'), NEW_APPLICATION);
      assert.equal(await this.oracles.getRoleApplicationType('dog'), NEW_APPLICATION);

      assert.equal(await this.oracles.getRoleRewardShare('human'), 25);
      assert.equal(await this.oracles.getRoleRewardShare('cat'), 30);
      assert.equal(await this.oracles.getRoleRewardShare('dog'), 45);
    });

    it('should prevent non-applicationManager from overwriting an existing application type', async function() {
      await assertRevert(
        this.oracles.setApplicationTypeRoles(NEW_APPLICATION, ['foo', 'bar', 'buzz'], [30, 30, 40], ['', '', ''], {
          from: bob
        })
      );
    });

    it('should prevent an applicationManager owerwriting existing application type', async function() {
      await assertRevert(
        this.oracles.setApplicationTypeRoles(NEW_APPLICATION, ['foo', 'bar', 'buzz'], [30, 30, 40], ['', '', ''], {
          from: applicationTypeManager
        })
      );
      let res = await this.oracles.getApplicationTypeRoles(NEW_APPLICATION);
      assert.sameMembers(res.map(hexToUtf8), ['human', 'cat', 'dog']);
      res = await this.oracles.getApplicationTypeRolesCount(NEW_APPLICATION);
      assert.equal(res.toString(), '3');
    });

    it('should provide an ability to delete all roles of the given type', async function() {
      assert.equal(await this.oracles.getRoleRewardShare('human'), '25');

      await this.oracles.deleteApplicationType(NEW_APPLICATION, { from: applicationTypeManager });

      const res = await this.oracles.getApplicationTypeRoles(NEW_APPLICATION);
      assert.equal(res.length, 0);

      assert.equal(await this.oracles.getRoleApplicationType('human'), NON_EXISTING_APPLICATION);
      assert.equal(await this.oracles.getRoleApplicationType('cat'), NON_EXISTING_APPLICATION);
      assert.equal(await this.oracles.getRoleApplicationType('dog'), NON_EXISTING_APPLICATION);

      assert.equal(await this.oracles.getRoleRewardShare('human'), 0);
      assert.equal(await this.oracles.getRoleRewardShare('cat'), 0);
      assert.equal(await this.oracles.getRoleRewardShare('dog'), 0);
    });

    it('should allow add a brand new list of roles after deletion', async function() {
      await this.oracles.deleteApplicationType(NEW_APPLICATION, { from: applicationTypeManager });
      await this.oracles.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['foo', 'bar', 'buzz'],
        [30, 30, 40],
        ['', '', ''],
        { from: applicationTypeManager }
      );
      assert.equal(await this.oracles.getRoleApplicationType('foo'), NEW_APPLICATION);
      assert.equal(await this.oracles.getRoleApplicationType('bar'), NEW_APPLICATION);
      assert.equal(await this.oracles.getRoleApplicationType('buzz'), NEW_APPLICATION);

      assert.equal(await this.oracles.getRoleRewardShare('foo'), 30);
      assert.equal(await this.oracles.getRoleRewardShare('bar'), 30);
      assert.equal(await this.oracles.getRoleRewardShare('buzz'), 40);
    });
  });

  describe('oracles management', () => {
    beforeEach(async function() {
      const res = await this.oracles.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['🦄', '🦆', '🦋'],
        [30, 30, 40],
        ['', '', ''],
        { from: applicationTypeManager }
      );
      assert.isNotNull(res);
    });

    describe('#addValidator()', () => {
      it('should allow an validatorManager to assign oracles', async function() {
        await this.oracles.addValidator(alice, 'Alice', 'sezu06', [], ['🦄'], { from: validatorManager });
      });

      it('should deny an validatorManager to assign validator with non-existent role', async function() {
        await assertRevert(
          this.oracles.addValidator(alice, 'Alice', 'sezu06', [], ['🦄', '🦆️'], { from: validatorManager })
        );
      });

      it('should deny any other person than validatorManager to assign oracles', async function() {
        await assertRevert(this.oracles.addValidator(alice, 'Alice', 'sezu06', [], ['🦄'], { from: alice }));
      });
    });

    describe('#removeValidator()', () => {
      it('should allow an ower to remove oracles', async function() {
        await this.oracles.removeValidator(alice, { from: validatorManager });
      });

      it('should deny any other person than validatorManager to remove oracles', async function() {
        await assertRevert(this.oracles.removeValidator(alice, { from: alice }));
      });
    });

    describe('#isValidatorActive()', () => {
      it('return true if validator is active and has deposited his stake', async function() {
        assert(!(await this.oracles.isValidatorActive(alice)));
        await this.oracles.addValidator(alice, 'Alice', 'IN', [], ['🦄'], { from: validatorManager });
        assert(await this.oracles.isValidatorActive(alice));
        await this.oracles.removeValidator(alice, { from: validatorManager });
        assert(!(await this.oracles.isValidatorActive(alice)));
      });
    });
  });
});
