const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const ClaimManager = artifacts.require('./ClaimManager.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const { initHelperWeb3, paymentMethods, assertRevert, ether } = require('../../helpers');
const { deployPGGFactory, buildPGG } = require('../../deploymentHelpers');

const web3 = new Web3(ClaimManager.web3.currentProvider);

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);

// eslint-disable-next-line
contract("PGGFactory", (accounts) => {
  const [coreTeam, alice, feeCollector, a1, a2, a3] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });
    this.claimManager = await ClaimManager.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });

    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.pggRegistry = await PGGRegistry.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.feeRegistry.initialize();
    await this.pggRegistry.initialize(this.ggr.address);

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, {
      from: coreTeam
    });

    this.pggFactory = await deployPGGFactory(this.ggr, coreTeam);

    await this.feeRegistry.setGaltFee(await this.pggFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.pggFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.pggFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactory.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('FEE_COLLECTOR'), feeCollector, true, { from: coreTeam });

    await this.galtToken.mint(alice, ether(100000), { from: coreTeam });
  });

  describe('protocol fee', () => {
    async function build(factory, value = 0) {
      await buildPGG(factory, [a1, a2, a3], 2, 7, 10, 60, ether(1000), 240000, {}, {}, alice, value);
    }

    describe('payments', async function() {
      it('should accept GALT payments with a registered value', async function() {
        await this.galtToken.approve(this.pggFactory.address, ether(10), { from: alice });
        await build(this.pggFactory, 0);
      });

      it('should accept ETH payments with a registered value', async function() {
        await build(this.pggFactory, ether(5));
      });

      it('should accept GALT payments with an approved value higher than a registered', async function() {
        await this.galtToken.approve(this.pggFactory.address, ether(11), { from: alice });
        await build(this.pggFactory, 0);
        const res = await this.galtToken.balanceOf(this.pggFactory.address);
        assert.equal(res, ether(10));
      });

      it('should reject GALT payments with an approved value lower than a registered', async function() {
        await this.galtToken.approve(this.pggFactory.address, ether(9), { from: alice });
        await assertRevert(build(this.pggFactory, 0));
      });

      it('should accept ETH payments with a value higher than a registered one', async function() {
        await assertRevert(build(this.pggFactory, ether(6)));
      });

      it('should accept ETH payments with a value lower than a registered one', async function() {
        await assertRevert(build(this.pggFactory, ether(4)));
      });
    });
  });
});
