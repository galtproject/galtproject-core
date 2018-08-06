const PlotManager = artifacts.require('./PlotManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { ether, assertRevert } = require('../helpers');
const galt = require('../helpers/galt');

const web3 = new Web3(PlotManager.web3.currentProvider);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('PlotManager', ([deployer, alice, bob]) => {
  beforeEach(async function() {
    this.plotManager = await PlotManager.new({ from: deployer });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: deployer });
    this.splitMerge = await SplitMerge.new({ from: deployer });

    this.spaceToken.initialize(this.plotManager.address, 'SpaceToken', 'SPACE', { from: deployer });
    this.spaceToken.setSplitMerge(this.splitMerge.address, { from: deployer });
    this.plotManager.initialize(this.spaceToken.address, this.splitMerge.address, { from: deployer });
    this.splitMerge.initialize(this.spaceToken.address, { from: deployer });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  describe('contract', () => {
    it('should provide methods to create and read an application', async function() {
      const initVertices = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
      const initLedgerIdentifier = 'шц50023中222ائِيل';

      const vertices = initVertices.map(galt.geohashToNumber);
      const credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
      const ledgerIdentifier = web3.utils.utf8ToHex(initLedgerIdentifier);
      const res = await this.plotManager.applyForPlotOwnership(
        vertices,
        credentials,
        ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        7,
        { from: alice, gas: 500000 }
      );

      const aId = res.events.NewApplication.returnValues.id;

      const res2 = await this.plotManager.getPlotApplication.call(aId);

      // assertions
      for (let i = 0; i < res2.vertices.length; i++) {
        galt.numberToGeohash(res2.vertices[i]).should.be.equal(initVertices[i]);
      }

      assert.equal(res2.status, 1);
      assert.equal(res2.precision, 7);
      assert.equal(res2.applicant.toLowerCase(), alice);
      assert.equal(web3.utils.hexToAscii(res2.country), 'MN');
      assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), initLedgerIdentifier);
    });

    it.only('should mint package-token to SplitMerge contract', async function() {
      this.timeout(20000);
      const initVertices = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
      const initLedgerIdentifier = 'шц50023中222ائِيل';

      const vertices = initVertices.map(galt.geohashToNumber);
      const credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
      const ledgerIdentifier = web3.utils.utf8ToHex(initLedgerIdentifier);
      let res = await this.plotManager.applyForPlotOwnership(
        vertices,
        credentials,
        ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        7,
        { from: alice, gas: 500000 }
      );

      const aId = res.logs[0].args.id;
      // console.log('Application ID:', aId);

      res = await this.plotManager.mintPack(aId, { from: alice });
      const packTokenId = res.logs[0].args.spaceTokenId;
      // console.log('Pack Token ID:', packTokenId);

      let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
      geohashes += ` gbsuv7zq	gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
      geohashes = geohashes.split(' ').map(galt.geohashToNumber);
      res = await this.plotManager.pushGeohashes(aId, geohashes, { from: alice });

      geohashes = `sezu7zht sezu7zhv sezu7zjj sezu7zhs sezu7zhu sezu7zjh sezu7zhe	sezu7zhg sezu7zj5`;
      geohashes = geohashes.split(' ').map(galt.geohashToNumber);
      res = await this.plotManager.pushGeohashes(aId, geohashes, { from: alice });

      // Verify pre-swap state
      res = await this.plotManagerWeb3.methods.getPlotApplication(aId).call({ form: alice });

      let packageToken = res.packageToken;
      let geohashTokens = res.geohashTokens;
      let status = res.status;

      console.log('splitMerge', this.splitMerge.address);
      console.log('plotManager', this.plotManager.address);

      assert.equal(status, 1);

      res = await this.spaceToken.ownerOf.call(res.packageToken);
      assert.equal(res, this.splitMerge.address);

      for (let i = 0; i < geohashTokens; i++) {
        let localRes = await this.spaceToken.ownerOf.call(res.geohashTokens[i]);
        assert.equal(localRes, this.plotManager.address);
      }

      // Swap
      await this.plotManager.swapTokens(aId, { from: alice });

      // Verify after-swap state
      res = await this.plotManagerWeb3.methods.getPlotApplication(aId).call({ form: alice });

      packageToken = res.packageToken;
      geohashTokens = res.geohashTokens;
      status = res.status;

      console.log('splitMerge', this.splitMerge.address);
      console.log('plotManager', this.plotManager.address);
      assert.equal(status, 2);

      res = await this.spaceToken.ownerOf.call(res.packageToken);
      assert.equal(res, this.plotManager.address);

      for (let i = 0; i < geohashTokens; i++) {
        let localRes = await this.spaceToken.ownerOf.call(res.geohashTokens[i]);
        assert.equal(localRes, this.splitMerge.address);
      }

      // TODO: validators management
      // TODO: application submition by applicant
      // TODO: application approval by validator
      res = await this.spaceToken.totalSupply.call();
      assert.equal(res, 25);
    });
  });
});
