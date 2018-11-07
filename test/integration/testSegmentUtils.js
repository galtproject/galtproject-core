const PointUtils = artifacts.require('./utils/PointUtils.sol');
const MathUtils = artifacts.require('./utils/MathUtils.sol');
const VectorUtils = artifacts.require('./utils/VectorUtils.sol');
const SegmentUtils = artifacts.require('./utils/SegmentUtils.sol');
const TestSegmentUtils = artifacts.require('./test/TestSegmentUtils.sol');

const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, ether } = require('../helpers');

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
    it('should correctly detect segmentsIntersect', async function() {
      const intersectSegments = [[[2, 2], [2, -2]], [[-1, 1], [3, 1]]];
      const notIntersectSegments = [[[-1, 1], [-1, -1]], [[1, 1], [1, -1]]];

      let number = 1;

      this.segmentsIntersect = async function(segment1, segment2, expectedResult) {
        console.log('      segmentsIntersect number', number);

        const res = await this.testSegmentUtils.segmentsIntersect(segment1, segment2, {
          from: coreTeam
        });
        assert.equal(res.logs[0].args.result, expectedResult);
        console.log('      gasUsed', res.receipt.gasUsed);

        number += 1;
      };

      await this.segmentsIntersect(intersectSegments[0], intersectSegments[1], true);

      await this.segmentsIntersect(notIntersectSegments[0], notIntersectSegments[1], false);
    });
  });

  describe('#findSegmentsIntersection()', () => {
    it('should correctly detect findSegmentsIntersection', async function() {
      const intersectSegments = [[[2, 2], [2, -2]], [[-1, 1], [3, 1]]];
      const notIntersectSegments = [[[-1, 1], [-1, -1]], [[1, 1], [1, -1]]];

      let number = 1;

      this.findSegmentsIntersection = async function(segment1, segment2, expectedResult) {
        console.log('      findSegmentsIntersection number', number);

        const res = await this.testSegmentUtils.findSegmentsIntersection(segment1, segment2, {
          from: coreTeam
        });
        assert.deepEqual(res.logs[0].args.result.map(a => a.toString(10)), expectedResult.map(a => a.toString(10)));
        console.log('      gasUsed', res.receipt.gasUsed);

        number += 1;
      };

      await this.findSegmentsIntersection(intersectSegments[0], intersectSegments[1], [2, 1]);

      await this.findSegmentsIntersection(notIntersectSegments[0], notIntersectSegments[1], [-1, -1]);
    });
  });

  describe('#compareSegments', () => {
    it('should correctly detect compareSegments', async function() {
      const segments = [[[-1, 1], [1, -1]], [[-2, -2], [2, 2]]];

      const BEFORE = 0;
      const AFTER = 1;

      let number = 1;

      this.compareSegments = async function(segment1, segment2, expectedResult) {
        console.log('      compareSegments number', number);

        const etherSegment1 = segment1.map(point => point.map(coor => ether(coor)));
        const etherSegment2 = segment2.map(point => point.map(coor => ether(coor)));

        const res = await this.testSegmentUtils.compareSegments(etherSegment1, etherSegment2, {
          from: coreTeam
        });
        assert.equal(res.logs[0].args.result.toString(10), expectedResult.toString(10));
        console.log('      gasUsed', res.receipt.gasUsed);

        number += 1;
      };

      await this.testSegmentUtils.setSweeplinePosition(BEFORE);
      await this.testSegmentUtils.setSweeplineX(ether(-1));

      await this.compareSegments(segments[0], segments[1], 1);
      await this.compareSegments(segments[1], segments[0], -1);

      await this.testSegmentUtils.setSweeplineX(0);

      await this.compareSegments(segments[0], segments[1], 1);
      await this.compareSegments(segments[1], segments[0], -1);

      await this.testSegmentUtils.setSweeplinePosition(AFTER);

      await this.compareSegments(segments[0], segments[1], -1);
      await this.compareSegments(segments[1], segments[0], 1);

      await this.testSegmentUtils.setSweeplinePosition(BEFORE);
      await this.testSegmentUtils.setSweeplineX(ether(1));

      await this.compareSegments(segments[0], segments[1], -1);
      await this.compareSegments(segments[1], segments[0], 1);
    });
  });
});
