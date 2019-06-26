const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const PGGArbitratorStakeAccounting = artifacts.require('./MockPGGArbitratorStakeAccounting.sol');
const PGGConfig = artifacts.require('./PGGConfig.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const { assertRevert, ether, initHelperWeb3 } = require('../../helpers');

const web3 = new Web3(GaltToken.web3.currentProvider);
const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);

contract('PGGArbitratorStakeAccounting', accounts => {
  const [
    coreTeam,
    slashManager,
    multiSig,
    alice,
    bob,
    zeroAddress,
    delegateSpaceVoting,
    delegateGaltVoting,
    oracleStakeVoting
  ] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    await this.acl.initialize();
    await this.ggr.initialize();

    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.acl.setRole(bytes32('ARBITRATION_STAKE_SLASHER'), slashManager, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ORACLE_STAKE_SLASHER'), slashManager, true, { from: coreTeam });

    this.config = await PGGConfig.new(this.ggr.address, 2, 3, ether(1000), 30, {
      from: coreTeam
    });
    this.arbitratorStakeAccountingX = await PGGArbitratorStakeAccounting.new(this.config.address, 60, {
      from: coreTeam
    });

    await this.config.initialize(
      multiSig,
      zeroAddress,
      this.arbitratorStakeAccountingX.address,
      zeroAddress,
      zeroAddress,
      delegateSpaceVoting,
      delegateGaltVoting,
      oracleStakeVoting,
      zeroAddress
    );

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });

    this.mX = multiSig;
  });

  describe('#stake()', () => {
    it('should allow any address stake in GALT', async function() {
      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(35), { from: alice });

      await this.arbitratorStakeAccountingX.stake(bob, ether(35), { from: alice });

      let res = await this.arbitratorStakeAccountingX.balanceOf(bob);
      assert.equal(res, ether(35));

      res = await this.galtToken.balanceOf(multiSig);
      assert.equal(res, ether(35));

      // add some more deposit
      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(10), { from: bob });
      await this.arbitratorStakeAccountingX.stake(bob, ether(10), { from: bob });

      res = await this.arbitratorStakeAccountingX.balanceOf(bob);
      assert.equal(res, ether(45));

      res = await this.galtToken.balanceOf(multiSig);
      assert.equal(res, ether(45));
    });
  });

  describe('#slash()', () => {
    beforeEach(async function() {
      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(35), { from: alice });
      await this.arbitratorStakeAccountingX.stake(bob, ether(35), { from: alice });
    });

    it('should allow slash manager slashing arbitrator stake', async function() {
      await this.arbitratorStakeAccountingX.slash(bob, ether(18), { from: slashManager });

      const res = await this.arbitratorStakeAccountingX.balanceOf(bob);
      assert.equal(res, ether(17));
    });

    it('should deny non-slashing manager slashing stake', async function() {
      await assertRevert(this.arbitratorStakeAccountingX.slash(bob, ether(10), { from: bob }));
    });

    it('should deny slashing with a value grater than current stake', async function() {
      await assertRevert(this.arbitratorStakeAccountingX.slash(bob, ether(36), { from: slashManager }));
    });
  });

  // TODO: find a right way to test periods with ganache blocks
  describe.skip('#getCurrentPeriod()', () => {
    it('should provide correct period ID', async function() {
      // DANGER: could fail since we don't count the execution time
      let res = await web3.eth.getBlock('latest');
      const latestBlockTimestamp = res.timestamp;
      await this.arbitratorStakeAccountingX.setInitialTimestamp(latestBlockTimestamp);
      res = await this.arbitratorStakeAccountingX.getInitialTimestamp();
      assert.equal(res, latestBlockTimestamp);
      res = await this.arbitratorStakeAccountingX.getCurrentPeriod();
      assert.equal(res, 0);

      await this.arbitratorStakeAccountingX.setInitialTimestamp(latestBlockTimestamp - 59);
      res = await this.arbitratorStakeAccountingX.getCurrentPeriod();
      assert.equal(res, 0);

      await this.arbitratorStakeAccountingX.setInitialTimestamp(latestBlockTimestamp - 60);
      res = await this.arbitratorStakeAccountingX.getCurrentPeriod();
      assert.equal(res, 1);

      await this.arbitratorStakeAccountingX.setInitialTimestamp(latestBlockTimestamp - 61);
      res = await this.arbitratorStakeAccountingX.getCurrentPeriod();
      assert.equal(res, 1);

      await this.arbitratorStakeAccountingX.setInitialTimestamp(latestBlockTimestamp - 119);
      res = await this.arbitratorStakeAccountingX.getCurrentPeriod();
      assert.equal(res, 1);

      await this.arbitratorStakeAccountingX.setInitialTimestamp(latestBlockTimestamp - 120);
      res = await this.arbitratorStakeAccountingX.getCurrentPeriod();
      assert.equal(res, 2);

      await this.arbitratorStakeAccountingX.setInitialTimestamp(latestBlockTimestamp - 121);
      res = await this.arbitratorStakeAccountingX.getCurrentPeriod();
      assert.equal(res, 2);
    });
  });
});
