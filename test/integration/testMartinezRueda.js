const MockMartinezRueda = artifacts.require('./mocks/MockMartinezRueda.sol');

const _ = require('lodash');
const Web3 = require('web3');
const chai = require('chai');
const pIteration = require('p-iteration');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const {
  initHelperWeb3,
  initHelperArtifacts,
  ether,
  getMartinezRuedaLib,
  getLinkedListLib,
  getSweepQueueLinkedListLib,
  clearLibCache
} = require('../helpers');

const web3 = new Web3(MockMartinezRueda.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('MartinezRueda', ([coreTeam]) => {
  before(clearLibCache);

  beforeEach(async function() {
    this.martinezRueda = await getMartinezRuedaLib();
    MockMartinezRueda.link('MartinezRueda', this.martinezRueda.address);

    MockMartinezRueda.link('LinkedList', (await getLinkedListLib()).address);
    MockMartinezRueda.link('SweepQueueLinkedList', (await getSweepQueueLinkedListLib()).address);
    this.mockMartinezRueda = await MockMartinezRueda.new({ from: coreTeam });

    this.mockMartinezRuedaWeb3 = new web3.eth.Contract(this.mockMartinezRueda.abi, this.mockMartinezRueda.address);

    this.subdivideSegments = async function() {
      const isOver = await this.mockMartinezRuedaWeb3.methods.isSubdivideSegmentsOver().call();
      if (isOver) {
        return;
      }
      await this.mockMartinezRueda.subdivideSegments();

      await this.subdivideSegments();
    };

    this.setSubjectContour = async function(points) {
      const etherPoints = points.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));

      await pIteration.forEachSeries(etherPoints, async segment => {
        await this.mockMartinezRueda.addPointToSubject(segment);
      });
    };

    this.setClippingContour = async function(points) {
      const etherPoints = points.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));

      await pIteration.forEachSeries(etherPoints, async segment => {
        await this.mockMartinezRueda.addPointToClipping(segment);
      });
    };

    this.checkPointsByLength = async function(index, length, pointsShouldIncluded, foundPoints = {}) {
      const eventPoint = (await this.mockMartinezRueda.getResultResultEventPoint(index)).map(coor => coor.toString(10));

      const foundIndex = _.findIndex(
        pointsShouldIncluded,
        point => point[0] === eventPoint[0] && point[1] === eventPoint[1]
      );

      if (foundIndex > -1) {
        pointsShouldIncluded.splice(foundIndex, 1);
        /* eslint-disable */
        foundPoints[JSON.stringify(eventPoint)] = true;
        /* eslint-enable */
      } else {
        assert(foundPoints[JSON.stringify(eventPoint)], true);
      }

      if (index + 1 >= length) {
        return;
      }

      await this.checkPointsByLength(index + 1, length, pointsShouldIncluded, foundPoints);
    };
  });

  describe('Check result of MartinezRueda', () => {
    it('should correctly handle case 1', async function() {
      await this.setSubjectContour([
        [1.230889102444052694, 104.508869033306837081],
        [1.201198389753699301, 104.507961440831422805],
        [1.200340250506997107, 104.532680679112672805],
        [1.209607785567641256, 104.532165359705686569],
        [1.2108092475682497, 104.518947433680295944],
        [1.221278244629502294, 104.517917465418577194],
        [1.221964722499251363, 104.533367324620485305],
        [1.2300309631973505, 104.534265864640474318]
      ]);

      await this.setClippingContour([
        [1.194818755611777304, 104.524910990148782728],
        [1.195333572104573248, 104.542420450598001478],
        [1.23137441463768482, 104.540703836828470228],
        [1.232232553884387014, 104.523194376379251478]
      ]);

      await this.mockMartinezRueda.processSubjectPolygon();
      await this.mockMartinezRueda.processClippingPolygon();

      await this.subdivideSegments();

      await this.mockMartinezRueda.orderEvents();

      const eventsLength = await this.mockMartinezRueda.getResultEventsLength();
      // console.log('eventsLength', eventsLength.toString(10));

      const pointsShouldIncluded = [
        ['1200340250507000000', '104532680679113000000'],
        ['1200619217705673161', '104524644854296393606'],
        ['1210331879095094258', '104524199219555883837'],
        ['1209607785568000000', '104532165359706000000'],
        ['1221534521210438948', '104523685221763517362'],
        ['1230402222620450466', '104523278355338521356'],
        ['1230030963197000000', '104534265864640000000'],
        ['1221964722499000000', '104533367324620000000']
      ];

      await this.checkPointsByLength(0, parseInt(eventsLength.toString(10), 10), pointsShouldIncluded);

      assert.equal(pointsShouldIncluded.length, 0);
    });

    it('should correctly handle case 2', async function() {
      await this.setSubjectContour([
        [1.2154430989176035, 104.49491517618299],
        [1.2149281147867441, 104.51156632974744],
        [1.2056605797261, 104.51156632974744],
        [1.2044591177254915, 104.51946275308728],
        [1.1963928770273924, 104.51946275308728],
        [1.1957063991576433, 104.49680345132947]
      ]);

      await this.setClippingContour([
        [1.2065324652940035, 104.5116032101214],
        [1.1951483320444822, 104.51125787571073],
        [1.1958123464137316, 104.52563183382154],
        [1.206624498590827, 104.52494518831372]
      ]);

      await this.mockMartinezRueda.processSubjectPolygon();
      await this.mockMartinezRueda.processClippingPolygon();

      await this.subdivideSegments();

      await this.mockMartinezRueda.orderEvents();

      const eventsLength = await this.mockMartinezRueda.getResultEventsLength();
      console.log('eventsLength', eventsLength.toString(10));

      const pointsShouldIncluded = [
        ['1196145221231270521', '104511288116057948363'],
        ['1205658999765187970', '104511576713795242481'],
        ['1204459117725000000', '104519462753087000000'],
        ['1196392877027000000', '104519462753087000000']
      ];

      await this.checkPointsByLength(0, parseInt(eventsLength.toString(10), 10), pointsShouldIncluded);

      assert.equal(pointsShouldIncluded.length, 0);
    });

    it('should correctly handle case 3', async function() {
      await this.setSubjectContour([
        [1.2303741183131933, 104.50938368216157],
        [1.2290011625736952, 104.53134862706065],
        [1.2077200133353472, 104.53096406534314],
        [1.2051455955952406, 104.50950605794787]
      ]);

      await this.setClippingContour([
        [1.2221363838762045, 104.51723115518689],
        [1.2334633525460958, 104.51808946207166],
        [1.2392984982579947, 104.53714387491345],
        [1.2224795389920473, 104.54624192789197],
        [1.218360671773553, 104.520492721349]
      ]);

      await this.mockMartinezRueda.processSubjectPolygon();
      await this.mockMartinezRueda.processClippingPolygon();

      await this.subdivideSegments();

      await this.mockMartinezRueda.orderEvents();

      const eventsLength = await this.mockMartinezRueda.getResultEventsLength();
      console.log('eventsLength', eventsLength.toString(10));

      const pointsShouldIncluded = [
        ['1218360671774000000', '104520492721349000000'],
        ['1222136383876000000', '104517231155187000000'],
        ['1229847077330823555', '104517815436954983339'],
        ['1229001162574000000', '104531348627061000000'],
        ['1220071380383886832', '104531187261133716233']
      ];

      await this.checkPointsByLength(0, parseInt(eventsLength.toString(10), 10), pointsShouldIncluded);

      assert.equal(pointsShouldIncluded.length, 0);
    });

    it('should correctly handle case 4', async function() {
      await this.setSubjectContour([
        [1.2291728239506483, 104.51007032766938],
        [1.2037726398557425, 104.50989866629243],
        [1.2036009784787893, 104.53199403360486],
        [1.227113390341401, 104.53336732462049]
      ]);

      await this.setClippingContour([
        [1.2314039189368486, 104.52323930338025],
        [1.2152714375406504, 104.52255265787244],
        [1.2126970198005438, 104.54298002645373],
        [1.2344931531697512, 104.54898850992322]
      ]);

      await this.mockMartinezRueda.processSubjectPolygon();
      await this.mockMartinezRueda.processClippingPolygon();

      await this.subdivideSegments();

      await this.mockMartinezRueda.orderEvents();

      const eventsLength = await this.mockMartinezRueda.getResultEventsLength();
      console.log('eventsLength', eventsLength.toString(10));

      const pointsShouldIncluded = [
        ['1214004978082901197', '104532601700706952753'],
        ['1215271437541000000', '104522552657872000000'],
        ['1228021425037782365', '104523095334564247262'],
        ['1227113390341000000', '104533367324620000000']
      ];

      await this.checkPointsByLength(0, parseInt(eventsLength.toString(10), 10), pointsShouldIncluded);

      assert.equal(pointsShouldIncluded.length, 0);
    });

    it('should correctly handle case 5', async function() {
      await this.setSubjectContour([
        [1.2310605961829424, 104.49840137735009],
        [1.2307174410670996, 104.53272124752402],
        [1.2161295767873526, 104.53319566324353],
        [1.2163010705262423, 104.49714677408338]
      ]);

      await this.setClippingContour([
        [1.239641821011901, 104.50881941244006],
        [1.239641821011901, 104.51980607584119],
        [1.2046307791024446, 104.52135069295764],
        [1.2053172569721937, 104.50744612142444]
      ]);

      await this.mockMartinezRueda.processSubjectPolygon();
      await this.mockMartinezRueda.processClippingPolygon();

      await this.subdivideSegments();

      await this.mockMartinezRueda.orderEvents();

      const eventsLength = await this.mockMartinezRueda.getResultEventsLength();
      console.log('eventsLength', eventsLength.toString(10));

      const pointsShouldIncluded = [
        ['1216188352034539584', '104520840795965260760'],
        ['1216249993050129794', '104507883529113108546'],
        ['1230959902169445303', '104508472057667067493'],
        ['1230842694876358559', '104520194275680316175']
      ];

      await this.checkPointsByLength(0, parseInt(eventsLength.toString(10), 10), pointsShouldIncluded);

      assert.equal(pointsShouldIncluded.length, 0);
    });
  });
});
