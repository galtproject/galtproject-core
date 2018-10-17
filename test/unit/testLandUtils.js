const LandUtils = artifacts.require('./utils/LandUtils.sol');
const Web3 = require('web3');
const { assertRevert } = require('../helpers');

const web3 = new Web3(LandUtils.web3.currentProvider);

contract('LandUtils', ([deployer]) => {
  beforeEach(async function() {
    this.utils = await LandUtils.new({ from: deployer });
    this.utils3 = new web3.eth.Contract(this.utils.abi, this.utils.address);
  });

  describe('#geohash5Capacity()', () => {
    it('provide correct results', async function() {
      assert.equal(await this.utils3.methods.geohash5Capacity('1').call(), 1);
      assert.equal(await this.utils3.methods.geohash5Capacity('15').call(), 1);
      assert.equal(await this.utils3.methods.geohash5Capacity('31').call(), 1);
      assert.equal(await this.utils3.methods.geohash5Capacity('32').call(), 2);
      assert.equal(await this.utils3.methods.geohash5Capacity('1023').call(), 2);
      assert.equal(await this.utils3.methods.geohash5Capacity('1024').call(), 3);
      assert.equal(await this.utils3.methods.geohash5Capacity('32767').call(), 3);
      assert.equal(await this.utils3.methods.geohash5Capacity('32768').call(), 4);
      assert.equal(await this.utils3.methods.geohash5Capacity('1048575').call(), 4);
      assert.equal(await this.utils3.methods.geohash5Capacity('1048576').call(), 5);
      assert.equal(await this.utils3.methods.geohash5Capacity('33554431').call(), 5);
      assert.equal(await this.utils3.methods.geohash5Capacity('33554432').call(), 6);
      assert.equal(await this.utils3.methods.geohash5Capacity('1073741823').call(), 6);
      assert.equal(await this.utils3.methods.geohash5Capacity('1073741824').call(), 7);
      assert.equal(await this.utils3.methods.geohash5Capacity('34359738367').call(), 7);
      assert.equal(await this.utils3.methods.geohash5Capacity('34359738368').call(), 8);
      assert.equal(await this.utils3.methods.geohash5Capacity('1099511627775').call(), 8);
      assert.equal(await this.utils3.methods.geohash5Capacity('1099511627776').call(), 9);
      assert.equal(await this.utils3.methods.geohash5Capacity('35184372088831').call(), 9);
      assert.equal(await this.utils3.methods.geohash5Capacity('35184372088832').call(), 10);
      assert.equal(await this.utils3.methods.geohash5Capacity('1125899906842623').call(), 10);
      assert.equal(await this.utils3.methods.geohash5Capacity('1125899906842624').call(), 11);
      assert.equal(await this.utils3.methods.geohash5Capacity('36028797018963967').call(), 11);
      assert.equal(await this.utils3.methods.geohash5Capacity('36028797018963968').call(), 12);
      assert.equal(await this.utils3.methods.geohash5Capacity('1152921504606846975').call(), 12);
    });

    it('should revert on 0 input', async function() {
      await assertRevert(this.utils3.methods.geohash5Capacity('0').call());
    });

    it('should revert on empty input', async function() {
      await assertRevert(this.utils3.methods.geohash5Capacity('0').call());
    });

    it('should revert if a value is greater than max', async function() {
      // max is 1152921504606846975
      await assertRevert(this.utils3.methods.geohash5Capacity('1152921504606846976').call());
    });
  });
});
