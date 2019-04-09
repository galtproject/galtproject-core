const FeeRegistry = artifacts.require('./FeeRegistry.sol');

const Web3 = require('web3');
const { ether, assertRevert, initHelperWeb3, initHelperArtifacts, paymentMethods } = require('../helpers');

const web3 = new Web3(FeeRegistry.web3.currentProvider);

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

contract('FeeRegistry', accounts => {
  const [coreTeam, alice] = accounts;
  const KEY = bytes32('MY_KEY');

  beforeEach(async function() {
    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
  });

  describe('ETH Fee', () => {
    describe('#getEthFee()', async function() {
      it('should return given value', async function() {
        await this.feeRegistry.setEthFee(KEY, ether(10), { from: coreTeam });
        const res = await this.feeRegistry.getEthFee(KEY);
        assert.equal(res, ether(10));
      });

      it('should return 0 for unknown given value', async function() {
        const res = await this.feeRegistry.getEthFee(KEY);
        assert.equal(res, ether(0));
      });
    });

    describe('#getEthFeeOrRevert()', async function() {
      it('should not revert when ETH_ONLY payment is enabled', async function() {
        await this.feeRegistry.setEthFee(KEY, ether(10), { from: coreTeam });
        await this.feeRegistry.setPaymentMethod(KEY, paymentMethods.ETH_ONLY, { from: coreTeam });
        const res = await this.feeRegistry.getEthFeeOrRevert(KEY);
        assert.equal(res, ether(10));
      });

      it('should not revert when ETH_AND_GALT payment is enabled', async function() {
        await this.feeRegistry.setEthFee(KEY, ether(10), { from: coreTeam });
        await this.feeRegistry.setPaymentMethod(KEY, paymentMethods.ETH_AND_GALT, { from: coreTeam });
        const res = await this.feeRegistry.getEthFeeOrRevert(KEY);
        assert.equal(res, ether(10));
      });

      it('should revert when GALT_ONLY payment is enabled', async function() {
        await this.feeRegistry.setEthFee(KEY, ether(10), { from: coreTeam });
        await this.feeRegistry.setPaymentMethod(KEY, paymentMethods.GALT_ONLY, { from: coreTeam });
        await assertRevert(this.feeRegistry.getEthFeeOrRevert(KEY));
      });

      it('should revert when NONE payment is enabled', async function() {
        await this.feeRegistry.setEthFee(KEY, ether(10), { from: coreTeam });
        await assertRevert(this.feeRegistry.getEthFeeOrRevert(KEY));
      });
    });
  });

  describe('GALT Fee', () => {
    describe('#getGaltFee()', async function() {
      it('should return given value', async function() {
        await this.feeRegistry.setGaltFee(KEY, ether(10), { from: coreTeam });
        const res = await this.feeRegistry.getGaltFee(KEY);
        assert.equal(res, ether(10));
      });

      it('should return 0 for unknown given value', async function() {
        const res = await this.feeRegistry.getGaltFee(KEY);
        assert.equal(res, ether(0));
      });
    });

    describe('#getGaltFeeOrRevert()', async function() {
      it('should not revert when GALT_ONLY payment is enabled', async function() {
        await this.feeRegistry.setGaltFee(KEY, ether(10), { from: coreTeam });
        await this.feeRegistry.setPaymentMethod(KEY, paymentMethods.GALT_ONLY, { from: coreTeam });
        const res = await this.feeRegistry.getGaltFeeOrRevert(KEY);
        assert.equal(res, ether(10));
      });

      it('should not revert when ETH_AND_GALT payment is enabled', async function() {
        await this.feeRegistry.setGaltFee(KEY, ether(10), { from: coreTeam });
        await this.feeRegistry.setPaymentMethod(KEY, paymentMethods.ETH_AND_GALT, { from: coreTeam });
        const res = await this.feeRegistry.getGaltFeeOrRevert(KEY);
        assert.equal(res, ether(10));
      });

      it('should revert when ETH_ONLY payment is enabled', async function() {
        await this.feeRegistry.setGaltFee(KEY, ether(10), { from: coreTeam });
        await this.feeRegistry.setPaymentMethod(KEY, paymentMethods.ETH_ONLY, { from: coreTeam });
        await assertRevert(this.feeRegistry.getGaltFeeOrRevert(KEY));
      });

      it('should revert when NONE payment is enabled', async function() {
        await this.feeRegistry.setGaltFee(KEY, ether(10), { from: coreTeam });
        await assertRevert(this.feeRegistry.getGaltFeeOrRevert(KEY));
      });
    });
  });

  describe('Setters', async function() {
    it('should deny non-owner #setEthFee() invocation', async function() {
      await assertRevert(this.feeRegistry.setEthFee(KEY, ether(10), { from: alice }));
    });

    it('should deny non-owner #setGaltFee() invocation', async function() {
      await assertRevert(this.feeRegistry.setGaltFee(KEY, ether(10), { from: alice }));
    });

    it('should deny non-owner #setPaymentMethod() invocation', async function() {
      await assertRevert(this.feeRegistry.setPaymentMethod(KEY, paymentMethods.ETH_ONLY, { from: alice }));
    });
  });
});
