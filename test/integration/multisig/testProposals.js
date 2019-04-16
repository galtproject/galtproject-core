const GaltToken = artifacts.require('./GaltToken.sol');
const GlobalGovernance = artifacts.require('./GlobalGovernance.sol');
const ACL = artifacts.require('./ACL.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const ClaimManager = artifacts.require('./ClaimManager.sol');
const MockSpaceRA = artifacts.require('./MockSpaceRA.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');

const { assertRevert, ether, initHelperWeb3, numberToEvmWord, paymentMethods } = require('../../helpers');
const { deployMultiSigFactory, buildArbitration } = require('../../deploymentHelpers');

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

contract('Proposals', accounts => {
  const [
    coreTeam,
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
      this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
      this.claimManager = await ClaimManager.new({ from: coreTeam });
      this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
      this.acl = await ACL.new({ from: coreTeam });

      this.globalGovernance = await GlobalGovernance.new({ from: coreTeam });
      this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
      this.multiSigRegistry = await MultiSigRegistry.new(this.ggr.address, { from: coreTeam });
      this.spaceLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('SPACE_LOCKER_REGISTRAR'), {
        from: coreTeam
      });

      this.sra = await MockSpaceRA.new(this.ggr.address, { from: coreTeam });

      await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.MULTI_SIG_REGISTRY(), this.multiSigRegistry.address, {
        from: coreTeam
      });
      await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.CLAIM_MANAGER(), claimManagerAddress, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.SPACE_RA(), this.sra.address, { from: coreTeam });
      await this.ggr.setContract(await this.ggr.GLOBAL_GOVERNANCE(), this.globalGovernance.address, { from: coreTeam });

      this.multiSigFactory = await deployMultiSigFactory(this.ggr, coreTeam);

      await this.acl.setRole(bytes32('ARBITRATION_STAKE_SLASHER'), this.claimManager.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('ORACLE_STAKE_SLASHER'), this.claimManager.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('MULTI_SIG_REGISTRAR'), this.multiSigFactory.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), this.sra.address, true, { from: coreTeam });

      await this.feeRegistry.setGaltFee(await this.multiSigFactory.FEE_KEY(), ether(10), { from: coreTeam });
      await this.feeRegistry.setEthFee(await this.multiSigFactory.FEE_KEY(), ether(5), { from: coreTeam });
      await this.feeRegistry.setPaymentMethod(await this.multiSigFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
        from: coreTeam
      });

      await this.claimManager.initialize(this.ggr.address, {
        from: coreTeam
      });
    })();

    // Setup multiSig
    await (async () => {
      await this.galtToken.approve(this.multiSigFactory.address, ether(20), { from: alice });

      this.ab = await buildArbitration(
        this.multiSigFactory,
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

      this.mX = this.ab.multiSig.address;
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
      const key = await this.ab.config.SET_THRESHOLD_THRESHOLD();
      let res = await this.ab.modifyThresholdProposalManager.propose(key, 42, 'its better', { from: alice });
      const { proposalId } = res.logs[0].args;

      await this.ab.modifyThresholdProposalManager.aye(proposalId, { from: alice });

      res = await this.ab.modifyThresholdProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.ab.modifyThresholdProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.ab.modifyThresholdProposalManager.nay(proposalId, { from: bob });
      await this.ab.modifyThresholdProposalManager.aye(proposalId, { from: charlie });

      res = await this.ab.modifyThresholdProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.ab.modifyThresholdProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      await assertRevert(this.ab.modifyThresholdProposalManager.triggerReject(proposalId));
      await this.ab.modifyThresholdProposalManager.triggerApprove(proposalId);

      res = await this.ab.modifyThresholdProposalManager.getProposal(proposalId);
      assert.equal(res.key, key);
      assert.equal(res.value, 42);
      assert.equal(res.description, 'its better');

      res = await this.ab.modifyThresholdProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.ab.modifyThresholdProposalManager.getActiveProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);
      res = await this.ab.modifyThresholdProposalManager.getApprovedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      res = await this.ab.modifyThresholdProposalManager.getRejectedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);

      res = await this.ab.config.thresholds(web3.utils.utf8ToHex('set_threshold_threshold'));
      assert.equal(web3.utils.hexToNumberString(res), '42');
    });
  });

  describe('Change MofN Proposals', () => {
    it('should change corresponding values', async function() {
      let res = await this.ab.modifyMofNProposalManager.propose(12, 13, 'its better', { from: alice });
      const { proposalId } = res.logs[0].args;

      await this.ab.modifyMofNProposalManager.aye(proposalId, { from: alice });

      res = await this.ab.modifyMofNProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.ab.modifyMofNProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.ab.modifyMofNProposalManager.nay(proposalId, { from: bob });
      await this.ab.modifyMofNProposalManager.aye(proposalId, { from: charlie });

      res = await this.ab.modifyMofNProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.ab.modifyMofNProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      await assertRevert(this.ab.modifyMofNProposalManager.triggerReject(proposalId));
      await this.ab.modifyMofNProposalManager.triggerApprove(proposalId);

      res = await this.ab.modifyMofNProposalManager.getProposal(proposalId);
      assert.equal(res.m, 12);
      assert.equal(res.n, 13);
      assert.equal(res.description, 'its better');

      res = await this.ab.modifyMofNProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.ab.modifyMofNProposalManager.getActiveProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);
      res = await this.ab.modifyMofNProposalManager.getApprovedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      res = await this.ab.modifyMofNProposalManager.getRejectedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);

      res = await this.ab.config.m();
      assert.equal(res, 12);
      res = await this.ab.config.n();
      assert.equal(res, 13);
    });
  });

  describe('Change Minimal Arbitrator Stake Proposals', () => {
    it('should change corresponding values', async function() {
      let res = await this.ab.modifyArbitratorStakeProposalManager.propose(ether(42), 'its better', { from: alice });
      const { proposalId } = res.logs[0].args;

      await this.ab.modifyArbitratorStakeProposalManager.aye(proposalId, { from: alice });

      res = await this.ab.modifyArbitratorStakeProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.ab.modifyArbitratorStakeProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.ab.modifyArbitratorStakeProposalManager.nay(proposalId, { from: bob });
      await this.ab.modifyArbitratorStakeProposalManager.aye(proposalId, { from: charlie });

      res = await this.ab.modifyArbitratorStakeProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.ab.modifyArbitratorStakeProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      await assertRevert(this.ab.modifyArbitratorStakeProposalManager.triggerReject(proposalId));
      await this.ab.modifyArbitratorStakeProposalManager.triggerApprove(proposalId);

      res = await this.ab.modifyArbitratorStakeProposalManager.getProposal(proposalId);
      assert.equal(res.value, ether(42));
      assert.equal(res.description, 'its better');

      res = await this.ab.modifyArbitratorStakeProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.ab.modifyArbitratorStakeProposalManager.getActiveProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);
      res = await this.ab.modifyArbitratorStakeProposalManager.getApprovedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      res = await this.ab.modifyArbitratorStakeProposalManager.getRejectedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);

      res = await this.ab.config.minimalArbitratorStake();
      assert.equal(res, ether(42));
    });
  });

  describe('Change Contract Address Proposals', () => {
    it('should change corresponding values', async function() {
      let res = await this.ab.modifyContractAddressProposalManager.propose(
        bytes32('oracle_stakes_contract'),
        bob,
        'its better',
        { from: alice }
      );
      const { proposalId } = res.logs[0].args;

      await this.ab.modifyContractAddressProposalManager.aye(proposalId, { from: alice });

      res = await this.ab.modifyContractAddressProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.ab.modifyContractAddressProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.ab.modifyContractAddressProposalManager.nay(proposalId, { from: bob });
      await this.ab.modifyContractAddressProposalManager.aye(proposalId, { from: charlie });

      res = await this.ab.modifyContractAddressProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.ab.modifyContractAddressProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      await assertRevert(this.ab.modifyContractAddressProposalManager.triggerReject(proposalId));
      await this.ab.modifyContractAddressProposalManager.triggerApprove(proposalId);

      res = await this.ab.modifyContractAddressProposalManager.getProposal(proposalId);
      assert.equal(hexToUtf8(res.key), 'oracle_stakes_contract');
      assert.equal(res.value, bob);
      assert.equal(res.description, 'its better');

      res = await this.ab.modifyContractAddressProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.ab.modifyContractAddressProposalManager.getActiveProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);
      res = await this.ab.modifyContractAddressProposalManager.getApprovedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      res = await this.ab.modifyContractAddressProposalManager.getRejectedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);

      res = await this.ab.config.getOracleStakes();
      assert.equal(res, bob);
    });
  });

  describe('Revoke Arbitrators Proposals', () => {
    it('should set an empty owners list to multisig', async function() {
      let res = await this.ab.revokeArbitratorsProposalManager.propose('they cheated', { from: alice });
      const { proposalId } = res.logs[0].args;

      await this.ab.revokeArbitratorsProposalManager.aye(proposalId, { from: alice });

      res = await this.ab.revokeArbitratorsProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.ab.revokeArbitratorsProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.ab.revokeArbitratorsProposalManager.nay(proposalId, { from: bob });
      await this.ab.revokeArbitratorsProposalManager.aye(proposalId, { from: charlie });

      res = await this.ab.revokeArbitratorsProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.ab.revokeArbitratorsProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      res = await this.ab.multiSig.getOwners();
      assert.sameMembers(res, [a1, a2, a3]);

      await assertRevert(this.ab.revokeArbitratorsProposalManager.triggerReject(proposalId));
      await this.ab.revokeArbitratorsProposalManager.triggerApprove(proposalId);

      res = await this.ab.revokeArbitratorsProposalManager.getProposal(proposalId);
      assert.equal(res, 'they cheated');

      res = await this.ab.revokeArbitratorsProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);

      res = await this.ab.multiSig.getOwners();
      assert.sameMembers(res, []);
    });
  });

  describe('Change Application Config Proposals', () => {
    it('should change a corresponding application config value', async function() {
      let res = await this.ab.modifyApplicationConfigProposalManager.propose(
        bytes32('my_key'),
        numberToEvmWord(42),
        'its better',
        { from: alice }
      );
      const { proposalId } = res.logs[0].args;

      await this.ab.modifyApplicationConfigProposalManager.aye(proposalId, { from: alice });

      res = await this.ab.modifyApplicationConfigProposalManager.getAyeShare(proposalId);
      assert.equal(res, 8);
      res = await this.ab.modifyApplicationConfigProposalManager.getNayShare(proposalId);
      assert.equal(res, 0);

      await this.ab.modifyApplicationConfigProposalManager.nay(proposalId, { from: bob });
      await this.ab.modifyApplicationConfigProposalManager.aye(proposalId, { from: charlie });

      res = await this.ab.modifyApplicationConfigProposalManager.getAyeShare(proposalId);
      assert.equal(res, 24);
      res = await this.ab.modifyApplicationConfigProposalManager.getNayShare(proposalId);
      assert.equal(res, 8);

      await assertRevert(this.ab.modifyApplicationConfigProposalManager.triggerReject(proposalId));
      await this.ab.modifyApplicationConfigProposalManager.triggerApprove(proposalId);

      res = await this.ab.modifyApplicationConfigProposalManager.getProposal(proposalId);
      assert.equal(hexToUtf8(res.key), 'my_key');
      assert.equal(res.value, '0x000000000000000000000000000000000000000000000000000000000000002a');
      assert.equal(res.description, 'its better');

      res = await this.ab.modifyApplicationConfigProposalManager.getProposalVoting(proposalId);
      assert.equal(res.status, ProposalStatus.APPROVED);
      assert.sameMembers(res.ayes, [alice, charlie]);
      assert.sameMembers(res.nays, [bob]);

      res = await this.ab.modifyApplicationConfigProposalManager.getActiveProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);
      res = await this.ab.modifyApplicationConfigProposalManager.getApprovedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      res = await this.ab.modifyApplicationConfigProposalManager.getRejectedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);

      res = await this.ab.config.applicationConfig(bytes32('my_key'));
      assert.equal(res, '0x000000000000000000000000000000000000000000000000000000000000002a');
    });
  });

  describe('Create/Support Global Proposal Proposals', () => {
    it('should change a corresponding application config value', async function() {
      // when MultiSigRegistry is transferred to globalGovernance
      await this.multiSigRegistry.transferOwnership(this.globalGovernance.address);
      const transferBackBytecode = this.multiSigRegistry.contract.methods.transferOwnership(coreTeam).encodeABI();

      // we want to vote to transfer it back to the coreTeam
      let res = await this.ab.createGlobalProposalProposalManager.propose(
        this.multiSigRegistry.address,
        '0',
        transferBackBytecode,
        'back to centralization',
        { from: alice }
      );
      let { proposalId } = res.logs[0].args;

      await this.ab.createGlobalProposalProposalManager.aye(proposalId, { from: alice });
      await this.ab.createGlobalProposalProposalManager.nay(proposalId, { from: bob });
      await this.ab.createGlobalProposalProposalManager.aye(proposalId, { from: charlie });

      await assertRevert(this.ab.createGlobalProposalProposalManager.triggerReject(proposalId));
      await this.ab.createGlobalProposalProposalManager.triggerApprove(proposalId);

      res = await this.ab.createGlobalProposalProposalManager.getProposal(proposalId);
      const globalProposalId = res.globalId;

      assert.equal(res.destination, this.multiSigRegistry.address);
      assert.equal(res.value, 0);
      assert.equal(res.globalId, 1);
      assert.equal(res.data, transferBackBytecode);
      assert.equal(res.description, 'back to centralization');

      res = await this.globalGovernance.proposals(globalProposalId);
      assert.equal(res.creator, this.ab.createGlobalProposalProposalManager.address);
      assert.equal(res.value, 0);
      assert.equal(res.destination, this.multiSigRegistry.address);
      assert.equal(res.data, transferBackBytecode);

      // support
      res = await this.ab.supportGlobalProposalProposalManager.propose(globalProposalId, 'looks good', { from: alice });
      // eslint-disable-next-line
      proposalId = res.logs[0].args.proposalId;

      await this.ab.supportGlobalProposalProposalManager.aye(proposalId, { from: alice });
      await this.ab.supportGlobalProposalProposalManager.nay(proposalId, { from: bob });
      await this.ab.supportGlobalProposalProposalManager.aye(proposalId, { from: charlie });

      res = await this.ab.config.globalProposalSupport(globalProposalId);
      assert.equal(res, false);

      await this.ab.supportGlobalProposalProposalManager.triggerApprove(proposalId);

      res = await this.ab.config.globalProposalSupport(globalProposalId);
      assert.equal(res, true);
    });
  });
});
