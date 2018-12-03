const MockMartinezRueda = artifacts.require('../contracts/mocks/MockMartinezRueda.sol');

const pIteration = require('p-iteration');
const Web3 = require('web3');

const web3 = new Web3(MockMartinezRueda.web3.currentProvider);

const {
  initHelperWeb3,
  initHelperArtifacts,
  ether,
  getMartinezRuedaLib,
  clearLibCache,
  getLinkedListLib,
  getSweepQueueLinkedListLib
} = require('../test/helpers');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

module.exports = async function(callback) {
  clearLibCache();

  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];

  const martinezRueda = await getMartinezRuedaLib();

  MockMartinezRueda.link('MartinezRueda', martinezRueda.address);
  MockMartinezRueda.link('LinkedList', (await getLinkedListLib()).address);
  MockMartinezRueda.link('SweepQueueLinkedList', (await getSweepQueueLinkedListLib()).address);

  let mockMartinezRueda = await MockMartinezRueda.new({ from: coreTeam });

  let mockMartinezRuedaWeb3 = new web3.eth.Contract(mockMartinezRueda.abi, mockMartinezRueda.address);

  await setSubjectContour([
    [1.230889102444052694, 104.508869033306837081],
    [1.201198389753699301, 104.507961440831422805],
    [1.200340250506997107, 104.532680679112672805],
    [1.209607785567641256, 104.532165359705686569],
    [1.2108092475682497, 104.518947433680295944],
    [1.221278244629502294, 104.517917465418577194],
    [1.221964722499251363, 104.533367324620485305],
    [1.2300309631973505, 104.534265864640474318]
  ]);

  await setClippingContour([
    [1.194818755611777304, 104.524910990148782728],
    [1.195333572104573248, 104.542420450598001478],
    [1.23137441463768482, 104.540703836828470228],
    [1.232232553884387014, 104.523194376379251478]
  ]);

  await processMartinezRueda();

  await redeploy();

  await setSubjectContour([
    [1.2154430989176035, 104.49491517618299],
    [1.2149281147867441, 104.51156632974744],
    [1.2056605797261, 104.51156632974744],
    [1.2044591177254915, 104.51946275308728],
    [1.1963928770273924, 104.51946275308728],
    [1.1957063991576433, 104.49680345132947]
  ]);

  await setClippingContour([
    [1.2065324652940035, 104.5116032101214],
    [1.1951483320444822, 104.51125787571073],
    [1.1958123464137316, 104.52563183382154],
    [1.206624498590827, 104.52494518831372]
  ]);

  await processMartinezRueda();

  await redeploy();

  await setSubjectContour([
    [1.2303741183131933, 104.50938368216157],
    [1.2290011625736952, 104.53134862706065],
    [1.2077200133353472, 104.53096406534314],
    [1.2051455955952406, 104.50950605794787]
  ]);

  await setClippingContour([
    [1.2221363838762045, 104.51723115518689],
    [1.2334633525460958, 104.51808946207166],
    [1.2392984982579947, 104.53714387491345],
    [1.2224795389920473, 104.54624192789197],
    [1.218360671773553, 104.520492721349]
  ]);

  await processMartinezRueda();

  await redeploy();

  await setSubjectContour([
    [1.2291728239506483, 104.51007032766938],
    [1.2037726398557425, 104.50989866629243],
    [1.2036009784787893, 104.53199403360486],
    [1.227113390341401, 104.53336732462049]
  ]);

  await setClippingContour([
    [1.2314039189368486, 104.52323930338025],
    [1.2152714375406504, 104.52255265787244],
    [1.2126970198005438, 104.54298002645373],
    [1.2344931531697512, 104.54898850992322]
  ]);

  await processMartinezRueda();

  await redeploy();

  await setSubjectContour([
    [1.2310605961829424, 104.49840137735009],
    [1.2307174410670996, 104.53272124752402],
    [1.2161295767873526, 104.53319566324353],
    [1.2163010705262423, 104.49714677408338]
  ]);

  await setClippingContour([
    [1.239641821011901, 104.50881941244006],
    [1.239641821011901, 104.51980607584119],
    [1.2046307791024446, 104.52135069295764],
    [1.2053172569721937, 104.50744612142444]
  ]);

  await processMartinezRueda();

  callback();

  // Helpers

  async function processMartinezRueda() {
    console.log(``);
    let totalGasUsed = 0;

    let res = await mockMartinezRueda.processSubjectPolygon();
    totalGasUsed += res.receipt.gasUsed;
    console.log('      processSubjectPolygon gasUsed', res.receipt.gasUsed);

    res = await mockMartinezRueda.processClippingPolygon();
    totalGasUsed += res.receipt.gasUsed;
    console.log('      processClippingPolygon gasUsed', res.receipt.gasUsed);

    totalGasUsed += await subdivideSegments();

    res = await mockMartinezRueda.orderEvents();
    totalGasUsed += res.receipt.gasUsed;
    console.log('      orderEvents gasUsed', res.receipt.gasUsed);

    console.log('');
    console.log(`      Total gasUsed`, totalGasUsed);
    console.log(``);
  }

  async function subdivideSegments() {
    const isOver = await mockMartinezRuedaWeb3.methods.isSubdivideSegmentsOver().call();
    if (isOver) {
      return 0;
    }
    const res = await mockMartinezRueda.subdivideSegments();
    console.log('      subdivideSegments gasUsed', res.receipt.gasUsed);

    return res.receipt.gasUsed + (await subdivideSegments());
  }

  async function setSubjectContour(points) {
    console.log(`      Subject contour: ${points.length} points`);
    const etherPoints = points.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));

    await pIteration.forEachSeries(etherPoints, async segment => {
      await mockMartinezRueda.addPointToSubject(segment);
    });
  }

  async function setClippingContour(points) {
    console.log(`      Clipping contour: ${points.length} points`);
    const etherPoints = points.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));

    await pIteration.forEachSeries(etherPoints, async segment => {
      await mockMartinezRueda.addPointToClipping(segment);
    });
  }

  async function redeploy() {
    mockMartinezRueda = await MockMartinezRueda.new({ from: coreTeam });
    mockMartinezRuedaWeb3 = new web3.eth.Contract(mockMartinezRueda.abi, mockMartinezRueda.address);
  }
  // Helpers end
};
