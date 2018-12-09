const SpaceToken = artifacts.require('./SpaceToken.sol');
const SpaceReputationAccounting = artifacts.require('./SpaceReputationAccounting.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { zeroAddress, assertRevert, initHelperWeb3 } = require('../helpers');

const web3 = new Web3(SpaceReputationAccounting.web3.currentProvider);

initHelperWeb3(web3);

chai.use(chaiAsPromised);

contract('SpaceReputationAccounting', ([coreTeam, minter, alice, bob, charlie, dan, eve]) => {
  beforeEach(async function() {
    this.spaceToken = await SpaceToken.new('Name', 'Symbol', { from: coreTeam });
    this.spaceReputationAccounting = await SpaceReputationAccounting.new(this.spaceToken.address, { from: coreTeam });
    this.spaceToken.setSpaceReputationAccounting(this.spaceReputationAccounting.address, { from: coreTeam });
    this.spaceToken.addRoleTo(minter, 'minter', { from: coreTeam });

    this.spaceReputationAccountingWeb3 = new web3.eth.Contract(
      this.spaceReputationAccounting.abi,
      this.spaceReputationAccounting.address
    );
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  describe('SpaceToken callback handlers', () => {
    it('should ignore permissions check if spaceReputationAccounting set to 0x0', async function() {
      this.spaceToken.setSpaceReputationAccounting(zeroAddress, { from: coreTeam });
      this.spaceToken.addRole(coreTeam, 'minter', { from: coreTeam });
      let res = this.spaceToken.mint(alice);
      const token1 = res.logs[0].args.id;

      res = this.spaceToken.ownerOf(token1);
      assert.equal(res.toLowerCase(), alice);
    });
  });

  describe('transfer', () => {
    it('should handle basic transfer case', async function() {
      let res = await this.spaceToken.mint(alice, { from: minter });
      const token1 = res.logs[0].args.tokenId.toNumber();

      res = await this.spaceTokenWeb3.methods.ownerOf(token1).call();
      assert.equal(res.toLowerCase(), alice);

      // HACK
      await this.spaceReputationAccounting.setTokenArea(token1, 800, { from: alice });

      // STAKE
      await assertRevert(this.spaceReputationAccounting.stake(token1, { from: minter }));
      await this.spaceReputationAccounting.stake(token1, { from: alice });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 800);

      // TRANSFER #1
      await this.spaceReputationAccounting.transfer(bob, alice, 350, { from: alice });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 450);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 350);

      // TRANSFER #2
      await this.spaceReputationAccounting.transfer(charlie, alice, 100, { from: bob });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 450);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 250);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 100);

      // TRANSFER #3
      await this.spaceReputationAccounting.transfer(alice, alice, 50, { from: charlie });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 500);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 250);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 50);

      // REVOKE #1
      await this.spaceReputationAccounting.revoke(bob, 200, { from: alice });

      await assertRevert(this.spaceReputationAccounting.revoke(bob, 200, { from: charlie }));
      await assertRevert(this.spaceReputationAccounting.revoke(alice, 200, { from: charlie }));

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 700);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 50);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 50);

      // REVOKE #2
      await assertRevert(this.spaceReputationAccounting.unstake(token1, { from: alice}));

      await this.spaceReputationAccounting.revoke(bob, 50, { from: alice });
      await this.spaceReputationAccounting.revoke(charlie, 50, { from: alice });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 800);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 0);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 0);

      // UNSTAKE
      await this.spaceReputationAccounting.unstake(token1, { from: alice });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 0);
    });
  });
});
