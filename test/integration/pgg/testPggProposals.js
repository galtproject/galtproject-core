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

const { assertRevert, ether, initHelperWeb3, numberToEvmWord, paymentMethods } = require('../../helpers');
const { deployPGGFactory, buildPGG } = require('../../deploymentHelpers');

const { utf8ToHex, hexToUtf8 } = Web3.utils;
const bytes32 = utf8ToHex;
const web3 = new Web3(GaltToken.web3.currentProvider);

initHelperWeb3(web3);

const ProposalStatus = {
  NULL: 0,
  ACTIVE: 1,
  APPROVED: 2,
  REJECTED: 3
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

      this.pgg = await buildPGG(
        this.pggFactory,
        [a1, a2, a3],
        2,
        7,
        10,
        60,
        ether(1000),
        [24, 24, 24, 24, 24, 24, 24, 24],
        {},
        alice
      );

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
      const key = await this.pgg.config.SET_THRESHOLD_THRESHOLD();
      let res = await this.pgg.modifyThresholdProposalManager.propose(key, 42, 'its better', { from: alice });
      const { proposalId } = res.logs[0].args;

      await this.pgg.modifyThresholdProposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.modifyThresholdProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.pgg.modifyThresholdProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.pgg.modifyThresholdProposalManager.nay(proposalId, { from: bob });
      await this.pgg.modifyThresholdProposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.modifyThresholdProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.pgg.modifyThresholdProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      await assertRevert(this.pgg.modifyThresholdProposalManager.triggerReject(proposalId));
      await this.pgg.modifyThresholdProposalManager.triggerApprove(proposalId);

      res = await this.pgg.modifyThresholdProposalManager.getProposal(proposalId);
      assert.equal(res.key, key);
      assert.equal(res.value, 42);
      assert.equal(res.description, 'its better');

      res = await this.pgg.modifyThresholdProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.pgg.modifyThresholdProposalManager.getActiveProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);
      res = await this.pgg.modifyThresholdProposalManager.getApprovedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      res = await this.pgg.modifyThresholdProposalManager.getRejectedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);

      res = await this.pgg.config.thresholds(web3.utils.utf8ToHex('set_threshold_threshold'));
      assert.equal(web3.utils.hexToNumberString(res), '42');
    });
  });

  describe('Change MofN Proposals', () => {
    it('should change corresponding values', async function() {
      let res = await this.pgg.modifyMofNProposalManager.propose(12, 13, 'its better', { from: alice });
      const { proposalId } = res.logs[0].args;

      await this.pgg.modifyMofNProposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.modifyMofNProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.pgg.modifyMofNProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.pgg.modifyMofNProposalManager.nay(proposalId, { from: bob });
      await this.pgg.modifyMofNProposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.modifyMofNProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.pgg.modifyMofNProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      await assertRevert(this.pgg.modifyMofNProposalManager.triggerReject(proposalId));
      await this.pgg.modifyMofNProposalManager.triggerApprove(proposalId);

      res = await this.pgg.modifyMofNProposalManager.getProposal(proposalId);
      assert.equal(res.m, 12);
      assert.equal(res.n, 13);
      assert.equal(res.description, 'its better');

      res = await this.pgg.modifyMofNProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.pgg.modifyMofNProposalManager.getActiveProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);
      res = await this.pgg.modifyMofNProposalManager.getApprovedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      res = await this.pgg.modifyMofNProposalManager.getRejectedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);

      res = await this.pgg.config.m();
      assert.equal(res, 12);
      res = await this.pgg.config.n();
      assert.equal(res, 13);
    });
  });

  describe('Change Minimal Arbitrator Stake Proposals', () => {
    it('should change corresponding values', async function() {
      let res = await this.pgg.modifyArbitratorStakeProposalManager.propose(ether(42), 'its better', { from: alice });
      const { proposalId } = res.logs[0].args;

      await this.pgg.modifyArbitratorStakeProposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.modifyArbitratorStakeProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.pgg.modifyArbitratorStakeProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.pgg.modifyArbitratorStakeProposalManager.nay(proposalId, { from: bob });
      await this.pgg.modifyArbitratorStakeProposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.modifyArbitratorStakeProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.pgg.modifyArbitratorStakeProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      await assertRevert(this.pgg.modifyArbitratorStakeProposalManager.triggerReject(proposalId));
      await this.pgg.modifyArbitratorStakeProposalManager.triggerApprove(proposalId);

      res = await this.pgg.modifyArbitratorStakeProposalManager.getProposal(proposalId);
      assert.equal(res.value, ether(42));
      assert.equal(res.description, 'its better');

      res = await this.pgg.modifyArbitratorStakeProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.pgg.modifyArbitratorStakeProposalManager.getActiveProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);
      res = await this.pgg.modifyArbitratorStakeProposalManager.getApprovedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      res = await this.pgg.modifyArbitratorStakeProposalManager.getRejectedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);

      res = await this.pgg.config.minimalArbitratorStake();
      assert.equal(res, ether(42));
    });
  });

  describe('Change Contract Address Proposals', () => {
    it('should change corresponding values', async function() {
      let res = await this.pgg.modifyContractAddressProposalManager.propose(
        bytes32('oracle_stakes_contract'),
        bob,
        'its better',
        { from: alice }
      );
      const { proposalId } = res.logs[0].args;

      await this.pgg.modifyContractAddressProposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.modifyContractAddressProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.pgg.modifyContractAddressProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.pgg.modifyContractAddressProposalManager.nay(proposalId, { from: bob });
      await this.pgg.modifyContractAddressProposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.modifyContractAddressProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.pgg.modifyContractAddressProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      await assertRevert(this.pgg.modifyContractAddressProposalManager.triggerReject(proposalId));
      await this.pgg.modifyContractAddressProposalManager.triggerApprove(proposalId);

      res = await this.pgg.modifyContractAddressProposalManager.getProposal(proposalId);
      assert.equal(hexToUtf8(res.key), 'oracle_stakes_contract');
      assert.equal(res.value, bob);
      assert.equal(res.description, 'its better');

      res = await this.pgg.modifyContractAddressProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.pgg.modifyContractAddressProposalManager.getActiveProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);
      res = await this.pgg.modifyContractAddressProposalManager.getApprovedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      res = await this.pgg.modifyContractAddressProposalManager.getRejectedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);

      res = await this.pgg.config.getOracleStakes();
      assert.equal(res, bob);
    });
  });

  describe('Revoke Arbitrators Proposals', () => {
    it('should set an empty owners list to multisig', async function() {
      let res = await this.pgg.revokeArbitratorsProposalManager.propose('they cheated', { from: alice });
      const { proposalId } = res.logs[0].args;

      await this.pgg.revokeArbitratorsProposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.revokeArbitratorsProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.pgg.revokeArbitratorsProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.pgg.revokeArbitratorsProposalManager.nay(proposalId, { from: bob });
      await this.pgg.revokeArbitratorsProposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.revokeArbitratorsProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.pgg.revokeArbitratorsProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      res = await this.pgg.multiSig.getOwners();
      assert.sameMembers(res, [a1, a2, a3]);

      await assertRevert(this.pgg.revokeArbitratorsProposalManager.triggerReject(proposalId));
      await this.pgg.revokeArbitratorsProposalManager.triggerApprove(proposalId);

      res = await this.pgg.revokeArbitratorsProposalManager.getProposal(proposalId);
      assert.equal(res, 'they cheated');

      res = await this.pgg.revokeArbitratorsProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);

      res = await this.pgg.multiSig.getOwners();
      assert.sameMembers(res, []);
    });
  });

  describe('Change Application Config Proposals', () => {
    it('should change a corresponding application config value', async function() {
      let res = await this.pgg.modifyApplicationConfigProposalManager.propose(
        bytes32('my_key'),
        numberToEvmWord(42),
        'its better',
        { from: alice }
      );
      const { proposalId } = res.logs[0].args;

      await this.pgg.modifyApplicationConfigProposalManager.aye(proposalId, { from: alice });

      res = await this.pgg.modifyApplicationConfigProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.pgg.modifyApplicationConfigProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.pgg.modifyApplicationConfigProposalManager.nay(proposalId, { from: bob });
      await this.pgg.modifyApplicationConfigProposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.modifyApplicationConfigProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.pgg.modifyApplicationConfigProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      await assertRevert(this.pgg.modifyApplicationConfigProposalManager.triggerReject(proposalId));
      await this.pgg.modifyApplicationConfigProposalManager.triggerApprove(proposalId);

      res = await this.pgg.modifyApplicationConfigProposalManager.getProposal(proposalId);
      assert.equal(hexToUtf8(res.key), 'my_key');
      assert.equal(res.value, '0x000000000000000000000000000000000000000000000000000000000000002a');
      assert.equal(res.description, 'its better');

      res = await this.pgg.modifyApplicationConfigProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.pgg.modifyApplicationConfigProposalManager.getActiveProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);
      res = await this.pgg.modifyApplicationConfigProposalManager.getApprovedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      res = await this.pgg.modifyApplicationConfigProposalManager.getRejectedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);

      res = await this.pgg.config.applicationConfig(bytes32('my_key'));
      assert.equal(res, '0x000000000000000000000000000000000000000000000000000000000000002a');
    });
  });

  describe('Create/Support Global Proposal Proposals', () => {
    it('should change a corresponding application config value', async function() {
      // when PGGRegistry is transferred to globalGovernance
      await this.feeRegistry.transferOwnership(this.globalGovernance.address);
      const transferBackBytecode = this.feeRegistry.contract.methods.transferOwnership(coreTeam).encodeABI();

      // we want to vote to transfer it back to the coreTeam
      let res = await this.pgg.createGlobalProposalProposalManager.propose(
        this.feeRegistry.address,
        '0',
        transferBackBytecode,
        'back to centralization',
        { from: alice }
      );
      let { proposalId } = res.logs[0].args;

      await this.pgg.createGlobalProposalProposalManager.aye(proposalId, { from: alice });
      await this.pgg.createGlobalProposalProposalManager.nay(proposalId, { from: bob });
      await this.pgg.createGlobalProposalProposalManager.aye(proposalId, { from: charlie });

      await assertRevert(this.pgg.createGlobalProposalProposalManager.triggerReject(proposalId));
      await this.pgg.createGlobalProposalProposalManager.triggerApprove(proposalId);

      res = await this.pgg.createGlobalProposalProposalManager.getProposal(proposalId);
      const globalProposalId = res.globalId;

      assert.equal(res.destination, this.feeRegistry.address);
      assert.equal(res.value, 0);
      assert.equal(res.globalId, 1);
      assert.equal(res.data, transferBackBytecode);
      assert.equal(res.description, 'back to centralization');

      res = await this.globalGovernance.proposals(globalProposalId);
      assert.equal(res.creator, this.pgg.createGlobalProposalProposalManager.address);
      assert.equal(res.value, 0);
      assert.equal(res.destination, this.feeRegistry.address);
      assert.equal(res.data, transferBackBytecode);

      // support
      res = await this.pgg.supportGlobalProposalProposalManager.propose(globalProposalId, 'looks good', {
        from: alice
      });
      // eslint-disable-next-line
      proposalId = res.logs[0].args.proposalId;

      await this.pgg.supportGlobalProposalProposalManager.aye(proposalId, { from: alice });
      await this.pgg.supportGlobalProposalProposalManager.nay(proposalId, { from: bob });
      await this.pgg.supportGlobalProposalProposalManager.aye(proposalId, { from: charlie });

      res = await this.pgg.config.globalProposalSupport(globalProposalId);
      assert.equal(res, false);

      await this.pgg.supportGlobalProposalProposalManager.triggerApprove(proposalId);

      res = await this.pgg.config.globalProposalSupport(globalProposalId);
      assert.equal(res, true);
    });
  });
});
