const MathUtils = artifacts.require('./utils/MathUtils.sol');
const MockMathUtils = artifacts.require('./mocks/MockMathUtils.sol');

const pIteration = require('p-iteration');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3 } = require('../helpers');

const web3 = new Web3(MockMathUtils.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('MathUtils', ([coreTeam]) => {
  beforeEach(async function() {
    this.MathUtils = await MathUtils.new({ from: coreTeam });
    MockMathUtils.link('MathUtils', this.MathUtils.address);
    this.mockMathUtils = await MockMathUtils.new({ from: coreTeam });
  });

  describe('#sqrtInt()', () => {
    it('should correctly get sqrt', async function() {
      const input = 100456;
      const res = await this.mockMathUtils.sqrtInt(Web3.utils.toWei(input.toString(), 'ether'));
      const sqrtRes = parseInt(res.logs[0].args.result.toString(10), 10) / 10 ** 18;

      assert.isBelow(Math.abs(sqrtRes - Math.sqrt(input)), 0.000000001);
    });
  });

  describe('#logE()', () => {
    it('should correctly get logE', async function() {
      const input = 1.0033726130081486;
      const res = await this.mockMathUtils.logE(Web3.utils.toWei(input.toString(), 'ether'));
      const logERes = parseInt(res.logs[0].args.result.toString(10), 10) / 10 ** 18;

      assert.isBelow(Math.abs(logERes - Math.log(input)), 0.00000000001);
    });
  });

  describe('#log2()', () => {
    it('should correctly get log2', async function() {
      const input = 1.0033726130081486;
      const res = await this.mockMathUtils.log2(Web3.utils.toWei(input.toString(), 'ether'));
      const log2Res = parseInt(res.logs[0].args.result.toString(10), 10) / 10 ** 18;

      assert.isBelow(Math.abs(log2Res - Math.log2(input)), 0.00000000001);
    });
  });

  describe('#log10()', () => {
    it('should correctly get log10', async function() {
      const input = 1.0033726130081486;
      const res = await this.mockMathUtils.log10(Web3.utils.toWei(input.toString(), 'ether'));
      const log10Res = parseInt(res.logs[0].args.result.toString(10), 10) / 10 ** 18;

      assert.isBelow(Math.abs(log10Res - Math.log10(input)), 0.00000000001);
    });
  });

  describe('#exp()', () => {
    it('should correctly get exp', async function() {
      const input = 1.0033726130081486;
      const res = await this.mockMathUtils.exp(Web3.utils.toWei(input.toString(), 'ether'));
      const sqrtRes = parseInt(res.logs[0].args.result.toString(10), 10) / 10 ** 18;

      assert.isBelow(Math.abs(sqrtRes - Math.exp(input)), 0.000000001);
    });
  });
});
