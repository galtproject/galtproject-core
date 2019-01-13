const GeohashUtils = artifacts.require('./utils/GeohashUtils.sol');
const MockGeohashUtils = artifacts.require('./mocks/MockGeohashUtils.sol');

const { assertRevert } = require('../helpers');

contract('LandUtils', ([deployer]) => {
  beforeEach(async function() {
    this.utils = await GeohashUtils.new({ from: deployer });

    MockGeohashUtils.link('GeohashUtils', this.utils.address);
    this.mockGeohashUtils = await MockGeohashUtils.new({ from: deployer });
    this.geohash5Precision = async geohash5 => {
      const res = await this.mockGeohashUtils.geohash5Precision(geohash5);
      return res.logs[0].args.result;
    };
  });

  describe('#geohash5Precision()', () => {
    it('provide correct results', async function() {
      assert.equal(await this.geohash5Precision('1'), 1);
      assert.equal(await this.geohash5Precision('15'), 1);
      assert.equal(await this.geohash5Precision('31'), 1);
      assert.equal(await this.geohash5Precision('32'), 2);
      assert.equal(await this.geohash5Precision('1023'), 2);
      assert.equal(await this.geohash5Precision('1024'), 3);
      assert.equal(await this.geohash5Precision('32767'), 3);
      assert.equal(await this.geohash5Precision('32768'), 4);
      assert.equal(await this.geohash5Precision('1048575'), 4);
      assert.equal(await this.geohash5Precision('1048576'), 5);
      assert.equal(await this.geohash5Precision('33554431'), 5);
      assert.equal(await this.geohash5Precision('33554432'), 6);
      assert.equal(await this.geohash5Precision('1073741823'), 6);
      assert.equal(await this.geohash5Precision('1073741824'), 7);
      assert.equal(await this.geohash5Precision('34359738367'), 7);
      assert.equal(await this.geohash5Precision('34359738368'), 8);
      assert.equal(await this.geohash5Precision('1099511627775'), 8);
      assert.equal(await this.geohash5Precision('1099511627776'), 9);
      assert.equal(await this.geohash5Precision('35184372088831'), 9);
      assert.equal(await this.geohash5Precision('35184372088832'), 10);
      assert.equal(await this.geohash5Precision('1125899906842623'), 10);
      assert.equal(await this.geohash5Precision('1125899906842624'), 11);
      assert.equal(await this.geohash5Precision('36028797018963967'), 11);
      assert.equal(await this.geohash5Precision('36028797018963968'), 12);
      assert.equal(await this.geohash5Precision('1152921504606846975'), 12);
    });

    it('should return 0 on 0 input', async function() {
      assert.equal(await this.geohash5Precision('0'), 0);
    });

    it('should revert if a value is greater than max', async function() {
      // max is 1152921504606846975
      await assertRevert(this.geohash5Precision('1152921504606846976'));
    });
  });
});
