const PointUtils = artifacts.require('./utils/PointUtils.sol');
const MathUtils = artifacts.require('./utils/MathUtils.sol');
const VectorUtils = artifacts.require('./utils/VectorUtils.sol');
const SegmentUtils = artifacts.require('./utils/SegmentUtils.sol');
const MockSegmentUtils = artifacts.require('./mocks/MockSegmentUtils.sol');

const Web3 = require('web3');
const { initHelperWeb3, ether } = require('../test/helpers');

const web3 = new Web3(MockSegmentUtils.web3.currentProvider);

initHelperWeb3(web3);

module.exports = async function(callback) {
  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];

  const mathUtils = await MathUtils.new({ from: coreTeam });
  PointUtils.link('MathUtils', mathUtils.address);
  VectorUtils.link('MathUtils', mathUtils.address);

  const vectorUtils = await VectorUtils.new({ from: coreTeam });
  SegmentUtils.link('VectorUtils', vectorUtils.address);
  SegmentUtils.link('MathUtils', mathUtils.address);

  const segmentUtils = await SegmentUtils.new({ from: coreTeam });
  MockSegmentUtils.link('SegmentUtils', segmentUtils.address);

  const mockSegmentUtils = await MockSegmentUtils.new({ from: coreTeam });

  let intersectSegments = [[[2, 2], [2, -2]], [[-1, 1], [3, 1]]];
  let notIntersectSegments = [[[-1, 1], [-1, -1]], [[1, 1], [1, -1]]];

  await segmentsIntersect(intersectSegments[0], intersectSegments[1]);

  await segmentsIntersect(notIntersectSegments[0], notIntersectSegments[1]);

  intersectSegments = [[[2, 2], [2, -2]], [[-1, 1], [3, 1]]];
  notIntersectSegments = [[[-1, 1], [-1, -1]], [[1, 1], [1, -1]]];

  await findSegmentsIntersection(intersectSegments[0], intersectSegments[1], [2, 1]);

  await findSegmentsIntersection(notIntersectSegments[0], notIntersectSegments[1], [0, 0]);

  const segments = [[[-1, 1], [1, -1]], [[-2, -2], [2, 2]]];

  const BEFORE = 0;
  const AFTER = 1;

  await mockSegmentUtils.setSweeplinePosition(BEFORE);
  await mockSegmentUtils.setSweeplineX(ether(-1));

  await compareSegments(segments[0], segments[1]);
  await compareSegments(segments[1], segments[0]);

  await mockSegmentUtils.setSweeplineX(0);

  await compareSegments(segments[0], segments[1]);
  await compareSegments(segments[1], segments[0]);

  await mockSegmentUtils.setSweeplinePosition(AFTER);

  await compareSegments(segments[0], segments[1]);
  await compareSegments(segments[1], segments[0]);

  await mockSegmentUtils.setSweeplinePosition(BEFORE);
  await mockSegmentUtils.setSweeplineX(ether(1));

  await compareSegments(segments[0], segments[1]);
  await compareSegments(segments[1], segments[0]);

  callback();

  // Helpers
  async function segmentsIntersect(segment1, segment2) {
    console.log('      segmentsIntersect', segment1, segment2);

    const res = await mockSegmentUtils.segmentsIntersect(segment1, segment2, {
      from: coreTeam
    });
    console.log('      gasUsed', res.receipt.gasUsed);
  }

  async function findSegmentsIntersection(segment1, segment2) {
    console.log('      findSegmentsIntersection', segment1, segment2);

    const res = await mockSegmentUtils.findSegmentsIntersection(segment1, segment2, {
      from: coreTeam
    });
    console.log('      gasUsed', res.receipt.gasUsed);
  }

  async function compareSegments(segment1, segment2) {
    console.log('      compareSegments number', segment1, segment2);
    const etherSegment1 = segment1.map(point => point.map(coor => ether(coor)));
    const etherSegment2 = segment2.map(point => point.map(coor => ether(coor)));

    const res = await mockSegmentUtils.compareSegments(etherSegment1, etherSegment2, {
      from: coreTeam
    });
    console.log('      gasUsed', res.receipt.gasUsed);
  }
  // Helpers end
};
