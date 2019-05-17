const ACL = artifacts.require('./ACL.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');
const OracleStakeVoting = artifacts.require('./OracleStakeVoting.sol');
const ArbitrationCandidateTop = artifacts.require('./ArbitrationCandidateTop.sol');
const ArbitrationConfig = artifacts.require('./ArbitrationConfig.sol');
const ArbitrationOracles = artifacts.require('./ArbitrationOracles.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const StakeTracker = artifacts.require('./StakeTracker.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');

const Web3 = require('web3');
const { assertRevert, ether, initHelperWeb3 } = require('../../helpers');

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;
const web3 = new Web3(ACL.web3.currentProvider);

initHelperWeb3(web3);

const NON_EXISTENT_ROLE = bytes32('blah');
const PE_AUDITOR_ORACLE_TYPE = bytes32('PE_AUDITOR_ORACLE_TYPE');
const PC_CUSTODIAN_ORACLE_TYPE = bytes32('PC_CUSTODIAN_ORACLE_TYPE');
const PC_AUDITOR_ORACLE_TYPE = bytes32('PC_AUDITOR_ORACLE_TYPE');

const FOO = bytes32('foo');
const BAR = bytes32('bar');
const BUZZ = bytes32('buzz');
// eslint-disable-next-line no-underscore-dangle
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');
const EVE = bytes32('Eve');

// NOTICE: we don't wrap MockToken with a proxy on production
contract('OracleStakesAccounting', accounts => {
  const [
    coreTeam,
    slashManager,
    oracleModifier,
    multiSigRegistrar,
    multiSig,
    zeroAddress,
    delegateSpaceVoting,
    delegateGaltVoting,
    alice,
    bob,
    charlie,
    dan,
    eve
  ] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    this.stakeTracker = await StakeTracker.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.multiSigRegistry.initialize(this.ggr.address);
    await this.stakeTracker.initialize(this.ggr.address);

    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.STAKE_TRACKER(), this.stakeTracker.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.MULTI_SIG_REGISTRY(), this.multiSigRegistry.address, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('ORACLE_STAKE_SLASHER'), slashManager, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ORACLE_MODIFIER'), oracleModifier, true, { from: coreTeam });
    await this.acl.setRole(bytes32('MULTI_SIG_REGISTRAR'), multiSigRegistrar, true, { from: coreTeam });

    assert.equal(await this.acl.hasRole(slashManager, bytes32('ORACLE_STAKE_SLASHER')), true);

    this.config = await ArbitrationConfig.new(this.ggr.address, 2, 3, ether(1000), [30, 30, 30, 30, 30, 30, 30, 30], {
      from: coreTeam
    });
    this.candidateTop = await ArbitrationCandidateTop.new(this.config.address, { from: coreTeam });
    this.oracleStakesAccountingX = await OracleStakesAccounting.new(this.config.address, { from: coreTeam });
    this.oracleStakeVotingX = await OracleStakeVoting.new(this.config.address, { from: coreTeam });
    this.oraclesX = await ArbitrationOracles.new(this.config.address, { from: coreTeam });

    await this.config.initialize(
      multiSig,
      this.candidateTop.address,
      zeroAddress,
      this.oracleStakesAccountingX.address,
      this.oraclesX.address,
      delegateSpaceVoting,
      delegateGaltVoting,
      this.oracleStakeVotingX.address
    );

    await this.multiSigRegistry.addMultiSig(multiSig, this.config.address, { from: multiSigRegistrar });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    this.mX = multiSig;

    // assign oracles
    await this.oraclesX.addOracle(bob, BOB, MN, '', [], [PC_CUSTODIAN_ORACLE_TYPE, FOO], {
      from: oracleModifier
    });
    await this.oraclesX.addOracle(
      charlie,
      CHARLIE,
      MN,
      '',
      [],
      [BAR, PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
      {
        from: oracleModifier
      }
    );
    await this.oraclesX.addOracle(dan, DAN, MN, '', [], [BUZZ, PE_AUDITOR_ORACLE_TYPE], {
      from: oracleModifier
    });
    await this.oraclesX.addOracle(eve, EVE, MN, '', [], [PC_AUDITOR_ORACLE_TYPE, PE_AUDITOR_ORACLE_TYPE], {
      from: oracleModifier
    });
  });

  describe('#stake()', () => {
    it('should allow any user stake for oracle', async function() {
      await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(35), { from: alice });
      await this.oracleStakesAccountingX.stake(bob, PC_CUSTODIAN_ORACLE_TYPE, ether(35), { from: alice });
      let res = await this.oracleStakesAccountingX.stakeOf(bob, NON_EXISTENT_ROLE);
      assert.equal(res, 0);
      res = await this.oracleStakesAccountingX.stakeOf(bob, PC_CUSTODIAN_ORACLE_TYPE);
      assert.equal(res, ether(35));
    });

    it('should deny staking for non-existing role', async function() {
      await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(35), { from: alice });
      await assertRevert(
        this.oracleStakesAccountingX.stake(bob, bytes32('non-exisitng-role'), ether(35), { from: alice })
      );

      const res = await this.oracleStakesAccountingX.stakeOf(bob, NON_EXISTENT_ROLE);
      assert.equal(res, 0);
    });

    it('should deny staking for non-existing oracle', async function() {
      await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(35), { from: alice });
      await assertRevert(this.oracleStakesAccountingX.stake(alice, NON_EXISTENT_ROLE, ether(35), { from: alice }));

      const res = await this.oracleStakesAccountingX.stakeOf(alice, NON_EXISTENT_ROLE);
      assert.equal(res, 0);
    });
  });

  describe('#slash()', () => {
    beforeEach(async function() {
      await this.oraclesX.addOracle(bob, BOB, MN, '', [], [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE, FOO], {
        from: oracleModifier
      });
      await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(1000), { from: alice });
      await this.oracleStakesAccountingX.stake(bob, PC_CUSTODIAN_ORACLE_TYPE, ether(35), { from: alice });
      await this.oracleStakesAccountingX.stake(bob, PC_AUDITOR_ORACLE_TYPE, ether(55), { from: alice });
      await this.oracleStakesAccountingX.stake(bob, PC_CUSTODIAN_ORACLE_TYPE, ether(25), { from: alice });
    });

    it('should allow slash manager slashing oracle stake', async function() {
      await this.oracleStakesAccountingX.slash(bob, PC_AUDITOR_ORACLE_TYPE, ether(18), { from: slashManager });

      const res = await this.oracleStakesAccountingX.stakeOf(bob, PC_AUDITOR_ORACLE_TYPE);
      assert.equal(res, ether(37));
    });

    it('should allow slash a stake to a negative value', async function() {
      await this.oracleStakesAccountingX.slash(bob, PC_AUDITOR_ORACLE_TYPE, ether(100), { from: slashManager });

      const res = await this.oracleStakesAccountingX.stakeOf(bob, PC_AUDITOR_ORACLE_TYPE);
      assert.equal(res, ether(-45));
    });

    it('should deny non-slashing manager slashing stake', async function() {
      await assertRevert(this.oracleStakesAccountingX.slash(bob, PC_AUDITOR_ORACLE_TYPE, ether(100), { from: bob }));
    });

    it('should deny slashing non-existent role', async function() {
      await assertRevert(
        this.oracleStakesAccountingX.slash(bob, PE_AUDITOR_ORACLE_TYPE, ether(100), { from: slashManager })
      );
    });

    it('should allow slashing existent role with 0 balance', async function() {
      await this.oracleStakesAccountingX.slash(dan, PE_AUDITOR_ORACLE_TYPE, ether(100), { from: slashManager });

      const res = await this.oracleStakesAccountingX.stakeOf(dan, PE_AUDITOR_ORACLE_TYPE);
      assert.equal(res, ether(-100));
    });
  });
});
