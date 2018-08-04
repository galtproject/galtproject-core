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
    this.plotManagerTruffle = await PlotManager.new({ from: deployer });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: deployer });
    this.splitMerge = await SplitMerge.new({ from: deployer });

    this.spaceToken.initialize(this.plotManagerTruffle.address, 'SpaceToken', 'SPACE', { from: deployer });
    this.plotManagerTruffle.initialize(this.spaceToken.address, this.splitMerge.address, { from: deployer });

    this.plotManager = new web3.eth.Contract(this.plotManagerTruffle.abi, this.plotManagerTruffle.address);
    this.spaceToken = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  describe('contract', () => {
    it('should provide methods to create and read an application', async function() {
      const initVertices = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
      const initLedgerIdentifier = 'шц50023中222ائِيل';

      const vertices = initVertices.map(galt.geohashToNumber);
      const credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
      const ledgerIdentifier = web3.utils.utf8ToHex(initLedgerIdentifier);
      const res = await this.plotManager.methods
        .applyForPlotOwnership(vertices, credentials, ledgerIdentifier, web3.utils.asciiToHex('MN'), 7)
        .send({ from: alice, gas: 500000 });

      const aId = res.events.NewApplication.returnValues.id;

      const res2 = await this.plotManager.methods.getPlotApplication(aId).call();

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

    it('should mint package-token to SplitMerge contract', async function() {
      this.timeout(20000);
      const initVertices = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
      const initLedgerIdentifier = 'шц50023中222ائِيل';

      const vertices = initVertices.map(galt.geohashToNumber);
      const credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
      const ledgerIdentifier = web3.utils.utf8ToHex(initLedgerIdentifier);
      const send = this.plotManager.methods
        .applyForPlotOwnership(vertices, credentials, ledgerIdentifier, web3.utils.asciiToHex('MN'), 7)
        .send({ from: alice, gas: 500000 });

      let res = await send;
      const aId = res.events.NewApplication.returnValues.id;
      // console.log('Application ID:', aId);

      res = await this.plotManagerTruffle.mintPack(aId, { from: alice });
      const packTokenId = res.logs[0].args.spaceTokenId;
      // console.log('Pack Token ID:', packTokenId);

      let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
      geohashes += ` gbsuv7zq	gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
      geohashes = geohashes.split(' ').map(galt.geohashToNumber);
      res = await this.plotManagerTruffle.pushGeohashes(aId, geohashes, { from: alice });

      geohashes = `sezu7zht sezu7zhv sezu7zjj sezu7zhs sezu7zhu sezu7zjh sezu7zhe	sezu7zhg sezu7zj5`;
      geohashes = geohashes.split(' ').map(galt.geohashToNumber);
      res = await this.plotManagerTruffle.pushGeohashes(aId, geohashes, { from: alice });

      // TODO: exchange tokens between PlotManager and SplitMerge
      // TODO: validators management
      // TODO: application submition by applicant
      // TODO: application approval by validator
      res = await this.spaceToken.methods.totalSupply().call();
      assert.equal(res, 25);
    });
  });
});
