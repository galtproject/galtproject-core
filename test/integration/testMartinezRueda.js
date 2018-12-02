const MockMartinezRueda = artifacts.require('./mocks/MockMartinezRueda.sol');

const Web3 = require('web3');
const chai = require('chai');
const pIteration = require('p-iteration');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, initHelperArtifacts, ether, getMartinezRuedaLib, clearLibCache } = require('../helpers');

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
  });

  describe('Check result of MartinezRueda', () => {
    it.only('should correctly handle case 1', async function() {
      await this.setSubjectContour([
        [1.230889102444052694, 104.508869033306837081],
        [1.201198389753699301, 104.507961440831422805],
        [1.200340250506997107, 104.532680679112672805],
        [1.209607785567641256, 104.532165359705686569], //---
        [1.2108092475682497, 104.518947433680295944],
        [1.221278244629502294, 104.517917465418577194], //---
        [1.221964722499251363, 104.533367324620485305],
        [1.2300309631973505, 104.534265864640474318]
        // [1.230889102444052694, 104.508869033306837081]
      ]);

      await this.setClippingContour([
        [1.194818755611777304, 104.524910990148782728],
        [1.195333572104573248, 104.542420450598001478],
        [1.23137441463768482, 104.540703836828470228],
        [1.232232553884387014, 104.523194376379251478] // |
        // [1.194818755611777304, 104.524910990148782728]
      ]);

      await this.mockMartinezRueda.processSubjectPolygon();
      await this.mockMartinezRueda.processClippingPolygon();

      await this.subdivideSegments();

      await this.mockMartinezRueda.orderEvents();

      const eventsLength = await this.mockMartinezRueda.getResultEventsLength();
      console.log('eventsLength', eventsLength.toString(10));

      let eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(0);
      console.log(eventPoint.map(coor => coor.toString(10)));

      eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(1);
      console.log(eventPoint.map(coor => coor.toString(10)));

      eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(2);
      console.log(eventPoint.map(coor => coor.toString(10)));

      eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(3);
      console.log(eventPoint.map(coor => coor.toString(10)));

      eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(4);
      console.log(eventPoint.map(coor => coor.toString(10)));

      eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(5);
      console.log(eventPoint.map(coor => coor.toString(10)));

      eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(6);
      console.log(eventPoint.map(coor => coor.toString(10)));

      eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(7);
      console.log(eventPoint.map(coor => coor.toString(10)));

      eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(8);
      console.log(eventPoint.map(coor => coor.toString(10)));

      eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(9);
      console.log(eventPoint.map(coor => coor.toString(10)));

      eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(10);
      console.log(eventPoint.map(coor => coor.toString(10)));

      eventPoint = await this.mockMartinezRueda.getResultResultEventPoint(11);
      console.log(eventPoint.map(coor => coor.toString(10)));
      
      assert.equal(true, false);

      // await this.mockMartinezRueda.connectEdges();

      // console.log('result', result[1]);
      // assert.deepEqual(result, [
      //     [
      //         // [
      //         [1.200340250506997, 104.53268067911267],
      //         [1.200619217705587, 104.52464485429624],
      //         [1.2103318790951096, 104.52419921955585],
      //         [1.2096077855676413, 104.53216535970569],
      //         [1.200340250506997, 104.53268067911267]
      //         // ]
      //     ], [
      //         // [
      //         [1.2215345212102309, 104.52368522176366],
      //         [1.2304022226206794, 104.52327835533876],
      //         [1.2300309631973505, 104.53426586464047],
      //         [1.2219647224992514, 104.53336732462049],
      //         [1.2215345212102309, 104.52368522176366]
      //         // ]
      //     ]
      // ]);

      // const outputLength = await this.mockMartinezRuedaWeb3.methods.getOutputLength().call();
      // assert.equal(outputLength, '2');
      //
      // const outputPoint1 = await this.mockMartinezRuedaWeb3.methods.getOutputPoint(0).call();
      // assert.deepEqual(outputPoint1.map(c => c.toString(10)), ['37717413344078919255', '55744268878164737395']);
      //
      // const outputPoint2 = await this.mockMartinezRuedaWeb3.methods.getOutputPoint(1).call();
      // assert.deepEqual(outputPoint2.map(c => c.toString(10)), ['37749639151743334230', '55745685549624400907']);
    });
  });
});
