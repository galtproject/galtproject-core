const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const GaltLockerFactory = artifacts.require('./GaltLockerFactory.sol');
const GaltLocker = artifacts.require('./GaltLocker.sol');
const GaltRA = artifacts.require('./GaltRA.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const {
  ether,
  deploySpaceGeoData,
  assertRevert,
  initHelperWeb3,
  initHelperArtifacts,
  paymentMethods
} = require('../helpers');
const { deployPGGFactory, buildPGG } = require('../deploymentHelpers');

const web3 = new Web3(GaltLockerFactory.web3.currentProvider);

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

contract('GaltRA', accounts => {
  const [coreTeam, alice, bob, charlie, a1, a2, a3, spaceRA] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });
    this.spaceGeoData = await deploySpaceGeoData(this.ggr);
    this.galtToken = await GaltToken.new({ from: coreTeam });

    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.pggRegistry = await PGGRegistry.new({ from: coreTeam });
    this.galtLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('GALT_LOCKER_REGISTRAR'), {
      from: coreTeam
    });
    this.galtLockerFactory = await GaltLockerFactory.new(this.ggr.address, { from: coreTeam });
    this.galtRA = await GaltRA.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.pggRegistry.initialize(this.ggr.address);
    await this.galtRA.initialize(this.ggr.address);

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(charlie, ether(10000000), { from: coreTeam });

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_RA(), spaceRA, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_LOCKER_REGISTRY(), this.galtLockerRegistry.address, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.GALT_RA(), this.galtRA.address, {
      from: coreTeam
    });

    await this.feeRegistry.setGaltFee(await this.galtLockerFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.galtLockerFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.galtLockerFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('GALT_REPUTATION_NOTIFIER'), this.galtRA.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('GALT_LOCKER_REGISTRAR'), this.galtLockerFactory.address, true, { from: coreTeam });
  });

  describe('transfer', () => {
    it('should handle basic reputation transfer case', async function() {
      await this.galtToken.approve(this.galtLockerFactory.address, ether(10), { from: alice });
      let res = await this.galtLockerFactory.build({ from: alice });
      const aliceLockerAddress = res.logs[0].args.locker;

      res = await this.galtLockerFactory.build({ from: bob, value: ether(5) });
      const bobLockerAddress = res.logs[0].args.locker;

      await this.galtToken.approve(this.galtLockerFactory.address, ether(10), { from: charlie });
      res = await this.galtLockerFactory.build({ from: charlie });
      const charlieLockerAddress = res.logs[0].args.locker;

      const aliceLocker = await GaltLocker.at(aliceLockerAddress);
      const bobLocker = await GaltLocker.at(bobLockerAddress);
      const charlieLocker = await GaltLocker.at(charlieLockerAddress);

      // APPROVE GALT TOKEN
      await this.galtToken.approve(aliceLockerAddress, 800, { from: alice });
      await this.galtToken.approve(bobLockerAddress, 600, { from: bob });
      await this.galtToken.approve(charlieLockerAddress, 400, { from: charlie });

      // DEPOSIT SPACE TOKEN
      await aliceLocker.deposit(800, { from: alice });
      await bobLocker.deposit(600, { from: bob });
      await charlieLocker.deposit(400, { from: charlie });

      res = await aliceLocker.reputation();
      assert.equal(res, 800);
      res = await bobLocker.reputation();
      assert.equal(res, 600);
      res = await charlieLocker.reputation();
      assert.equal(res, 400);

      res = await aliceLocker.owner();
      assert.equal(res, alice);

      res = await this.galtLockerRegistry.isValid(aliceLockerAddress);
      assert.equal(res, true);

      res = await this.galtLockerRegistry.getLockersListByOwner(alice);
      assert.deepEqual(res, [aliceLockerAddress]);

      res = await this.galtLockerRegistry.getLockersCountByOwner(alice);
      assert.equal(res.toString(10), '1');

      res = await this.galtRA.isMember(alice);
      assert.equal(res, false);

      // APPROVE REPUTATION MINT
      await assertRevert(aliceLocker.approveMint(this.galtRA.address, { from: charlie }));
      await aliceLocker.approveMint(this.galtRA.address, { from: alice });
      await bobLocker.approveMint(this.galtRA.address, { from: bob });
      await charlieLocker.approveMint(this.galtRA.address, { from: charlie });
      await assertRevert(aliceLocker.approveMint(this.galtRA.address, { from: alice }));
      await assertRevert(this.galtRA.mint(aliceLockerAddress, { from: charlie }));
      await this.galtRA.mint(aliceLockerAddress, { from: alice });
      await this.galtRA.mint(bobLockerAddress, { from: bob });
      await this.galtRA.mint(charlieLockerAddress, { from: charlie });
      await assertRevert(this.galtRA.mint(aliceLockerAddress, { from: alice }));

      res = await this.galtRA.balanceOf(alice);
      assert.equal(res, 800);

      res = await this.galtRA.isMember(alice);
      assert.equal(res, true);

      // TRANSFER #1
      await this.galtRA.delegate(bob, alice, 350, { from: alice });

      res = await this.galtRA.balanceOf(alice);
      assert.equal(res, 450);

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 950);

      // TRANSFER #2
      await this.galtRA.delegate(charlie, alice, 100, { from: bob });

      res = await this.galtRA.balanceOf(alice);
      assert.equal(res, 450);

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 850);

      res = await this.galtRA.balanceOf(charlie);
      assert.equal(res, 500);

      // TRANSFER #3
      await this.galtRA.delegate(alice, alice, 50, { from: charlie });

      res = await this.galtRA.balanceOf(alice);
      assert.equal(res, 500);

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 850);

      res = await this.galtRA.balanceOf(charlie);
      assert.equal(res, 450);

      // check owned balance...
      res = await this.galtRA.ownedBalanceOf(alice);
      assert.equal(res, 800);

      res = await this.galtRA.ownedBalanceOf(bob);
      assert.equal(res, 600);

      res = await this.galtRA.ownedBalanceOf(charlie);
      assert.equal(res, 400);

      // check delegatedBy
      res = await this.galtRA.delegatedBy(alice);
      assert.sameMembers(res, []);

      res = await this.galtRA.delegatedBy(bob);
      assert.sameMembers(res, [alice]);

      res = await this.galtRA.delegatedBy(charlie);
      assert.sameMembers(res, [alice]);

      // check delegations
      res = await this.galtRA.delegations(alice);
      assert.sameMembers(res, [bob, charlie]);

      res = await this.galtRA.delegations(bob);
      assert.sameMembers(res, []);

      res = await this.galtRA.delegations(charlie);
      assert.sameMembers(res, []);

      // REVOKE #1
      await this.galtRA.revoke(bob, 200, { from: alice });

      await assertRevert(this.galtRA.revoke(bob, 200, { from: charlie }));
      await assertRevert(this.galtRA.revoke(alice, 200, { from: charlie }));

      res = await this.galtRA.balanceOf(alice);
      assert.equal(res, 700);

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 650);

      res = await this.galtRA.balanceOf(charlie);
      assert.equal(res, 450);

      // BURN REPUTATION UNSUCCESSFUL ATTEMPTS
      await assertRevert(this.galtRA.approveBurn(aliceLockerAddress, { from: alice }));

      // UNSUCCESSFUL WITHDRAW SPACE TOKEN
      await assertRevert(aliceLocker.burn(this.galtRA.address, { from: alice }));
      await assertRevert(aliceLocker.withdraw(1, { from: alice }));

      // REVOKE REPUTATION
      await this.galtRA.revoke(bob, 50, { from: alice });
      await this.galtRA.revoke(charlie, 50, { from: alice });

      res = await this.galtRA.balanceOf(alice);
      assert.equal(res, 800);

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 600);

      res = await this.galtRA.balanceOf(charlie);
      assert.equal(res, 400);

      // check delegations
      res = await this.galtRA.delegations(alice);
      assert.sameMembers(res, []);

      res = await this.galtRA.delegations(bob);
      assert.sameMembers(res, []);

      res = await this.galtRA.delegations(charlie);
      assert.sameMembers(res, []);

      // WITHDRAW TOKEN
      await assertRevert(this.galtRA.approveBurn(aliceLockerAddress, { from: charlie }));
      await this.galtRA.approveBurn(aliceLockerAddress, { from: alice });

      // check owned balances...
      res = await this.galtRA.ownedBalanceOf(alice);
      assert.equal(res, 0);

      res = await this.galtRA.ownedBalanceOf(bob);
      assert.equal(res, 600);

      res = await this.galtRA.ownedBalanceOf(charlie);
      assert.equal(res, 400);

      // check delegations
      res = await this.galtRA.delegations(alice);
      assert.sameMembers(res, []);

      res = await this.galtRA.delegations(bob);
      assert.sameMembers(res, []);

      res = await this.galtRA.delegations(charlie);
      assert.sameMembers(res, []);

      await aliceLocker.burn(this.galtRA.address, { from: alice });
      await aliceLocker.withdraw(800, { from: alice });

      res = await this.galtRA.balanceOf(alice);
      assert.equal(res, 0);

      res = await aliceLocker.reputation();
      assert.equal(res, 0);

      res = await aliceLocker.owner();
      assert.equal(res, alice);

      res = await this.galtLockerRegistry.isValid(aliceLockerAddress);
      assert.equal(res, true);
    });
  });

  describe('revokeLocked', () => {
    it('should allow revoking locked reputation', async function() {
      this.pggFactory = await deployPGGFactory(this.ggr, coreTeam);
      await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactory.address, true, { from: coreTeam });
      await this.feeRegistry.setGaltFee(await this.pggFactory.FEE_KEY(), ether(10), { from: coreTeam });
      await this.feeRegistry.setEthFee(await this.pggFactory.FEE_KEY(), ether(5), { from: coreTeam });
      await this.feeRegistry.setPaymentMethod(await this.pggFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
        from: coreTeam
      });

      await this.galtToken.approve(this.pggFactory.address, ether(10), { from: alice });
      await this.galtToken.approve(this.pggFactory.address, ether(10), { from: bob });
      await this.galtToken.approve(this.pggFactory.address, ether(10), { from: charlie });

      // MultiSigX
      this.pggX = await buildPGG(this.pggFactory, [a1, a2, a3], 2, 3, 4, 60, ether(1000), 300000, {}, {}, alice);
      const pggConfigX = this.pggX.config;

      // MultiSigY
      this.pggY = await buildPGG(this.pggFactory, [a1, a2, a3], 2, 3, 4, 60, ether(1000), 300000, {}, {}, bob);
      const pggConfigY = this.pggY.config;

      // MultiSigZ
      this.pggZ = await buildPGG(this.pggFactory, [a1, a2, a3], 2, 3, 4, 60, ether(1000), 300000, {}, {}, charlie);
      const pggConfigZ = this.pggZ.config;

      await this.galtToken.approve(this.galtLockerFactory.address, ether(10), { from: alice });
      let res = await this.galtLockerFactory.build({ from: alice });
      const aliceLockerAddress = res.logs[0].args.locker;

      await this.galtToken.approve(this.galtLockerFactory.address, ether(10), { from: bob });
      res = await this.galtLockerFactory.build({ from: bob });
      const bobLockerAddress = res.logs[0].args.locker;

      await this.galtToken.approve(this.galtLockerFactory.address, ether(10), { from: charlie });
      res = await this.galtLockerFactory.build({ from: charlie });
      const charlieLockerAddress = res.logs[0].args.locker;

      const aliceLocker = await GaltLocker.at(aliceLockerAddress);
      const bobLocker = await GaltLocker.at(bobLockerAddress);
      const charlieLocker = await GaltLocker.at(charlieLockerAddress);

      // APPROVE SPACE TOKEN
      await this.galtToken.approve(aliceLockerAddress, 800, { from: alice });
      await this.galtToken.approve(bobLockerAddress, 600, { from: bob });
      await this.galtToken.approve(charlieLockerAddress, 400, { from: charlie });

      // DEPOSIT SPACE TOKEN
      await aliceLocker.deposit(800, { from: alice });
      await bobLocker.deposit(600, { from: bob });
      await charlieLocker.deposit(400, { from: charlie });

      // APPROVE REPUTATION MINT
      await aliceLocker.approveMint(this.galtRA.address, { from: alice });
      await bobLocker.approveMint(this.galtRA.address, { from: bob });
      await charlieLocker.approveMint(this.galtRA.address, { from: charlie });
      await this.galtRA.mint(aliceLockerAddress, { from: alice });
      await this.galtRA.mint(bobLockerAddress, { from: bob });
      await this.galtRA.mint(charlieLockerAddress, { from: charlie });

      await this.galtRA.delegate(bob, alice, 350, { from: alice });
      await this.galtRA.delegate(charlie, alice, 100, { from: bob });
      await this.galtRA.delegate(alice, alice, 50, { from: charlie });

      res = await this.galtRA.balanceOf(alice);
      assert.equal(res, 500);

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 850);

      res = await this.galtRA.balanceOf(charlie);
      assert.equal(res, 450);

      // Bob stakes reputation in multiSigA
      await this.galtRA.lockReputation(pggConfigX.address, 100, { from: bob });
      await this.galtRA.lockReputation(pggConfigY.address, 30, { from: bob });
      await this.galtRA.lockReputation(pggConfigZ.address, 70, { from: bob });

      // Alice can revoke only 50 unlocked reputation tokens
      await assertRevert(this.galtRA.revoke(bob, 51, { from: alice }));
      await this.galtRA.revoke(bob, 50, { from: alice });

      // To revoke locked reputation Alice uses #revokeLocked() and explicitly
      // specifies multiSig to revoke reputation from
      await assertRevert(this.galtRA.revokeLocked(bob, pggConfigX.address, 101, { from: alice }));

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 800);
      res = await this.galtRA.delegatedBalanceOf(bob, alice);
      assert.equal(res, 200);
      res = await this.galtRA.lockedBalanceOf(bob);
      assert.equal(res, 200);
      res = await this.galtRA.lockedPggBalanceOf(bob, pggConfigX.address);
      assert.equal(res, 100);

      // Bob performs self-revokeLocked()
      await this.galtRA.revokeLocked(bob, pggConfigX.address, 100, { from: bob });

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 800);
      res = await this.galtRA.delegatedBalanceOf(bob, alice);
      assert.equal(res, 200);
      res = await this.galtRA.lockedBalanceOf(bob);
      assert.equal(res, 100);
      res = await this.galtRA.lockedPggBalanceOf(bob, pggConfigX.address);
      assert.equal(res, 0);

      await assertRevert(this.galtRA.revokeLocked(bob, pggConfigX.address, 101, { from: alice }));

      // The above doesn't affect on Alice ability to revoke delegated to Bob balance
      await this.galtRA.revoke(bob, 100, { from: alice });

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 700);
      res = await this.galtRA.delegatedBalanceOf(bob, alice);
      assert.equal(res, 100);
      res = await this.galtRA.lockedBalanceOf(bob);
      assert.equal(res, 100);
      res = await this.galtRA.lockedPggBalanceOf(bob, pggConfigX.address);
      assert.equal(res, 0);

      await assertRevert(this.galtRA.revokeLocked(bob, pggConfigZ.address, 71, { from: alice }));
      await this.galtRA.revokeLocked(bob, pggConfigZ.address, 70, { from: alice });
      await this.galtRA.revokeLocked(bob, pggConfigY.address, 30, { from: alice });
      await this.galtRA.revoke(charlie, 50, { from: alice });

      // ATTEMPT TO BURN
      await assertRevert(aliceLocker.burn(this.galtRA.address, { from: alice }));

      res = await this.galtRA.balanceOf(alice);
      assert.equal(res, 800);

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 600);

      res = await this.galtRA.balanceOf(charlie);
      assert.equal(res, 400);

      // APPROVE BURN AND TRY AGAIN
      await this.galtRA.approveBurn(aliceLockerAddress, { from: alice });
      await aliceLocker.burn(this.galtRA.address, { from: alice });

      // Withdraw token
      await aliceLocker.withdraw(800, { from: alice });
    });
  });
});
