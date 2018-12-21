const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const SpaceReputationAccounting = artifacts.require('./SpaceReputationAccounting.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const Oracles = artifacts.require('./Oracles.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { ether, zeroAddress, assertRevert, initHelperWeb3 } = require('../helpers');
const { deployMultiSigFactory } = require('../deploymentHelpers');

const web3 = new Web3(SpaceReputationAccounting.web3.currentProvider);

initHelperWeb3(web3);

chai.use(chaiAsPromised);

contract('SpaceReputationAccounting', accounts => {
  const [coreTeam, minter, alice, bob, charlie, a1, a2, a3, claimManager] = accounts;

  beforeEach(async function() {
    this.spaceToken = await SpaceToken.new('Name', 'Symbol', { from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    this.spaceReputationAccounting = await SpaceReputationAccounting.new(
      this.spaceToken.address,
      this.multiSigRegistry.address,
      { from: coreTeam }
    );
    this.spaceToken.setSpaceReputationAccounting(this.spaceReputationAccounting.address, { from: coreTeam });
    this.spaceToken.addRoleTo(minter, 'minter', { from: coreTeam });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    this.spaceReputationAccountingWeb3 = new web3.eth.Contract(
      this.spaceReputationAccounting.abi,
      this.spaceReputationAccounting.address
    );
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  describe('SpaceToken callback handlers', () => {
    it('should ignore permissions check if spaceReputationAccounting set to 0x0', async function() {
      this.spaceToken.setSpaceReputationAccounting(zeroAddress, { from: coreTeam });
      this.spaceToken.addRoleTo(coreTeam, 'minter', { from: coreTeam });
      let res = await this.spaceToken.mint(alice);
      const token1 = res.logs[0].args.tokenId;

      res = await this.spaceToken.ownerOf(token1);
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
      await this.spaceReputationAccounting.delegate(bob, alice, 350, { from: alice });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 450);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 350);

      // TRANSFER #2
      await this.spaceReputationAccounting.delegate(charlie, alice, 100, { from: bob });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 450);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 250);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 100);

      // TRANSFER #3
      await this.spaceReputationAccounting.delegate(alice, alice, 50, { from: charlie });

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
      await assertRevert(this.spaceReputationAccounting.unstake(token1, { from: alice }));

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

  describe('revokeLocked', () => {
    it('should allow revoking locked reputation', async function() {
      this.multiSigFactory = await deployMultiSigFactory(
        this.galtToken.address,
        this.oracles,
        claimManager,
        this.multiSigRegistry,
        this.spaceReputationAccounting.address,
        coreTeam
      );
      await this.galtToken.approve(this.multiSigFactory.address, ether(30), { from: alice });
      let res = await this.multiSigFactory.build([a1, a2, a3], 2, { from: alice });
      const abMultiSigX = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);

      res = await this.multiSigFactory.build([a1, a2, a3], 2, { from: alice });
      const abMultiSigY = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);

      res = await this.multiSigFactory.build([a1, a2, a3], 2, { from: alice });
      const abMultiSigZ = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);

      res = await this.spaceToken.mint(alice, { from: minter });
      const token1 = res.logs[0].args.tokenId.toNumber();

      // HACK
      await this.spaceReputationAccounting.setTokenArea(token1, 800, { from: alice });

      // STAKE
      await this.spaceReputationAccounting.stake(token1, { from: alice });
      await this.spaceReputationAccounting.delegate(bob, alice, 350, { from: alice });
      await this.spaceReputationAccounting.delegate(charlie, alice, 100, { from: bob });
      await this.spaceReputationAccounting.delegate(alice, alice, 50, { from: charlie });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 500);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 250);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 50);

      // Bob stakes reputation in multiSigA
      await this.spaceReputationAccounting.lockReputation(abMultiSigX.address, 100, { from: bob });
      await this.spaceReputationAccounting.lockReputation(abMultiSigY.address, 30, { from: bob });
      await this.spaceReputationAccounting.lockReputation(abMultiSigZ.address, 70, { from: bob });

      // Alice can revoke only 50 unlocked reputation tokens
      await assertRevert(this.spaceReputationAccounting.revoke(bob, 51, { from: alice }));
      await this.spaceReputationAccounting.revoke(bob, 50, { from: alice });

      // To revoke locked reputation Alice uses #revokeLocked() and explicitly
      // specifies multiSig to revoke reputation from
      await assertRevert(this.spaceReputationAccounting.revokeLocked(bob, abMultiSigX.address, 101, { from: alice }));
      await assertRevert(this.spaceReputationAccounting.revokeLocked(bob, abMultiSigX.address, 100, { from: bob }));
      await this.spaceReputationAccounting.revokeLocked(bob, abMultiSigX.address, 100, { from: alice });
      await assertRevert(this.spaceReputationAccounting.revokeLocked(bob, abMultiSigY.address, 31, { from: alice }));
      await assertRevert(this.spaceReputationAccounting.revokeLocked(bob, abMultiSigY.address, 30, { from: bob }));
      await this.spaceReputationAccounting.revokeLocked(bob, abMultiSigY.address, 30, { from: alice });
      await assertRevert(this.spaceReputationAccounting.revokeLocked(bob, abMultiSigZ.address, 71, { from: alice }));
      await assertRevert(this.spaceReputationAccounting.revokeLocked(bob, abMultiSigZ.address, 70, { from: bob }));
      await this.spaceReputationAccounting.revokeLocked(bob, abMultiSigZ.address, 70, { from: alice });
    });
  });
});
