const GaltToken = artifacts.require('./GaltToken.sol');
const Web3 = require('web3');
const { initHelperWeb3, ether, assertRevert } = require('../helpers');

const web3 = new Web3(GaltToken.web3.currentProvider);

initHelperWeb3(web3);

contract('GaltToken', ([deployer, alice, bob]) => {
  beforeEach(async function() {
    this.galtToken = await GaltToken.new({ from: deployer });
  });

  describe('#mint()', () => {
    it('should allow deployer mint some tokens', async function() {
      await this.galtToken.mint(alice, ether(42), { from: deployer });
      const res = await this.galtToken.balanceOf(alice);
      assert.equal(res.toString(), ether(42));
    });

    it('should deny non-owner mint operation', async function() {
      await assertRevert(this.galtToken.mint(alice, ether(42), { from: bob }));
      const res = await this.galtToken.balanceOf(alice);
      assert.equal(res.toString(), 0);
    });
  });
});
