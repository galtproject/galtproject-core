const Oracles = artifacts.require('./Oracles.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { assertRevert, initHelperWeb3 } = require('../helpers');

const { hexToUtf8 } = Web3.utils;
const web3 = new Web3(Oracles.web3.currentProvider);

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
contract('Oracles', accounts => {
  const [
    coreTeam,
    oracleManager,
    applicationTypeManager,
    oracleTypeManager,
    stakesManager,
    oracleStakeAccounting,
    alice,
    bob
  ] = accounts;

  beforeEach(async function() {
    this.oracles = await Oracles.new({ from: coreTeam });

    await this.oracles.addRoleTo(applicationTypeManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleTypeManager, await this.oracles.ROLE_ORACLE_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(stakesManager, await this.oracles.ROLE_ORACLE_STAKES_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleStakeAccounting, await this.oracles.ROLE_ORACLE_STAKES_NOTIFIER(), {
      from: coreTeam
    });
  });

  describe('roles management', () => {
    beforeEach(async function() {
      this.res = await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        ['human', 'cat', 'dog'],
        [25, 30, 45],
        ['', '', ''],
        { from: applicationTypeManager }
      );
    });

    it('should provide an ability to set roles for the given type', async function() {
      let res = await this.oracles.getApplicationTypeOracleTypes(NEW_APPLICATION);
      assert.sameMembers(res.map(hexToUtf8), ['human', 'cat', 'dog']);
      res = await this.oracles.getApplicationTypeOracleTypesCount(NEW_APPLICATION);
      assert.equal(res.toString(), '3');

      assert.equal(await this.oracles.getOracleTypeApplicationType('human'), NEW_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType('cat'), NEW_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType('dog'), NEW_APPLICATION);

      assert.equal(await this.oracles.getOracleTypeRewardShare('human'), 25);
      assert.equal(await this.oracles.getOracleTypeRewardShare('cat'), 30);
      assert.equal(await this.oracles.getOracleTypeRewardShare('dog'), 45);
    });

    it('should prevent non-applicationManager from overwriting an existing application type', async function() {
      await assertRevert(
        this.oracles.setApplicationTypeOracleTypes(
          NEW_APPLICATION,
          ['foo', 'bar', 'buzz'],
          [30, 30, 40],
          ['', '', ''],
          {
            from: bob
          }
        )
      );
    });

    it('should prevent an applicationManager owerwriting existing application type', async function() {
      await assertRevert(
        this.oracles.setApplicationTypeOracleTypes(
          NEW_APPLICATION,
          ['foo', 'bar', 'buzz'],
          [30, 30, 40],
          ['', '', ''],
          {
            from: applicationTypeManager
          }
        )
      );
      let res = await this.oracles.getApplicationTypeOracleTypes(NEW_APPLICATION);
      assert.sameMembers(res.map(hexToUtf8), ['human', 'cat', 'dog']);
      res = await this.oracles.getApplicationTypeOracleTypesCount(NEW_APPLICATION);
      assert.equal(res.toString(), '3');
    });

    it('should provide an ability to delete all roles of the given type', async function() {
      assert.equal(await this.oracles.getOracleTypeRewardShare('human'), '25');

      await this.oracles.deleteApplicationType(NEW_APPLICATION, { from: applicationTypeManager });

      const res = await this.oracles.getApplicationTypeOracleTypes(NEW_APPLICATION);
      assert.equal(res.length, 0);

      assert.equal(await this.oracles.getOracleTypeApplicationType('human'), NON_EXISTING_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType('cat'), NON_EXISTING_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType('dog'), NON_EXISTING_APPLICATION);

      assert.equal(await this.oracles.getOracleTypeRewardShare('human'), 0);
      assert.equal(await this.oracles.getOracleTypeRewardShare('cat'), 0);
      assert.equal(await this.oracles.getOracleTypeRewardShare('dog'), 0);
    });

    it('should allow add a brand new list of roles after deletion', async function() {
      await this.oracles.deleteApplicationType(NEW_APPLICATION, { from: applicationTypeManager });
      await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        ['foo', 'bar', 'buzz'],
        [30, 30, 40],
        ['', '', ''],
        {
          from: applicationTypeManager
        }
      );
      assert.equal(await this.oracles.getOracleTypeApplicationType('foo'), NEW_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType('bar'), NEW_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType('buzz'), NEW_APPLICATION);

      assert.equal(await this.oracles.getOracleTypeRewardShare('foo'), 30);
      assert.equal(await this.oracles.getOracleTypeRewardShare('bar'), 30);
      assert.equal(await this.oracles.getOracleTypeRewardShare('buzz'), 40);
    });
  });

  describe('oracles management', () => {
    beforeEach(async function() {
      const res = await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        ['🦄', '🦆', '🦋'],
        [30, 30, 40],
        ['', '', ''],
        { from: applicationTypeManager }
      );
      assert.isNotNull(res);
    });

    describe('#addOracle()', () => {
      it('should allow an oracleManager to assign oracles', async function() {
        await this.oracles.addOracle(alice, 'Alice', 'sezu06', [], ['🦄'], { from: oracleManager });
      });

      it('should deny an oracleManager to assign oracle with non-existent role', async function() {
        await assertRevert(
          this.oracles.addOracle(alice, 'Alice', 'sezu06', [], ['🦄', '🦆️'], { from: oracleManager })
        );
      });

      it('should deny any other person than oracleManager to assign oracles', async function() {
        await assertRevert(this.oracles.addOracle(alice, 'Alice', 'sezu06', [], ['🦄'], { from: alice }));
      });
    });

    describe('#removeOracle()', () => {
      it('should allow an ower to remove oracles', async function() {
        await this.oracles.removeOracle(alice, { from: oracleManager });
      });

      it('should deny any other person than oracleManager to remove oracles', async function() {
        await assertRevert(this.oracles.removeOracle(alice, { from: alice }));
      });
    });

    describe('#isOracleActive()', () => {
      it('return true if oracle is active and has deposited his stake', async function() {
        assert(!(await this.oracles.isOracleActive(alice)));
        await this.oracles.addOracle(alice, 'Alice', 'IN', [], ['🦄'], { from: oracleManager });
        assert(await this.oracles.isOracleActive(alice));
        await this.oracles.removeOracle(alice, { from: oracleManager });
        assert(!(await this.oracles.isOracleActive(alice)));
      });
    });
  });
});
