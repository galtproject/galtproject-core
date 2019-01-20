const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const SpaceReputationAccounting = artifacts.require('./SpaceReputationAccounting.sol');
const FundStorageFactory = artifacts.require('./FundStorageFactory.sol');
const FundMultiSigFactory = artifacts.require('./FundMultiSigFactory.sol');
const FundControllerFactory = artifacts.require('./FundControllerFactory.sol');
const MockRSRA = artifacts.require('./MockRSRA.sol');
const MockRSRAFactory = artifacts.require('./MockRSRAFactory.sol');
const FundFactory = artifacts.require('./FundFactory.sol');
const FundStorage = artifacts.require('./FundStorage.sol');

const NewMemberProposalManagerFactory = artifacts.require('./NewMemberProposalManagerFactory.sol');
const ExpelMemberProposalManagerFactory = artifacts.require('./ExpelMemberProposalManagerFactory.sol');
const WLProposalManagerFactory = artifacts.require('./WLProposalManagerFactory.sol');
const FineMemberProposalManagerFactory = artifacts.require('./FineMemberProposalManagerFactory.sol');
const MockModifyConfigProposalManagerFactory = artifacts.require('./MockModifyConfigProposalManagerFactory.sol');

const MockModifyConfigProposalManager = artifacts.require('./MockModifyConfigProposalManager.sol');

const Web3 = require('web3');
const { ether, assertRevert, initHelperWeb3, initHelperArtifacts } = require('../../helpers');

const web3 = new Web3(SpaceReputationAccounting.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const ProposalStatus = {
  NULL: 0,
  ACTIVE: 1,
  APPROVED: 2,
  REJECTED: 3
};

contract('ModifyConfigProposal', accounts => {
  const [coreTeam, alice, bob, charlie, dan, eve, frank, spaceLockerRegistryAddress] = accounts;

  beforeEach(async function() {
    this.spaceToken = await SpaceToken.new('Name', 'Symbol', { from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    this.spaceReputationAccounting = await SpaceReputationAccounting.new(
      this.spaceToken.address,
      this.multiSigRegistry.address,
      spaceLockerRegistryAddress,
      { from: coreTeam }
    );

    // fund factory contracts
    this.rsraFactory = await MockRSRAFactory.new();
    this.fundStorageFactory = await FundStorageFactory.new();
    this.fundMultiSigFactory = await FundMultiSigFactory.new();
    this.fundControllerFactory = await FundControllerFactory.new();

    this.modifyConfigProposalManagerFactory = await MockModifyConfigProposalManagerFactory.new();
    this.newMemberProposalManagerFactory = await NewMemberProposalManagerFactory.new();
    this.fineMemberProposalManagerFactory = await FineMemberProposalManagerFactory.new();
    this.expelMemberProposalManagerFactory = await ExpelMemberProposalManagerFactory.new();
    this.wlProposalManagerFactory = await WLProposalManagerFactory.new();

    this.fundFactory = await FundFactory.new(
      this.galtToken.address,
      this.spaceToken.address,
      spaceLockerRegistryAddress,
      this.rsraFactory.address,
      this.fundMultiSigFactory.address,
      this.fundStorageFactory.address,
      this.fundControllerFactory.address,
      this.modifyConfigProposalManagerFactory.address,
      this.newMemberProposalManagerFactory.address,
      this.fineMemberProposalManagerFactory.address,
      this.expelMemberProposalManagerFactory.address,
      this.wlProposalManagerFactory.address,
      { from: coreTeam }
    );

    // assign roles
    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    // build fund
    await this.galtToken.approve(this.fundFactory.address, ether(100), { from: alice });
    let res = await this.fundFactory.buildFirstStep(false, 60, 50, 60, 60, 60, [bob, charlie, dan], 2, { from: alice });
    this.rsraX = await MockRSRA.at(res.logs[0].args.fundRsra);
    this.fundStorageX = await FundStorage.at(res.logs[0].args.fundStorage);

    res = await this.fundFactory.buildSecondStep({ from: alice });
    this.modifyConfigProposalManagerX = await MockModifyConfigProposalManager.at(
      res.logs[0].args.modifyConfigProposalManager
    );

    await this.fundFactory.buildThirdStep({ from: alice });

    this.spaceReputationAccountingWeb3 = new web3.eth.Contract(
      this.spaceReputationAccounting.abi,
      this.spaceReputationAccounting.address
    );
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
    this.rsraXWeb3 = new web3.eth.Contract(this.rsraX.abi, this.rsraX.address);
    this.modifyConfigProposalManagerXWeb3 = new web3.eth.Contract(
      this.modifyConfigProposalManagerX.abi,
      this.modifyConfigProposalManagerX.address
    );
    this.fundStorageXWeb3 = new web3.eth.Contract(this.fundStorageX.abi, this.fundStorageX.address);

    this.beneficiaries = [bob, charlie, dan, eve, frank];
  });

  describe('proposal creation', () => {
    it('should allow user who has reputation creating a new proposal', async function() {
      await this.rsraX.mintAndLockHack(this.beneficiaries, 300, { from: alice });

      let res = await this.modifyConfigProposalManagerX.propose(
        'modify_config_threshold',
        '0x000000000000000000000000000000000000000000000000000000000000002a',
        'blah',
        {
          from: bob
        }
      );

      const proposalId = res.logs[0].args.proposalId.toString(10);

      res = await this.modifyConfigProposalManagerXWeb3.methods.getProposal(proposalId).call();
      assert.equal(web3.utils.hexToUtf8(res.key), 'modify_config_threshold');
      assert.equal(web3.utils.hexToNumberString(res.value), '42');
      assert.equal(res.description, 'blah');
    });
  });

  describe('voting method #2 (Proposal contracts queries RSRA for addresses locked reputation share)', () => {
    it('should allow reverting a proposal if negative votes threshold is reached', async function() {
      await this.rsraX.mintAndLockHack(this.beneficiaries, 300, { from: alice });

      let res = await this.modifyConfigProposalManagerX.propose(
        'modify_config_threshold',
        '0x000000000000000000000000000000000000000000000000000000000000002a',
        'blah',
        {
          from: bob
        }
      );

      const proposalId = res.logs[0].args.proposalId.toString(10);

      await this.modifyConfigProposalManagerX.aye(proposalId, { from: bob });
      await this.modifyConfigProposalManagerX.nay(proposalId, { from: charlie });

      res = await this.modifyConfigProposalManagerXWeb3.methods.getProposalVoting(proposalId).call();
      assert.sameMembers(res.ayes.map(a => a.toLowerCase()), [bob]);
      assert.sameMembers(res.nays.map(a => a.toLowerCase()), [charlie]);

      assert.equal(res.status, ProposalStatus.ACTIVE);

      res = await this.modifyConfigProposalManagerXWeb3.methods.getAyeShare(proposalId).call();
      assert.equal(res, 20);
      res = await this.modifyConfigProposalManagerXWeb3.methods.getNayShare(proposalId).call();
      assert.equal(res, 20);

      // Deny double-vote
      await assertRevert(this.modifyConfigProposalManagerX.aye(proposalId, { from: bob }));

      await assertRevert(this.modifyConfigProposalManagerX.triggerReject(proposalId, { from: dan }));

      await this.modifyConfigProposalManagerX.nay(proposalId, { from: dan });
      await this.modifyConfigProposalManagerX.nay(proposalId, { from: eve });

      res = await this.modifyConfigProposalManagerXWeb3.methods.getAyeShare(proposalId).call();
      assert.equal(res, 20);
      res = await this.modifyConfigProposalManagerXWeb3.methods.getNayShare(proposalId).call();
      assert.equal(res, 60);

      await this.modifyConfigProposalManagerX.triggerReject(proposalId, { from: dan });

      res = await this.modifyConfigProposalManagerXWeb3.methods.getProposalVoting(proposalId).call();
      assert.equal(res.status, ProposalStatus.REJECTED);
    });

    it('should allow approving proposal if positive votes threshold is reached', async function() {
      await this.rsraX.mintAndLockHack(this.beneficiaries, 300, { from: alice });

      let res = await this.modifyConfigProposalManagerX.propose(
        'modify_config_threshold',
        '0x000000000000000000000000000000000000000000000000000000000000002a',
        'blah',
        {
          from: bob
        }
      );

      const proposalId = res.logs[0].args.proposalId.toString(10);

      await this.modifyConfigProposalManagerX.aye(proposalId, { from: bob });
      await this.modifyConfigProposalManagerX.nay(proposalId, { from: charlie });

      res = await this.modifyConfigProposalManagerXWeb3.methods.getProposalVoting(proposalId).call();
      assert.sameMembers(res.ayes.map(a => a.toLowerCase()), [bob]);
      assert.sameMembers(res.nays.map(a => a.toLowerCase()), [charlie]);

      assert.equal(res.status, ProposalStatus.ACTIVE);

      res = await this.modifyConfigProposalManagerXWeb3.methods.getAyeShare(proposalId).call();
      assert.equal(res, 20);
      res = await this.modifyConfigProposalManagerXWeb3.methods.getNayShare(proposalId).call();
      assert.equal(res, 20);

      // Deny double-vote
      await assertRevert(this.modifyConfigProposalManagerX.aye(proposalId, { from: bob }));

      await assertRevert(this.modifyConfigProposalManagerX.triggerReject(proposalId, { from: dan }));

      await this.modifyConfigProposalManagerX.aye(proposalId, { from: dan });
      await this.modifyConfigProposalManagerX.aye(proposalId, { from: eve });

      res = await this.modifyConfigProposalManagerXWeb3.methods.getAyeShare(proposalId).call();
      assert.equal(res, 60);
      res = await this.modifyConfigProposalManagerXWeb3.methods.getNayShare(proposalId).call();
      assert.equal(res, 20);

      // Revert attempt should fail
      await assertRevert(this.modifyConfigProposalManagerX.triggerReject(proposalId));
      await this.modifyConfigProposalManagerX.triggerApprove(proposalId);

      res = await this.modifyConfigProposalManagerXWeb3.methods.getProposalVoting(proposalId).call();
      assert.equal(res.status, ProposalStatus.APPROVED);

      res = await this.fundStorageXWeb3.methods.getConfigValue(web3.utils.utf8ToHex('modify_config_threshold')).call();
      assert.equal(web3.utils.hexToNumberString(res), '42');
    });
  });
});
