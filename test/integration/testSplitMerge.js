const PointRedBlackTree = artifacts.require('./utils/PointRedBlackTree.sol');
const SegmentRedBlackTree = artifacts.require('./utils/SegmentRedBlackTree.sol');
const BentleyOttman = artifacts.require('./utils/BentleyOttman.sol');
const WeilerAtherton = artifacts.require('./utils/WeilerAtherton.sol');
const PolygonUtils = artifacts.require('./utils/PolygonUtils.sol');
const LandUtils = artifacts.require('./utils/LandUtils.sol');
const ArrayUtils = artifacts.require('./utils/ArrayUtils.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const SpaceSplitOperation = artifacts.require('./SpaceSplitOperation.sol');
// const _ = require('lodash');
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

contract('SplitMerge', ([coreTeam, alice]) => {
  beforeEach(async function() {
    this.baseContour = ['w9cx6wbuuy', 'w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0'].map(galt.geohashToGeohash5);

    this.arrayUtils = await ArrayUtils.new({ from: coreTeam });

    this.landUtils = await LandUtils.new({ from: coreTeam });
    PolygonUtils.link('LandUtils', this.landUtils.address);

    this.pointRedBlackTree = await PointRedBlackTree.new({ from: coreTeam });
    BentleyOttman.link('PointRedBlackTree', this.pointRedBlackTree.address);

    this.segmentRedBlackTree = await SegmentRedBlackTree.new({ from: coreTeam });
    BentleyOttman.link('SegmentRedBlackTree', this.segmentRedBlackTree.address);

    this.polygonUtils = await PolygonUtils.new({ from: coreTeam });
    this.bentleyOttman = await BentleyOttman.new({ from: coreTeam });
    WeilerAtherton.link('BentleyOttman', this.bentleyOttman.address);
    WeilerAtherton.link('PolygonUtils', this.polygonUtils.address);

    this.weilerAtherton = await WeilerAtherton.new({ from: coreTeam });

    SplitMerge.link('LandUtils', this.landUtils.address);
    SplitMerge.link('ArrayUtils', this.arrayUtils.address);
    SplitMerge.link('PolygonUtils', this.polygonUtils.address);
    SplitMerge.link('WeilerAtherton', this.weilerAtherton.address);

    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.splitMerge = await SplitMerge.new({ from: coreTeam });

    this.splitMerge.initialize(this.spaceToken.address, zeroAddress, { from: coreTeam });
    this.spaceToken.initialize('SpaceToken', 'SPACE', { from: coreTeam });

    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'burner');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.splitMerge.addRoleTo(coreTeam, 'geo_data_manager');

    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);

    this.splitPackage = async (baseContour, cropContour) => {
      const basePackage = baseContour.map(galt.geohashToGeohash5);
      const cropPackage = cropContour.map(galt.geohashToGeohash5);

      let res;
      res = await this.splitMerge.initPackage(alice, { from: coreTeam });
      const basePackageId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);
      await this.splitMerge.setPackageContour(basePackageId, basePackage, { from: coreTeam });
      await this.splitMerge.setPackageHeights(basePackageId, basePackage.map((geohash, index) => index + 10), {
        from: coreTeam
      });

      let totalGasUsed = 0;

      res = await this.splitMerge.startSplitOperation(basePackageId, cropPackage, {
        from: alice
      });
      console.log('      startSplitOperation gasUsed', res.receipt.gasUsed);

      totalGasUsed += res.receipt.gasUsed;

      const splitOperation = await SpaceSplitOperation.at(res.logs[0].args.splitOperation);
      res = await splitOperation.prepareAndInitAllPolygons();
      console.log('      prepareAndInitAllPolygons gasUsed', res.receipt.gasUsed);
      totalGasUsed += res.receipt.gasUsed;
      res = await splitOperation.addAllPolygonsSegments();
      console.log('      addAllPolygonsSegments gasUsed', res.receipt.gasUsed);
      totalGasUsed += res.receipt.gasUsed;
      res = await splitOperation.processBentleyOttman();
      console.log('      processBentleyOttman gasUsed', res.receipt.gasUsed);
      totalGasUsed += res.receipt.gasUsed;
      res = await splitOperation.processBentleyOttman();
      console.log('      processBentleyOttman gasUsed', res.receipt.gasUsed);
      totalGasUsed += res.receipt.gasUsed;
      res = await splitOperation.processWeilerAtherton();
      console.log('      processWeilerAtherton gasUsed', res.receipt.gasUsed);
      totalGasUsed += res.receipt.gasUsed;
      res = await splitOperation.finishAllPolygons();
      console.log('      finishAllPolygons gasUsed', res.receipt.gasUsed);
      totalGasUsed += res.receipt.gasUsed;
      res = await this.splitMerge.finishSplitOperation(basePackageId, {
        from: alice
      });
      console.log('      finishSplitOperation gasUsed', res.receipt.gasUsed);
      totalGasUsed += res.receipt.gasUsed;
      console.log('      totalGasUsed', totalGasUsed);
    };

    this.mergePackage = async (firstContour, secondContour, resultContour) => {
      const firstPackage = firstContour.map(galt.geohashToGeohash5);
      const secondPackage = secondContour.map(galt.geohashToGeohash5);
      const resultPackage = resultContour.map(galt.geohashToGeohash5);

      let res;
      res = await this.splitMerge.initPackage(alice, { from: coreTeam });
      const firstPackageId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);
      await this.splitMerge.setPackageContour(firstPackageId, firstPackage, { from: coreTeam });
      await this.splitMerge.setPackageHeights(firstPackageId, firstPackage.map((geohash, index) => index + 10), {
        from: coreTeam
      });

      res = await this.splitMerge.initPackage(alice, { from: coreTeam });
      const secondPackageId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);
      await this.splitMerge.setPackageContour(secondPackageId, secondPackage, { from: coreTeam });
      await this.splitMerge.setPackageHeights(secondPackageId, secondPackage.map((geohash, index) => index + 10), {
        from: coreTeam
      });

      await this.splitMerge.mergePackage(firstPackageId, secondPackageId, resultPackage, {
        from: alice
      });
    };
  });

  describe('package', () => {
    it('should creating correctly', async function() {
      let res;

      res = await this.splitMerge.initPackage(alice, { from: coreTeam });

      const packageId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);

      res = await this.spaceToken.ownerOf.call(packageId);
      assert.equal(res, alice);

      await this.splitMerge.setPackageContour(packageId, this.baseContour, { from: coreTeam });

      res = (await this.splitMerge.getPackageContour(packageId)).map(geohash => geohash.toString(10));

      assert.deepEqual(res, this.baseContour.map(geohash => geohash.toString(10)));
    });

    it('should check split correctly', async function() {
      const splitContour1 = ['w9cx63zs88', 'w9cx71gk90', 'w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0'].map(
        galt.geohashToGeohash5
      );
      const splitContour2 = ['w9cx63zs88', 'w9cx71gk90', 'w9cx6wbuuy'].map(galt.geohashToGeohash5);
      await this.splitMerge.checkSplitContours(this.baseContour, splitContour1, splitContour2);
    });

    it('should reject incorrect split by duplicate geohash of source contour', async function() {
      const splitContour1 = ['w9cx63zs88', 'w9cx71gk90', 'w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0'].map(
        galt.geohashToGeohash5
      );
      const splitContour2 = ['w9cx63zs88', 'w9cx6wbuuy', 'w9cx71gk90', 'w9cx6wbuuy'].map(galt.geohashToGeohash5);
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

    it('should check merge correctly', async function() {
      const sourceContour = ['w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0', 'w9cx63zs88', 'w9cx71gk90'].map(
        galt.geohashToGeohash5
      );
      const mergeContour = ['w9cx6wbuuy', 'w9cx63zs88', 'w9cx71gk90'].map(galt.geohashToGeohash5);
      await this.splitMerge.checkMergeContours(sourceContour, mergeContour, this.baseContour);
    });

    it('should reject incorrect split by duplicate geohash of merge contour', async function() {
      const sourceContour = ['w9cx71g9s1b', 'w9cwg7dkdrp', 'w9cwfqk3f0m', 'w9cx63zs884', 'w9cx71gk90n'].map(
        galt.geohashToGeohash5
      );
      const mergeContour = ['w9cx6wbuuyu', 'w9cx63zs884', 'w9cx6wbuuyu', 'w9cx71gk90n'].map(galt.geohashToGeohash5);
      await assertRevert(this.splitMerge.checkMergeContours(sourceContour, mergeContour, this.baseContour));
    });

    // describe('should handle 4, 6, 4 contours correctly', () => {
    //   const firstContour = ['w24mjr9xcudz', 'w24mjm2gzc84', 'w24mjmwc2gz8', 'w24mjxbh2rw7'];
    //
    //   const secondContour = [
    //     'w24mjr9xcudz',
    //     'w24mjm2gzc84',
    //     'w24mhugn2gzd',
    //     'w24mkgbt2fzs',
    //     'w24mmedp2fzt',
    //     'w24mjxbh2rw7'
    //   ];
    //
    //   const thirdContour = galt.geohash.contour.mergeContours(firstContour, secondContour, false);
    //
    //   it('should split 4 => 6, 4', async function() {
    //     await this.splitPackage(firstContour, secondContour, thirdContour);
    //   });
    //
    //   it('should merge 4, 6 => 4', async function() {
    //     await this.mergePackage(firstContour, secondContour, thirdContour);
    //   });
    // });

    it.only('should split 4 => 6, 4', async function() {
      await this.splitPackage(
        ['w24qfpvbmnkt', 'w24qf5ju3pkx', 'w24qfejgkp2p', 'w24qfxqukn80'],
        ['w24r42pt2n24', 'w24qfmpp2p00', 'w24qfuvb7zpg', 'w24r50dr2n0n']
      );
    });

    it('should split and then merge correctly', async function() {
      const baseContourAfterSplit = ['w24mjr9xcudz', 'w24mjm2gzc84', 'w24mjmwc2gz8', 'w24mjxbh2rw7'];

      const newContourAfterSplit = [
        'w24mjr9xcudz',
        'w24mjm2gzc84',
        'w24mhugn2gzd',
        'w24mkgbt2fzs',
        'w24mmedp2fzt',
        'w24mjxbh2rw7'
      ];

      let baseContour = galt.geohash.contour.mergeContours(baseContourAfterSplit, newContourAfterSplit, false);

      baseContour = baseContour.map(galt.geohashToGeohash5);
      // const contourToSplitForOldPackage = baseContourAfterSplit.map(galt.geohashToGeohash5);
      // const contourToSplitForNewPackage = newContourAfterSplit.map(galt.geohashToGeohash5);

      const res = await this.splitMerge.initPackage(alice, { from: coreTeam });

      const packageId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);

      await this.splitMerge.setPackageContour(packageId, baseContour, { from: coreTeam });
      await this.splitMerge.setPackageHeights(packageId, baseContour.map((geohash, index) => index + 10), {
        from: coreTeam
      });

      // CACHING
      // await this.splitMerge.checkSplitContours(baseContour, contourToSplitForOldPackage, contourToSplitForNewPackage);

      // res = await this.splitMerge.splitPackage(packageId, contourToSplitForOldPackage, contourToSplitForNewPackage, {
      //   from: alice
      // });
      //
      // const newPackageId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);
      //
      // res = await this.spaceToken.ownerOf.call(packageId);
      // assert.equal(res, alice);
      //
      // const resContour = await this.splitMerge.getPackageContour.call(packageId);
      // assert.deepEqual(resContour.map(item => item.toString(10)), contourToSplitForOldPackage);
      //
      // const resHeights = await this.splitMerge.getPackageHeights.call(packageId);
      // assert.equal(resHeights.some(item => item.toString(10) === '0'), false);
      // assert.equal(resHeights.length === resContour.length, true);
      //
      // res = await this.spaceToken.ownerOf.call(newPackageId);
      // assert.equal(res, alice);
      //
      // res = await this.splitMerge.getPackageContour.call(newPackageId);
      // assert.deepEqual(res.map(item => item.toString(10)), contourToSplitForNewPackage);
      //
      // await this.splitMerge.mergePackage(newPackageId, newPackageId, baseContour, {
      //   from: alice
      // });
      //
      // res = await this.splitMerge.getPackageContour.call(newPackageId);
      // assert.deepEqual(res.map(item => item.toString(10)), baseContour);
      //
      // res = await this.spaceToken.exists.call(newPackageId);
      // assert.equal(res, false);
    });
  });
});
