const MockToken = artifacts.require('./mocks/MockToken.sol');
const AdminUpgradeabilityProxy = artifacts.require('zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { ether, initHelperWeb3 } = require('../helpers');

const web3 = new Web3(MockToken.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

// NOTICE: we don't wrap MockToken with a proxy on production
contract('Proxy', ([deployer, alice, bob]) => {
  beforeEach(async function() {
    const initialMockToken = await MockToken.new({ from: deployer });
    const proxy = await AdminUpgradeabilityProxy.new(initialMockToken.address, { from: deployer });
    const mockTokenTruffle = await MockToken.at(proxy.address);

    this.mockToken = new web3.eth.Contract(mockTokenTruffle.abi, proxy.address, { from: alice });
    await this.mockToken.methods.initialize().send({ from: bob });
    this.proxyAddress = proxy.address;
  });

  describe('Factory', () => {
    it('should provide access to call logic contract methods', async function() {
      const res = await this.mockToken.methods.balanceOf(alice).call({ from: bob });
      res.should.be.a.bignumber.eq(0);
    });

    it('should keep storage between calls', async function() {
      await this.mockToken.methods.mint(alice, ether(42)).send({ from: bob });

      const res = await this.mockToken.methods.balanceOf(alice).call({ from: bob });
      res.should.be.a.bignumber.eq(ether(42));
    });
  });
});
