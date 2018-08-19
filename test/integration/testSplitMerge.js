const PlotManager = artifacts.require('./PlotManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const pIteration = require('p-iteration');

const web3 = new Web3(PlotManager.web3.currentProvider);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SplitMerge', ([coreTeam, alice]) => {
  beforeEach(async function() {
      this.initFirstGeohash = 'sezu05';
      this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];

      this.firstGeohash = galt.geohashToGeohash5(this.initFirstGeohash);
      this.contour = this.initContour.map(galt.geohashToGeohash5);

      this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
      this.splitMerge = await SplitMerge.new({ from: coreTeam });

      this.plotManager = await PlotManager.new({ from: coreTeam });

      this.spaceToken.initialize('SpaceToken', 'SPACE', { from: coreTeam });
      this.splitMerge.initialize(this.spaceToken.address, this.plotManager.address, { from: coreTeam });

      this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
      this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

      this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
      this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  describe('contract', () => {
    it.only('should creating correctly', async function() {
      let res;
      // TODO: remove console.log lines when the tests work
      // console.log('spaceToken.mintGeohash', alice, this.firstGeohash);
      res = await this.spaceToken.mintGeohash(alice, this.firstGeohash, { from: coreTeam });

      res = await this.splitMerge.initPackage(galt.geohashToTokenId(this.firstGeohash), { from: alice });

      const packageId = res.logs[0].args.id;
      console.log('packageId', packageId);
      //
      // res = await this.spaceToken.ownerOf.call(packageId);
      // assert.equal(res, alice);
      //
      // // console.log('setPackageContour', packageId, geohashes);
      // await this.splitMerge.setPackageContour(packageId, geohashes, { from: alice });
      //
      // const neighbors = [];
      // const directions = [];
      //
      // await pIteration.forEach(geohashes, async geohash => {
      //   // console.log('mint', geohash);
      //   res = await this.spaceToken.mintGeohash(alice, geohash, { from: deployer });
      //   neighbors.push(res.logs[0].args.id);
      //   directions.push(web3.utils.asciiToHex('N'));
      // });
      //
      // await this.splitMerge.addGeohashesToPackage(packageId, geohashes, neighbors, directions, { from: alice });
      //
      // res = await this.splitMerge.packageGeohashesCount.call(packageId);
      // assert.equal(res.toString(10), (geohashes.length + 1).toString(10));
      //
      // await this.splitMerge.removeGeohashesFromPackage(packageId, geohashes, directions, directions, { from: alice });
      //
      // res = await this.splitMerge.packageGeohashesCount.call(packageId);
      // assert.equal(res.toString(10), (0).toString(10));
    });
  });
});
