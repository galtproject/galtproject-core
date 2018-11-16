const PointRedBlackTree = artifacts.require('../contracts/collections/PointRedBlackTree.sol');
const SegmentRedBlackTree = artifacts.require('../contracts/collections/SegmentRedBlackTree.sol');
const BentleyOttman = artifacts.require('../contracts/utils/BentleyOttman.sol');
const MockBentleyOttman = artifacts.require('../contracts/mocks/MockBentleyOttman.sol');

const pIteration = require('p-iteration');
const Web3 = require('web3');

const web3 = new Web3(MockBentleyOttman.web3.currentProvider);

const { initHelperWeb3, ether } = require('../test/helpers');

initHelperWeb3(web3);

module.exports = async function(callback) {
  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];

  const pointRedBlackTree = await PointRedBlackTree.new({ from: coreTeam });
  BentleyOttman.link('PointRedBlackTree', pointRedBlackTree.address);

  const segmentRedBlackTree = await SegmentRedBlackTree.new({ from: coreTeam });
  BentleyOttman.link('SegmentRedBlackTree', segmentRedBlackTree.address);

  const bentleyOttman = await BentleyOttman.new({ from: coreTeam });
  MockBentleyOttman.link('BentleyOttman', bentleyOttman.address);

  let mockBentleyOttman = await MockBentleyOttman.new({ from: coreTeam });
  let mockBentleyOttmanWeb3 = new web3.eth.Contract(mockBentleyOttman.abi, mockBentleyOttman.address);

  await setSegmentsAndHandleQueuePoints([
    [[37.484750007973105, 55.752246954910646], [37.58202906030469, 55.77921141925473]],
    [[37.61120188739855, 55.73959974028182], [37.797988512759424, 55.747811024975036]],
    [[37.74709936516053, 55.7495343170777], [37.53610865112482, 55.71211068549921]],
    [[37.625201497695514, 55.71944373035385], [37.7595083872098, 55.747766806262256]],
    [[37.68599959332016, 55.782359403768204], [37.49501443612691, 55.72772231919566]]
  ]);

  await redeploy();

  await setSegmentsAndHandleQueuePoints([
    [[37.76969192083046, 55.76677008516301], [37.63181731019415, 55.751938326388974]],
    [[37.441016373071996, 55.78557135451422], [37.608522492722216, 55.73105542625078]],
    [[37.652041463641424, 55.73987541904628], [37.68218877423553, 55.76885334957768]],
    [[37.68831757976256, 55.75111211248927], [37.679768066345304, 55.76043505829761]],
    [[37.63480194752325, 55.723303783416455], [37.5096053342284, 55.729045212762685]],
    [[37.566044579959325, 55.7377918616373], [37.516416549790414, 55.79247372710407]],
    [[37.53609668783335, 55.74886598399479], [37.53457057953605, 55.71145403212967]],
    [[37.60169673277886, 55.74330451873227], [37.67315110221475, 55.721233976712554]]
  ]);

  await redeploy();

  await setSegmentsAndHandleQueuePoints([
    [[1.2036009784787893, 104.53199403360486], [1.227113390341401, 104.53336732462049]],
    [[1.227113390341401, 104.53336732462049], [1.2291728239506483, 104.51007032766938]],
    [[1.2314039189368486, 104.52323930338025], [1.2152714375406504, 104.52255265787244]],
    [[1.2152714375406504, 104.52255265787244], [1.2126970198005438, 104.54298002645373]]
  ]);

  await redeploy();

  await setSegmentsAndHandleQueuePoints([
    [[1.2291728239506483, 104.51007032766938], [1.2037726398557425, 104.50989866629243]],
    [[1.2037726398557425, 104.50989866629243], [1.2036009784787893, 104.53199403360486]],
    [[1.2036009784787893, 104.53199403360486], [1.227113390341401, 104.53336732462049]],
    [[1.227113390341401, 104.53336732462049], [1.2291728239506483, 104.51007032766938]],
    [[1.2314039189368486, 104.52323930338025], [1.2152714375406504, 104.52255265787244]],
    [[1.2152714375406504, 104.52255265787244], [1.2126970198005438, 104.54298002645373]],
    [[1.2126970198005438, 104.54298002645373], [1.2344931531697512, 104.54898850992322]],
    [[1.2344931531697512, 104.54898850992322], [1.2314039189368486, 104.52323930338025]]
  ]);

  callback();

  // Helpers
  async function handleQueuePoints() {
    const isOver = await mockBentleyOttmanWeb3.methods.isQueuePointsOver().call();
    if (isOver) {
      return 0;
    }
    const res = await mockBentleyOttman.handleQueuePoints();
    console.log('      handleQueuePoints tx gasUsed', res.receipt.gasUsed);

    return res.receipt.gasUsed + (await handleQueuePoints());
  }
  async function setSegmentsAndHandleQueuePoints(segments) {
    console.log(`      Segments count: ${segments.length}\n`);
    const etherSegments = segments.map(segment =>
      segment.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)))
    );

    let totalAddSegmentGasUsed = 0;
    await pIteration.forEachSeries(etherSegments, async segment => {
      const res = await mockBentleyOttman.addSegment(segment);
      console.log('      addSegment tx gasUsed', res.receipt.gasUsed);
      totalAddSegmentGasUsed += res.receipt.gasUsed;
    });

    const handleQueueTotalGasUsed = await handleQueuePoints();
    console.log('');
    console.log('      addSegment total gasUsed', totalAddSegmentGasUsed);
    console.log('      handleQueuePoints total gasUsed', handleQueueTotalGasUsed);
  }

  async function redeploy() {
    mockBentleyOttman = await MockBentleyOttman.new({ from: coreTeam });
    mockBentleyOttmanWeb3 = new web3.eth.Contract(mockBentleyOttman.abi, mockBentleyOttman.address);
  }
  // Helpers end
};
