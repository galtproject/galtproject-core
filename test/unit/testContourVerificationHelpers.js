const LandUtils = artifacts.require('./LandUtils.sol');
const PolygonUtils = artifacts.require('./PolygonUtils.sol');
const ContourVerificationManagerLib = artifacts.require('./ContourVerificationManagerLib.sol');

const Web3 = require('web3');
const galtUtils = require('@galtproject/utils');

const { initHelperWeb3 } = require('../helpers');
const { addElevationToContour } = require('../galtHelpers');

const web3 = new Web3(ContourVerificationManagerLib.web3.currentProvider);

ContourVerificationManagerLib.numberFormat = 'String';

initHelperWeb3(web3);

contract('ContourVerificationManagerLib', accounts => {
  const [coreTeam] = accounts;

  beforeEach(async function() {
    this.landUtils = await LandUtils.new();
    PolygonUtils.link('LandUtils', this.landUtils.address);

    this.polygonUtils = await PolygonUtils.new();

    ContourVerificationManagerLib.link('LandUtils', this.landUtils.address);
    ContourVerificationManagerLib.link('PolygonUtils', this.polygonUtils.address);
    this.contourVerificationManagerLib = await ContourVerificationManagerLib.new({ from: coreTeam });

    this.rawContour = ['dr5qvnpd300r', 'dr5qvnp655pq', 'dr5qvnp3g3w0', 'dr5qvnp9cnpt'];
    this.contour = this.rawContour.map(galtUtils.geohashToNumber).map(a => a.toString(10));
  });

  it('should return the lowest z point of the contour', async function() {
    assert.equal(
      await this.contourVerificationManagerLib.getLowestElevation(addElevationToContour(20, this.contour)),
      20
    );
    assert.equal(
      await this.contourVerificationManagerLib.getLowestElevation(addElevationToContour(0, this.contour)),
      0
    );
    assert.equal(
      await this.contourVerificationManagerLib.getLowestElevation(addElevationToContour(-1000, this.contour)),
      -1000
    );
  });

  it('should check for intersections', async function() {
    assert.equal(await this.contourVerificationManagerLib.checkVerticalIntersection(30, 20, -5, -10), false);
    assert.equal(await this.contourVerificationManagerLib.checkVerticalIntersection(30, 20, 10, -5), false);
    assert.equal(await this.contourVerificationManagerLib.checkVerticalIntersection(30, 20, 10, -5), false);
    assert.equal(await this.contourVerificationManagerLib.checkVerticalIntersection(30, 20, 20, 15), false);
    assert.equal(await this.contourVerificationManagerLib.checkVerticalIntersection(30, 20, 35, 30), false);
    assert.equal(await this.contourVerificationManagerLib.checkVerticalIntersection(30, 20, 40, 35), false);

    assert.equal(await this.contourVerificationManagerLib.checkVerticalIntersection(30, 20, 40, 10), true);
    assert.equal(await this.contourVerificationManagerLib.checkVerticalIntersection(30, 20, 25, 22), true);

    assert.equal(await this.contourVerificationManagerLib.checkVerticalIntersection(-20, -30, -22, -25), true);
    assert.equal(await this.contourVerificationManagerLib.checkVerticalIntersection(-20, -30, -10, -40), true);

    // TODO: figure out what we should do with HP < LP
    assert.equal(await this.contourVerificationManagerLib.checkVerticalIntersection(20, 30, 20, 10), false);
  });
});
