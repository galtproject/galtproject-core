const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

SpaceLockerFactory.numberFormat = 'String';
GaltToken.numberFormat = 'String';

const Web3 = require('web3');
const {
  ether,
  assertEthBalanceChanged,
  assertGaltBalanceChanged,
  assertRevert,
  initHelperWeb3,
  initHelperArtifacts,
  paymentMethods
} = require('../../helpers');

const web3 = new Web3(SpaceLockerFactory.web3.currentProvider);

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

contract('SpaceLockerFactory', accounts => {
  const [coreTeam, alice, feeCollector] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });

    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.spaceLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('SPACE_LOCKER_REGISTRAR'), {
      from: coreTeam
    });
    this.spaceLockerFactory = await SpaceLockerFactory.new(this.ggr.address, { from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.feeRegistry.initialize();

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_LOCKER_REGISTRY(), this.spaceLockerRegistry.address, {
      from: coreTeam
    });

    await this.feeRegistry.setGaltFee(await this.spaceLockerFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.spaceLockerFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.spaceLockerFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('FEE_COLLECTOR'), feeCollector, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_LOCKER_REGISTRAR'), this.spaceLockerFactory.address, true, {
      from: coreTeam
    });
  });

  describe('protocol fee', () => {
    describe('payments', async function() {
      it('should accept GALT payments with a registered value', async function() {
        await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: alice });
        await this.spaceLockerFactory.build({ from: alice });
      });

      it('should accept ETH payments with a registered value', async function() {
        await this.spaceLockerFactory.build({ from: alice, value: ether(5) });
      });

      it('should accept GALT payments with an approved value higher than a registered', async function() {
        await this.galtToken.approve(this.spaceLockerFactory.address, ether(11), { from: alice });
        await this.spaceLockerFactory.build({ from: alice });
        const res = await this.galtToken.balanceOf(this.spaceLockerFactory.address);
        assert.equal(res, ether(10));
      });

      it('should reject GALT payments with an approved value lower than a registered', async function() {
        await this.galtToken.approve(this.spaceLockerFactory.address, ether(9), { from: alice });
        await assertRevert(this.spaceLockerFactory.build({ from: alice }));
      });

      it('should accept ETH payments with a value higher than a registered one', async function() {
        await assertRevert(this.spaceLockerFactory.build({ from: alice, value: ether(6) }));
      });

      it('should accept ETH payments with a value lower than a registered one', async function() {
        await assertRevert(this.spaceLockerFactory.build({ from: alice, value: ether(4) }));
      });
    });

    describe('collection', () => {
      it('should allow the collector withdrawing all collected ETH fees', async function() {
        await this.spaceLockerFactory.build({ from: alice, value: ether(5) });
        await this.spaceLockerFactory.build({ from: alice, value: ether(5) });
        await this.spaceLockerFactory.build({ from: alice, value: ether(5) });
        await this.spaceLockerFactory.build({ from: alice, value: ether(5) });
        await this.spaceLockerFactory.build({ from: alice, value: ether(5) });
        await this.spaceLockerFactory.build({ from: alice, value: ether(5) });

        const ethBalanceBefore = await web3.eth.getBalance(feeCollector);
        await this.spaceLockerFactory.withdrawEthFees({ from: feeCollector });
        const ethBalanceAfter = await web3.eth.getBalance(feeCollector);
        assertEthBalanceChanged(ethBalanceBefore, ethBalanceAfter, ether(30));
      });

      it('should allow the collector withdrawing all collected GALT fees', async function() {
        await this.galtToken.approve(this.spaceLockerFactory.address, ether(70), { from: alice });
        await this.spaceLockerFactory.build({ from: alice });
        await this.spaceLockerFactory.build({ from: alice });
        await this.spaceLockerFactory.build({ from: alice });
        await this.spaceLockerFactory.build({ from: alice });
        await this.spaceLockerFactory.build({ from: alice });
        await this.spaceLockerFactory.build({ from: alice });
        await this.spaceLockerFactory.build({ from: alice });

        const galtBalanceBefore = await this.galtToken.balanceOf(feeCollector);
        await this.spaceLockerFactory.withdrawGaltFees({ from: feeCollector });
        const galtBalanceAfter = await this.galtToken.balanceOf(feeCollector);

        assertGaltBalanceChanged(galtBalanceBefore, galtBalanceAfter, ether(70));
      });
    });
  });
});
