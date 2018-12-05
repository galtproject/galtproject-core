const LandUtils = artifacts.require('./utils/LandUtils.sol');
const MockLandUtils = artifacts.require('./mocks/MockLandUtils.sol');

const Web3 = require('web3');
const { assertRevert } = require('../helpers');

const web3 = new Web3(LandUtils.web3.currentProvider);

contract('LandUtils', ([deployer]) => {
  beforeEach(async function() {
    this.utils = await LandUtils.new({ from: deployer });
    this.utils3 = new web3.eth.Contract(this.utils.abi, this.utils.address);

    MockLandUtils.link('LandUtils', this.utils.address);
    this.mockLandUtils = await MockLandUtils.new({ from: deployer });
  });

  describe('#geohash5Precision()', () => {
    it('provide correct results', async function() {
      assert.equal(await this.utils3.methods.geohash5Precision('1').call(), 1);
      assert.equal(await this.utils3.methods.geohash5Precision('15').call(), 1);
      assert.equal(await this.utils3.methods.geohash5Precision('31').call(), 1);
      assert.equal(await this.utils3.methods.geohash5Precision('32').call(), 2);
      assert.equal(await this.utils3.methods.geohash5Precision('1023').call(), 2);
      assert.equal(await this.utils3.methods.geohash5Precision('1024').call(), 3);
      assert.equal(await this.utils3.methods.geohash5Precision('32767').call(), 3);
      assert.equal(await this.utils3.methods.geohash5Precision('32768').call(), 4);
      assert.equal(await this.utils3.methods.geohash5Precision('1048575').call(), 4);
      assert.equal(await this.utils3.methods.geohash5Precision('1048576').call(), 5);
      assert.equal(await this.utils3.methods.geohash5Precision('33554431').call(), 5);
      assert.equal(await this.utils3.methods.geohash5Precision('33554432').call(), 6);
      assert.equal(await this.utils3.methods.geohash5Precision('1073741823').call(), 6);
      assert.equal(await this.utils3.methods.geohash5Precision('1073741824').call(), 7);
      assert.equal(await this.utils3.methods.geohash5Precision('34359738367').call(), 7);
      assert.equal(await this.utils3.methods.geohash5Precision('34359738368').call(), 8);
      assert.equal(await this.utils3.methods.geohash5Precision('1099511627775').call(), 8);
      assert.equal(await this.utils3.methods.geohash5Precision('1099511627776').call(), 9);
      assert.equal(await this.utils3.methods.geohash5Precision('35184372088831').call(), 9);
      assert.equal(await this.utils3.methods.geohash5Precision('35184372088832').call(), 10);
      assert.equal(await this.utils3.methods.geohash5Precision('1125899906842623').call(), 10);
      assert.equal(await this.utils3.methods.geohash5Precision('1125899906842624').call(), 11);
      assert.equal(await this.utils3.methods.geohash5Precision('36028797018963967').call(), 11);
      assert.equal(await this.utils3.methods.geohash5Precision('36028797018963968').call(), 12);
      assert.equal(await this.utils3.methods.geohash5Precision('1152921504606846975').call(), 12);
    });

    it('should return 0 on 0 input', async function() {
      assert.equal(await this.utils3.methods.geohash5Precision('0').call(), 0);
    });

    it('should revert if a value is greater than max', async function() {
      // max is 1152921504606846975
      await assertRevert(this.utils3.methods.geohash5Precision('1152921504606846976').call());
    });
  });

  describe('#geohash5ToLatLonArr()', () => {
    it('should correctly convert geohash5 to lat lon', async function() {
      const res = await this.mockLandUtils.geohash5ToLatLonArr(30136808136, {
        from: deployer
      });

      assert.deepEqual(res.logs[0].args.result.map(coor => coor.toString(10)), [
        '1178970336914062500',
        '104513626098632812500'
      ]);
    });
  });

  describe('#latLonToGeohash5()', () => {
    it('should correctly convert lat lon to geohash5', async function() {
      const res = await this.mockLandUtils.latLonToGeohash5(['1178970336914062500', '104513626098632812500'], 7, {
        from: deployer
      });

      assert.deepEqual(res.logs[0].args.result.toString(10), '30136808136');
    });
  });
});
