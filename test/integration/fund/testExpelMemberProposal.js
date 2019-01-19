const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceLockerRegistry = artifacts.require('./SpaceLockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const SpaceLocker = artifacts.require('./SpaceLocker.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const SpaceReputationAccounting = artifacts.require('./SpaceReputationAccounting.sol');
const FundStorageFactory = artifacts.require('./FundStorageFactory.sol');
const FundMultiSigFactory = artifacts.require('./FundMultiSigFactory.sol');
const FundControllerFactory = artifacts.require('./FundControllerFactory.sol');
const MockRSRA = artifacts.require('./MockRSRA.sol');
const MockRSRAFactory = artifacts.require('./MockRSRAFactory.sol');
const FundFactory = artifacts.require('./FundFactory.sol');
const FundStorage = artifacts.require('./FundStorage.sol');
const FundController = artifacts.require('./FundController.sol');

const NewMemberProposalManagerFactory = artifacts.require('./NewMemberProposalManagerFactory.sol');
const ExpelMemberProposalManagerFactory = artifacts.require('./ExpelMemberProposalManagerFactory.sol');
const FineMemberProposalManagerFactory = artifacts.require('./FineMemberProposalManagerFactory.sol');
const MockModifyConfigProposalManagerFactory = artifacts.require('./MockModifyConfigProposalManagerFactory.sol');

const MockModifyConfigProposalManager = artifacts.require('./MockModifyConfigProposalManager.sol');
const NewMemberProposalManager = artifacts.require('./NewMemberProposalManager.sol');
const ExpelMemberProposalManager = artifacts.require('./ExpelMemberProposalManager.sol');

const Web3 = require('web3');
const { ether, deploySplitMerge, assertRevert, initHelperWeb3, initHelperArtifacts } = require('../../helpers');

const web3 = new Web3(SpaceReputationAccounting.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const ProposalStatus = {
  NULL: 0,
  ACTIVE: 1,
  APPROVED: 2,
  REJECTED: 3
};

contract('ExpelFundMemberProposal', accounts => {
  const [coreTeam, alice, bob, charlie, dan, eve, frank, minter, geoDateManagement, unauthorized] = accounts;

  beforeEach(async function() {
    this.spaceToken = await SpaceToken.new('Name', 'Symbol', { from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.splitMerge = await deploySplitMerge(this.spaceToken.address);
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

    // fund factory contracts
    this.rsraFactory = await MockRSRAFactory.new();
    this.fundStorageFactory = await FundStorageFactory.new();
    this.fundMultiSigFactory = await FundMultiSigFactory.new();
    this.fundControllerFactory = await FundControllerFactory.new();

    this.modifyConfigProposalManagerFactory = await MockModifyConfigProposalManagerFactory.new();
    this.newMemberProposalManagerFactory = await NewMemberProposalManagerFactory.new();
    this.fineMemberProposalManagerFactory = await FineMemberProposalManagerFactory.new();
    this.expelMemberProposalManagerFactory = await ExpelMemberProposalManagerFactory.new();

    this.fundFactory = await FundFactory.new(
      this.galtToken.address,
      this.spaceToken.address,
      this.spaceLockerRegistry.address,
      this.rsraFactory.address,
      this.fundMultiSigFactory.address,
      this.fundStorageFactory.address,
      this.fundControllerFactory.address,
      this.modifyConfigProposalManagerFactory.address,
      this.newMemberProposalManagerFactory.address,
      this.fineMemberProposalManagerFactory.address,
      this.expelMemberProposalManagerFactory.address,
      { from: coreTeam }
    );

    // assign roles
    this.spaceToken.addRoleTo(minter, 'minter', { from: coreTeam });
    this.spaceLockerRegistry.addRoleTo(this.spaceLockerFactory.address, await this.spaceLockerRegistry.ROLE_FACTORY(), {
      from: coreTeam
    });
    await this.splitMerge.addRoleTo(geoDateManagement, 'geo_data_manager', {
      from: coreTeam
    });
    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    // build fund
    await this.galtToken.approve(this.fundFactory.address, ether(100), { from: alice });
    let res = await this.fundFactory.buildFirstStep(false, 60, 50, 30, 60, 60, [bob, charlie, dan], 2, { from: alice });
    this.rsraX = await MockRSRA.at(res.logs[0].args.fundRsra);
    this.fundStorageX = await FundStorage.at(res.logs[0].args.fundStorage);
    this.fundControllerX = await FundController.at(res.logs[0].args.fundController);
    this.fundMultiSigXAddress = res.logs[0].args.fundMultiSig;

    res = await this.fundFactory.buildSecondStep({ from: alice });
    this.modifyConfigProposalManagerX = await MockModifyConfigProposalManager.at(
      res.logs[0].args.modifyConfigProposalManager
    );
    this.newMemberProposalManagerX = await NewMemberProposalManager.at(res.logs[0].args.newMemberProposalManager);
    this.expelMemberProposalManagerX = await ExpelMemberProposalManager.at(res.logs[0].args.expelMemberProposalManager);

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
    this.expelMemberProposalManagerXWeb3 = new web3.eth.Contract(
      this.expelMemberProposalManagerX.abi,
      this.expelMemberProposalManagerX.address
    );
    this.spaceLockerRegistryWeb3 = new web3.eth.Contract(
      this.spaceLockerRegistry.abi,
      this.spaceLockerRegistry.address
    );
    this.fundStorageXWeb3 = new web3.eth.Contract(this.fundStorageX.abi, this.fundStorageX.address);
    this.rsraXWeb3 = new web3.eth.Contract(this.rsraX.abi, this.rsraX.address);

    this.beneficiaries = [bob, charlie, dan, eve, frank];
    await this.rsraX.mintAndLockHack(this.beneficiaries, 300, { from: alice });
  });

  describe('proposal pipeline', () => {
    it('should allow user who has reputation creating a new proposal', async function() {
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
      await locker.approveMint(this.rsraX.address, { from: alice });
      await assertRevert(this.rsraX.mint(lockerAddress, { from: minter }));
      await this.rsraX.mint(lockerAddress, { from: alice });

      // DISTRBIBUTE REPUTATION
      await this.rsraX.delegate(bob, alice, 300, { from: alice });
      await this.rsraX.delegate(charlie, alice, 100, { from: bob });

      await assertRevert(this.rsraX.burnExpelledAndLocked(token1, bob, alice, 200, { from: unauthorized }));
      await assertRevert(this.rsraX.burnExpelled(token1, bob, alice, 200, { from: unauthorized }));

      // EXPEL
      res = await this.expelMemberProposalManagerX.propose(token1, 'blah', { from: unauthorized });

      const proposalId = res.logs[0].args.proposalId.toString(10);

      res = await this.expelMemberProposalManagerXWeb3.methods.getProposal(proposalId).call();
      assert.equal(web3.utils.hexToNumberString(res.spaceTokenId), token1);
      assert.equal(res.description, 'blah');

      await this.expelMemberProposalManagerX.aye(proposalId, { from: bob });
      await this.expelMemberProposalManagerX.aye(proposalId, { from: charlie });
      await this.expelMemberProposalManagerX.aye(proposalId, { from: dan });

      res = await this.expelMemberProposalManagerXWeb3.methods.getAyeShare(proposalId).call();
      assert.equal(res, 60);
      res = await this.expelMemberProposalManagerXWeb3.methods.getThreshold().call();
      assert.equal(res, 60);

      res = await this.fundStorageXWeb3.methods.getExpelledToken(token1).call();
      assert.equal(res.isExpelled, false);
      assert.equal(res.amount, 0);

      // ACCEPT PROPOSAL
      await this.expelMemberProposalManagerX.triggerApprove(proposalId);

      res = await this.fundStorageXWeb3.methods.getExpelledToken(token1).call();
      assert.equal(res.isExpelled, true);
      assert.equal(res.amount, 800);

      res = await this.expelMemberProposalManagerXWeb3.methods.getProposalVoting(proposalId).call();
      assert.equal(res.status, ProposalStatus.APPROVED);

      // BURNING LOCKED REPUTATION FOR EXPELLED TOKEN
      await assertRevert(this.rsraX.burnExpelledAndLocked(token1, charlie, alice, 101, { from: unauthorized }));
      await this.rsraX.burnExpelledAndLocked(token1, charlie, alice, 100, { from: unauthorized });
      await assertRevert(this.rsraX.burnExpelledAndLocked(token1, bob, alice, 201, { from: unauthorized }));
      await this.rsraX.burnExpelledAndLocked(token1, bob, alice, 200, { from: unauthorized });
      await assertRevert(this.rsraX.burnExpelled(token1, alice, alice, 501, { from: unauthorized }));
      await this.rsraX.burnExpelled(token1, alice, alice, 500, { from: unauthorized });

      res = await this.fundStorageXWeb3.methods.getExpelledToken(token1).call();
      assert.equal(res.isExpelled, true);
      assert.equal(res.amount, 0);

      res = await this.rsraXWeb3.methods.balanceOf(alice).call();
      assert.equal(res, 0);
      res = await this.rsraXWeb3.methods.delegatedBalanceOf(alice, alice).call();
      assert.equal(res, 0);

      // MINT REPUTATION REJECTED
      await assertRevert(this.rsraX.mint(lockerAddress, { from: alice }));

      // BURN
      await locker.burn(this.rsraX.address, { from: alice });

      // MINT REPUTATION REJECTED AFTER BURN
      await locker.approveMint(this.rsraX.address, { from: alice });
      await assertRevert(this.rsraX.mint(lockerAddress, { from: alice }));
    });
  });
});
