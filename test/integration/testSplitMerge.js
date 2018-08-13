const PlotManager = artifacts.require('./PlotManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const pIteration = require('p-iteration');
const { ether } = require('../helpers');

const web3 = new Web3(PlotManager.web3.currentProvider);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SplitMerge', ([deployer, alice, bob, charlie]) => {
  beforeEach(async function() {
    this.plotManager = await PlotManager.new({ from: deployer });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: deployer });
    this.splitMerge = await SplitMerge.new({ from: deployer });

    this.spaceToken.initialize(deployer, 'SpaceToken', 'SPACE', { from: deployer });
    this.spaceToken.setSplitMerge(this.splitMerge.address, { from: deployer });
    this.plotManager.initialize(this.spaceToken.address, this.splitMerge.address, { from: deployer });
    this.splitMerge.initialize(this.spaceToken.address, { from: deployer });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
    this.splitMergeWeb3 = new web3.eth.Contract(this.splitMerge.abi, this.splitMerge.address);
  });

  // TODO: fix spaceToken.mint error and unskip test
  describe.skip('contract', () => {
    it('should creating correctly', async function() {
      const initFirstGeohash = 'sdesde';
      const initGeohashes = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];

      const firstGeohash = galt.geohashToNumber(initFirstGeohash);
      const geohashes = initGeohashes.map(galt.geohashToNumber);

      console.log('spaceToken.mint', alice, firstGeohash);
      // TODO: fix error by web3 Error: Transaction has been reverted by the EVM:
      // by truffle: Error: Invalid number of arguments to Solidity function
      await this.spaceTokenWeb3.methods.mint(alice, firstGeohash).send({ from: deployer });

      console.log('splitMerge.initPackage', firstGeohash);
      const packageId = await this.splitMerge.initPackage(firstGeohash, { from: alice });

      console.log('setPackageContour', geohashes);
      await this.splitMergeWeb3.methods.setPackageContour(packageId, geohashes).send({ from: alice });

      await pIteration.forEach(geohashes, async geohashN => {
        console.log('mint', geohashN);
        await this.spaceTokenWeb3.methods.mint(alice, geohashN).send({ from: deployer });

        console.log('addGeohashToPackage', geohashN);
        await this.splitMergeWeb3.methods
          .addGeohashToPackage(packageId, geohashN, firstGeohash, web3.utils.asciiToHex('N'))
          .send({ from: alice });
      });
    });
  });
});
