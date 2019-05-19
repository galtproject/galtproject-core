const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const ClaimManager = artifacts.require('./ClaimManager.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const GaltRA = artifacts.require('./GaltRA.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const GaltLockerFactory = artifacts.require('./GaltLockerFactory.sol');
const StakeTracker = artifacts.require('./StakeTracker.sol');
const OwnedUpgradeabilityProxy = artifacts.require('./OwnedUpgradeabilityProxy.sol');
const GlobalGovernance = artifacts.require('./GlobalGovernance.sol');
// eslint-disable-next-line
const MockGlobalGovernance_V2 = artifacts.require('./MockGlobalGovernance_V2.sol');

const Web3 = require('web3');

GlobalGovernance.numberFormat = 'String';
MockGlobalGovernance_V2.numberFormat = 'String';
OwnedUpgradeabilityProxy.numberFormat = 'String';
StakeTracker.numberFormat = 'String';
GaltRA.numberFormat = 'String';
SpaceRA.numberFormat = 'String';

const { assertRevert, ether, initHelperWeb3, deploySpaceGeoDataMock, paymentMethods } = require('../helpers');
const { deployPGGFactory } = require('../deploymentHelpers');
const globalGovernanceHelpers = require('../globalGovernanceHelpers');

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;
const web3 = new Web3(GaltToken.web3.currentProvider);

initHelperWeb3(web3);

// NOTICE: uncomment one of below for tests
// const { log } = console;
const log = function() {};

contract('GlobalGovernance', accounts => {
  const [
    coreTeam,
    minter,
    oracleModifier,
    geoDataManager,
    claimManagerAddress,

    // initial arbitrators
    a1,
    a2,
    a3,

    // arbitrators
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank,
    george,
    hannah,
    mike,
    nick,
    oliver,

    // oracles
    xander,
    yan,
    zack
  ] = accounts;

  beforeEach(async function() {
    // Setup Galt token
    await (async () => {
      this.galtToken = await GaltToken.new({ from: coreTeam });

      await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(charlie, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(dan, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(eve, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(frank, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(george, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(hannah, ether(10000000), { from: coreTeam });

      await this.galtToken.mint(mike, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(nick, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(oliver, ether(10000000), { from: coreTeam });

      await this.galtToken.mint(zack, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(zack, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(zack, ether(10000000), { from: coreTeam });
    })();

    // Create and initialize contracts
    await (async () => {
      this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
      this.claimManager = await ClaimManager.new({ from: coreTeam });
      this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
      this.acl = await ACL.new({ from: coreTeam });
      const deployment = await deploySpaceGeoDataMock(this.ggr);
      this.spaceGeoData = deployment.spaceGeoData;

      this.globalGovernance = await GlobalGovernance.new({ from: coreTeam });
      this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
      this.stakeTracker = await StakeTracker.new({ from: coreTeam });
      this.pggRegistry = await PGGRegistry.new({ from: coreTeam });
      this.spaceLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('SPACE_LOCKER_REGISTRAR'), {
        from: coreTeam
      });
      this.galtLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('GALT_LOCKER_REGISTRAR'), {
        from: coreTeam
      });
      this.spaceLockerFactory = await SpaceLockerFactory.new(this.ggr.address, { from: coreTeam });
      this.galtLockerFactory = await GaltLockerFactory.new(this.ggr.address, { from: coreTeam });

      await this.acl.initialize();
      await this.ggr.initialize();
      await this.pggRegistry.initialize(this.ggr.address);
      await this.stakeTracker.initialize(this.ggr.address);
      await this.globalGovernance.initialize(this.ggr.address, 750000, 750000, { from: coreTeam });

      await this.spaceToken.addRoleTo(minter, 'minter', {
        from: coreTeam
      });

      this.spaceRA = await SpaceRA.new({ from: coreTeam });
      this.galtRA = await GaltRA.new({ from: coreTeam });

      await this.galtRA.initialize(this.ggr.address);
      await this.spaceRA.initialize(this.ggr.address);

      await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.STAKE_TRACKER(), this.stakeTracker.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, {
        from: coreTeam
      });
      await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.CLAIM_MANAGER(), claimManagerAddress, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.GLOBAL_GOVERNANCE(), this.globalGovernance.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.SPACE_LOCKER_REGISTRY(), this.spaceLockerRegistry.address, {
        from: coreTeam
      });
      await this.ggr.setContract(await this.ggr.GALT_LOCKER_REGISTRY(), this.galtLockerRegistry.address, {
        from: coreTeam
      });
      await this.ggr.setContract(await this.ggr.SPACE_RA(), this.spaceRA.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.GALT_RA(), this.galtRA.address, { from: coreTeam });

      this.pggFactory = await deployPGGFactory(this.ggr, coreTeam);

      await this.acl.setRole(bytes32('ARBITRATION_STAKE_SLASHER'), this.claimManager.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('ORACLE_STAKE_SLASHER'), this.claimManager.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('ORACLE_MODIFIER'), oracleModifier, true, { from: coreTeam });
      await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactory.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), this.spaceRA.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('GALT_REPUTATION_NOTIFIER'), this.galtRA.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('SPACE_LOCKER_REGISTRAR'), this.spaceLockerFactory.address, true, {
        from: coreTeam
      });
      await this.acl.setRole(bytes32('GALT_LOCKER_REGISTRAR'), this.galtLockerFactory.address, true, {
        from: coreTeam
      });
      await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), geoDataManager, true, { from: coreTeam });

      await this.feeRegistry.setGaltFee(await this.pggFactory.FEE_KEY(), ether(10), { from: coreTeam });
      await this.feeRegistry.setEthFee(await this.pggFactory.FEE_KEY(), ether(5), { from: coreTeam });
      await this.feeRegistry.setPaymentMethod(await this.pggFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
        from: coreTeam
      });
      await this.feeRegistry.setGaltFee(await this.spaceLockerFactory.FEE_KEY(), ether(10), { from: coreTeam });
      await this.feeRegistry.setEthFee(await this.spaceLockerFactory.FEE_KEY(), ether(5), { from: coreTeam });
      await this.feeRegistry.setPaymentMethod(await this.spaceLockerFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
        from: coreTeam
      });
      await this.feeRegistry.setGaltFee(await this.galtLockerFactory.FEE_KEY(), ether(10), { from: coreTeam });
      await this.feeRegistry.setEthFee(await this.galtLockerFactory.FEE_KEY(), ether(5), { from: coreTeam });
      await this.feeRegistry.setPaymentMethod(await this.galtLockerFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
        from: coreTeam
      });

      await this.claimManager.initialize(this.ggr.address, {
        from: coreTeam
      });
    })();
  });

  describe('self-upgrade', () => {
    it('should allow self-upgrade logic using proxy', async function() {
      const proxy = await OwnedUpgradeabilityProxy.new({ from: alice });
      let globalGovernance = await GlobalGovernance.at(proxy.address);

      const globalGovernanceV1 = await GlobalGovernance.new({ from: coreTeam });
      const txData1 = globalGovernanceV1.contract.methods.initialize(this.ggr.address, 75000, 75000).encodeABI();
      await proxy.upgradeToAndCall(globalGovernanceV1.address, txData1, { from: alice });
      await proxy.transferProxyOwnership(globalGovernance.address, { from: alice });

      await this.ggr.setContract(await this.ggr.GLOBAL_GOVERNANCE(), globalGovernance.address, { from: coreTeam });

      const { seedArbitration } = globalGovernanceHelpers(
        this.galtToken,
        this.spaceToken,
        this.spaceRA,
        this.galtRA,
        this.spaceGeoData,
        this.spaceLockerFactory,
        this.galtLockerFactory,
        [a1, a2, a3],
        minter,
        oracleModifier,
        geoDataManager,
        alice,
        log
      );

      await this.galtToken.approve(this.pggFactory.address, ether(100), { from: alice });

      this.pggM = await seedArbitration(
        this.pggFactory,
        alice,
        [alice, bob, charlie, dan],
        [bob, george, hannah, mike],
        [xander, bob],
        500,
        200,
        200
      );

      log('M weight', (await globalGovernance.getPggWeight(this.pggM.multiSig.address)).weight);

      // Step #1. Create proposal for an increased threshold for add2ggr change to 95% instead of default 75%
      const globalGovernanceV2 = await MockGlobalGovernance_V2.new({ from: coreTeam });
      const upgradeBytecode = await proxy.contract.methods.upgradeTo(globalGovernanceV2.address).encodeABI();

      // we want to vote to transfer it back to the coreTeam
      let res = await this.pggM.createGlobalProposalProposalManager.propose(
        globalGovernance.address,
        '0',
        upgradeBytecode,
        'back to centralization',
        { from: alice }
      );
      let { proposalId } = res.logs[0].args;

      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: alice });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: bob });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: charlie });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: dan });
      await this.pggM.createGlobalProposalProposalManager.triggerApprove(proposalId);

      res = await this.pggM.createGlobalProposalProposalManager.getProposal(proposalId);
      const globalProposalId = res.globalId;

      // Step #2. Create support proposal and accept it
      res = await this.pggM.supportGlobalProposalProposalManager.propose(globalProposalId, 'looks good', {
        from: alice
      });
      // eslint-disable-next-line
      proposalId = res.logs[0].args.proposalId;

      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: alice });
      await this.pggM.supportGlobalProposalProposalManager.nay(proposalId, { from: bob });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: charlie });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: dan });
      await this.pggM.supportGlobalProposalProposalManager.nay(proposalId, { from: george });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: hannah });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: mike });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: xander });

      await this.pggM.supportGlobalProposalProposalManager.triggerApprove(proposalId);

      res = await this.pggM.config.globalProposalSupport(globalProposalId);
      assert.equal(true, res);

      // Step #3. Now accept the proposal and check that #foo() method works correctly
      globalGovernance = await MockGlobalGovernance_V2.at(proxy.address);
      await assertRevert(globalGovernance.foo());

      await globalGovernance.trigger(globalProposalId);

      res = await globalGovernance.foo();
      assert.equal(res, 'bar');
    });
  });

  describe('#setThreshold()', () => {
    it('should apply custom threshold if one exists', async function() {
      await this.ggr.transferOwnership(this.globalGovernance.address, { from: coreTeam });
      const { seedArbitration } = globalGovernanceHelpers(
        this.galtToken,
        this.spaceToken,
        this.spaceRA,
        this.galtRA,
        this.spaceGeoData,
        this.spaceLockerFactory,
        this.galtLockerFactory,
        [a1, a2, a3],
        minter,
        oracleModifier,
        geoDataManager,
        alice,
        log
      );

      await this.galtToken.approve(this.pggFactory.address, ether(100), { from: alice });

      this.pggM = await seedArbitration(
        this.pggFactory,
        alice,
        [alice, bob, charlie, dan],
        [bob, george, hannah, mike],
        [xander, bob],
        500,
        200,
        200
      );

      this.pggN = await seedArbitration(
        this.pggFactory,
        alice,
        [bob, charlie, dan, eve],
        [george, hannah, mike, nick],
        [yan, zack],
        10,
        30,
        0
      );
      log('M weight', (await this.globalGovernance.getPggWeight(this.pggM.multiSig.address)).weight);
      log('N weight', (await this.globalGovernance.getPggWeight(this.pggN.multiSig.address)).weight);

      // Step #1. Create proposal for an increased threshold for add2ggr change to 95% instead of default 75%
      const signatureHash = await this.ggr.contract.methods
        .setContract(bytes32(''), alice)
        .encodeABI()
        .substr(0, 10);

      // console.log('signatureHash >>>', signatureHash);
      const marker = await this.globalGovernance.getMarker(this.ggr.address, signatureHash);
      // console.log('marker >>>', marker);
      const increaseThreshold = this.globalGovernance.contract.methods.setThreshold(marker, 950000).encodeABI();

      // we want to vote to transfer it back to the coreTeam
      let res = await this.pggM.createGlobalProposalProposalManager.propose(
        this.globalGovernance.address,
        '0',
        increaseThreshold,
        'back to centralization',
        { from: alice }
      );
      let { proposalId } = res.logs[0].args;

      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: alice });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: bob });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: charlie });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: dan });
      await this.pggM.createGlobalProposalProposalManager.triggerApprove(proposalId);

      res = await this.pggM.createGlobalProposalProposalManager.getProposal(proposalId);
      let globalProposalId = res.globalId;

      // Step #2. Create support proposal and accept it
      res = await this.pggM.supportGlobalProposalProposalManager.propose(globalProposalId, 'looks good', {
        from: alice
      });
      // eslint-disable-next-line
      proposalId = res.logs[0].args.proposalId;

      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: alice });
      await this.pggM.supportGlobalProposalProposalManager.nay(proposalId, { from: bob });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: charlie });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: dan });
      await this.pggM.supportGlobalProposalProposalManager.nay(proposalId, { from: george });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: hannah });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: mike });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: xander });

      await this.pggM.supportGlobalProposalProposalManager.triggerApprove(proposalId);

      res = await this.pggM.config.globalProposalSupport(globalProposalId);
      assert.equal(true, res);

      await this.globalGovernance.trigger(globalProposalId);

      // Step #3. Crate proposal to add a record
      const addRecordBytecode = this.ggr.contract.methods
        .setContract(await this.ggr.FEE_COLLECTOR(), charlie)
        .encodeABI();

      res = await this.pggM.createGlobalProposalProposalManager.propose(
        this.ggr.address,
        '0',
        addRecordBytecode,
        'charlie is a new fee manager',
        { from: alice }
      );
      proposalId = res.logs[0].args.proposalId;

      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: alice });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: bob });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: charlie });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: dan });
      await this.pggM.createGlobalProposalProposalManager.triggerApprove(proposalId);

      res = await this.pggM.createGlobalProposalProposalManager.getProposal(proposalId);
      globalProposalId = res.globalId;

      // Step #4. Support proposal to add a record at around 94.19%
      res = await this.pggM.supportGlobalProposalProposalManager.propose(globalProposalId, 'looks good', {
        from: alice
      });
      // eslint-disable-next-line
      proposalId = res.logs[0].args.proposalId;

      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: alice });
      await this.pggM.supportGlobalProposalProposalManager.nay(proposalId, { from: bob });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: charlie });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: dan });
      await this.pggM.supportGlobalProposalProposalManager.nay(proposalId, { from: george });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: hannah });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: mike });
      await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: xander });

      await this.pggM.supportGlobalProposalProposalManager.triggerApprove(proposalId);

      await assertRevert(this.globalGovernance.trigger(globalProposalId));

      // Step #5. Support proposal to add a record at 100%
      res = await this.pggN.supportGlobalProposalProposalManager.propose(globalProposalId, 'looks good', {
        from: alice
      });
      // eslint-disable-next-line
      proposalId = res.logs[0].args.proposalId;

      await this.pggN.supportGlobalProposalProposalManager.nay(proposalId, { from: bob });
      await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: charlie });
      await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: dan });
      await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: eve });
      await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: george });
      await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: hannah });
      await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: mike });
      await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: nick });
      await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: yan });
      await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: zack });

      await this.pggN.supportGlobalProposalProposalManager.triggerApprove(proposalId);

      res = await this.pggM.config.globalProposalSupport(globalProposalId);
      log('M support', res);
      res = await this.pggN.config.globalProposalSupport(globalProposalId);
      log('N support', res);

      // Step #6. Trigger the proposal and check the new key
      await this.globalGovernance.trigger(globalProposalId);

      res = await this.ggr.getContract(await this.ggr.FEE_COLLECTOR());
      assert.equal(res, charlie);
    });
  });

  describe('Create/Support Global Proposal Proposals', () => {
    it('should change a corresponding application config value', async function() {
      await this.ggr.transferOwnership(this.globalGovernance.address, { from: coreTeam });
      const { seedArbitration: seedPgg } = globalGovernanceHelpers(
        this.galtToken,
        this.spaceToken,
        this.spaceRA,
        this.galtRA,
        this.spaceGeoData,
        this.spaceLockerFactory,
        this.galtLockerFactory,
        [a1, a2, a3],
        minter,
        oracleModifier,
        geoDataManager,
        alice,
        log
      );

      // Step #1. Create several multiSigs
      await (async () => {
        await this.galtToken.approve(this.pggFactory.address, ether(100), { from: alice });

        this.pggM = await seedPgg(
          this.pggFactory,
          alice,
          [alice, bob, charlie, dan],
          [bob, george, hannah, mike],
          [xander, bob],
          500,
          200,
          200
        );
        this.pggN = await seedPgg(
          this.pggFactory,
          alice,
          [bob, charlie, dan, eve],
          [george, hannah, mike, nick],
          [yan, zack],
          0,
          50,
          0
        );
        // X: charlie, dan, eve, george, hannah, mike, nick, yan, zack
        this.pggX = await seedPgg(
          this.pggFactory,
          alice,
          [charlie, dan, eve, george],
          [eve, george, hannah, mike, nick],
          [eve, yan, zack],
          1250,
          60,
          100
        );
        // Y: hannah, mike, nick, oliver, alice, bob, charlie, dan, xander, yan, zack
        this.pggY = await seedPgg(
          this.pggFactory,
          alice,
          [hannah, mike, nick, oliver],
          [alice, bob, charlie, dan],
          [xander, yan, zack],
          2000,
          150,
          50
        );
        // Z: oliver, alice, xander
        this.pggZ = await seedPgg(this.pggFactory, alice, [oliver, xander], [alice], [xander], 3500, 0, 600);
      })();

      // Step #2. Transfer PGGRegistry to the Governance contract
      await this.pggRegistry.transferOwnership(this.globalGovernance.address);

      // Step #3. Transfer PGGRegistry to the Governance contract
      const transferBackBytecode = this.pggRegistry.contract.methods.transferOwnership(coreTeam).encodeABI();

      // we want to vote to transfer it back to the coreTeam
      let res = await this.pggM.createGlobalProposalProposalManager.propose(
        this.pggRegistry.address,
        '0',
        transferBackBytecode,
        'back to centralization',
        { from: alice }
      );
      let { proposalId } = res.logs[0].args;

      // [alice, bob, charlie, dan],
      //   [bob, george, hannah, mike],
      //   [xander, bob],
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: alice });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: bob });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: charlie });
      await this.pggM.createGlobalProposalProposalManager.aye(proposalId, { from: dan });

      res = await this.pggM.createGlobalProposalProposalManager.getAyeShare(proposalId);
      res = await this.pggM.createGlobalProposalProposalManager.getNayShare(proposalId);

      await assertRevert(this.pggM.createGlobalProposalProposalManager.triggerReject(proposalId));
      await this.pggM.createGlobalProposalProposalManager.triggerApprove(proposalId);

      res = await this.pggM.createGlobalProposalProposalManager.getProposal(proposalId);
      const globalProposalId = res.globalId;

      assert.equal(res.destination, this.pggRegistry.address);
      assert.equal(res.value, 0);
      assert.equal(res.globalId, 1);
      assert.equal(res.data, transferBackBytecode);
      assert.equal(res.description, 'back to centralization');

      res = await this.globalGovernance.proposals(globalProposalId);
      assert.equal(res.creator, this.pggM.createGlobalProposalProposalManager.address);
      assert.equal(res.value, 0);
      assert.equal(res.destination, this.pggRegistry.address);
      assert.equal(res.data, transferBackBytecode);

      res = await this.globalGovernance.getSupport(globalProposalId);
      assert.equal(res, 0);

      // Now voting process begin
      // MultiSig M votes AYE
      await (async () => {
        log('### MultiSig M');
        res = await this.pggM.supportGlobalProposalProposalManager.propose(globalProposalId, 'looks good', {
          from: alice
        });
        // eslint-disable-next-line
        proposalId = res.logs[0].args.proposalId;

        await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: alice });
        await this.pggM.supportGlobalProposalProposalManager.nay(proposalId, { from: bob });
        await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: charlie });
        await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: dan });
        await this.pggM.supportGlobalProposalProposalManager.nay(proposalId, { from: george });
        await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: hannah });
        await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: mike });
        await this.pggM.supportGlobalProposalProposalManager.aye(proposalId, { from: xander });

        await this.pggM.supportGlobalProposalProposalManager.triggerApprove(proposalId);

        res = await this.pggM.config.globalProposalSupport(globalProposalId);
        assert.equal(true, res);

        res = await this.globalGovernance.getSupportDetails(globalProposalId);
        log('global support details', res);

        res = await this.globalGovernance.getSupport(globalProposalId);
        log('global support (%)', res);
      })();

      // MultiSig N votes AYE
      await (async () => {
        log('### MultiSig N');
        res = await this.pggN.supportGlobalProposalProposalManager.propose(globalProposalId, 'looks good', {
          from: alice
        });
        // eslint-disable-next-line
        proposalId = res.logs[0].args.proposalId;

        await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: george });
        await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: hannah });
        await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: nick });
        await this.pggN.supportGlobalProposalProposalManager.aye(proposalId, { from: mike });

        res = await this.pggN.supportGlobalProposalProposalManager.getAyeShare(proposalId);
        assert.equal(res, 30);

        await this.pggN.supportGlobalProposalProposalManager.triggerApprove(proposalId);

        res = await this.globalGovernance.getSupportedMultiSigs(globalProposalId);
        assert.sameMembers(res, [this.pggM.multiSig.address, this.pggN.multiSig.address]);

        res = await this.pggN.config.globalProposalSupport(globalProposalId);
        assert.equal(res, true);

        res = await this.globalGovernance.getSupportDetails(globalProposalId);
        log('global support details', res);

        res = await this.globalGovernance.getSupport(globalProposalId);
        log('global support (%)', res);
      })();

      // MultiSig X doesn't reach the theshold
      // X: charlie, dan, eve, george, hannah, mike, nick, yan, zack
      await (async () => {
        log('### MultiSig X');
        res = await this.pggX.supportGlobalProposalProposalManager.propose(globalProposalId, 'looks good', {
          from: alice
        });
        // eslint-disable-next-line
        proposalId = res.logs[0].args.proposalId;

        await this.pggX.supportGlobalProposalProposalManager.aye(proposalId, { from: hannah });

        res = await this.pggX.supportGlobalProposalProposalManager.getAyeShare(proposalId);
        log('>>>', res.toString(10));
        // assert.equal(res, 30);

        await assertRevert(this.pggX.supportGlobalProposalProposalManager.triggerApprove(proposalId));

        res = await this.globalGovernance.getSupportedMultiSigs(globalProposalId);
        assert.sameMembers(res, [this.pggM.multiSig.address, this.pggN.multiSig.address]);

        res = await this.pggX.config.globalProposalSupport(globalProposalId);
        assert.equal(res, false);

        res = await this.globalGovernance.getSupportDetails(globalProposalId);
        log('global support details', res);

        res = await this.globalGovernance.getSupport(globalProposalId);
        log('global support (%)', res);
      })();

      // MultiSig Y votes NAY
      // Y: charlie, dan, eve, george, hannah, mike, nick, yan, zack
      await (async () => {
        log('### MultiSig Y');
        res = await this.pggY.supportGlobalProposalProposalManager.propose(globalProposalId, 'looks good', {
          from: alice
        });
        // eslint-disable-next-line
        proposalId = res.logs[0].args.proposalId;

        await this.pggY.supportGlobalProposalProposalManager.nay(proposalId, { from: charlie });
        await this.pggY.supportGlobalProposalProposalManager.nay(proposalId, { from: dan });
        await this.pggY.supportGlobalProposalProposalManager.nay(proposalId, { from: eve });
        await this.pggY.supportGlobalProposalProposalManager.nay(proposalId, { from: george });
        await this.pggY.supportGlobalProposalProposalManager.nay(proposalId, { from: hannah });
        await this.pggY.supportGlobalProposalProposalManager.nay(proposalId, { from: mike });
        await this.pggY.supportGlobalProposalProposalManager.aye(proposalId, { from: nick });

        res = await this.pggY.supportGlobalProposalProposalManager.getAyeShare(proposalId);
        log('>>>', res.toString(10));
        // assert.equal(res, 30);

        await this.pggY.supportGlobalProposalProposalManager.triggerReject(proposalId);

        res = await this.globalGovernance.getSupportedMultiSigs(globalProposalId);
        assert.sameMembers(res, [this.pggM.multiSig.address, this.pggN.multiSig.address]);

        res = await this.pggY.config.globalProposalSupport(globalProposalId);
        assert.equal(res, false);

        res = await this.globalGovernance.getSupportDetails(globalProposalId);
        log('global support details', res);

        res = await this.globalGovernance.getSupport(globalProposalId);
        log('global support (%)', res);
      })();

      const support = await this.globalGovernance.getSupport(globalProposalId);
      const defaultThreshold = await this.globalGovernance.defaultThreshold();
      assert.equal(parseInt(support, 10) < parseInt(defaultThreshold, 10), true);

      // not available to be executed yet
      await assertRevert(this.globalGovernance.trigger(globalProposalId));

      res = await this.pggRegistry.owner();
      assert.equal(res, this.globalGovernance.address);

      // MultiSig Z votes NAY
      // Z: oliver, alice, xander
      await (async () => {
        log('### MultiSig Z');
        res = await this.pggZ.supportGlobalProposalProposalManager.propose(globalProposalId, 'looks good', {
          from: alice
        });
        // eslint-disable-next-line
        proposalId = res.logs[0].args.proposalId;

        await this.pggZ.supportGlobalProposalProposalManager.aye(proposalId, { from: oliver });
        await this.pggZ.supportGlobalProposalProposalManager.aye(proposalId, { from: alice });
        await this.pggZ.supportGlobalProposalProposalManager.aye(proposalId, { from: xander });

        res = await this.pggZ.supportGlobalProposalProposalManager.getAyeShare(proposalId);
        log('>>>', res.toString(10));
        // assert.equal(res, 30);

        await this.pggZ.supportGlobalProposalProposalManager.triggerApprove(proposalId);

        res = await this.globalGovernance.getSupportedMultiSigs(globalProposalId);
        assert.sameMembers(res, [this.pggM.multiSig.address, this.pggN.multiSig.address, this.pggZ.multiSig.address]);

        res = await this.pggZ.config.globalProposalSupport(globalProposalId);
        assert.equal(res, true);

        res = await this.globalGovernance.getSupportDetails(globalProposalId);
        log('global support details', res);

        res = await this.globalGovernance.getSupport(globalProposalId);
        log('global support (%)', res);
      })();

      await this.globalGovernance.trigger(globalProposalId);

      res = await this.pggRegistry.owner();
      assert.equal(res, coreTeam);

      log(
        'M',
        await this.spaceRA.lockedPggBalance(this.pggM.multiSig.address),
        await this.galtRA.lockedPggBalance(this.pggM.multiSig.address),
        await this.stakeTracker.balanceOf(this.pggM.multiSig.address)
      );

      log(
        'N',
        await this.spaceRA.lockedPggBalance(this.pggN.multiSig.address),
        await this.galtRA.lockedPggBalance(this.pggN.multiSig.address),
        await this.stakeTracker.balanceOf(this.pggN.multiSig.address)
      );

      log(
        'X',
        await this.spaceRA.lockedPggBalance(this.pggX.multiSig.address),
        await this.galtRA.lockedPggBalance(this.pggX.multiSig.address),
        await this.stakeTracker.balanceOf(this.pggX.multiSig.address)
      );

      log(
        'Y',
        await this.spaceRA.lockedPggBalance(this.pggY.multiSig.address),
        await this.galtRA.lockedPggBalance(this.pggY.multiSig.address),
        await this.stakeTracker.balanceOf(this.pggY.multiSig.address)
      );

      log(
        'Z',
        await this.spaceRA.lockedPggBalance(this.pggZ.multiSig.address),
        await this.galtRA.lockedPggBalance(this.pggZ.multiSig.address),
        await this.stakeTracker.balanceOf(this.pggZ.multiSig.address)
      );

      log(
        'total',
        await this.spaceRA.totalSupply(),
        await this.galtRA.totalSupply(),
        await this.stakeTracker.totalSupply()
      );
    });
  });
});
