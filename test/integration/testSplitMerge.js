const Geodesic = artifacts.require('./Geodesic.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SpaceSplitOperation = artifacts.require('./SpaceSplitOperation.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');

const web3 = new Web3(SpaceToken.web3.currentProvider);

const { BN } = Web3.utils;
const { assertRevert, deploySplitMerge, initHelperArtifacts, clearLibCache } = require('../helpers');

initHelperArtifacts(artifacts);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SplitMerge', ([coreTeam, alice]) => {
  before(clearLibCache);

  beforeEach(async function() {
    this.subjectContour = ['w9cx6wbuuy', 'w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0'].map(galt.geohashToGeohash5);

    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.splitMerge = await deploySplitMerge(this.spaceToken.address);

    this.geodesic = Geodesic.at(await this.splitMerge.geodesic());

    await this.splitMerge.initialize(this.spaceToken.address, { from: coreTeam });

    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'burner');

    await this.splitMerge.addRoleTo(coreTeam, await this.splitMerge.GEO_DATA_MANAGER());

    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);

    this.processMartinezRueda = async splitOperation => {
      const doneStage = await splitOperation.doneStage();
      if (doneStage >= 5) {
        return;
      }
      await splitOperation.processMartinezRueda();

      await this.processMartinezRueda(splitOperation);
    };

    this.buildResultPolygon = async (splitOperation, n = 0) => {
      const isFinished = await splitOperation.isBuildResultFinished();
      if (isFinished) {
        return;
      }
      if (n > 3) {
        assert(false, 'Too many buildResultPolygon calls');
      }
      await splitOperation.buildResultPolygon();

      await this.buildResultPolygon(splitOperation, n + 1);
    };

    this.mintSpaceTokenId = async geohashContour => {
      const res = await this.splitMerge.initPackage(alice);
      const tokenId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);

      await this.splitMerge.setPackageContour(tokenId, geohashContour.map(galt.geohashToNumber));
      await this.splitMerge.setPackageHeights(tokenId, geohashContour.map(() => 10));
      return tokenId;
    };

    this.getGeohashesContour = async _spaceTokenId =>
      (await this.splitMerge.getPackageContour(_spaceTokenId)).map(geohash =>
        galt.numberToGeohash(geohash.toString(10))
      );

    this.splitPackage = async (subjectSpaceTokenId, clippingContour) => {
      let res;
      await this.spaceToken.approve(this.splitMerge.address, subjectSpaceTokenId, { from: alice });
      res = await this.splitMerge.startSplitOperation(
        subjectSpaceTokenId,
        clippingContour.map(galt.geohashToGeohash5),
        {
          from: alice
        }
      );

      const splitOperation = await SpaceSplitOperation.at(res.logs[0].args.splitOperation);

      const clippingContourResponse = await splitOperation.getClippingContour();
      assert.deepEqual(
        clippingContourResponse.map(g => g.toString(10)),
        clippingContour.map(g => galt.geohashToGeohash5(g).toString())
      );
      await splitOperation.prepareAndInitAllPolygons();
      await splitOperation.addSubjectPolygonSegments();
      await splitOperation.addClippingPolygonSegments();
      await this.processMartinezRueda(splitOperation);

      // processWeilerAtherton
      await splitOperation.addIntersectedPoints();
      await this.buildResultPolygon(splitOperation);
      await splitOperation.buildSubjectPolygonOutput();

      await splitOperation.finishAllPolygons();

      res = await this.splitMerge.finishSplitOperation(subjectSpaceTokenId, {
        from: alice
      });

      return res.logs.map(log => log.args.id);
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

      await this.splitMerge.setPackageContour(packageId, this.subjectContour, { from: coreTeam });

      res = (await this.splitMerge.getPackageContour(packageId)).map(geohash => geohash.toString(10));

      assert.deepEqual(res, this.subjectContour.map(geohash => geohash.toString(10)));
    });

    it('should check merge correctly', async function() {
      const sourceContour = ['w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0', 'w9cx63zs88', 'w9cx71gk90'].map(
        galt.geohashToGeohash5
      );
      const mergeContour = ['w9cx6wbuuy', 'w9cx63zs88', 'w9cx71gk90'].map(galt.geohashToGeohash5);
      await this.splitMerge.checkMergeContours(sourceContour, mergeContour, this.subjectContour);
    });

    it('should reject incorrect split by duplicate geohash of merge contour', async function() {
      const sourceContour = ['w9cx71g9s1b', 'w9cwg7dkdrp', 'w9cwfqk3f0m', 'w9cx63zs884', 'w9cx71gk90n'].map(
        galt.geohashToGeohash5
      );
      const mergeContour = ['w9cx6wbuuyu', 'w9cx63zs884', 'w9cx6wbuuyu', 'w9cx71gk90n'].map(galt.geohashToGeohash5);
      await assertRevert(this.splitMerge.checkMergeContours(sourceContour, mergeContour, this.subjectContour));
    });

    it('should correctly split 4, 4 => 6, 4', async function() {
      const subjectSpaceTokenId = await this.mintSpaceTokenId([
        'w24qfpvbmnkt',
        'w24qf5ju3pkx',
        'w24qfejgkp2p',
        'w24qfxqukn80'
      ]);

      const clippingSpaceTokensIds = await this.splitPackage(subjectSpaceTokenId, [
        'w24r42pt2n24',
        'w24qfmpp2p00',
        'w24qfuvb7zpg',
        'w24r50dr2n0n'
      ]);

      assert.equal(clippingSpaceTokensIds.length, 1);
      assert.deepEqual(await this.getGeohashesContour(clippingSpaceTokensIds[0]), [
        'w24qftn244vj',
        'w24qfxqukn80',
        'w24qfrx3sxuc',
        'w24qfmpp2p00'
      ]);

      assert.deepEqual(await this.getGeohashesContour(subjectSpaceTokenId), [
        'w24qfpvbmnkt',
        'w24qf5ju3pkx',
        'w24qfejgkp2p',
        'w24qftn244vj',
        'w24qfmpp2p00',
        'w24qfrx3sxuc'
      ]);
    });

    it('should correctly split 4, 5 => 7, 5', async function() {
      const subjectSpaceTokenId = await this.mintSpaceTokenId([
        'w24qfpvrmnke',
        'w24qfxtrkyqv',
        'w24qfev5kp24',
        'w24qf5mkrzrv'
      ]);

      const clippingSpaceTokensIds = await this.splitPackage(subjectSpaceTokenId, [
        'w24qfq7pkn8p',
        'w24r42ec2n0p',
        'w24r4c9ekjbp',
        'w24qgn832n8n',
        'w24qfmv92nbh'
      ]);

      assert.equal(clippingSpaceTokensIds.length, 1);
      assert.deepEqual(await this.getGeohashesContour(clippingSpaceTokensIds[0]), [
        'w24qfwj73jy9',
        'w24qfxtrkyqv',
        'w24qfrgs3s5g',
        'w24qfq7pkn8p',
        'w24qfmv92nbh'
      ]);

      assert.deepEqual(await this.getGeohashesContour(subjectSpaceTokenId), [
        'w24qfpvrmnke',
        'w24qfrgs3s5g',
        'w24qfq7pkn8p',
        'w24qfmv92nbh',
        'w24qfwj73jy9',
        'w24qfev5kp24',
        'w24qf5mkrzrv'
      ]);
    });

    it('should correctly split 4, reverse 5 => 7, 5', async function() {
      const subjectSpaceTokenId = await this.mintSpaceTokenId([
        'w24qfpvrmnke',
        'w24qfxtrkyqv',
        'w24qfev5kp24',
        'w24qf5mkrzrv'
      ]);

      const clippingSpaceTokensIds = await this.splitPackage(subjectSpaceTokenId, [
        'w24qfmv92nbh',
        'w24qgn832n8n',
        'w24r4c9ekjbp',
        'w24r42ec2n0p',
        'w24qfq7pkn8p'
      ]);

      assert.equal(clippingSpaceTokensIds.length, 1);
      assert.deepEqual(await this.getGeohashesContour(clippingSpaceTokensIds[0]), [
        'w24qfwj73jy9',
        'w24qfxtrkyqv',
        'w24qfrgs3s5g',
        'w24qfq7pkn8p',
        'w24qfmv92nbh'
      ]);

      assert.deepEqual(await this.getGeohashesContour(subjectSpaceTokenId), [
        'w24qfpvrmnke',
        'w24qfrgs3s5g',
        'w24qfq7pkn8p',
        'w24qfmv92nbh',
        'w24qfwj73jy9',
        'w24qfev5kp24',
        'w24qf5mkrzrv'
      ]);
    });

    it('should correctly split 6, 4 => 4, 4, 6', async function() {
      const subjectSpaceTokenId = await this.mintSpaceTokenId([
        'w24qcv6bkp00',
        'w24qfjpj2p00',
        'w24qf5rp2p2j',
        'w24qf7kb2p2n',
        'w24qf3uc2pb1',
        'w24qccsm2pb4'
      ]);

      const clippingSpaceTokensIds = await this.splitPackage(subjectSpaceTokenId, [
        'w24qf5xh8cgw',
        'w24qf1wf0zf1',
        'w24qf99npg84',
        'w24qfe8tpg05'
      ]);

      assert.equal(clippingSpaceTokensIds.length, 1);
      assert.deepEqual(await this.getGeohashesContour(clippingSpaceTokensIds[0]), [
        'w24qf1yb198s',
        'w24qf3uc2pb1',
        'w24qf7kb2p2n',
        'w24qf5rp2ppu'
      ]);

      assert.deepEqual(await this.getGeohashesContour(subjectSpaceTokenId), [
        'w24qcv6bkp00',
        'w24qfjpj2p00',
        'w24qf5rp2p2j',
        'w24qf5rp2ppu',
        'w24qf1yb198s',
        'w24qccsm2pb4'
      ]);
    });

    // Not supported case
    it.skip('should correctly split 4, 4 => 4, 4, 4', async function() {
      const subjectSpaceTokenId = await this.mintSpaceTokenId([
        'w24r1bj7mnrd',
        'w24r48n3kyq7',
        'w24qftqu2nbp',
        'w24qcvkt2nbn'
      ]);

      const clippingSpaceTokensIds = await this.splitPackage(subjectSpaceTokenId, [
        'w24r41svrvzz',
        'w24r43tj2jbp',
        'w24qf7q17zry',
        'w24qf57vrzrv'
      ]);

      assert.equal(clippingSpaceTokensIds.length, 1);
      assert.deepEqual(await this.getGeohashesContour(clippingSpaceTokensIds[0]), [
        'w24qf1yb198s',
        'w24qf3uc2pb1',
        'w24qf7kb2p2n',
        'w24qf5rp2ppu'
      ]);

      assert.deepEqual(await this.getGeohashesContour(subjectSpaceTokenId), [
        'w24qcv6bkp00',
        'w24qfjpj2p00',
        'w24qf5rp2p2j',
        'w24qf5rp2ppu',
        'w24qf1yb198s',
        'w24qccsm2pb4'
      ]);
    });

    it('should correctly split 8, 4 => 8, 4, 4', async function() {
      const subjectSpaceTokenId = await this.mintSpaceTokenId([
        'w24qfxzt2yqh',
        'w24r40j43nkg',
        'w24qf4smkp85',
        'w24qfdw2kp8h',
        'w24qfsjyrzpz',
        'w24qfkkm7zpy',
        'w24qfq7d7yzb',
        'w24qfwqykn8p'
      ]);

      const clippingSpaceTokensIds = await this.splitPackage(subjectSpaceTokenId, [
        'w24r42r6qby9',
        'w24qf988qfqe',
        'w24qfct7qfqd',
        'w24r4bhjqbyd'
      ]);

      assert.equal(clippingSpaceTokensIds.length, 2);
      assert.deepEqual(await this.getGeohashesContour(clippingSpaceTokensIds[0]), [
        'w24qfd8d0g8h', // 1200619217705582405,104524644854296247290
        'w24qfdw2kp8h', // 1200340250506997107,104532680679112672805
        'w24qfsjyrzpz', // 1209607785567641256,104532165359705686569
        'w24qfs24wq5y' // 1210331879095087062,104524199219555862637
      ]);

      assert.deepEqual(await this.getGeohashesContour(clippingSpaceTokensIds[1]), [
        'w24qfqrgfqs9', // 1221534521210230496,104523685221763649871
        'w24qfwqykn8p', // 1221964722499251363,104533367324620485305
        'w24qfxzt2yqh', // 1230030963197350500,104534265864640474318
        'w24qfrzx8gt5' // 1230402222620671413,104523278355338755424
      ]);

      assert.deepEqual(await this.getGeohashesContour(subjectSpaceTokenId), [
        'w24qfrzx8gt5', // 1230402222620671413,104523278355338755424
        'w24r40j43nkg', // 1230889102444052694,104508869033306837081
        'w24qf4smkp85', // 1201198389753699301,104507961440831422805
        'w24qfd8d0g8h', // 1200619217705582405,104524644854296247290
        'w24qfs24wq5y', // 1210331879095087062,104524199219555862637
        'w24qfkkm7zpy', // 1210809247568249700,104518947433680295944
        'w24qfq7d7yzb', // 1221278244629502294,104517917465418577194
        'w24qfqrgfqs9' // 1221534521210230496,104523685221763649871
      ]);
    });

    it('should revert split of self0intersected clipping polygon', async function() {
      const subjectSpaceTokenId = await this.mintSpaceTokenId([
        'w24qfj8rmnys',
        'w24qft983nbn',
        'w24qf6pr2p8n',
        'w24qcfr4sh0n'
      ]);

      const clippingContour = ['w24qfpu7xbxy', 'w24qfrw580b5', 'w24qfjjp5tt2', 'w24qfm1uttt9'];

      await this.spaceToken.approve(this.splitMerge.address, subjectSpaceTokenId, { from: alice });
      const res = await this.splitMerge.startSplitOperation(
        subjectSpaceTokenId,
        clippingContour.map(galt.geohashToGeohash5),
        {
          from: alice
        }
      );

      const splitOperation = await SpaceSplitOperation.at(res.logs[0].args.splitOperation);
      await assertRevert(splitOperation.prepareAndInitAllPolygons());
    });

    it('should correctly split 4, 4 => 4, 8', async function() {
      const subjectSpaceTokenId = await this.mintSpaceTokenId([
        'w24qfj8rmnys',
        'w24qft983nbn',
        'w24qf6pr2p8n',
        'w24qcfr4sh0n'
      ]);

      const clippingSpaceTokensIds = await this.splitPackage(subjectSpaceTokenId, [
        'w24qfq8d6606',
        'w24qfhen6688',
        'w24qfkteb688',
        'w24qfq4vhw94'
      ]);

      assert.equal(clippingSpaceTokensIds.length, 1);
      assert.deepEqual(await this.getGeohashesContour(clippingSpaceTokensIds[0]), [
        'w24qfmefgc0c',
        'w24qfjtvhzhf',
        'w24qfhen6688',
        'w24qfkteb688'
      ]);

      assert.deepEqual(await this.getGeohashesContour(subjectSpaceTokenId), [
        'w24qfj8rmnys',
        'w24qfjtvhzhf',
        'w24qfhen6688',
        'w24qfkteb688',
        'w24qfmefgc0c',
        'w24qft983nbn',
        'w24qf6pr2p8n',
        'w24qcfr4sh0n'
      ]);
    });

    it('should correctly split real case 1', async function() {
      const subjectSpaceTokenId = await this.mintSpaceTokenId(['w24r42h56n7d', 'w24qfgy56x3f', 'w24qf6tv6pt5']);

      const clippingSpaceTokensIds = await this.splitPackage(subjectSpaceTokenId, [
        'w24r434v6n4d',
        'w24r4c11qqn5',
        'w24qfm7eqngr'
      ]);

      assert.equal(clippingSpaceTokensIds.length, 1);
      assert.deepEqual(await this.getGeohashesContour(clippingSpaceTokensIds[0]), [
        'w24qfmsve4y7',
        'w24r42h56n7d',
        'w24qfwck0tek'
      ]);

      assert.deepEqual(await this.getGeohashesContour(subjectSpaceTokenId), [
        'w24qfwck0tek',
        'w24qfgy56x3f',
        'w24qf6tv6pt5',
        'w24qfmsve4y7'
      ]);
    });

    // TODO: write test for cancelSplitPackage

    it('should split and then merge correctly', async function() {
      const subjectContour = ['w24qfpvbmnkt', 'w24qf5ju3pkx', 'w24qfejgkp2p', 'w24qfxqukn80'];
      const subjectContourGeohash5 = subjectContour.map(galt.geohashToGeohash5);
      const subjectSpaceTokenId = await this.mintSpaceTokenId(subjectContour);

      const clippingSpaceTokensIds = await this.splitPackage(subjectSpaceTokenId, [
        'w24r42pt2n24',
        'w24qfmpp2p00',
        'w24qfuvb7zpg',
        'w24r50dr2n0n'
      ]);

      assert.equal(await this.spaceToken.ownerOf(subjectSpaceTokenId), alice);
      assert.equal(await this.spaceToken.ownerOf(clippingSpaceTokensIds[0]), alice);

      await this.splitMerge.mergePackage(clippingSpaceTokensIds[0], subjectSpaceTokenId, subjectContourGeohash5, {
        from: alice
      });

      assert.equal(await this.spaceToken.ownerOf(subjectSpaceTokenId), alice);
      assert.deepEqual(await this.getGeohashesContour(subjectSpaceTokenId), subjectContour);
      assert.equal(await this.spaceToken.exists.call(clippingSpaceTokensIds[0]), false);
    });
  });
});
