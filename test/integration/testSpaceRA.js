const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const SpaceLocker = artifacts.require('./SpaceLocker.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');

const {
  ether,
  deploySplitMerge,
  assertRevert,
  initHelperWeb3,
  initHelperArtifacts,
  paymentMethods
} = require('../helpers');
const { deployMultiSigFactory, buildArbitration } = require('../deploymentHelpers');

const web3 = new Web3(SpaceRA.web3.currentProvider);

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

contract('SpaceRA', accounts => {
  const [coreTeam, minter, alice, bob, charlie, a1, a2, a3, geoDateManagement, claimManager] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Name', 'Symbol', { from: coreTeam });
    this.splitMerge = await deploySplitMerge(this.ggr);
    this.galtToken = await GaltToken.new({ from: coreTeam });

    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    this.spaceLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('SPACE_LOCKER_REGISTRAR'), {
      from: coreTeam
    });
    this.spaceLockerFactory = await SpaceLockerFactory.new(this.ggr.address, { from: coreTeam });
    this.spaceRA = await SpaceRA.new(this.ggr.address, { from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.multiSigRegistry.initialize(this.ggr.address);
    await this.spaceRA.initialize(this.ggr.address);

    await this.spaceToken.addRoleTo(minter, 'minter', { from: coreTeam });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(charlie, ether(10000000), { from: coreTeam });

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.MULTI_SIG_REGISTRY(), this.multiSigRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.CLAIM_MANAGER(), claimManager, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_LOCKER_REGISTRY(), this.spaceLockerRegistry.address, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.SPACE_RA(), this.spaceRA.address, { from: coreTeam });

    await this.feeRegistry.setGaltFee(await this.spaceLockerFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.spaceLockerFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.spaceLockerFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), this.spaceRA.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_LOCKER_REGISTRAR'), this.spaceLockerFactory.address, true, {
      from: coreTeam
    });
    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), geoDateManagement, true, { from: coreTeam });
  });

  describe('transfer', () => {
    it('should handle basic reputation transfer case', async function() {
      let res = await this.spaceToken.mint(alice, { from: minter });
      const token1 = res.logs[0].args.tokenId.toNumber();
      res = await this.spaceToken.mint(bob, { from: minter });
      const token2 = res.logs[0].args.tokenId.toNumber();
      res = await this.spaceToken.mint(charlie, { from: minter });
      const token3 = res.logs[0].args.tokenId.toNumber();

      res = await this.spaceToken.ownerOf(token1);
      assert.equal(res, alice);
      res = await this.spaceToken.ownerOf(token2);
      assert.equal(res, bob);
      res = await this.spaceToken.ownerOf(token3);
      assert.equal(res, charlie);

      // HACK
      await this.splitMerge.setTokenArea(token1, 800, '0', { from: geoDateManagement });
      await this.splitMerge.setTokenArea(token2, 600, '0', { from: geoDateManagement });
      await this.splitMerge.setTokenArea(token3, 400, '0', { from: geoDateManagement });

      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: alice });
      res = await this.spaceLockerFactory.build({ from: alice });
      const aliceLockerAddress = res.logs[0].args.locker;

      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: bob });
      res = await this.spaceLockerFactory.build({ from: bob });
      const bobLockerAddress = res.logs[0].args.locker;

      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: charlie });
      res = await this.spaceLockerFactory.build({ from: charlie });
      const charlieLockerAddress = res.logs[0].args.locker;

      const aliceLocker = await SpaceLocker.at(aliceLockerAddress);
      const bobLocker = await SpaceLocker.at(bobLockerAddress);
      const charlieLocker = await SpaceLocker.at(charlieLockerAddress);

      // APPROVE SPACE TOKEN
      await this.spaceToken.approve(aliceLockerAddress, token1, { from: alice });
      await this.spaceToken.approve(bobLockerAddress, token2, { from: bob });
      await this.spaceToken.approve(charlieLockerAddress, token3, { from: charlie });

      // DEPOSIT SPACE TOKEN
      await aliceLocker.deposit(token1, { from: alice });
      await bobLocker.deposit(token2, { from: bob });
      await charlieLocker.deposit(token3, { from: charlie });

      res = await aliceLocker.reputation();
      assert.equal(res, 800);

      res = await aliceLocker.owner();
      assert.equal(res, alice);

      res = await aliceLocker.spaceTokenId();
      assert.equal(res, 0);

      res = await aliceLocker.tokenDeposited();
      assert.equal(res, true);

      res = await this.spaceLockerRegistry.isValid(aliceLockerAddress);
      assert.equal(res, true);

      res = await this.spaceLockerRegistry.getLockersListByOwner(alice);
      assert.deepEqual(res, [aliceLockerAddress]);

      res = await this.spaceLockerRegistry.getLockersCountByOwner(alice);
      assert.equal(res.toString(10), '1');

      res = await this.spaceRA.isMember(alice);
      assert.equal(res, false);

      res = await this.spaceRA.ownerHasSpaceToken(alice, 0);
      assert.equal(res, false);

      // APPROVE REPUTATION MINT
      await assertRevert(aliceLocker.approveMint(this.spaceRA.address, { from: charlie }));
      await aliceLocker.approveMint(this.spaceRA.address, { from: alice });
      await bobLocker.approveMint(this.spaceRA.address, { from: bob });
      await charlieLocker.approveMint(this.spaceRA.address, { from: charlie });
      await assertRevert(aliceLocker.approveMint(this.spaceRA.address, { from: alice }));
      await assertRevert(this.spaceRA.mint(aliceLockerAddress, { from: charlie }));
      await this.spaceRA.mint(aliceLockerAddress, { from: alice });
      await this.spaceRA.mint(bobLockerAddress, { from: bob });
      await this.spaceRA.mint(charlieLockerAddress, { from: charlie });
      await assertRevert(this.spaceRA.mint(aliceLockerAddress, { from: alice }));

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 800);

      res = await this.spaceRA.isMember(alice);
      assert.equal(res, true);

      res = await this.spaceRA.ownerHasSpaceToken(alice, 0);
      assert.equal(res, true);

      // TRANSFER #1
      await this.spaceRA.delegate(bob, alice, 350, { from: alice });

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 450);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 950);

      // TRANSFER #2
      await this.spaceRA.delegate(charlie, alice, 100, { from: bob });

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 450);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 850);

      res = await this.spaceRA.balanceOf(charlie);
      assert.equal(res, 500);

      // TRANSFER #3
      await this.spaceRA.delegate(alice, alice, 50, { from: charlie });

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 500);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 850);

      res = await this.spaceRA.balanceOf(charlie);
      assert.equal(res, 450);

      // check owned balance...
      res = await this.spaceRA.ownedBalanceOf(alice);
      assert.equal(res, 800);

      res = await this.spaceRA.ownedBalanceOf(bob);
      assert.equal(res, 600);

      res = await this.spaceRA.ownedBalanceOf(charlie);
      assert.equal(res, 400);

      // check delegatedBy
      res = await this.spaceRA.delegatedBy(alice);
      assert.sameMembers(res, []);

      res = await this.spaceRA.delegatedBy(bob);
      assert.sameMembers(res, [alice]);

      res = await this.spaceRA.delegatedBy(charlie);
      assert.sameMembers(res, [alice]);

      // check delegations
      res = await this.spaceRA.delegations(alice);
      assert.sameMembers(res, [bob, charlie]);

      res = await this.spaceRA.delegations(bob);
      assert.sameMembers(res, []);

      res = await this.spaceRA.delegations(charlie);
      assert.sameMembers(res, []);

      // REVOKE #1
      await this.spaceRA.revoke(bob, 200, { from: alice });

      await assertRevert(this.spaceRA.revoke(bob, 200, { from: charlie }));
      await assertRevert(this.spaceRA.revoke(alice, 200, { from: charlie }));

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 700);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 650);

      res = await this.spaceRA.balanceOf(charlie);
      assert.equal(res, 450);

      // BURN REPUTATION UNSUCCESSFUL ATTEMPTS
      await assertRevert(this.spaceRA.approveBurn(aliceLockerAddress, { from: alice }));

      // UNSUCCESSFUL WITHDRAW SPACE TOKEN
      await assertRevert(aliceLocker.burn(this.spaceRA.address, { from: alice }));
      await assertRevert(aliceLocker.withdraw(token1, { from: alice }));

      // REVOKE REPUTATION
      await this.spaceRA.revoke(bob, 50, { from: alice });
      await this.spaceRA.revoke(charlie, 50, { from: alice });

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 800);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 600);

      res = await this.spaceRA.balanceOf(charlie);
      assert.equal(res, 400);

      // check delegations
      res = await this.spaceRA.delegations(alice);
      assert.sameMembers(res, []);

      res = await this.spaceRA.delegations(bob);
      assert.sameMembers(res, []);

      res = await this.spaceRA.delegations(charlie);
      assert.sameMembers(res, []);

      // WITHDRAW TOKEN
      await assertRevert(this.spaceRA.approveBurn(aliceLockerAddress, { from: charlie }));
      await this.spaceRA.approveBurn(aliceLockerAddress, { from: alice });

      // check owned balances...
      res = await this.spaceRA.ownedBalanceOf(alice);
      assert.equal(res, 0);

      res = await this.spaceRA.ownedBalanceOf(bob);
      assert.equal(res, 600);

      res = await this.spaceRA.ownedBalanceOf(charlie);
      assert.equal(res, 400);

      // check delegations
      res = await this.spaceRA.delegations(alice);
      assert.sameMembers(res, []);

      res = await this.spaceRA.delegations(bob);
      assert.sameMembers(res, []);

      res = await this.spaceRA.delegations(charlie);
      assert.sameMembers(res, []);

      await aliceLocker.burn(this.spaceRA.address, { from: alice });
      await aliceLocker.withdraw(token1, { from: alice });

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 0);

      res = await aliceLocker.reputation();
      assert.equal(res, 0);

      res = await aliceLocker.owner();
      assert.equal(res, alice);

      res = await aliceLocker.spaceTokenId();
      assert.equal(res, 0);

      res = await aliceLocker.tokenDeposited();
      assert.equal(res, false);

      res = await this.spaceLockerRegistry.isValid(aliceLockerAddress);
      assert.equal(res, true);
    });
  });

  describe('revokeLocked', () => {
    it('should allow revoking locked reputation', async function() {
      this.multiSigFactory = await deployMultiSigFactory(this.ggr, coreTeam);
      await this.acl.setRole(bytes32('MULTI_SIG_REGISTRAR'), this.multiSigFactory.address, true, { from: coreTeam });

      await this.feeRegistry.setGaltFee(await this.multiSigFactory.FEE_KEY(), ether(10), { from: coreTeam });
      await this.feeRegistry.setEthFee(await this.multiSigFactory.FEE_KEY(), ether(5), { from: coreTeam });
      await this.feeRegistry.setPaymentMethod(await this.multiSigFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
        from: coreTeam
      });

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
        [30, 30, 30, 30, 30, 30, 30, 30],
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
        [30, 30, 30, 30, 30, 30, 30, 30],
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
        [30, 30, 30, 30, 30, 30, 30, 30],
        {},
        charlie
      );
      const abMultiSigZ = this.abZ.multiSig;

      let res = await this.spaceToken.mint(alice, { from: minter });
      const token1 = res.logs[0].args.tokenId.toNumber();
      res = await this.spaceToken.mint(bob, { from: minter });
      const token2 = res.logs[0].args.tokenId.toNumber();
      res = await this.spaceToken.mint(charlie, { from: minter });
      const token3 = res.logs[0].args.tokenId.toNumber();

      // HACK
      await this.splitMerge.setTokenArea(token1, 800, '0', { from: geoDateManagement });
      await this.splitMerge.setTokenArea(token2, 600, '0', { from: geoDateManagement });
      await this.splitMerge.setTokenArea(token3, 400, '0', { from: geoDateManagement });

      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: alice });
      res = await this.spaceLockerFactory.build({ from: alice });
      const aliceLockerAddress = res.logs[0].args.locker;

      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: bob });
      res = await this.spaceLockerFactory.build({ from: bob });
      const bobLockerAddress = res.logs[0].args.locker;

      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: charlie });
      res = await this.spaceLockerFactory.build({ from: charlie });
      const charlieLockerAddress = res.logs[0].args.locker;

      const aliceLocker = await SpaceLocker.at(aliceLockerAddress);
      const bobLocker = await SpaceLocker.at(bobLockerAddress);
      const charlieLocker = await SpaceLocker.at(charlieLockerAddress);

      // APPROVE SPACE TOKEN
      await this.spaceToken.approve(aliceLockerAddress, token1, { from: alice });
      await this.spaceToken.approve(bobLockerAddress, token2, { from: bob });
      await this.spaceToken.approve(charlieLockerAddress, token3, { from: charlie });

      // DEPOSIT SPACE TOKEN
      await aliceLocker.deposit(token1, { from: alice });
      await bobLocker.deposit(token2, { from: bob });
      await charlieLocker.deposit(token3, { from: charlie });

      // APPROVE REPUTATION MINT
      await aliceLocker.approveMint(this.spaceRA.address, { from: alice });
      await bobLocker.approveMint(this.spaceRA.address, { from: bob });
      await charlieLocker.approveMint(this.spaceRA.address, { from: charlie });
      await this.spaceRA.mint(aliceLockerAddress, { from: alice });
      await this.spaceRA.mint(bobLockerAddress, { from: bob });
      await this.spaceRA.mint(charlieLockerAddress, { from: charlie });

      await this.spaceRA.delegate(bob, alice, 350, { from: alice });
      await this.spaceRA.delegate(charlie, alice, 100, { from: bob });
      await this.spaceRA.delegate(alice, alice, 50, { from: charlie });

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 500);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 850);

      res = await this.spaceRA.balanceOf(charlie);
      assert.equal(res, 450);

      // Bob stakes reputation in multiSigA
      await this.spaceRA.lockReputation(abMultiSigX.address, 100, { from: bob });
      await this.spaceRA.lockReputation(abMultiSigY.address, 30, { from: bob });
      await this.spaceRA.lockReputation(abMultiSigZ.address, 70, { from: bob });

      // Alice can revoke only 50 unlocked reputation tokens
      await assertRevert(this.spaceRA.revoke(bob, 51, { from: alice }));
      await this.spaceRA.revoke(bob, 50, { from: alice });

      // To revoke locked reputation Alice uses #revokeLocked() and explicitly
      // specifies multiSig to revoke reputation from
      await assertRevert(this.spaceRA.revokeLocked(bob, abMultiSigX.address, 101, { from: alice }));

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 800);
      res = await this.spaceRA.delegatedBalanceOf(bob, alice);
      assert.equal(res, 200);
      res = await this.spaceRA.lockedBalanceOf(bob);
      assert.equal(res, 200);
      res = await this.spaceRA.lockedMultiSigBalanceOf(bob, abMultiSigX.address);
      assert.equal(res, 100);

      // Bob performs self-revokeLocked()
      await this.spaceRA.revokeLocked(bob, abMultiSigX.address, 100, { from: bob });

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 800);
      res = await this.spaceRA.delegatedBalanceOf(bob, alice);
      assert.equal(res, 200);
      res = await this.spaceRA.lockedBalanceOf(bob);
      assert.equal(res, 100);
      res = await this.spaceRA.lockedMultiSigBalanceOf(bob, abMultiSigX.address);
      assert.equal(res, 0);

      await assertRevert(this.spaceRA.revokeLocked(bob, abMultiSigX.address, 101, { from: alice }));

      // The above doesn't affect on Alice ability to revoke delegated to Bob balance
      await this.spaceRA.revoke(bob, 100, { from: alice });

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 700);
      res = await this.spaceRA.delegatedBalanceOf(bob, alice);
      assert.equal(res, 100);
      res = await this.spaceRA.lockedBalanceOf(bob);
      assert.equal(res, 100);
      res = await this.spaceRA.lockedMultiSigBalanceOf(bob, abMultiSigX.address);
      assert.equal(res, 0);

      await assertRevert(this.spaceRA.revokeLocked(bob, abMultiSigZ.address, 71, { from: alice }));
      await this.spaceRA.revokeLocked(bob, abMultiSigZ.address, 70, { from: alice });
      await this.spaceRA.revokeLocked(bob, abMultiSigY.address, 30, { from: alice });
      await this.spaceRA.revoke(charlie, 50, { from: alice });

      // ATTEMPT TO BURN
      await assertRevert(aliceLocker.burn(this.spaceRA.address, { from: alice }));

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 800);

      res = await this.spaceRA.balanceOf(bob);
      assert.equal(res, 600);

      res = await this.spaceRA.balanceOf(charlie);
      assert.equal(res, 400);

      // APPROVE BURN AND TRY AGAIN
      await this.spaceRA.approveBurn(aliceLockerAddress, { from: alice });
      await aliceLocker.burn(this.spaceRA.address, { from: alice });

      // Withdraw token
      await aliceLocker.withdraw(token1, { from: alice });
    });
  });

  describe('SpaceLocker burn', () => {
    it('should deny minting reputation', async function() {
      this.multiSigFactory = await deployMultiSigFactory(this.ggr, coreTeam);
      await this.galtToken.approve(this.multiSigFactory.address, ether(30), { from: alice });

      let res = await this.spaceToken.mint(alice, { from: minter });
      const token1 = res.logs[0].args.tokenId.toNumber();

      // HACK
      await this.splitMerge.setTokenArea(token1, 800, '0', { from: geoDateManagement });

      // CREATE LOCKER
      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: alice });
      res = await this.spaceLockerFactory.build({ from: alice });
      const lockerAddress = res.logs[0].args.locker;

      const locker = await SpaceLocker.at(lockerAddress);

      // DEPOSIT SPACE TOKEN
      await this.spaceToken.approve(lockerAddress, token1, { from: alice });
      await locker.deposit(token1, { from: alice });

      await locker.approveMint(this.spaceRA.address, { from: alice });

      // SHOULD PREVENT DOUBLE MINT
      await assertRevert(locker.approveMint(this.spaceRA.address, { from: alice }));

      await this.spaceRA.mint(lockerAddress, { from: alice });

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 800);

      await this.spaceRA.approveBurn(lockerAddress, { from: alice });

      res = await this.spaceRA.balanceOf(alice);
      assert.equal(res, 0);

      await locker.burn(this.spaceRA.address, { from: alice });

      // Pass in a keccak256 of the token ID to prevent accidental calls
      await locker.burnToken(web3.utils.keccak256(web3.eth.abi.encodeParameter('uint256', parseInt(token1, 10))), {
        from: alice
      });

      // APPROVE
      await assertRevert(locker.approveMint(this.spaceRA.address, { from: alice }));
    });
  });
});
