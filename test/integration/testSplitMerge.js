const PolygonUtils = artifacts.require('./PolygonUtils.sol');
const LandUtils = artifacts.require('./LandUtils.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');

const web3 = new Web3(SplitMerge.web3.currentProvider);

const { BN } = Web3.utils;
const { zeroAddress, assertRevert } = require('../helpers');

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

// TODO: either delete tests or fix them
contract.only('SplitMerge', ([coreTeam, alice]) => {
  beforeEach(async function() {
    this.baseContour = ['w9cx6wbuuy', 'w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0'].map(galt.geohashToGeohash5);

    this.landUtils = await LandUtils.new({ from: coreTeam });
    PolygonUtils.link('LandUtils', this.landUtils.address);
    SplitMerge.link('LandUtils', this.landUtils.address);

    this.polygonUtils = await PolygonUtils.new({ from: coreTeam });
    SplitMerge.link('PolygonUtils', this.polygonUtils.address);

    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.splitMerge = await SplitMerge.new({ from: coreTeam });

    this.splitMerge.initialize(this.spaceToken.address, zeroAddress, { from: coreTeam });
    this.spaceToken.initialize('SpaceToken', 'SPACE', { from: coreTeam });

    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'burner');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  describe('package', () => {
    it('should creating correctly', async function() {
      let res;

      res = await this.splitMerge.initPackage({ from: alice });

      const packageId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);

      res = await this.spaceToken.ownerOf.call(packageId);
      assert.equal(res, alice);

      await this.splitMerge.setPackageContour(packageId, this.baseContour, { from: alice });

      res = (await this.splitMerge.getPackageContour(packageId)).map(geohash => geohash.toString(10));

      assert.deepEqual(res, this.baseContour.map(geohash => geohash.toString(10)));
    });

    it('should check split and merge correctly', async function() {
      const splitContour1 = ['w9cx63zs88', 'w9cx71gk90', 'w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0'].map(
        galt.geohashToGeohash5
      );
      const splitContour2 = ['w9cx63zs88', 'w9cx71gk90', 'w9cx6wbuuy'].map(galt.geohashToGeohash5);
      await this.splitMerge.checkSplitContours(this.baseContour, splitContour1, splitContour2);
    });

    it('should reject small precision geohashes', async function() {
      const splitContour1 = ['w9cx63z', 'w9cx71g', 'w9cx71g', 'w9cwg7d', 'w9cwfqk'].map(galt.geohashToGeohash5);
      const splitContour2 = ['w9cx63z', 'w9cx71g', 'w9cx6wb'].map(galt.geohashToGeohash5);
      await assertRevert(this.splitMerge.checkSplitContours(this.baseContour, splitContour1, splitContour2));
    });

    it('should reject incorrect split by unique not exists in source contour error', async function() {
      const splitContour1 = ['w9cx63zs88', 'w9cx71gk90', 'w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0'].map(
        galt.geohashToGeohash5
      );
      const splitContour2 = ['w9cx63zs88', 'w9cx71gk90', 'w9cx6wbuuy', 'w9cx6w0uuy'].map(galt.geohashToGeohash5);
      await assertRevert(this.splitMerge.checkSplitContours(this.baseContour, splitContour1, splitContour2));
    });

    it('should reject incorrect split by duplicate element not inside source contour error', async function() {
      const splitContour1 = ['w9cx63zs88', 'w9cx71gk90', 'w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0'].map(
        galt.geohashToGeohash5
      );
      const splitContour2 = ['w9cx63zs88', 'w9cx71gk90', 'w9cx6wbuuy', 'w9cx6w0uuy', 'w9cwfqk3f0'].map(
        galt.geohashToGeohash5
      );
      await assertRevert(this.splitMerge.checkSplitContours(this.baseContour, splitContour1, splitContour2));
    });

    it('should split and merge correctly', async function() {
      const contourToSplitForOldPackage = ['w9cx63zs88', 'w9cx71gk90', 'w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0'].map(
        galt.geohashToGeohash5
      );
      const contourToSplitForNewPackage = ['w9cx63zs88', 'w9cx71gk90', 'w9cx6wbuuy'].map(galt.geohashToGeohash5);

      let res;
      res = await this.splitMerge.initPackage({ from: alice });

      const packageId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);

      await this.splitMerge.setPackageContour(packageId, this.baseContour, { from: alice });

      res = await this.splitMerge.splitPackage(packageId, contourToSplitForOldPackage, contourToSplitForNewPackage, {
        from: alice
      });

      const newPackageId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);

      res = await this.spaceToken.ownerOf.call(packageId);
      assert.equal(res, alice);

      res = await this.splitMerge.getPackageContour.call(packageId);
      assert.deepEqual(res.map(item => item.toString(10)), contourToSplitForOldPackage);

      res = await this.spaceToken.ownerOf.call(newPackageId);
      assert.equal(res, alice);

      res = await this.splitMerge.getPackageContour.call(newPackageId);
      assert.deepEqual(res.map(item => item.toString(10)), contourToSplitForNewPackage);

      await this.splitMerge.mergePackage(newPackageId, newPackageId, this.baseContour, {
        from: alice
      });

      res = await this.splitMerge.getPackageContour.call(newPackageId);
      assert.deepEqual(res.map(item => item.toString(10)), this.baseContour);

      res = await this.spaceToken.exists.call(newPackageId);
      assert.equal(res, false);
    });
  });
});
