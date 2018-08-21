const MockToken = artifacts.require('./mocks/MockToken.sol');
// eslint-disable-next-line
const MockToken_V2 = artifacts.require('./mocks/MockToken_V2.sol');
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
contract('Proxy Upgrade', ([coreTeam, proxyAdmin, alice, bob, charlie]) => {
  beforeEach(async function() {
    const initialMockToken = await MockToken.new({ from: coreTeam });
    const proxy = await AdminUpgradeabilityProxy.new(initialMockToken.address, { from: proxyAdmin });

    this.mockToken = await MockToken.at(proxy.address);
    this.mockTokenWeb3 = new web3.eth.Contract(this.mockToken.abi, proxy.address, { from: alice });

    await this.mockToken.initialize({ from: bob });
    await this.mockToken.mint(alice, ether(100), { from: bob });
    this.proxyAddress = proxy.address;
  });

  describe('v1', () => {
    it('should provide access to call logic contract methods', async function() {
      const res = await this.mockTokenWeb3.methods.balanceOf(alice).call({ from: bob });
      res.should.be.a.bignumber.eq(ether(100));
    });

    it('should fail when calling v2 method', async function() {
      try {
        await this.mockTokenWeb3.methods.faucet().send({ from: charlie });
        assert.fail('Method works while shouldnt');
      } catch (e) {
        assert(e);
      }
    });
  });

  describe('v2', () => {
    beforeEach(async function() {
      await this.mockToken.transfer(bob, ether(42), { from: alice });
      const proxy = await AdminUpgradeabilityProxy.at(this.proxyAddress);

      // deploying a new version of the token...
      const mockTokenV2 = await MockToken_V2.new({ from: coreTeam });
      proxy.upgradeTo(mockTokenV2.address, { from: proxyAdmin });

      this.mockTokenV2 = await MockToken_V2.at(proxy.address);
      this.mockTokenWeb3V2 = new web3.eth.Contract(this.mockTokenV2.abi, proxy.address, { from: alice });
    });

    it('should still provide access to call logic contract methods', async function() {
      let res = await this.mockTokenWeb3V2.methods.balanceOf(alice).call({ from: bob });
      res.should.be.a.bignumber.eq(ether(100 - 42));
      res = await this.mockTokenWeb3V2.methods.balanceOf(bob).call({ from: bob });
      res.should.be.a.bignumber.eq(ether(42));
    });

    it('should provide v2 methods', async function() {
      let res = await this.mockTokenWeb3V2.methods.balanceOf(charlie).call({ from: bob });
      res.should.be.a.bignumber.eq(ether(0));

      await this.mockTokenWeb3V2.methods.faucet().send({ from: charlie });

      res = await this.mockTokenWeb3V2.methods.balanceOf(charlie).call({ from: bob });
      res.should.be.a.bignumber.eq(ether(87));
    });
  });
});
