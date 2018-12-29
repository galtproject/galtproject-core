const PolygonUtils = artifacts.require('./utils/PolygonUtils.sol');
const LandUtils = artifacts.require('./utils/LandUtils.sol');
const TrigonometryUtils = artifacts.require('./utils/TrigonometryUtils.sol');
const MockPolygonUtils = artifacts.require('./mocks/MockPolygonUtils.sol');

const pIteration = require('p-iteration');
const Web3 = require('web3');
const { initHelperWeb3, ether } = require('../test/helpers');

const web3 = new Web3(MockPolygonUtils.web3.currentProvider);

initHelperWeb3(web3);

module.exports = async function(callback) {
  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];

  const trigonometryUtils = await TrigonometryUtils.new({ from: coreTeam });
  PolygonUtils.link('TrigonometryUtils', trigonometryUtils.address);
  const landUtils = await LandUtils.new({ from: coreTeam });
  PolygonUtils.link('LandUtils', landUtils.address);
  const polygonUtils = await PolygonUtils.new({ from: coreTeam });
  MockPolygonUtils.link('PolygonUtils', polygonUtils.address);
  const mockPolygonUtils = await MockPolygonUtils.new({ from: coreTeam });

  await getArea([
    [1.2291728239506483, 104.51007032766938],
    [1.2037726398557425, 104.50989866629243],
    [1.2036009784787893, 104.53199403360486],
    [1.227113390341401, 104.53336732462049]
  ]);

  callback();

  // Helpers
  async function getArea(contour) {
    const etherContour = contour.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));
    await pIteration.forEachSeries(etherContour, async point => {
      await mockPolygonUtils.addPoint(point);
    });

    const res = await mockPolygonUtils.getArea();
    console.log(`      gasUsed for ${contour.length} contour`, res.receipt.gasUsed);
  }
  // Helpers end
};
