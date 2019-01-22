const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');

const { deployGeodesic, initHelperArtifacts, clearLibCache } = require('../helpers');

initHelperArtifacts(artifacts);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract.only('Geodesic', () => {
  before(clearLibCache);

  beforeEach(async function() {
    this.geodesic = await deployGeodesic();
  });

  it('should calculate contour area correctly', async function() {
    let contour = ['k6wnu5q1jh44', 'k6wnu7d6tj8x', 'k6wnu6umb4b4', 'k6wnu60xk405', 'k6wnu4m0pvxy'].map(//, 'k6wnu60xk405', 'k6wnu4m0pvxy'
      galt.geohashToGeohash5
    );
    let res = await this.geodesic.cacheGeohashListToLatLonAndUtm(contour);
      console.log('gasUsed for cache', res.receipt.gasUsed);
    // contour = ['k6wnu60xk405', 'k6wnu4m0pvxy'].map(
    //       galt.geohashToGeohash5
    //   );
    // res = await this.geodesic.cacheGeohashListToLatLonAndUtm(contour);
    // console.log('gasUsed for cache', res.receipt.gasUsed);
      contour = ['k6wnu5q1jh44', 'k6wnu7d6tj8x', 'k6wnu6umb4b4', 'k6wnu60xk405', 'k6wnu4m0pvxy'].map(
          galt.geohashToGeohash5
      );
    res = await this.geodesic.calculateContourArea(contour);
    console.log('gasUsed for calculate', res.receipt.gasUsed);
    assert.isBelow(Math.abs(res.logs[0].args.area.toFixed() / 10 ** 18 - 500882.5), 1.5);
    // assert.equal(true, false);
  });
});
