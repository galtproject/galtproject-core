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

contract('SplitMerge', ([deployer, alice]) => {
  beforeEach(async function() {
    this.plotManager = await PlotManager.new({ from: deployer });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: deployer });
    this.splitMerge = await SplitMerge.new({ from: deployer });

    this.spaceToken.initialize('SpaceToken', 'SPACE', { from: deployer });
    this.spaceToken.addRoleTo(this.splitMerge.address, 'minter', { from: deployer });
    this.spaceToken.addRoleTo(this.splitMerge.address, 'operator', { from: deployer });
    this.plotManager.initialize(this.spaceToken.address, this.splitMerge.address, { from: deployer });
    this.splitMerge.initialize(this.spaceToken.address, { from: deployer });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
    this.splitMergeWeb3 = new web3.eth.Contract(this.splitMerge.abi, this.splitMerge.address);
  });

  // TODO: fix spaceToken.mint error and unskip test
  describe.skip('contract', () => {
    it('should creating correctly', async function() {
      let res;

      const initFirstGeohash = 'sdesde';
      const initGeohashes = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];

      const firstGeohash = galt.geohashToNumber(initFirstGeohash).toString(10);
      const geohashes = initGeohashes.map(galt.geohashToNumber).map(geohash => geohash.toString(10));

      // TODO: remove console.log lines when the tests work
      // console.log('spaceToken.mint', alice, firstGeohash);
      // TODO: fix error by web3 Error: Transaction has been reverted by the EVM:
      await this.spaceToken.mint(alice, firstGeohash, { from: deployer });
      // await this.spaceTokenWeb3.methods.mint(alice, firstGeohash).send({ from: deployer });

      // console.log('splitMerge.initPackage', firstGeohash);
      res = await this.splitMerge.initPackage(firstGeohash, { from: alice });

      const packageId = res.logs[0].args.id;

      res = await this.spaceToken.ownerOf.call(packageId);
      assert.equal(res, alice);

      // console.log('setPackageContour', packageId, geohashes);
      await this.splitMerge.setPackageContour(packageId, geohashes, { from: alice });

      const neighbors = [];
      const directions = [];

      await pIteration.forEach(geohashes, async geohash => {
        // console.log('mint', geohash);
        await this.spaceToken.mint(alice, geohash, { from: deployer });
        neighbors.push(firstGeohash);
        directions.push(web3.utils.asciiToHex('N'));
      });

      await this.splitMerge.addGeohashesToPackage(packageId, geohashes, neighbors, directions, { from: alice });

      res = await this.splitMerge.packageGeohashesCount.call(packageId);
      assert.equal(res.toString(10), (geohashes.length + 1).toString(10));
    });
  });
});
