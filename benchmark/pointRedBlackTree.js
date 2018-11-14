const PointUtils = artifacts.require('./utils/PointUtils.sol');
const PointRedBlackTree = artifacts.require('./collections/PointRedBlackTree.sol');
const MockPointRedBlackTree = artifacts.require('./mocks/MockPointRedBlackTree.sol');

const pIteration = require('p-iteration');
const Web3 = require('web3');
const { initHelperWeb3, ether } = require('../test/helpers');

const web3 = new Web3(MockPointRedBlackTree.web3.currentProvider);

initHelperWeb3(web3);

module.exports = async function(callback) {
  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];

  const pointUtils = await PointUtils.new({ from: coreTeam });
  const pointRedBlackTree = await PointRedBlackTree.new({ from: coreTeam });
  MockPointRedBlackTree.link('PointRedBlackTree', pointRedBlackTree.address);
  MockPointRedBlackTree.link('PointUtils', pointUtils.address);

  const mockPointRedBlackTree = await MockPointRedBlackTree.new({ from: coreTeam });

  const mockPointRedBlackTreeWeb3 = new web3.eth.Contract(mockPointRedBlackTree.abi, mockPointRedBlackTree.address);

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

  const etherPoints = points.map(point => point.map(coor => ether(coor)));

  await comparePoints([10, 0], [0, 0], 1);
  await comparePoints([2, -1], [0, 0], 1);
  await comparePoints([2, -1], [10, 0], -1);
  await comparePoints([5, 5], [2, -1], 1);
  await comparePoints([5, 5], [10, 0], -1);
  await comparePoints([5, 0], [2, -1], 1);
  await comparePoints([5, 0], [10, 0], -1);
  await comparePoints([5, 0], [5, 5], -1);
  await comparePoints([5, 10], [2, -1], 1);
  await comparePoints([5, 10], [5, 5], 1);
  await comparePoints([5, 10], [10, 0], -1);
  await comparePoints([1, 1], [5, 5], -1);
  await comparePoints([1, 1], [2, -1], -1);
  await comparePoints([1, 1], [0, 0], 1);
  await comparePoints([3, 7], [5, 5], -1);
  await comparePoints([3, 7], [2, -1], 1);
  await comparePoints([3, 7], [5, 0], -1);

  let number = 1;
  let totalInsertGasUsed = 0;
  let totalFindGasUsed = 0;

  await pIteration.forEachSeries(etherPoints, async point => {
    await insert(point);
  });

  await pIteration.forEachSeries(etherPoints, async point => {
    await find(point);
  });

  console.log('');
  console.log(`      Total gasUsed for ${number} insert()`, totalInsertGasUsed);
  console.log(`      Total gasUsed for ${number} find()`, totalFindGasUsed);

  const resultRootId = await mockPointRedBlackTreeWeb3.methods.getRoot().call();
  const resultRootItem = await mockPointRedBlackTreeWeb3.methods.getItem(resultRootId).call();

  await checkRightAndLeft(resultRootItem);

  callback();

  // Helpers
  async function comparePoints(point1, point2) {
    console.log('      comparePoints', point1, point2);
    const res = await mockPointRedBlackTree.comparePoints(point1.map(c => ether(c)), point2.map(c => ether(c)), {
      from: coreTeam
    });
    console.log('      gasUsed', res.receipt.gasUsed);
  }

  function getPointId(point) {
    return `1${Math.abs(web3.utils.fromWei(point[0], 'ether')).toString()}1${Math.abs(
      web3.utils.fromWei(point[1], 'ether')
    ).toString()}`;
  }

  async function insert(point) {
    console.log('      PointRedBlackTree.insert() number', number);
    const id = getPointId(point);
    const res = await mockPointRedBlackTree.insert(id, point, {
      from: coreTeam
    });
    console.log('      gasUsed', res.receipt.gasUsed);
    totalInsertGasUsed += res.receipt.gasUsed;
    number += 1;
  }

  async function find(point) {
    console.log('      PointRedBlackTree.find() on number of points:', number - 1);
    const res = await mockPointRedBlackTree.find(point, {
      from: coreTeam
    });
    console.log('      gasUsed', res.receipt.gasUsed);
    totalFindGasUsed += res.receipt.gasUsed;
  }

  async function checkRightAndLeft(item) {
    if (parseInt(item.left, 10)) {
      const leftItem = await mockPointRedBlackTreeWeb3.methods.getItem(item.left).call();
      await checkRightAndLeft(leftItem);
    }
    if (parseInt(item.right, 10)) {
      const rightItem = await mockPointRedBlackTreeWeb3.methods.getItem(item.right).call();
      await checkRightAndLeft(rightItem);
    }
  }
  // Helpers end
};
