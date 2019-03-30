const GaltToken = artifacts.require('./GaltToken.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const GaltLockerFactory = artifacts.require('./GaltLockerFactory.sol');
const GaltLocker = artifacts.require('./GaltLocker.sol');
const GaltRA = artifacts.require('./GaltRA.sol');
const Oracles = artifacts.require('./Oracles.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const { ether, deploySplitMerge, assertRevert, initHelperWeb3, initHelperArtifacts } = require('../helpers');
const { deployMultiSigFactory, buildArbitration } = require('../deploymentHelpers');

const web3 = new Web3(GaltLockerFactory.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

contract('GaltRA', accounts => {
  const [coreTeam, alice, bob, charlie, a1, a2, a3, geoDateManagement, claimManager, spaceRA] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.splitMerge = await deploySplitMerge(this.ggr);
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });

    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    this.galtLockerRegistry = await LockerRegistry.new({ from: coreTeam });
    this.galtLockerFactory = await GaltLockerFactory.new(this.ggr.address, { from: coreTeam });
    this.galtRA = await GaltRA.new(this.ggr.address, { from: coreTeam });
    await this.galtLockerRegistry.addRoleTo(
      this.galtLockerFactory.address,
      await this.galtLockerRegistry.ROLE_FACTORY(),
      {
        from: coreTeam
      }
    );
    await this.splitMerge.addRoleTo(geoDateManagement, 'geo_data_manager', {
      from: coreTeam
    });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(charlie, ether(10000000), { from: coreTeam });

    await this.ggr.setContract(await this.ggr.MULTI_SIG_REGISTRY(), this.multiSigRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.ORACLES(), this.oracles.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.CLAIM_MANAGER(), claimManager, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_RA(), spaceRA, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_LOCKER_REGISTRY(), this.galtLockerRegistry.address, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.GALT_RA(), this.galtRA.address, {
      from: coreTeam
    });
  });

  describe('transfer', () => {
    it('should handle basic reputation transfer case', async function() {
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
    it.only('should allow revoking locked reputation', async function() {
      this.multiSigFactory = await deployMultiSigFactory(this.ggr, coreTeam);
      await this.galtToken.approve(this.multiSigFactory.address, ether(10), { from: alice });
      await this.galtToken.approve(this.multiSigFactory.address, ether(10), { from: bob });
      await this.galtToken.approve(this.multiSigFactory.address, ether(10), { from: charlie });

      // MultiSigX
      this.abX = await buildArbitration(
        this.multiSigFactory,
        [a1, a2, a3],
        2,
        3,
        4,
        60,
        ether(1000),
        [30, 30, 30, 30, 30, 30],
        {},
        alice
      );
      const abMultiSigX = this.abX.multiSig;

      // MultiSigY
      this.abY = await buildArbitration(
        this.multiSigFactory,
        [a1, a2, a3],
        2,
        3,
        4,
        60,
        ether(1000),
        [30, 30, 30, 30, 30, 30],
        {},
        bob
      );
      const abMultiSigY = this.abY.multiSig;

      // MultiSigZ
      this.abZ = await buildArbitration(
        this.multiSigFactory,
        [a1, a2, a3],
        2,
        3,
        4,
        60,
        ether(1000),
        [30, 30, 30, 30, 30, 30],
        {},
        charlie
      );
      const abMultiSigZ = this.abZ.multiSig;

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
      await this.galtRA.lockReputation(abMultiSigX.address, 100, { from: bob });
      await this.galtRA.lockReputation(abMultiSigY.address, 30, { from: bob });
      await this.galtRA.lockReputation(abMultiSigZ.address, 70, { from: bob });

      // Alice can revoke only 50 unlocked reputation tokens
      await assertRevert(this.galtRA.revoke(bob, 51, { from: alice }));
      await this.galtRA.revoke(bob, 50, { from: alice });

      // To revoke locked reputation Alice uses #revokeLocked() and explicitly
      // specifies multiSig to revoke reputation from
      await assertRevert(this.galtRA.revokeLocked(bob, abMultiSigX.address, 101, { from: alice }));

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 800);
      res = await this.galtRA.delegatedBalanceOf(bob, alice);
      assert.equal(res, 200);
      res = await this.galtRA.lockedBalanceOf(bob);
      assert.equal(res, 200);
      res = await this.galtRA.lockedMultiSigBalanceOf(bob, abMultiSigX.address);
      assert.equal(res, 100);

      // Bob performs self-revokeLocked()
      await this.galtRA.revokeLocked(bob, abMultiSigX.address, 100, { from: bob });

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 800);
      res = await this.galtRA.delegatedBalanceOf(bob, alice);
      assert.equal(res, 200);
      res = await this.galtRA.lockedBalanceOf(bob);
      assert.equal(res, 100);
      res = await this.galtRA.lockedMultiSigBalanceOf(bob, abMultiSigX.address);
      assert.equal(res, 0);

      await assertRevert(this.galtRA.revokeLocked(bob, abMultiSigX.address, 101, { from: alice }));

      // The above doesn't affect on Alice ability to revoke delegated to Bob balance
      await this.galtRA.revoke(bob, 100, { from: alice });

      res = await this.galtRA.balanceOf(bob);
      assert.equal(res, 700);
      res = await this.galtRA.delegatedBalanceOf(bob, alice);
      assert.equal(res, 100);
      res = await this.galtRA.lockedBalanceOf(bob);
      assert.equal(res, 100);
      res = await this.galtRA.lockedMultiSigBalanceOf(bob, abMultiSigX.address);
      assert.equal(res, 0);

      await assertRevert(this.galtRA.revokeLocked(bob, abMultiSigZ.address, 71, { from: alice }));
      await this.galtRA.revokeLocked(bob, abMultiSigZ.address, 70, { from: alice });
      await this.galtRA.revokeLocked(bob, abMultiSigY.address, 30, { from: alice });
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
