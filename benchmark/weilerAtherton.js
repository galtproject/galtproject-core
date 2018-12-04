const MockWeilerAtherton = artifacts.require('../contracts/mocks/MockWeilerAtherton.sol');

const pIteration = require('p-iteration');
const Web3 = require('web3');

const web3 = new Web3(MockWeilerAtherton.web3.currentProvider);

const { initHelperWeb3, initHelperArtifacts, ether, getWeilerAthertonLib, clearLibCache } = require('../test/helpers');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

module.exports = async function(callback) {
  clearLibCache();

  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];

  const weilerAtherton = await getWeilerAthertonLib();
  MockWeilerAtherton.link('WeilerAtherton', weilerAtherton.address);

  let mockWeilerAtherton = await MockWeilerAtherton.new({ from: coreTeam });
  let mockWeilerAthertonWeb3 = new web3.eth.Contract(mockWeilerAtherton.abi, mockWeilerAtherton.address);

  await setSubjectPolygon([
    [1.2291728239506483, 104.51007032766938],
    [1.2037726398557425, 104.50989866629243],
    [1.2036009784787893, 104.53199403360486],
    [1.227113390341401, 104.53336732462049]
  ]);

  await setClippingPolygon([
    [1.2314039189368486, 104.52323930338025],
    [1.2152714375406504, 104.52255265787244],
    [1.2126970198005438, 104.54298002645373],
    [1.2344931531697512, 104.54898850992322]
  ]);

  await executeWeilerAtherton();

  await redeploy();

  callback();

  // Helpers
  async function setSubjectPolygon(points) {
    const etherPoints = points.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));
    await pIteration.forEachSeries(etherPoints, async point => {
      await mockWeilerAtherton.addPointToSubjectPolygon(point);
    });
  }

  async function setClippingPolygon(points) {
    const etherPoints = points.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));
    await pIteration.forEachSeries(etherPoints, async point => {
      await mockWeilerAtherton.addPointToClippingPolygon(point);
    });
  }

  async function executeWeilerAtherton() {
    let totalGasUsed = 0;
    let res = await mockWeilerAtherton.initSubjectPolygon();
    console.log('      initSubjectPolygon gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;

    res = await mockWeilerAtherton.initClippingPolygon();
    console.log('      initClippingPolygon gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;

    res = await mockWeilerAtherton.addSubjectPolygonSegments();
    console.log('      addSubjectPolygonSegments gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;

    res = await mockWeilerAtherton.addClippingPolygonSegments();
    console.log('      addClippingPolygonSegments gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;

    totalGasUsed += await processMartinezRueda();

    res = await mockWeilerAtherton.addIntersectedPoints();
    console.log('      addIntersectedPoints gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;
    res = await mockWeilerAtherton.buildResultPolygon();
    console.log('      buildResultPolygon gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;
    res = await mockWeilerAtherton.buildSubjectPolygonOutput();
    console.log('      buildSubjectPolygonOutput gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;
    console.log('');
    console.log('      totalGasUsed', totalGasUsed);
  }

  async function processMartinezRueda() {
    const isOver = await mockWeilerAthertonWeb3.methods.isMartinezRuedaFinished().call();
    if (isOver) {
      return 0;
    }
    const res = await mockWeilerAtherton.processMartinezRueda();
    console.log('      processMartinezRueda tx gasUsed', res.receipt.gasUsed);

    return res.receipt.gasUsed + (await processMartinezRueda());
  }

  async function redeploy() {
    mockWeilerAtherton = await MockWeilerAtherton.new({ from: coreTeam });
    mockWeilerAthertonWeb3 = new web3.eth.Contract(mockWeilerAtherton.abi, mockWeilerAtherton.address);
  }

  // Helpers end
};
