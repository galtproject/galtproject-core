const LandUtils = artifacts.require('./utils/LandUtils.sol');
const PolygonUtils = artifacts.require('./utils/PolygonUtils.sol');
const PointRedBlackTree = artifacts.require('./collections/PointRedBlackTree.sol');
const SegmentRedBlackTree = artifacts.require('./collections/SegmentRedBlackTree.sol');
const BentleyOttman = artifacts.require('./utils/BentleyOttman.sol');
const WeilerAtherton = artifacts.require('./utils/WeilerAtherton.sol');
const MockWeilerAtherton = artifacts.require('./mocks/MockWeilerAtherton.sol');

const galt = require('@galtproject/utils');
const Web3 = require('web3');
const chai = require('chai');
const pIteration = require('p-iteration');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, ether } = require('../helpers');

const web3 = new Web3(MockWeilerAtherton.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('WeilerAtherton', ([coreTeam]) => {
  beforeEach(async function() {
    this.landUtils = await LandUtils.new({ from: coreTeam });
    PolygonUtils.link('LandUtils', this.landUtils.address);
    this.polygonUtils = await PolygonUtils.new({ from: coreTeam });

    this.pointRedBlackTree = await PointRedBlackTree.new({ from: coreTeam });
    BentleyOttman.link('PointRedBlackTree', this.pointRedBlackTree.address);

    this.segmentRedBlackTree = await SegmentRedBlackTree.new({ from: coreTeam });
    BentleyOttman.link('SegmentRedBlackTree', this.segmentRedBlackTree.address);

    this.bentleyOttman = await BentleyOttman.new({ from: coreTeam });
    WeilerAtherton.link('BentleyOttman', this.bentleyOttman.address);
    WeilerAtherton.link('PolygonUtils', this.polygonUtils.address);

    this.weilerAtherton = await WeilerAtherton.new({ from: coreTeam });
    MockWeilerAtherton.link('WeilerAtherton', this.weilerAtherton.address);
    MockWeilerAtherton.link('PolygonUtils', this.polygonUtils.address);

    this.mockWeilerAtherton = await MockWeilerAtherton.new({ from: coreTeam });

    this.mockWeilerAthertonWeb3 = new web3.eth.Contract(this.mockWeilerAtherton.abi, this.mockWeilerAtherton.address);

    this.processBentleyOttman = async function() {
      const isBentleyOttmanFinished = await this.mockWeilerAthertonWeb3.methods.isBentleyOttmanFinished().call();
      if (isBentleyOttmanFinished) {
        return;
      }
      await this.mockWeilerAtherton.processBentleyOttman();

      await this.processBentleyOttman();
    };
  });

  // dev.highlightContour([ 'w24qfpvbmnkt', 'w24qf5ju3pkx', 'w24qfejgkp2p', 'w24qfxqukn80' ])
  const baseContour = [
    [1.2291728239506483, 104.51007032766938],
    [1.2037726398557425, 104.50989866629243],
    [1.2036009784787893, 104.53199403360486],
    [1.227113390341401, 104.53336732462049]
  ];
  // dev.highlightContour([ 'w24r42pt2n24', 'w24qfmpp2p00', 'w24qfuvb7zpg', 'w24r50dr2n0n'])
  const cropContour = [
    [1.2314039189368486, 104.52323930338025],
    [1.2152714375406504, 104.52255265787244],
    [1.2126970198005438, 104.54298002645373],
    [1.2344931531697512, 104.54898850992322]
  ];

  const etherBaseContour = baseContour.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));
  const etherCropContour = cropContour.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));

  describe.only('#initBasePolygon() and initCropPolygon()', () => {
    it('should correctly init polygons points', async function() {
      await pIteration.forEachSeries(etherBaseContour, async point => {
        await this.mockWeilerAtherton.addPointToBasePolygon(point);
      });
      await pIteration.forEachSeries(etherCropContour, async point => {
        await this.mockWeilerAtherton.addPointToCropPolygon(point);
      });

      await this.mockWeilerAtherton.initBasePolygon();
      await this.mockWeilerAtherton.initCropPolygon();

      await this.mockWeilerAtherton.addBasePolygonSegments();

      await this.mockWeilerAtherton.addCropPolygonSegments();

      await this.processBentleyOttman();
      await this.mockWeilerAtherton.addIntersectedPoints();
      await this.mockWeilerAtherton.buildResultPolygon();

      const resultPolygonLength = await this.mockWeilerAthertonWeb3.methods.getResultPolygonLength(0).call();
      console.log('resultPolygonLength', resultPolygonLength);

      for (let i = 0; i < resultPolygonLength; i++) {
        const resultPolygonPoint = (await this.mockWeilerAthertonWeb3.methods.getResultPolygonPoint(0, i).call()).map(
          coor => web3.utils.fromWei(coor, 'ether')
        );
        console.log(
          'resultPolygonPoint',
          galt.geohash.extra.encodeFromLatLng(resultPolygonPoint[0], resultPolygonPoint[1], 12)
        );
      }

      assert.equal(true, false);
    });
  });
});
