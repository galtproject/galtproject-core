const GaltToken = artifacts.require('./GaltToken.sol');
const GlobalGovernance = artifacts.require('./GlobalGovernance.sol');
const ACL = artifacts.require('./ACL.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const ClaimManager = artifacts.require('./ClaimManager.sol');
const MockSpaceRA = artifacts.require('./MockSpaceRA.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');

const { assertRevert, ether, int, initHelperWeb3, numberToEvmWord, paymentMethods } = require('../../helpers');
const { deployPGGFactory, buildPGG } = require('../../deploymentHelpers');

const { utf8ToHex, hexToNumberString } = Web3.utils;
const bytes32 = utf8ToHex;
const web3 = new Web3(GaltToken.web3.currentProvider);

initHelperWeb3(web3);

const ProposalStatus = {
  NULL: 0,
  ACTIVE: 1,
  APPROVED: 2,
  EXECUTED: 3,
  REJECTED: 4
};

contract('PGG Proposals', accounts => {
  const [
    coreTeam,

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

    // oracles
    mike,
    nick,
    oliver,

    // claimer
    zack
  ] = accounts;

  beforeEach(async function() {
    this.attachedDocuments = [
      'QmYNQJoKGNHTpPxCBPh9KkDpaExgd2duMa3aF6ytMpHdao',
      'QmeveuwF5wWBSgUXLG6p1oxF3GKkgjEnhA6AAwHUoVsx6E',
      'QmSrPmbaUKA3ZodhzPWZnpFgcPMFWF4QsxXbkWfEptTBJd'
    ];

    // Setup Galt token
    await (async () => {
      this.galtToken = await GaltToken.new({ from: coreTeam });

      await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(charlie, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(dan, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(eve, ether(10000000), { from: coreTeam });

      await this.galtToken.mint(mike, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(nick, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(oliver, ether(10000000), { from: coreTeam });

      await this.galtToken.mint(zack, ether(10000000), { from: coreTeam });
    })();

    // Create and initialize contracts
    await (async () => {
      this.claimManager = await ClaimManager.new({ from: coreTeam });
      this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
      this.acl = await ACL.new({ from: coreTeam });

      this.spaceToken = await SpaceToken.new(this.ggr.address, 'Space Token', 'SPACE', { from: coreTeam });
      this.globalGovernance = await GlobalGovernance.new({ from: coreTeam });
      this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
      this.pggRegistry = await PGGRegistry.new({ from: coreTeam });
      this.spaceLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('SPACE_LOCKER_REGISTRAR'), {
        from: coreTeam
      });

      this.sra = await MockSpaceRA.new(this.ggr.address, { from: coreTeam });

      await this.acl.initialize();
      await this.ggr.initialize();
      await this.feeRegistry.initialize();
      await this.pggRegistry.initialize(this.ggr.address);
      await this.sra.initialize(this.ggr.address);
      await this.claimManager.initialize(this.ggr.address);
      this.globalGovernance.initialize(this.ggr.address, 750000, 750000, { from: coreTeam });

      await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, {
        from: coreTeam
      });
      await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.SPACE_RA(), this.sra.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.GLOBAL_GOVERNANCE(), this.globalGovernance.address, { from: coreTeam });

      this.pggFactory = await deployPGGFactory(this.ggr, coreTeam);

      await this.acl.setRole(bytes32('ARBITRATION_STAKE_SLASHER'), this.claimManager.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('ORACLE_STAKE_SLASHER'), this.claimManager.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactory.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), this.sra.address, true, { from: coreTeam });

      await this.feeRegistry.setGaltFee(await this.pggFactory.FEE_KEY(), ether(10), { from: coreTeam });
      await this.feeRegistry.setEthFee(await this.pggFactory.FEE_KEY(), ether(5), { from: coreTeam });
      await this.feeRegistry.setPaymentMethod(await this.pggFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
        from: coreTeam
      });
    })();

    // Setup pgg
    await (async () => {
      await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });

      this.pgg = await buildPGG(this.pggFactory, [a1, a2, a3], 2, 7, 10, 60, ether(1000), 240000, {}, {}, alice);

      this.mX = this.pgg.config.address;
    })();

    // Mint and distribute SRA reputation using mock
    await (async () => {
      await this.sra.mintAll([alice, bob, charlie, dan, eve], ['10', '11', '12', '13', '14'], 500);
      assert.equal(await this.sra.balanceOf(alice), 500);
      await this.sra.lockReputation(this.mX, 500, { from: alice });
      await this.sra.lockReputation(this.mX, 500, { from: bob });
      await this.sra.delegate(charlie, dan, 500, { from: dan });
      await this.sra.lockReputation(this.mX, 1000, { from: charlie });
      await this.sra.lockReputation(this.mX, 500, { from: eve });
    })();
    // alice - 500 (8%)
    // bob - 500 (8%)
    // charlie - 1000 (16%)
    // eve - 500 (8%)
    // total - 2500 (40%)
  });

  describe('ModifyThreshold Proposals', () => {
    it('should change corresponding values', async function() {
      const key = await this.pgg.config.getThresholdMarker(
        this.pgg.config.address,
        await this.pgg.config.SET_THRESHOLD_SIGNATURE()
      );
      const proposeData = this.pgg.config.contract.methods.setThreshold(key, 420000).encodeABI();
      await assertRevert(
        this.pgg.proposalManager.propose(this.pgg.config.address, 0, proposeData, 'its better', {
          from: coreTeam
        })
      );
      let res = await this.pgg.proposalManager.propose(this.pgg.config.address, 0, proposeData, 'its better', {
        from: alice
      });
      const { proposalId } = res.logs[0].args;

      await this.pgg.proposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 80000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.pgg.proposalManager.nay(proposalId, { from: bob });
      await this.pgg.proposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 240000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 80000);
      res = await this.pgg.proposalManager.getThreshold(proposalId);
      assert.equal(res, 240000);

      await assertRevert(this.pgg.proposalManager.triggerReject(proposalId));
      await this.pgg.proposalManager.triggerApprove(proposalId);

      res = await this.pgg.proposalManager.proposals(proposalId);
      assert.equal(res.description, 'its better');
      assert.equal(res.status, ProposalStatus.EXECUTED);

      res = await this.pgg.proposalManager.getProposalVoters(proposalId);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.pgg.proposalManager.getActiveProposals();
      assert.sameMembers(res.map(int), []);
      res = await this.pgg.proposalManager.getApprovedProposals();
      assert.sameMembers(res.map(int), [1]);
      res = await this.pgg.proposalManager.getRejectedProposals();
      assert.sameMembers(res.map(int), []);

      res = await this.pgg.config.thresholds(
        await this.pgg.config.getThresholdMarker(this.pgg.config.address, proposeData)
      );
      assert.equal(web3.utils.hexToNumberString(res), '420000');

      res = await this.pgg.proposalManager.getThreshold(proposalId);
      assert.equal(res, 420000);
    });
  });

  describe('Change MofN Proposals', () => {
    it('should change corresponding values', async function() {
      const proposeData = this.pgg.config.contract.methods.setMofN(12, 13).encodeABI();
      let res = await this.pgg.proposalManager.propose(this.pgg.config.address, 0, proposeData, 'its better', {
        from: alice
      });
      const { proposalId } = res.logs[0].args;

      await this.pgg.proposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 80000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.pgg.proposalManager.nay(proposalId, { from: bob });
      await this.pgg.proposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 240000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 80000);
      res = await this.pgg.proposalManager.getThreshold(proposalId);
      assert.equal(res, 240000);

      await assertRevert(this.pgg.proposalManager.triggerReject(proposalId));
      await this.pgg.proposalManager.triggerApprove(proposalId);

      res = await this.pgg.proposalManager.proposals(proposalId);
      assert.equal(res.description, 'its better');
      assert.equal(res.status, ProposalStatus.EXECUTED);

      res = await this.pgg.proposalManager.getProposalVoters(proposalId);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.pgg.proposalManager.getActiveProposals();
      assert.sameMembers(res.map(int), []);
      res = await this.pgg.proposalManager.getApprovedProposals();
      assert.sameMembers(res.map(int), [1]);
      res = await this.pgg.proposalManager.getRejectedProposals();
      assert.sameMembers(res.map(int), []);

      res = await this.pgg.config.m();
      assert.equal(res, 12);
      res = await this.pgg.config.n();
      assert.equal(res, 13);
    });
  });

  describe('Change Minimal Arbitrator Stake Proposals', () => {
    it('should change corresponding values', async function() {
      const proposeData = this.pgg.config.contract.methods.setMinimalArbitratorStake(ether(42)).encodeABI();
      let res = await this.pgg.proposalManager.propose(this.pgg.config.address, 0, proposeData, 'its better', {
        from: alice
      });
      const { proposalId } = res.logs[0].args;

      await this.pgg.proposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 80000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 0);
      res = await this.pgg.proposalManager.getThreshold(proposalId);
      assert.equal(res, 240000);

      await this.pgg.proposalManager.nay(proposalId, { from: bob });
      await this.pgg.proposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 240000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 80000);

      await assertRevert(this.pgg.proposalManager.triggerReject(proposalId));
      await this.pgg.proposalManager.triggerApprove(proposalId);

      res = await this.pgg.proposalManager.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.EXECUTED);

      res = await this.pgg.proposalManager.getProposalVoters(proposalId);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.pgg.proposalManager.getActiveProposals();
      assert.sameMembers(res.map(int), []);
      res = await this.pgg.proposalManager.getApprovedProposals();
      assert.sameMembers(res.map(int), [1]);
      res = await this.pgg.proposalManager.getRejectedProposals();
      assert.sameMembers(res.map(int), []);

      res = await this.pgg.config.minimalArbitratorStake();
      assert.equal(res, ether(42));
    });
  });

  describe('Change Contract Address Proposals', () => {
    it('should change corresponding values', async function() {
      const proposeData = this.pgg.config.contract.methods
        .setContractAddress(bytes32('oracle_stakes_contract'), bob)
        .encodeABI();
      let res = await this.pgg.proposalManager.propose(this.pgg.config.address, 0, proposeData, 'its better', {
        from: alice
      });
      const { proposalId } = res.logs[0].args;

      await this.pgg.proposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 80000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 0);
      res = await this.pgg.proposalManager.getThreshold(proposalId);
      assert.equal(res, 240000);

      await this.pgg.proposalManager.nay(proposalId, { from: bob });
      await this.pgg.proposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 240000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 80000);

      await assertRevert(this.pgg.proposalManager.triggerReject(proposalId));
      await this.pgg.proposalManager.triggerApprove(proposalId);

      res = await this.pgg.proposalManager.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.EXECUTED);

      res = await this.pgg.proposalManager.getProposalVoters(proposalId);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.pgg.proposalManager.getActiveProposals();
      assert.sameMembers(res.map(int), []);
      res = await this.pgg.proposalManager.getApprovedProposals();
      assert.sameMembers(res.map(int), [1]);
      res = await this.pgg.proposalManager.getRejectedProposals();
      assert.sameMembers(res.map(int), []);

      res = await this.pgg.config.getOracleStakes();
      assert.equal(res, bob);
    });
  });

  describe('Revoke Arbitrators Proposals', () => {
    it('should set an empty owners list to multisig', async function() {
      const proposeData = this.pgg.multiSig.contract.methods.revokeArbitrators().encodeABI();
      let res = await this.pgg.proposalManager.propose(this.pgg.multiSig.address, 0, proposeData, 'they cheated', {
        from: alice
      });
      const { proposalId } = res.logs[0].args;

      await this.pgg.proposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 80000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 0);
      res = await this.pgg.proposalManager.getThreshold(proposalId);
      assert.equal(res, 240000);

      await this.pgg.proposalManager.nay(proposalId, { from: bob });
      await this.pgg.proposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 240000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 80000);

      res = await this.pgg.multiSig.getOwners();
      assert.sameMembers(res, [a1, a2, a3]);

      await assertRevert(this.pgg.proposalManager.triggerReject(proposalId));
      await this.pgg.proposalManager.triggerApprove(proposalId);

      res = await this.pgg.proposalManager.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.EXECUTED);
      assert.equal(res.description, 'they cheated');

      res = await this.pgg.multiSig.getOwners();
      assert.sameMembers(res, []);
    });
  });

  describe('Change Application Config Proposals', () => {
    it('should change a corresponding application config value', async function() {
      const proposeData = this.pgg.config.contract.methods
        .setApplicationConfigValue(bytes32('my_key'), numberToEvmWord(42))
        .encodeABI();
      let res = await this.pgg.proposalManager.propose(this.pgg.config.address, 0, proposeData, 'its better', {
        from: alice
      });
      const { proposalId } = res.logs[0].args;

      res = await this.pgg.config.applicationConfig(bytes32('my_key'));
      assert.equal(res, '0x0000000000000000000000000000000000000000000000000000000000000000');

      await this.pgg.proposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 80000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 0);
      res = await this.pgg.proposalManager.getThreshold(proposalId);
      assert.equal(res, 240000);

      await this.pgg.proposalManager.nay(proposalId, { from: bob });
      await this.pgg.proposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.proposalManager.getAyeShare(proposalId);
      assert.equal(res, 240000);
      res = await this.pgg.proposalManager.getNayShare(proposalId);
      assert.equal(res, 80000);

      await assertRevert(this.pgg.proposalManager.triggerReject(proposalId));
      await this.pgg.proposalManager.triggerApprove(proposalId);

      res = await this.pgg.proposalManager.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.EXECUTED);

      res = await this.pgg.proposalManager.getProposalVoters(proposalId);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.pgg.proposalManager.getActiveProposals();
      assert.sameMembers(res.map(int), []);
      res = await this.pgg.proposalManager.getApprovedProposals();
      assert.sameMembers(res.map(int), [1]);
      res = await this.pgg.proposalManager.getRejectedProposals();
      assert.sameMembers(res.map(int), []);

      res = await this.pgg.config.applicationConfig(bytes32('my_key'));
      assert.equal(res, '0x000000000000000000000000000000000000000000000000000000000000002a');
    });
  });

  describe('Create/Support Global Proposal Proposals', () => {
    it('should change a corresponding application config value', async function() {
      // when PGGRegistry is transferred to globalGovernance
      await this.feeRegistry.transferOwnership(this.globalGovernance.address);

      const transferBackBytecode = this.feeRegistry.contract.methods.transferOwnership(coreTeam).encodeABI();
      let proposeData = this.globalGovernance.contract.methods
        .propose(this.pgg.config.address, this.feeRegistry.address, '0', transferBackBytecode)
        .encodeABI();

      let res = await this.pgg.proposalManager.propose(this.globalGovernance.address, 0, proposeData, 'its better', {
        from: alice
      });
      let { proposalId } = res.logs[0].args;

      await this.pgg.proposalManager.aye(proposalId, { from: alice });
      await this.pgg.proposalManager.nay(proposalId, { from: bob });
      await this.pgg.proposalManager.aye(proposalId, { from: charlie });

      await assertRevert(this.pgg.proposalManager.triggerReject(proposalId));
      await this.pgg.proposalManager.triggerApprove(proposalId);

      res = await this.pgg.proposalManager.proposals(proposalId);
      const globalProposalId = hexToNumberString(res.response);

      assert.equal(res.destination, this.globalGovernance.address);
      assert.equal(res.value, 0);
      assert.equal(res.status, ProposalStatus.EXECUTED);
      assert.equal(res.data, proposeData);
      assert.equal(res.description, 'its better');

      res = await this.globalGovernance.proposals(globalProposalId);
      assert.equal(res.creator, this.pgg.proposalManager.address);
      assert.equal(res.value, 0);
      assert.equal(res.destination, this.feeRegistry.address);
      assert.equal(res.data, transferBackBytecode);

      // support
      proposeData = this.pgg.config.contract.methods.setGlobalProposalSupport(globalProposalId, true).encodeABI();
      res = await this.pgg.proposalManager.propose(this.pgg.config.address, 0, proposeData, 'blah', {
        from: alice
      });
      // eslint-disable-next-line
      proposalId = res.logs[0].args.proposalId;

      await this.pgg.proposalManager.aye(proposalId, { from: alice });
      await this.pgg.proposalManager.nay(proposalId, { from: bob });
      await this.pgg.proposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.config.globalProposalSupport(globalProposalId);
      assert.equal(res, false);

      await this.pgg.proposalManager.triggerApprove(proposalId);

      res = await this.pgg.config.globalProposalSupport(globalProposalId);
      assert.equal(res, true);
    });
  });
});
