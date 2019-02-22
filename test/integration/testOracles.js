const Oracles = artifacts.require('./Oracles.sol');
const Web3 = require('web3');
const { assertRevert, initHelperWeb3 } = require('../helpers');

const web3 = new Web3(Oracles.web3.currentProvider);

initHelperWeb3(web3);

const { hexToUtf8, utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

const NEW_APPLICATION = '0x41e691fcbdc41a0c9c62caec68dbbdb99b245cbb72f06df6f40fa1bd1b4d97d9';
const NON_EXISTING_APPLICATION = '0x0000000000000000000000000000000000000000000000000000000000000000';
const FOO = bytes32('foo');
const BAR = bytes32('bar');
const BUZZ = bytes32('buzz');
// eslint-disable-next-line no-underscore-dangle
const _ES = bytes32('');
const ALICE = bytes32('Alice');
const DOG = bytes32('dog');
const CAT = bytes32('cat');
const HUMAN = bytes32('human');

// NOTICE: we don't wrap MockToken with a proxy on production
contract('Oracles', accounts => {
  const [
    coreTeam,
    oracleManager,
    multiSigX,
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
        [HUMAN, CAT, DOG],
        [25, 30, 45],
        [_ES, _ES, _ES],
        { from: applicationTypeManager }
      );
    });

    it('should provide an ability to set roles for the given type', async function() {
      let res = await this.oracles.getApplicationTypeOracleTypes(NEW_APPLICATION);
      assert.sameMembers(res.map(hexToUtf8), [HUMAN, CAT, DOG].map(hexToUtf8));
      res = await this.oracles.getApplicationTypeOracleTypesCount(NEW_APPLICATION);
      assert.equal(res.toString(), '3');

      assert.equal(await this.oracles.getOracleTypeApplicationType(HUMAN), NEW_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType(CAT), NEW_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType(DOG), NEW_APPLICATION);

      assert.equal(await this.oracles.getOracleTypeRewardShare(HUMAN), 25);
      assert.equal(await this.oracles.getOracleTypeRewardShare(CAT), 30);
      assert.equal(await this.oracles.getOracleTypeRewardShare(DOG), 45);
    });

    it('should prevent non-applicationManager from overwriting an existing application type', async function() {
      await assertRevert(
        this.oracles.setApplicationTypeOracleTypes(NEW_APPLICATION, [FOO, BAR, BUZZ], [30, 30, 40], [_ES, _ES, _ES], {
          from: bob
        })
      );
    });

    it('should prevent an applicationManager owerwriting existing application type', async function() {
      await assertRevert(
        this.oracles.setApplicationTypeOracleTypes(NEW_APPLICATION, [FOO, BAR, BUZZ], [30, 30, 40], [_ES, _ES, _ES], {
          from: applicationTypeManager
        })
      );
      let res = await this.oracles.getApplicationTypeOracleTypes(NEW_APPLICATION);
      assert.sameMembers(res.map(hexToUtf8), [HUMAN, CAT, DOG].map(hexToUtf8));
      res = await this.oracles.getApplicationTypeOracleTypesCount(NEW_APPLICATION);
      assert.equal(res.toString(), '3');
    });

    it('should provide an ability to delete all roles of the given type', async function() {
      assert.equal(await this.oracles.getOracleTypeRewardShare(HUMAN), '25');

      await this.oracles.deleteApplicationType(NEW_APPLICATION, { from: applicationTypeManager });

      const res = await this.oracles.getApplicationTypeOracleTypes(NEW_APPLICATION);
      assert.equal(res.length, 0);

      assert.equal(await this.oracles.getOracleTypeApplicationType(HUMAN), NON_EXISTING_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType(CAT), NON_EXISTING_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType(DOG), NON_EXISTING_APPLICATION);

      assert.equal(await this.oracles.getOracleTypeRewardShare(HUMAN), 0);
      assert.equal(await this.oracles.getOracleTypeRewardShare(CAT), 0);
      assert.equal(await this.oracles.getOracleTypeRewardShare(DOG), 0);
    });

    it('should allow add a brand new list of roles after deletion', async function() {
      await this.oracles.deleteApplicationType(NEW_APPLICATION, { from: applicationTypeManager });
      await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        [FOO, BAR, BUZZ],
        [30, 30, 40],
        [_ES, _ES, _ES],
        {
          from: applicationTypeManager
        }
      );
      assert.equal(await this.oracles.getOracleTypeApplicationType(FOO), NEW_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType(BAR), NEW_APPLICATION);
      assert.equal(await this.oracles.getOracleTypeApplicationType(BUZZ), NEW_APPLICATION);

      assert.equal(await this.oracles.getOracleTypeRewardShare(FOO), 30);
      assert.equal(await this.oracles.getOracleTypeRewardShare(BAR), 30);
      assert.equal(await this.oracles.getOracleTypeRewardShare(BUZZ), 40);
    });
  });

  describe('oracles management', () => {
    beforeEach(async function() {
      const res = await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        [bytes32('🦄'), bytes32('🦆'), bytes32('🦋')],
        [30, 30, 40],
        [_ES, _ES, _ES],
        { from: applicationTypeManager }
      );
      assert.isNotNull(res);
    });

    describe('#addOracle()', () => {
      it('should allow an oracleManager to assign oracles', async function() {
        await this.oracles.addOracle(multiSigX, alice, ALICE, bytes32('sezu06'), '', [], [bytes32('🦄')], {
          from: oracleManager
        });
      });

      it('should deny an oracleManager to assign oracle with non-existent role', async function() {
        await assertRevert(
          this.oracles.addOracle(multiSigX, alice, ALICE, bytes32('sezu06'), '', [], [bytes32('🦄'), bytes32('🦆️')], {
            from: oracleManager
          })
        );
      });

      it('should deny any other person than oracleManager to assign oracles', async function() {
        await assertRevert(
          this.oracles.addOracle(multiSigX, alice, ALICE, bytes32('sezu06'), '', [], [bytes32('🦄')], { from: alice })
        );
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
      it('return true if oracle is active', async function() {
        assert(!(await this.oracles.isOracleActive(alice)));
        await this.oracles.addOracle(multiSigX, alice, ALICE, bytes32('IN'), '', [], [bytes32('🦄')], {
          from: oracleManager
        });
        assert(await this.oracles.isOracleActive(alice));
        await this.oracles.removeOracle(alice, { from: oracleManager });
        assert(!(await this.oracles.isOracleActive(alice)));
      });
    });
  });
});
