const PointUtils = artifacts.require('./utils/PointUtils.sol');
const MathUtils = artifacts.require('./utils/MathUtils.sol');
const VectorUtils = artifacts.require('./utils/VectorUtils.sol');
const SegmentUtils = artifacts.require('./utils/SegmentUtils.sol');
const TestSegmentUtils = artifacts.require('./test/TestSegmentUtils.sol');

const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3 } = require('../helpers');

const web3 = new Web3(TestSegmentUtils.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SegmentUtils', ([coreTeam]) => {
  beforeEach(async function() {
    this.mathUtils = await MathUtils.new({ from: coreTeam });
    PointUtils.link('MathUtils', this.mathUtils.address);
    VectorUtils.link('MathUtils', this.mathUtils.address);

    this.pointUtils = await PointUtils.new({ from: coreTeam });
    // VectorUtils.link('PointUtils', this.pointUtils.address);

    this.vectorUtils = await VectorUtils.new({ from: coreTeam });
    SegmentUtils.link('VectorUtils', this.vectorUtils.address);
    SegmentUtils.link('MathUtils', this.mathUtils.address);

    this.segmentUtils = await SegmentUtils.new({ from: coreTeam });
    TestSegmentUtils.link('SegmentUtils', this.segmentUtils.address);

    this.testSegmentUtils = await TestSegmentUtils.new({ from: coreTeam });
  });

  describe('#segmentsIntersect()', () => {
    it.only('should correctly detect segmentsIntersect', async function() {
      let res = await this.testSegmentUtils.segmentsIntersect([[2, 2], [2, -2]], [[-1, 1], [3, 1]], {
        from: coreTeam
      });
      assert.equal(res.logs[0].args.result, true);

      res = await this.testSegmentUtils.segmentsIntersect([[-1, 1], [-1, -1]], [[1, 1], [1, -1]], {
        from: coreTeam
      });
      assert.equal(res.logs[0].args.result, false);
    });

    it.only('should correctly detect findSegmentsIntersection', async function() {
      let res = await this.testSegmentUtils.findSegmentsIntersection([[2, 2], [2, -2]], [[-1, 1], [3, 1]], {
        from: coreTeam
      });
      assert.deepEqual(res.logs[0].args.result.map(a => a.toString(10)), ['2', '1']);

      res = await this.testSegmentUtils.findSegmentsIntersection([[-1, 1], [-1, -1]], [[1, 1], [1, -1]], {
        from: coreTeam
      });
      assert.deepEqual(res.logs[0].args.result.map(a => a.toString(10)), ['-1', '-1']);
    });
  });
});
