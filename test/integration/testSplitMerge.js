const PlotManager = artifacts.require('./PlotManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
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
    this.splitMerge = await SplitMerge.new(this.spaceToken.address, { from: deployer });

    this.spaceToken.initialize(this.plotManager.address, 'SpaceToken', 'SPACE', { from: deployer });
    this.spaceToken.setSplitMerge(this.splitMerge.address, { from: deployer });
    this.plotManager.initialize(this.spaceToken.address, this.splitMerge.address, { from: deployer });
    this.splitMerge.initialize(this.spaceToken.address, { from: deployer });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  describe('contract', () => {
    it.only('should creating correctly', async function() {
      const initFirstGeohash = 'sdesde';
      const initGeohashes = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];

      const firstGeohash = galt.geohashToNumber('sdesde');
      const geohashes = initGeohashes.map(galt.geohashToNumber);

      await this.spaceToken.mint(alice, firstGeohash, { from: deployer });

      const packageId = await this.splitMerge.initPackage(firstGeohash, { from: alice });
    });
  });
});
