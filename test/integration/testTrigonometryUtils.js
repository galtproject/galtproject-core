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
  });

  describe.only('#getSinOfRad()', () => {
    it('should correctly get sin', async function() {
      await pIteration.forEachSeries([13, 37, 76, 90, 93, 108, 137, 180, 189], async angle => {
        const radians = this.toRadians(angle);
        const res = await this.mockTrigonometryUtils.getSinOfRad(Web3.utils.toWei(radians.toString(), 'ether'));

        console.log(`      Sin of ${angle}:`);
        console.log(`      JavaScript:`, Math.sin(radians));
        // console.log(`      mySin:`, mySin(radians));
        console.log(`      Solidity:  `, res.logs[0].args.result.toFixed() / 10 ** 18);
        console.log(``);
        console.log(`gasUsed: ${res.receipt.gasUsed}`);
      });

      assert.equal(true, false);
      // assert.isBelow(Math.abs(res.logs[0].args.result.toFixed() - this.sinNumber(76)), 50);
    });
  });
});

function mySin(x) {
  const tp = 1 / (2 * Math.PI);
  x *= tp;
  x -= 0.25 + Math.floor(x + 0.25);
  x *= 16 * (Math.abs(x) - 0.5);
  // #if EXTRA_PRECISION
  x += 0.225 * x * (Math.abs(x) - 1);
  // #endif
  return x;
}
