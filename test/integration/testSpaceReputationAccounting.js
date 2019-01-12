const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const SpaceLockerRegistry = artifacts.require('./SpaceLockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const SpaceLocker = artifacts.require('./SpaceLocker.sol');
const SpaceReputationAccounting = artifacts.require('./SpaceReputationAccounting.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const Oracles = artifacts.require('./Oracles.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { ether, deploySplitMerge, assertRevert, initHelperWeb3, initHelperArtifacts } = require('../helpers');
const { deployMultiSigFactory } = require('../deploymentHelpers');

const web3 = new Web3(SpaceReputationAccounting.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

chai.use(chaiAsPromised);

contract('SpaceReputationAccounting', accounts => {
  const [coreTeam, minter, alice, bob, charlie, a1, a2, a3, geoDateManagement, claimManager] = accounts;

  beforeEach(async function() {
    this.spaceToken = await SpaceToken.new('Name', 'Symbol', { from: coreTeam });
    this.splitMerge = await deploySplitMerge(this.spaceToken.address);
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    this.spaceLockerRegistry = await SpaceLockerRegistry.new({ from: coreTeam });
    this.spaceLockerFactory = await SpaceLockerFactory.new(
      this.spaceLockerRegistry.address,
      this.galtToken.address,
      this.spaceToken.address,
      this.splitMerge.address,
      { from: coreTeam }
    );
    this.spaceReputationAccounting = await SpaceReputationAccounting.new(
      this.spaceToken.address,
      this.multiSigRegistry.address,
      this.spaceLockerRegistry.address,
      { from: coreTeam }
    );
    this.spaceToken.addRoleTo(minter, 'minter', { from: coreTeam });
    this.spaceLockerRegistry.addRoleTo(this.spaceLockerFactory.address, await this.spaceLockerRegistry.ROLE_FACTORY(), {
      from: coreTeam
    });
    await this.splitMerge.addRoleTo(geoDateManagement, 'geo_data_manager', {
      from: coreTeam
    });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    this.spaceReputationAccountingWeb3 = new web3.eth.Contract(
      this.spaceReputationAccounting.abi,
      this.spaceReputationAccounting.address
    );
    this.spaceLockerRegistryWeb3 = new web3.eth.Contract(
      this.spaceLockerRegistry.abi,
      this.spaceLockerRegistry.address
    );
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  describe('transfer', () => {
    it('should handle basic reputation transfer case', async function() {
      let res = await this.spaceToken.mint(alice, { from: minter });
      const token1 = res.logs[0].args.tokenId.toNumber();

      res = await this.spaceTokenWeb3.methods.ownerOf(token1).call();
      assert.equal(res.toLowerCase(), alice);

      // HACK
      await this.splitMerge.setTokenArea(token1, 800, { from: geoDateManagement });

      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: alice });
      res = await this.spaceLockerFactory.build({ from: alice });
      const lockerAddress = res.logs[0].args.locker;

      const locker = await SpaceLocker.at(lockerAddress);
      const lockerWeb3 = new web3.eth.Contract(locker.abi, locker.address);

      // DEPOSIT SPACE TOKEN
      await this.spaceToken.approve(lockerAddress, token1, { from: alice });
      await locker.deposit(token1, { from: alice });

      res = await lockerWeb3.methods.reputation().call();
      assert.equal(res, 800);

      res = await lockerWeb3.methods.owner().call();
      assert.equal(res.toLowerCase(), alice);

      res = await lockerWeb3.methods.spaceTokenId().call();
      assert.equal(res, 0);

      res = await lockerWeb3.methods.tokenDeposited().call();
      assert.equal(res, true);

      res = await this.spaceLockerRegistryWeb3.methods.isValid(lockerAddress).call();
      assert.equal(res, true);

      // MINT REPUTATION
      await locker.approveMint(this.spaceReputationAccounting.address, { from: alice });
      await assertRevert(this.spaceReputationAccounting.mint(lockerAddress, { from: minter }));
      await this.spaceReputationAccounting.mint(lockerAddress, { from: alice });

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

      // BURN REPUTATION UNSUCCESSFUL ATTEMPTS
      await assertRevert(this.spaceReputationAccounting.approveBurn(lockerAddress, { from: alice }));

      // UNSUCCESSFUL WITHDRAW SPACE TOKEN
      await assertRevert(locker.burn(this.spaceReputationAccounting.address, { from: alice }));
      await assertRevert(locker.withdraw(token1, { from: alice }));

      // REVOKE REPUTATION
      await this.spaceReputationAccounting.revoke(bob, 50, { from: alice });
      await this.spaceReputationAccounting.revoke(charlie, 50, { from: alice });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 800);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 0);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 0);

      // WITHDRAW TOKEN
      await assertRevert(this.spaceReputationAccounting.approveBurn(lockerAddress, { from: charlie }));
      await this.spaceReputationAccounting.approveBurn(lockerAddress, { from: alice });

      await locker.burn(this.spaceReputationAccounting.address, { from: alice });
      await locker.withdraw(token1, { from: alice });

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 0);

      res = await lockerWeb3.methods.reputation().call();
      assert.equal(res, 0);

      res = await lockerWeb3.methods.owner().call();
      assert.equal(res.toLowerCase(), alice);

      res = await lockerWeb3.methods.spaceTokenId().call();
      assert.equal(res, 0);

      res = await lockerWeb3.methods.tokenDeposited().call();
      assert.equal(res, false);

      res = await this.spaceLockerRegistryWeb3.methods.isValid(lockerAddress).call();
      assert.equal(res, true);
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
      await this.splitMerge.setTokenArea(token1, 800, { from: geoDateManagement });

      // CREATE LOCKER
      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: alice });
      res = await this.spaceLockerFactory.build({ from: alice });
      const lockerAddress = res.logs[0].args.locker;

      const locker = await SpaceLocker.at(lockerAddress);

      // DEPOSIT SPACE TOKEN
      await this.spaceToken.approve(lockerAddress, token1, { from: alice });
      await locker.deposit(token1, { from: alice });

      // APPROVE
      await locker.approveMint(this.spaceReputationAccounting.address, { from: alice });

      // STAKE
      await this.spaceReputationAccounting.mint(lockerAddress, { from: alice });
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
      await assertRevert(this.spaceReputationAccounting.revokeLocked(bob, abMultiSigZ.address, 71, { from: alice }));
      await assertRevert(this.spaceReputationAccounting.revokeLocked(bob, abMultiSigZ.address, 70, { from: bob }));
      await this.spaceReputationAccounting.revokeLocked(bob, abMultiSigZ.address, 70, { from: alice });
      await this.spaceReputationAccounting.revokeLocked(bob, abMultiSigY.address, 30, { from: alice });
      await this.spaceReputationAccounting.revoke(charlie, 50, { from: alice });

      // ATTEMPT TO BURN
      await assertRevert(locker.burn(this.spaceReputationAccounting.address, { from: alice }));

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 800);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(bob).call();
      assert.equal(res, 0);

      res = await this.spaceReputationAccountingWeb3.methods.balanceOf(charlie).call();
      assert.equal(res, 0);

      // APPROVE BURN AND TRY AGAIN
      await this.spaceReputationAccounting.approveBurn(lockerAddress, { from: alice });
      await locker.burn(this.spaceReputationAccounting.address, { from: alice });

      // Withdraw token
      await locker.withdraw(token1, { from: alice });
    });
  });

  describe('SpaceLocker burn', () => {
    it('should deny minting reputation', async function() {
      this.multiSigFactory = await deployMultiSigFactory(
        this.galtToken.address,
        this.oracles,
        claimManager,
        this.multiSigRegistry,
        this.spaceReputationAccounting.address,
        coreTeam
      );
      await this.galtToken.approve(this.multiSigFactory.address, ether(30), { from: alice });
      await this.multiSigFactory.build([a1, a2, a3], 2, { from: alice });

      let res = await this.spaceToken.mint(alice, { from: minter });
      const token1 = res.logs[0].args.tokenId.toNumber();

      // HACK
      await this.splitMerge.setTokenArea(token1, 800, { from: geoDateManagement });

      // CREATE LOCKER
      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: alice });
      res = await this.spaceLockerFactory.build({ from: alice });
      const lockerAddress = res.logs[0].args.locker;

      const locker = await SpaceLocker.at(lockerAddress);

      // DEPOSIT SPACE TOKEN
      await this.spaceToken.approve(lockerAddress, token1, { from: alice });
      await locker.deposit(token1, { from: alice });

      await locker.approveMint(this.spaceReputationAccounting.address, { from: alice });

      // SHOULD PREVENT DOUBLE MINT
      await assertRevert(locker.approveMint(this.spaceReputationAccounting.address, { from: alice }));

      await this.spaceReputationAccounting.mint(lockerAddress, { from: alice });
      await this.spaceReputationAccounting.approveBurn(lockerAddress, { from: alice });
      await locker.burn(this.spaceReputationAccounting.address, { from: alice });

      // Pass in a keccak256 of the token ID to prevent accidental calls
      await locker.burnToken(web3.utils.keccak256(web3.eth.abi.encodeParameter('uint256', parseInt(token1, 10))), {
        from: alice
      });

      // APPROVE
      await assertRevert(locker.approveMint(this.spaceReputationAccounting.address, { from: alice }));
    });
  });
});
