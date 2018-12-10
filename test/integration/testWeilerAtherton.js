const MockWeilerAtherton = artifacts.require('./mocks/MockWeilerAtherton.sol');

// const galt = require('@galtproject/utils');
const Web3 = require('web3');
const chai = require('chai');
const pIteration = require('p-iteration');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, initHelperArtifacts, ether, getWeilerAthertonLib, clearLibCache } = require('../helpers');

const web3 = new Web3(MockWeilerAtherton.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('WeilerAtherton', ([coreTeam]) => {
  before(clearLibCache);

  beforeEach(async function() {
    this.weilerAtherton = await getWeilerAthertonLib();
    MockWeilerAtherton.link('WeilerAtherton', this.weilerAtherton.address);

    this.mockWeilerAtherton = await MockWeilerAtherton.new({ from: coreTeam });

    this.mockWeilerAthertonWeb3 = new web3.eth.Contract(this.mockWeilerAtherton.abi, this.mockWeilerAtherton.address);

    this.processMartinezRueda = async function() {
      const isMartinezRuedaFinished = await this.mockWeilerAthertonWeb3.methods.isMartinezRuedaFinished().call();
      if (isMartinezRuedaFinished) {
        return;
      }
      await this.mockWeilerAtherton.processMartinezRueda();

      await this.processMartinezRueda();
    };
  });

  // dev.highlightContour([ 'w24qfpvbmnkt', 'w24qf5ju3pkx', 'w24qfejgkp2p', 'w24qfxqukn80' ])
  const subjectContour = [
    [1.2291728239506483, 104.51007032766938],
    [1.2037726398557425, 104.50989866629243],
    [1.2036009784787893, 104.53199403360486],
    [1.227113390341401, 104.53336732462049]
  ];
  // dev.highlightContour([ 'w24r42pt2n24', 'w24qfmpp2p00', 'w24qfuvb7zpg', 'w24r50dr2n0n'])
  const clippingContour = [
    [1.2314039189368486, 104.52323930338025],
    [1.2152714375406504, 104.52255265787244],
    [1.2126970198005438, 104.54298002645373],
    [1.2344931531697512, 104.54898850992322]
  ];

  const etherSubjectContour = subjectContour.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));
  const etherClippingContour = clippingContour.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));

  describe('#initSubjectPolygon() and initClippingPolygon()', () => {
    it('should correctly init polygons points', async function() {
      await pIteration.forEachSeries(etherSubjectContour, async point => {
        await this.mockWeilerAtherton.addPointToSubjectPolygon(point);
      });
      await pIteration.forEachSeries(etherClippingContour, async point => {
        await this.mockWeilerAtherton.addPointToClippingPolygon(point);
      });

      await this.mockWeilerAtherton.initSubjectPolygon();
      await this.mockWeilerAtherton.initClippingPolygon();

      // await this.mockWeilerAtherton.initAllPolygons();

      await this.mockWeilerAtherton.addSubjectPolygonSegments();

      await this.mockWeilerAtherton.addClippingPolygonSegments();

      await this.processMartinezRueda();
      await this.mockWeilerAtherton.addIntersectedPoints();
      await this.mockWeilerAtherton.buildResultPolygon();
      await this.mockWeilerAtherton.buildSubjectPolygonOutput();

      const resultPolygonsCount = await this.mockWeilerAthertonWeb3.methods.getResultPolygonsCount().call();
      assert.equal(resultPolygonsCount, '1');

      // dev.highlightContour([ 'w24qftn244vj', 'w24qfxqukn80', 'w24qfrx3sxuc', 'w24qfmpp2p00']);
      const resultPolygonLength = await this.mockWeilerAthertonWeb3.methods.getResultPolygonLength(0).call();
      assert.equal(resultPolygonLength, '4');

      let resultPoint = await this.mockWeilerAthertonWeb3.methods.getResultPolygonPoint(0, 0).call();
      assert.deepEqual(resultPoint.map(c => c.toString(10)), ['1214004978082901197', '104532601700706952753']);

      resultPoint = await this.mockWeilerAthertonWeb3.methods.getResultPolygonPoint(0, 1).call();
      assert.deepEqual(resultPoint.map(c => c.toString(10)), ['1227113390341000000', '104533367324620000000']);

      resultPoint = await this.mockWeilerAthertonWeb3.methods.getResultPolygonPoint(0, 2).call();
      assert.deepEqual(resultPoint.map(c => c.toString(10)), ['1228021425037782365', '104523095334564247262']);

      resultPoint = await this.mockWeilerAthertonWeb3.methods.getResultPolygonPoint(0, 3).call();
      assert.deepEqual(resultPoint.map(c => c.toString(10)), ['1215271437541000000', '104522552657872000000']);

      // dev.highlightContour([ 'w24qfpvbmnkt', 'w24qf5ju3pkx', 'w24qfejgkp2p', 'w24qftn244vj', 'w24qfmpp2p00', 'w24qfrx3sxuc']);
      const subjectPolygonOutputLength = await this.mockWeilerAthertonWeb3.methods
        .getSubjectPolygonOutputLength()
        .call();
      assert.equal(subjectPolygonOutputLength, '6');

      let subjectPoint = await this.mockWeilerAthertonWeb3.methods.getSubjectPolygonOutputPoint(0).call();
      assert.deepEqual(subjectPoint.map(c => c.toString(10)), ['1229172823951000000', '104510070327669000000']);

      subjectPoint = await this.mockWeilerAthertonWeb3.methods.getSubjectPolygonOutputPoint(1).call();
      assert.deepEqual(subjectPoint.map(c => c.toString(10)), ['1203772639856000000', '104509898666292000000']);

      subjectPoint = await this.mockWeilerAthertonWeb3.methods.getSubjectPolygonOutputPoint(2).call();
      assert.deepEqual(subjectPoint.map(c => c.toString(10)), ['1203600978479000000', '104531994033605000000']);

      subjectPoint = await this.mockWeilerAthertonWeb3.methods.getSubjectPolygonOutputPoint(3).call();
      assert.deepEqual(subjectPoint.map(c => c.toString(10)), ['1214004978082901197', '104532601700706952753']);

      subjectPoint = await this.mockWeilerAthertonWeb3.methods.getSubjectPolygonOutputPoint(4).call();
      assert.deepEqual(subjectPoint.map(c => c.toString(10)), ['1215271437541000000', '104522552657872000000']);

      subjectPoint = await this.mockWeilerAthertonWeb3.methods.getSubjectPolygonOutputPoint(5).call();
      assert.deepEqual(subjectPoint.map(c => c.toString(10)), ['1228021425037782365', '104523095334564247262']);
    });
  });
});
