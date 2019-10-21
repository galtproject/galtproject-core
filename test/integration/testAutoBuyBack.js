const AutoBuyBack = artifacts.require('./AutoBuyBack.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const MockDex = artifacts.require('./MockDex.sol');
const { ether } = require('../helpers');

const { web3 } = AutoBuyBack;

contract('AutoBuyBack', ([coreTeam, alice, bob]) => {
  beforeEach(async function() {
    this.galtToken = await GaltToken.new();
    this.mockDex = await MockDex.new(this.galtToken.address);
    this.autoBuyBack = await AutoBuyBack.new(this.mockDex.address, 1, { from: coreTeam });
    await this.galtToken.mint(this.mockDex.address, ether(42));
    assert.equal(await this.galtToken.balanceOf(this.mockDex.address), ether(42));
  });

  describe('#mint()', () => {
    it('should allow sending eths to contract', async function() {
      await this.autoBuyBack.sendTransaction({ from: alice, value: ether(200) });
      assert.equal(await web3.eth.getBalance(this.autoBuyBack.address), ether(200));

      await this.autoBuyBack.swap({ from: bob });

      assert.equal(await web3.eth.getBalance(this.mockDex.address), ether(200));
      assert.equal(await this.galtToken.balanceOf(this.autoBuyBack.address), ether(42));

      await this.autoBuyBack.swap({ from: alice });

      assert.equal(await web3.eth.getBalance(this.mockDex.address), ether(200));
      assert.equal(await this.galtToken.balanceOf(this.autoBuyBack.address), ether(42));
    });
  });
});
