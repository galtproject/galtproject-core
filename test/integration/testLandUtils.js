const LandUtils = artifacts.require('./utils/LandUtils.sol');
const MockLandUtils = artifacts.require('./mocks/MockLandUtils.sol');

const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, ether } = require('../helpers');

const web3 = new Web3(MockLandUtils.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('LandUtils', ([coreTeam]) => {
  beforeEach(async function() {
    this.landUtils = await LandUtils.new({ from: coreTeam });
    MockLandUtils.link('LandUtils', this.landUtils.address);
    this.mockLandUtils = await MockLandUtils.new({ from: coreTeam });
  });

  describe('#geohash5ToLatLonArr()', () => {
    it('should correctly convert geohash5 to lat lon', async function() {
      const res = await this.mockLandUtils.geohash5ToLatLonArr(30136808136, {
        from: coreTeam
      });

      assert.deepEqual(res.logs[0].args.result.map(coor => coor.toString(10)), [
        '1178970336914062500',
        '104513626098632812500'
      ]);
    });
  });

  describe.only('#latLonToGeohash5()', () => {
    it('should correctly convert lat lon to geohash5', async function() {
      const res = await this.mockLandUtils.latLonToGeohash5(['1178970336914062500', '104513626098632812500'], {
        from: coreTeam
      });

      assert.deepEqual(res.logs[0].args.result.toString(10), '30136808136');
    });
  });
});
