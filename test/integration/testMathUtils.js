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

  describe.only('#sqrtInt()', () => {
    it('should correctly get sqrt', async function() {
      const input = 100456;
      const res = await this.mockMathUtils.sqrtInt(Web3.utils.toWei(input.toString(), 'ether'));
      const sqrtRes = parseInt(res.logs[0].args.result.toString(10), 10) / 10 ** 18;

      assert.isBelow(Math.abs(sqrtRes - Math.sqrt(input)), 0.000000001);
    });
  });
});
