const TrigonometryUtils = artifacts.require('./utils/TrigonometryUtils.sol');
const MockTrigonometryUtils = artifacts.require('./mocks/MockTrigonometryUtils.sol');

const pIteration = require('p-iteration');
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
      return Math.round(2147483647 * Math.sin(this.toRadians(angle)));
    };
  });

  describe('#getSin()', () => {
    it('should correctly get sin', async function() {
      const res = await this.mockTrigonometryUtils.getSin(this.degreeToParam(76, 32));
      console.log(res.logs[0].args.result.toFixed(), this.sinNumber(76));

      assert.isBelow(Math.abs(res.logs[0].args.result.toFixed() - this.sinNumber(76)), 10000);
    });
  });

  describe.skip('#getSinOfEther()', () => {
    it('should correctly get sin of ether', async function() {
      const res = await this.mockTrigonometryUtils.getSinOfEther(Web3.utils.toWei('76', 'ether'));

      console.log(this.degreeToParam(76, 16), res.logs[0].args.result.toFixed());

      assert.isBelow(Math.abs(res.logs[0].args.result.toFixed() - this.sinNumber(76)), 10000);
    });
  });

  describe('#getTrueSinOfEther()', () => {
    it('should correctly get sin', async function() {
      await pIteration.forEachSeries([13, 37, 76, 90, 93, 108, 137, 180, 189], async angle => {
        const res = await this.mockTrigonometryUtils.getTrueSinOfEther(Web3.utils.toWei(angle.toString(), 'ether'));

        console.log(`      Sin of ${angle}:`);
        console.log(`      JavaScript:`, (Math.sin((angle * Math.PI) / 180) * 10 ** 18).toFixed());
        console.log(`      Solidity:  `, res.logs[0].args.result.toFixed());
        console.log(``);
      });

      assert.equal(true, false);
      // assert.isBelow(Math.abs(res.logs[0].args.result.toFixed() - this.sinNumber(76)), 50);
    });
  });
});
