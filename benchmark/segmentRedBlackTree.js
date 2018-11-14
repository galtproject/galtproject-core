const SegmentRedBlackTree = artifacts.require('../contracts/collections/SegmentRedBlackTree.sol');
const MockSegmentRedBlackTree = artifacts.require('../contracts/mocks/MockSegmentRedBlackTree.sol');
const SegmentUtils = artifacts.require('../contracts/utils/SegmentUtils.sol');

const _ = require('lodash');
const pIteration = require('p-iteration');
const Web3 = require('web3');
const { initHelperWeb3, ether } = require('../test/helpers');

const web3 = new Web3(MockSegmentRedBlackTree.web3.currentProvider);

initHelperWeb3(web3);

module.exports = async function(callback) {
  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];

  const segmentUtils = await SegmentUtils.new({ from: coreTeam });
  SegmentRedBlackTree.link('SegmentUtils', segmentUtils.address);

  const segmentRedBlackTree = await SegmentRedBlackTree.new({ from: coreTeam });
  MockSegmentRedBlackTree.link('SegmentRedBlackTree', segmentRedBlackTree.address);

  const mockSegmentRedBlackTree = await MockSegmentRedBlackTree.new({ from: coreTeam });

  const points = [
    [200, 12],
    [612, 401],
    [375, 486],
    [581, 21],
    [680, 25],
    [106, 414],
    [135, 478],
    [333, 51],
    [120, 74],
    [590, 473]
  ];

  const segments = [];
  points.forEach((d, i) => {
    if (i % 2) segments.push(_.sortBy([d, points[i - 1]], 'y'));
  });
  const etherSegments = segments.map(segment => segment.map(point => point.map(coor => ether(coor))));

  let number = 1;
  let totalGasUsed = 0;

  await pIteration.forEachSeries(etherSegments, async segment => {
    await insert(segment);
  });

  await pIteration.forEachSeries(etherSegments, async segment => {
    await find(segment);
  });

  console.log('');
  console.log('      Total gasUsed', totalGasUsed);
  callback();

  // Helpers
  function getSegmentId(segment) {
    return segment
      .map(point => point.map(coor => Math.abs(web3.utils.fromWei(coor, 'ether')).toString()).join(''))
      .join('');
  }

  async function insert(segment) {
    console.log('      SegmentRedBlackTree.insert() number', number);
    const id = getSegmentId(segment);
    const res = await mockSegmentRedBlackTree.insert(id, segment, {
      from: coreTeam
    });
    console.log('      gasUsed', res.receipt.gasUsed);

    totalGasUsed += res.receipt.gasUsed;
    number += 1;
  }

  async function find(point) {
    console.log('      SegmentRedBlackTree.find() on number of segments:', number - 1);
    const res = await mockSegmentRedBlackTree.find(point, {
      from: coreTeam
    });
    console.log('      gasUsed', res.receipt.gasUsed);

    totalGasUsed += res.receipt.gasUsed;
  }
  // Helpers end
};
