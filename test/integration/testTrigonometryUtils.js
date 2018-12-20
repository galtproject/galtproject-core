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

    this.toRadians = function(angle) {
      return angle * (Math.PI / 180);
    };

    this.degreesToCheck = [
      1.2291728239506483,
      104.51007032766938,
      1.2037726398557425,
      104.50989866629243,
      1.2036009784787893,
      104.53199403360486
    ];
  });

  describe('#getSinOfRad()', () => {
    it('should correctly get sin', async function() {
      await pIteration.forEachSeries(this.degreesToCheck, async angle => {
        const radians = this.toRadians(angle);
        const res = await this.mockTrigonometryUtils.getSinOfRad(Web3.utils.toWei(radians.toString(), 'ether'));
        const sinResult = res.logs[0].args.result.toFixed() / 10 ** 18;
        assert.isBelow(Math.abs(sinResult - Math.sin(radians)), 0.000000000001);
      });
    });
  });

  describe('#getSinOfDegree()', () => {
    it('should correctly get sin', async function() {
      await pIteration.forEachSeries(this.degreesToCheck, async angle => {
        const res = await this.mockTrigonometryUtils.getSinOfDegree(Web3.utils.toWei(angle.toString(), 'ether'));
        const sinResult = res.logs[0].args.result.toFixed() / 10 ** 18;
        assert.isBelow(Math.abs(sinResult - Math.sin(this.toRadians(angle))), 0.000000000001);
      });
    });
  });
});