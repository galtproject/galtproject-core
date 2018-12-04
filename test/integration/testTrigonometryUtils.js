const TrigonometryUtils = artifacts.require('./utils/TrigonometryUtils.sol');
const MockTrigonometryUtils = artifacts.require('./mocks/MockTrigonometryUtils.sol');

const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3 } = require('../helpers');

const web3 = new Web3(MockTrigonometryUtils.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('TrigonometryUtils', ([coreTeam]) => {
  beforeEach(async function() {
    this.trigonometryUtils = await TrigonometryUtils.new({ from: coreTeam });
    MockTrigonometryUtils.link('TrigonometryUtils', this.trigonometryUtils.address);
    this.mockTrigonometryUtils = await MockTrigonometryUtils.new({ from: coreTeam });

    this.degreeToParam = function(degrees, numberOfBits) {
      /* eslint-disable */
      const anglesPerCycle = 1 << (numberOfBits - 2);
      /* eslint-enable */
      return parseInt((degrees * anglesPerCycle) / 360.0, 10).toString();
    };

    this.toRadians = function(angle) {
      return angle * (Math.PI / 180);
    };

    this.sinNumber = function(angle) {
      return Math.round(32767 * Math.sin(this.toRadians(angle)));
    };
  });

  describe.only('#getSin()', () => {
    it('should correctly get sin', async function() {
      const res = await this.mockTrigonometryUtils.getSin(this.degreeToParam(76, 16));

      assert.isBelow(Math.abs(res.logs[0].args.result.toFixed() - this.sinNumber(76)), 50);
    });
  });
});
