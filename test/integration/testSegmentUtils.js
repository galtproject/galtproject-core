const MockSegmentUtils = artifacts.require('./mocks/MockSegmentUtils.sol');

const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, initHelperArtifacts, ether, getSegmentUtilsLib, clearLibCache } = require('../helpers');

const web3 = new Web3(MockSegmentUtils.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SegmentUtils', ([coreTeam]) => {
  before(clearLibCache);
  beforeEach(async function() {
    this.segmentUtils = await getSegmentUtilsLib();
    MockSegmentUtils.link('SegmentUtils', this.segmentUtils.address);

    this.mockSegmentUtils = await MockSegmentUtils.new({ from: coreTeam });
  });

  describe('#segmentsIntersect()', () => {
    it('should correctly detect segmentsIntersect', async function() {
      // let number = 1;

      // Helpers
      this.segmentsIntersect = async function(segment1, segment2, expectedResult) {
        // console.log('      segmentsIntersect number', number);

        const res = await this.mockSegmentUtils.segmentsIntersect(segment1, segment2, {
          from: coreTeam
        });
        assert.equal(res.logs[0].args.result, expectedResult);
        // number += 1;
      };
      // Helpers end

      const intersectSegments = [[[2, 2], [2, -2]], [[-1, 1], [3, 1]]];
      const notIntersectSegments = [[[-1, 1], [-1, -1]], [[1, 1], [1, -1]]];

      await this.segmentsIntersect(intersectSegments[0], intersectSegments[1], true);

      await this.segmentsIntersect(notIntersectSegments[0], notIntersectSegments[1], false);
    });
  });

  describe('#findSegmentsIntersection()', () => {
    it('should correctly detect findSegmentsIntersection', async function() {
      // let number = 1;

      // Helpers
      this.findSegmentsIntersection = async function(segment1, segment2, expectedResult) {
        // console.log('      findSegmentsIntersection number', number);

        const res = await this.mockSegmentUtils.findSegmentsIntersection(segment1, segment2, {
          from: coreTeam
        });
        assert.deepEqual(res.logs[0].args.result.map(a => a.toString(10)), expectedResult.map(a => a.toString(10)));
        // number += 1;
      };
      // Helpers end

      const intersectSegments = [[[2, 2], [2, -2]], [[-1, 1], [3, 1]]];
      const notIntersectSegments = [[[-1, 1], [-1, -1]], [[1, 1], [1, -1]]];

      await this.findSegmentsIntersection(intersectSegments[0], intersectSegments[1], [2, 1]);

      await this.findSegmentsIntersection(notIntersectSegments[0], notIntersectSegments[1], [0, 0]);
    });
  });

  describe('#compareSegments', () => {
    it('should correctly detect compareSegments', async function() {
      const segments = [[[-1, 1], [1, -1]], [[-2, -2], [2, 2]]];

      const BEFORE = 0;
      const AFTER = 1;

      // let number = 1;

      // Helpers
      this.compareSegments = async function(segment1, segment2, expectedResult) {
        // console.log('      compareSegments number', number);
        const etherSegment1 = segment1.map(point => point.map(coor => ether(coor)));
        const etherSegment2 = segment2.map(point => point.map(coor => ether(coor)));

        const res = await this.mockSegmentUtils.compareSegments(etherSegment1, etherSegment2, {
          from: coreTeam
        });
        assert.equal(res.logs[0].args.result.toString(10), expectedResult.toString(10));
        // number += 1;
      };
      // Helpers end

      await this.mockSegmentUtils.setSweeplinePosition(BEFORE);
      await this.mockSegmentUtils.setSweeplineX(ether(-1));

      await this.compareSegments(segments[0], segments[1], 1);
      await this.compareSegments(segments[1], segments[0], -1);

      await this.mockSegmentUtils.setSweeplineX(0);

      await this.compareSegments(segments[0], segments[1], 1);
      await this.compareSegments(segments[1], segments[0], -1);

      await this.mockSegmentUtils.setSweeplinePosition(AFTER);

      await this.compareSegments(segments[0], segments[1], -1);
      await this.compareSegments(segments[1], segments[0], 1);

      await this.mockSegmentUtils.setSweeplinePosition(BEFORE);
      await this.mockSegmentUtils.setSweeplineX(ether(1));

      await this.compareSegments(segments[0], segments[1], -1);
      await this.compareSegments(segments[1], segments[0], 1);
    });

    describe('#pointOnSegment', () => {
      it('should correctly detect pointOnSegment', async function() {
        // Helpers
        this.pointOnSegment = async function(point, segment) {
          // console.log('      compareSegments number', number);
          const etherPoint = point.map(coor => ether(coor));
          const etherSegment = segment.map(sPoint => sPoint.map(coor => ether(coor)));

          const result = await this.mockSegmentUtils.pointOnSegment(etherPoint, etherSegment[0], etherSegment[1]);
          return result.logs[0].args.result;
          // number += 1;
        };
        // Helpers end

        assert.equal(
          await this.pointOnSegment(
            [1.214004978082901197, 104.532601700706952753],
            [[1.229172823951, 104.510070327669], [1.203772639856, 104.509898666292]]
          ),
          false
        );

        assert.equal(
          await this.pointOnSegment(
            [1.214004978082901197, 104.532601700706952753],
            [[1.2036009784787893, 104.53199403360486], [1.227113390341401, 104.53336732462049]]
          ),
          true
        );

        assert.equal(
          await this.pointOnSegment(
            // w24qf67z3peh
            [1.200168589130044, 104.51813640072942],
            // w24r42h56n7d                                    w24qfgy56x3f
            [[1.231060596182942388, 104.518523309379816054], [1.207720013335347173, 104.543261658400297163]]
          ),
          false
        );

        // TODO: make it work
        assert.equal(
          await this.pointOnSegment(
            // w24qfsg5mp05
            [1.2132120039314032, 104.52826039865613],
            // w24r42h56n7d                                    w24qfgy56x3f
            [[1.231060596182942388, 104.518523309379816054], [1.207720013335347173, 104.543261658400297163]]
          ),
          false
        );

        // TODO: make it work
        assert.equal(
          await this.pointOnSegment(
            // w24qfmsve4y7
            [1.217695382181004489, 104.519599819276801756],
            // w24r42h56n7d                                    w24qfgy56x3f
            [[1.231060596182942388, 104.518523309379816054], [1.207720013335347173, 104.543261658400297163]]
          ),
          false
        );

        // 20 m
        assert.equal(
          await this.pointOnSegment(
            // w24qgpndpt0z
            [1.225346988067031, 104.5551478676498],
            // w24qgpnehynz                             w24qgpnb8efb
            [[1.2255240138620138, 104.55503789708018], [1.22508161701262, 104.55519346520305]]
          ),
          false
        );
        // 3 m
        assert.equal(
          await this.pointOnSegment(
            // w24qgpndpt0z
            [1.225346988067031, 104.5551478676498],
            // w24qgpndqszh                             w24qgpnb8efb
            [[1.2253880593925714, 104.55511333420873], [1.22508161701262, 104.55519346520305]]
          ),
          false
        );
      });
    });
  });
});
