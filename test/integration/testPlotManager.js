const PlotManager = artifacts.require('./PlotManager.sol');
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
    this.plotManager = new web3.eth.Contract(this.plotManagerTruffle.abi, this.plotManagerTruffle.address);
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
      assert.equal(web3.utils.hexToAscii(res2.country), 'MN');
      assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), initLedgerIdentifier);
    });
  });
});
