const TestSegmentUtils = artifacts.require('./test/TestSegmentUtils.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
// const { assertRevert } = require('../helpers');

// const web3 = new Web3(TestSegmentUtils.web3.currentProvider);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SegmentUtils', ([coreTeam]) => {
  beforeEach(async function() {
    this.testSegmentUtils = await TestSegmentUtils.new({ from: coreTeam });
  });

  describe('#segmentsIntersect()', () => {
    it.only('should correctly detect segmentsIntersect', async function() {
      let res = await this.testSegmentUtils.segmentsIntersect([[-2,-2], [2,2]], [[-1,1], [3,1]], { from: coreTeam });
      // assert.equal(res, alice);
    });
  });
});
