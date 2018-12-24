const PolygonUtils = artifacts.require('./utils/PolygonUtils.sol');
const LandUtils = artifacts.require('./utils/LandUtils.sol');
const TrigonometryUtils = artifacts.require('./utils/TrigonometryUtils.sol');
const MockPolygonUtils = artifacts.require('./mocks/MockPolygonUtils.sol');

const pIteration = require('p-iteration');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, ether } = require('../helpers');

const web3 = new Web3(MockPolygonUtils.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract.only('PolygonUtils', ([coreTeam]) => {
  beforeEach(async function() {
    this.trigonometryUtils = await TrigonometryUtils.new({ from: coreTeam });
    PolygonUtils.link('TrigonometryUtils', this.trigonometryUtils.address);
    this.landUtils = await LandUtils.new({ from: coreTeam });
    PolygonUtils.link('LandUtils', this.landUtils.address);
    this.polygonUtils = await PolygonUtils.new({ from: coreTeam });
    MockPolygonUtils.link('PolygonUtils', this.polygonUtils.address);
    this.mockPolygonUtils = await MockPolygonUtils.new({ from: coreTeam });
  });

  describe('#getArea()', () => {
    it('should correctly get area', async function() {
      const contour = [
        [1.2291728239506483, 104.51007032766938],
        [1.2037726398557425, 104.50989866629243],
        [1.2036009784787893, 104.53199403360486],
        [1.227113390341401, 104.53336732462049]
      ];

      const shouldBeArea = 1727367.5744677314;
      // Checks by services:
      // 1. https://github.com/mapbox/geojson-area
      // 1 727 367 sq m
      // 2. https://stackoverflow.com/questions/49666791/getting-area-from-gps-coordinates
      // 1 727 367 sq m
      // 3. https://3planeta.com/googlemaps/google-maps-calculator-ploschadei.html
      // 6 887 504 sq m
      // 4. https://geographiclib.sourceforge.io/cgi-bin/Planimeter?type=polygon&rhumb=geodesic&input=1.2291728239506483%2C+104.51007032766938%0D%0A1.2037726398557425%2C+104.50989866629243%0D%0A1.2036009784787893%2C+104.53199403360486%0D%0A1.227113390341401%2C+104.53336732462049&option=Submit
      // 6 841 437.7

      const etherContour = contour.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));
      await pIteration.forEachSeries(etherContour, async point => {
        await this.mockPolygonUtils.addPoint(point);
      });

      const res = await this.mockPolygonUtils.getArea();

      console.log(res.logs[0].args.result.toFixed());
      assert.isBelow(Math.abs(res.logs[0].args.result.toFixed() / 10 ** 18 - shouldBeArea), 0.00001);
    });
  });
});
