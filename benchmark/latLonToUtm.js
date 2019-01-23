const LandUtils = artifacts.require('./utils/LandUtils.sol');
const MockLandUtils = artifacts.require('./mocks/MockLandUtils.sol');

const pIteration = require('p-iteration');
const _ = require('lodash');
const Web3 = require('web3');
const { initHelperWeb3 } = require('../test/helpers');

const web3 = new Web3(MockLandUtils.web3.currentProvider);

initHelperWeb3(web3);

module.exports = async function(callback) {
  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];

  const landUtils = await LandUtils.new({ from: coreTeam });
  MockLandUtils.link('LandUtils', landUtils.address);
  const mockLandUtils = await MockLandUtils.new({ from: coreTeam });

  const latLonToCheck = [];

  for (let i = 0; i <= 20; i++) {
    latLonToCheck.push([getRandomInRange(-79.9, 83.9, 10), getRandomInRange(-180, 180, 10)]);
  }
  const gasUsedArr = [];
  await pIteration.forEach(latLonToCheck, async point => {
    const etherPoint = point.map(coor => web3.utils.toWei(coor.toString(), 'ether'));

    const res = await mockLandUtils.latLonToUtm(etherPoint);

    console.log('point', JSON.stringify(point));
    console.log('gasUsed', res.receipt.gasUsed);
    // TODO: add comparsion with galtprojects-utils-js results
    gasUsedArr.push(res.receipt.gasUsed);
  });

  console.log('average gasUsed', _.mean(gasUsedArr));

  callback();

  // Helpers
  function getRandomInRange(from, to, fixed) {
    return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
  }

  // Helpers end
};
