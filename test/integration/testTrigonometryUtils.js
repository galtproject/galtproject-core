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
      1.2037726398557425,
      1.2036009784787893,
      104.51007032766938,
      104.50989866629243,
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

  describe.only('#atan()', () => {
    it('should correctly get atan', async function() {
      await pIteration.forEachSeries(this.degreesToCheck, async angle => {
        const radians = this.toRadians(angle);
        const res = await this.mockTrigonometryUtils.atan(Web3.utils.toWei(radians.toString(), 'ether'));
        const sinResult = res.logs[0].args.result.toFixed() / 10 ** 18;
        console.log(radians);
        console.log(sinResult, my_atan(radians), taylor_atan(radians), Math.atan(radians));
        assert.isBelow(Math.abs(sinResult - Math.atan(radians)), 0.0000000001);
      });
    });
  });
});

function my_atan(x) {
  const n = 50;
  let a = 0.0; // 1st term
  let sum = 0.0;

  // special cases
  if (x === 1.0) return Math.PI / 4.0;
  if (x === -1.0) return -Math.PI / 4.0;

  if (n > 0) {
    if (x < -1.0 || x > 1.0) {
      // constant term
      if (x > 1.0) {
        sum = Math.PI / 2.0;
        console.log('x > 1.0', sum);
      } else {
        sum = -Math.PI / 2.0;
      }
      // initial value of a
      a = -1.0 / x;
      for (let j = 1; j <= n; j++) {
        sum += a;
        a *= (-1.0 * (2.0 * j - 1)) / ((2.0 * j + 1) * x * x); // next term from last
        console.log('a', a);
      }
    } // -1 < x < 1
    else {
      // constant term
      sum = 0.0;
      // initial value of a
      a = x;
      for (let j = 1; j <= n; j++) {
        sum += a;
        a *= (-1.0 * (2.0 * j - 1) * x * x) / (2.0 * j + 1); // next term from last
      }
    }
  }

  return sum;
}


function taylor_atan(x) {
  let tSeries = 0;
  let t1, t2;
    for (let n = 0; n <= 50; n++) {
        t1 = (Math.pow(x, 2 * n + 1)) * Math.pow(-1, n);
        t2 = t1 / (2 * n + 1);
        tSeries += t2;
    }
    return tSeries;
}
