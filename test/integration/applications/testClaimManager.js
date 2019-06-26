const ClaimManager = artifacts.require('./ClaimManager.sol');
const ACL = artifacts.require('./ACL.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const PGGOracleStakeAccounting = artifacts.require('./PGGOracleStakeAccounting.sol');
const StakeTracker = artifacts.require('./StakeTracker.sol');

const Web3 = require('web3');
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  ether,
  numberToEvmWord,
  evmMineBlock,
  assertGaltBalanceChanged,
  assertEthBalanceChanged,
  paymentMethods,
  assertRevert
} = require('../../helpers');
const { deployPGGFactory, buildPGG } = require('../../deploymentHelpers');

GaltToken.numberFormat = 'String';

const web3 = new Web3(ClaimManager.web3.currentProvider);
const { utf8ToHex, hexToString } = Web3.utils;
const bytes32 = utf8ToHex;

const PC_CUSTODIAN_ORACLE_TYPE = bytes32('PC_CUSTODIAN_ORACLE_TYPE');
const PC_AUDITOR_ORACLE_TYPE = bytes32('PC_AUDITOR_ORACLE_TYPE');

// eslint-disable-next-line no-underscore-dangle
const _ES = bytes32('');
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const DAN = bytes32('Dan');
const EVE = bytes32('Eve');

initHelperWeb3(web3);

const ApplicationStatus = {
  NOT_EXISTS: 0,
  SUBMITTED: 1,
  APPROVED: 2,
  REJECTED: 3,
  REVERTED: 4
};

const Action = {
  APPROVE: 0,
  REJECT: 1
};

const PaymentMethods = {
  NONE: 0,
  ETH_ONLY: 1,
  GALT_ONLY: 2,
  ETH_AND_GALT: 3
};

const Currency = {
  ETH: 0,
  GALT: 1
};

Object.freeze(ApplicationStatus);
Object.freeze(Action);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

// eslint-disable-next-line
contract("ClaimManager", (accounts) => {
  const [coreTeam, feeMixerAddress, spaceRA, oracleModifier, alice, bob, charlie, dan, eve, frank, george] = accounts;

  before(async function() {
    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';
    this.attachedDocuments = [
      'QmYNQJoKGNHTpPxCBPh9KkDpaExgd2duMa3aF6ytMpHdao',
      'QmeveuwF5wWBSgUXLG6p1oxF3GKkgjEnhA6AAwHUoVsx6E',
      'QmSrPmbaUKA3ZodhzPWZnpFgcPMFWF4QsxXbkWfEptTBJd'
    ];

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.claimManager = await ClaimManager.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });

    this.acl = await ACL.new({ from: coreTeam });
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.pggRegistry = await PGGRegistry.new({ from: coreTeam });
    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.stakeTracker = await StakeTracker.new({ from: coreTeam });
    this.myPGGOracleStakeAccounting = await PGGOracleStakeAccounting.new(alice, { from: coreTeam });

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.STAKE_TRACKER(), this.stakeTracker.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_RA(), spaceRA, {
      from: coreTeam
    });

    await this.galtToken.mint(alice, ether(1000000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(1000000000), { from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.pggRegistry.initialize(this.ggr.address);
    await this.stakeTracker.initialize(this.ggr.address);
    await this.claimManager.initialize(this.ggr.address);

    await this.feeRegistry.setProtocolEthShare(33, { from: coreTeam });
    await this.feeRegistry.setProtocolGaltShare(13, { from: coreTeam });

    this.pggFactory = await deployPGGFactory(this.ggr, coreTeam);

    await this.feeRegistry.setGaltFee(await this.pggFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.pggFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.pggFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactory.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('PGG_MULTI_SIG_PROPOSER'), this.claimManager.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ARBITRATION_STAKE_SLASHER'), this.claimManager.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ORACLE_STAKE_SLASHER'), this.claimManager.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('FEE_COLLECTOR'), feeMixerAddress, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ORACLE_MODIFIER'), oracleModifier, true, { from: coreTeam });

    await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });

    const applicationConfig = {};
    applicationConfig[bytes32('CM_MINIMAL_FEE_ETH')] = numberToEvmWord(ether(6));
    applicationConfig[bytes32('CM_MINIMAL_FEE_GALT')] = numberToEvmWord(ether(45));
    applicationConfig[bytes32('CM_M')] = numberToEvmWord(3);
    applicationConfig[bytes32('CM_N')] = numberToEvmWord(5);
    applicationConfig[bytes32('CM_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_AND_GALT);

    const pcCustodianKey = await this.myPGGOracleStakeAccounting.oracleTypeMinimalStakeKey(PC_CUSTODIAN_ORACLE_TYPE);
    const pcAuditorKey = await this.myPGGOracleStakeAccounting.oracleTypeMinimalStakeKey(PC_AUDITOR_ORACLE_TYPE);

    applicationConfig[pcCustodianKey] = numberToEvmWord(ether(200));
    applicationConfig[pcAuditorKey] = numberToEvmWord(ether(200));

    this.applicationConfig = applicationConfig;

    this.pggX = await buildPGG(
      this.pggFactory,
      [bob, charlie, dan, eve, frank],
      3,
      7,
      10,
      60,
      ether(1000),
      300000,
      {},
      applicationConfig,
      alice
    );

    this.pggMultiSigX = this.pggX.multiSig;
    this.oracleStakesAccountingX = this.pggX.oracleStakeAccounting;
    this.arbitratorStakeAccountingX = this.pggX.arbitratorStakeAccounting;
    this.mX = this.pggX.config.address;
    this.oraclesX = this.pggX.oracles;

    await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(1000000), { from: alice });
    await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(1000000), { from: bob });
    await this.arbitratorStakeAccountingX.stake(alice, ether(1000000), { from: alice });
    await this.arbitratorStakeAccountingX.stake(bob, ether(1000000), { from: bob });

    await this.oraclesX.addOracle(bob, BOB, MN, '', [_ES], [PC_AUDITOR_ORACLE_TYPE], { from: oracleModifier });
    await this.oraclesX.addOracle(dan, DAN, MN, '', [_ES], [PC_AUDITOR_ORACLE_TYPE], { from: oracleModifier });
    await this.oraclesX.addOracle(eve, EVE, MN, '', [_ES], [PC_AUDITOR_ORACLE_TYPE], { from: oracleModifier });

    await this.oraclesX.addOracle(bob, BOB, MN, '', [], [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE], {
      from: oracleModifier
    });
    await this.oraclesX.addOracle(eve, EVE, MN, '', [], [PC_AUDITOR_ORACLE_TYPE], {
      from: oracleModifier
    });
    await this.oraclesX.addOracle(dan, DAN, MN, '', [], [PC_AUDITOR_ORACLE_TYPE], {
      from: oracleModifier
    });

    const res = await this.arbitratorStakeAccountingX.totalStakes();
    assert.equal(res, ether(2000000));

    await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(600), { from: alice });

    await this.oracleStakesAccountingX.stake(bob, PC_CUSTODIAN_ORACLE_TYPE, ether(200), { from: alice });
    await this.oracleStakesAccountingX.stake(eve, PC_AUDITOR_ORACLE_TYPE, ether(200), { from: alice });
    await this.oracleStakesAccountingX.stake(dan, PC_AUDITOR_ORACLE_TYPE, ether(200), { from: alice });
  });

  describe('#getApplication()', () => {
    describe('with GALT payments', () => {
      it('should create a new application with SUBMITTED status', async function() {
        await this.galtToken.approve(this.claimManager.address, ether(45), { from: alice });
        let res = await this.claimManager.submit(
          this.mX,
          alice,
          ether(35),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          ether(45),
          { from: alice }
        );

        this.aId = res.logs[0].args.applicationId;

        res = await this.claimManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications if GALT payment is disabled', async function() {
          await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });
          this.applicationConfig[bytes32('CM_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_ONLY);

          // disabled GALT payments
          const pggDisabledGalt = await buildPGG(
            this.pggFactory,
            [bob, charlie, dan, eve, frank],
            3,
            7,
            10,
            60,
            ether(1000),
            300000,
            {},
            this.applicationConfig,
            alice
          );

          await this.galtToken.approve(this.claimManager.address, ether(45), { from: alice });
          await assertRevert(
            this.claimManager.submit(
              pggDisabledGalt.config.address,
              alice,
              ether(35),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              ether(45),
              {
                from: alice
              }
            )
          );
        });

        it('should reject applications without payment', async function() {
          await this.galtToken.approve(this.claimManager.address, ether(45), { from: alice });
          await assertRevert(
            this.claimManager.submit(this.mX, alice, ether(35), this.attachedDocuments.map(galt.ipfsHashToBytes32), 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await this.galtToken.approve(this.claimManager.address, ether(45), { from: alice });
          await assertRevert(
            this.claimManager.submit(
              this.mX,
              alice,
              ether(35),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              ether(20),
              {
                from: alice
              }
            )
          );
        });

        it('should reject applications with both ETH and GALT payments', async function() {
          await this.galtToken.approve(this.claimManager.address, ether(45), { from: alice });
          await assertRevert(
            this.claimManager.submit(
              this.mX,
              alice,
              ether(35),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              ether(45),
              {
                from: alice,
                value: ether(10)
              }
            )
          );
        });

        it('should calculate corresponding arbitrators and galtspace rewards', async function() {
          await this.galtToken.approve(this.claimManager.address, ether(53), { from: alice });
          let res = await this.claimManager.submit(
            this.mX,
            alice,
            ether(35),
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            ether(53),
            { from: alice }
          );

          this.aId = res.logs[0].args.applicationId;

          res = await this.claimManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
          assert.equal(parseInt(res.createdAt, 10) > 0, true);

          res = await this.claimManager.getApplicationRewards(this.aId);
          assert.equal(res.currency, Currency.GALT);

          assert.equal(res.arbitratorsReward, ether('46.11'));
          assert.equal(res.galtProtocolFee, ether('6.89'));
        });
      });
    });

    describe('with ETH payments', () => {
      it('should create a new application with SUBMITTED status', async function() {
        let res = await this.claimManager.submit(
          this.mX,
          alice,
          ether(35),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          0,
          { from: alice, value: ether(7) }
        );

        this.aId = res.logs[0].args.applicationId;

        res = await this.claimManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications if ETH payment is disabled', async function() {
          await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });
          this.applicationConfig[bytes32('CM_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.GALT_ONLY);

          // disabled GALT payments
          const pggDisabledEth = await buildPGG(
            this.pggFactory,
            [bob, charlie, dan, eve, frank],
            3,
            7,
            10,
            60,
            ether(1000),
            300000,
            {},
            this.applicationConfig,
            alice
          );

          await assertRevert(
            this.claimManager.submit(
              pggDisabledEth.config.address,
              alice,
              ether(35),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              0,
              {
                from: alice,
                value: ether(40)
              }
            )
          );
        });

        it('should reject applications without payment', async function() {
          await assertRevert(
            this.claimManager.submit(this.mX, alice, ether(35), this.attachedDocuments.map(galt.ipfsHashToBytes32), 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await assertRevert(
            this.claimManager.submit(this.mX, alice, ether(35), this.attachedDocuments.map(galt.ipfsHashToBytes32), 0, {
              from: alice,
              value: ether(4)
            })
          );
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          let res = await this.claimManager.submit(
            this.mX,
            alice,
            ether(35),
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            0,
            { from: alice, value: ether(13) }
          );

          this.aId = res.logs[0].args.applicationId;

          res = await this.claimManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.SUBMITTED);

          res = await this.claimManager.getApplicationRewards(this.aId);
          assert.equal(res.currency, Currency.ETH);

          assert.equal(res.arbitratorsReward, ether('8.71'));
          assert.equal(res.galtProtocolFee, ether('4.29'));
        });
      });
    });
  });

  describe('pipeline', () => {
    beforeEach(async function() {
      await evmMineBlock();
      const res = await this.claimManager.submit(
        this.mX,
        alice,
        ether(35),
        this.attachedDocuments.map(galt.ipfsHashToBytes32),
        0,
        { from: alice, value: ether(7) }
      );

      this.cId = res.logs[0].args.applicationId;
    });

    describe('#lock()', () => {
      it('should allow any super-oracle lock <=m slots', async function() {
        let res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.claimManager.lock(this.cId, { from: bob });
        await assertRevert(this.claimManager.lock(this.cId, { from: bob }));
        await this.claimManager.lock(this.cId, { from: charlie });
        await this.claimManager.lock(this.cId, { from: dan });
        await this.claimManager.lock(this.cId, { from: eve });
        await this.claimManager.lock(this.cId, { from: frank });
        await assertRevert(this.claimManager.lock(this.cId, { from: george }));

        res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 5);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);
      });

      it('should deny non-oracle locking a claim', async function() {
        await assertRevert(this.claimManager.lock(this.cId, { from: coreTeam }));
      });

      it('should deny proposal when claim is executed');
    });

    // WARNING: it is still possible to propose an approval when some of the candidates have no specified roles
    // and even inactive candidates
    describe('#proposeApproval()', () => {
      beforeEach(async function() {
        const res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
      });

      it('should allow new proposals from members who has already locked the application', async function() {
        let res = await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(20),
          [dan],
          [PC_AUDITOR_ORACLE_TYPE],
          [ether(20)],
          [],
          [],
          {
            from: bob
          }
        );
        const pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          ether(20),
          [bob, eve],
          [PC_AUDITOR_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
          [ether(10), ether(20)],
          [],
          [],
          { from: dan }
        );
        const pId2 = res.logs[0].args.proposalId;

        res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.slotsTaken, 2);

        res = await this.claimManager.getProposalList(this.cId);
        assert.sameMembers(res, [pId1, pId2]);

        res = await this.claimManager.getProposal(this.cId, pId1);
        assert.equal(res.from, bob);
        assert.equal(res.message, 'good enough');
        assert.equal(res.action, Action.APPROVE);
        res = await this.claimManager.getProposalDetails(this.cId, pId1);
        assert.sameMembers(res.oracles, [dan]);
        assert.sameMembers(res.oracleTypes.map(hexToString), [PC_AUDITOR_ORACLE_TYPE].map(hexToString));
        assert.sameMembers(res.oracleFines.map(v => v.toString(10)), [ether(20)]);

        res = await this.claimManager.getProposal(this.cId, pId2);
        assert.equal(res.from, dan);
        assert.equal(res.message, 'looks good');
        assert.equal(res.action, Action.APPROVE);
        res = await this.claimManager.getProposalDetails(this.cId, pId2);
        assert.sameMembers(res.oracles, [bob, eve]);
        assert.sameMembers(
          res.oracleTypes.map(web3.utils.hexToString),
          [PC_AUDITOR_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE].map(hexToString)
        );
        assert.sameMembers(res.oracleFines.map(v => v.toString(10)), [ether(10), ether(20)]);
      });

      it('should deny non-oracle proposing a proposal', async function() {
        await assertRevert(
          this.claimManager.proposeApproval(this.cId, 'looks good', ether(10), [], [], [], [], [], { from: coreTeam })
        );
      });

      it('should deny oracle proposing when claim is not locked', async function() {
        await assertRevert(
          this.claimManager.proposeApproval(this.cId, 'looks good', ether(10), [], [], [], [], [], { from: eve })
        );
      });

      it('should allow multiple proposals from the same oracle', async function() {
        await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(10),
          [dan],
          [PC_AUDITOR_ORACLE_TYPE],
          [ether(20)],
          [],
          [],
          {
            from: bob
          }
        );
        await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(10),
          [dan],
          [PC_AUDITOR_ORACLE_TYPE],
          [ether(30)],
          [],
          [],
          {
            from: bob
          }
        );
        await this.claimManager.proposeReject(this.cId, 'looks bad', { from: bob });
      });

      it('should deny proposal when claim is executed');
      it('should oracle votes for proposal');
    });

    describe('#proposeReject()', () => {
      beforeEach(async function() {
        const res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
      });

      it('should allow new proposals from members who has already locked the application', async function() {
        let res = await this.claimManager.proposeReject(this.cId, 'NOT good enough', { from: bob });
        const pId1 = res.logs[0].args.proposalId;
        res = await this.claimManager.proposeReject(this.cId, 'odd', { from: dan });
        const pId2 = res.logs[0].args.proposalId;

        res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.slotsTaken, 2);

        res = await this.claimManager.getProposalList(this.cId);
        assert.sameMembers(res, [pId1, pId2]);

        res = await this.claimManager.getProposal(this.cId, pId1);
        assert.equal(res.from, bob);
        assert.equal(res.message, 'NOT good enough');
        assert.equal(res.action, Action.REJECT);

        res = await this.claimManager.getProposal(this.cId, pId2);
        assert.equal(res.from, dan);
        assert.equal(res.message, 'odd');
        assert.equal(res.action, Action.REJECT);
      });

      it('should deny non-oracle proposing a proposal', async function() {
        await assertRevert(this.claimManager.proposeReject(this.cId, 'looks bad', { from: coreTeam }));
      });

      it('should deny oracle proposing when claim is not locked', async function() {
        await assertRevert(this.claimManager.proposeReject(this.cId, 'looks bad', { from: eve }));
      });

      it('should deny proposal when claim is executed');
      it('oracle votes for proposal');
    });

    describe('#vote()', () => {
      beforeEach(async function() {
        let res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });

        res = await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(10),
          [dan],
          [PC_AUDITOR_ORACLE_TYPE],
          [ether(20)],
          [],
          [],
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          ether(10),
          [bob, eve],
          [PC_AUDITOR_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
          [ether(10), ether(20)],
          [],
          [],
          { from: dan }
        );
        this.pId2 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeReject(this.cId, 'NOT good enough', { from: bob });
        this.pId3 = res.logs[0].args.proposalId;
      });

      it('should automatically count proposer voice', async function() {
        // empty array since the vote reassigned to pId3
        let res = await this.claimManager.getProposalVotes(this.cId, this.pId1);
        assert.sameMembers(res.votesFor, []);

        res = await this.claimManager.getProposalVotes(this.cId, this.pId2);
        assert.sameMembers(res.votesFor, [dan]);

        res = await this.claimManager.getProposalVotes(this.cId, this.pId3);
        assert.sameMembers(res.votesFor, [bob]);
      });

      it('should reassign slots according a last vote', async function() {
        await this.claimManager.vote(this.cId, this.pId1, { from: bob });
        await this.claimManager.vote(this.cId, this.pId1, { from: dan });

        let res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.claimManager.getProposalVotes(this.cId, this.pId1);
        assert.sameMembers(res.votesFor, [bob, dan]);

        res = await this.claimManager.getProposalVotes(this.cId, this.pId2);
        assert.sameMembers(res.votesFor, []);

        res = await this.claimManager.getProposalVotes(this.cId, this.pId3);
        assert.sameMembers(res.votesFor, []);
      });

      it('should deny oracles with non-locked slots voting', async function() {
        await assertRevert(this.claimManager.vote(this.cId, this.pId1, { from: eve }));
      });

      it('should allow re-voting if oracle has changed is mind', async function() {
        await this.claimManager.vote(this.cId, this.pId1, { from: bob });
        await this.claimManager.vote(this.cId, this.pId1, { from: dan });

        let res = await this.claimManager.getProposalVotes(this.cId, this.pId1);
        assert.sameMembers(res.votesFor, [bob, dan]);
        res = await this.claimManager.getProposalVotes(this.cId, this.pId2);
        assert.sameMembers(res.votesFor, []);
        res = await this.claimManager.getVotedFor(this.cId, bob);
        assert.equal(res, this.pId1);
        res = await this.claimManager.getVotedFor(this.cId, dan);
        assert.equal(res, this.pId1);

        await this.claimManager.vote(this.cId, this.pId2, { from: bob });

        res = await this.claimManager.getProposalVotes(this.cId, this.pId1);
        assert.sameMembers(res.votesFor, [dan]);
        res = await this.claimManager.getProposalVotes(this.cId, this.pId2);
        assert.sameMembers(res.votesFor, [bob]);
        res = await this.claimManager.getVotedFor(this.cId, bob);
        assert.equal(res, this.pId2);
        res = await this.claimManager.getVotedFor(this.cId, dan);
        assert.equal(res, this.pId1);
      });

      it('should deny voting if status is not SUBMITTED', async function() {
        await this.claimManager.vote(this.cId, this.pId1, { from: bob });
        await this.claimManager.vote(this.cId, this.pId1, { from: dan });

        await this.claimManager.lock(this.cId, { from: charlie });
        await this.claimManager.lock(this.cId, { from: eve });

        await this.claimManager.vote(this.cId, this.pId1, { from: charlie });

        await assertRevert(this.claimManager.vote(this.cId, this.pId1, { from: eve }));

        let res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
        assert.equal(res.slotsTaken, 4);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        res = await this.claimManager.getProposal(this.cId, this.pId1);
        assert.equal(res.from, bob);
        assert.equal(res.action, Action.APPROVE);
        res = await this.claimManager.getProposalVotes(this.cId, this.pId1);
        assert.sameMembers(res.votesFor, [dan, bob, charlie]);
      });

      it('should new porposals voting if status is not SUBMITTED', async function() {
        await this.claimManager.vote(this.cId, this.pId1, { from: bob });
        await this.claimManager.vote(this.cId, this.pId1, { from: dan });

        await this.claimManager.lock(this.cId, { from: charlie });
        await this.claimManager.lock(this.cId, { from: eve });

        await this.claimManager.vote(this.cId, this.pId1, { from: charlie });

        await assertRevert(
          this.claimManager.proposeApproval(
            this.cId,
            'looks good',
            ether(10),
            [bob, eve],
            [PC_AUDITOR_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
            [ether(15), ether(20)],
            [],
            [],
            { from: dan }
          )
        );
      });
    });

    describe('on threshold reach', () => {
      beforeEach(async function() {
        let res = await this.claimManager.getApplication(this.cId);

        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);
        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
        await this.claimManager.lock(this.cId, { from: eve });

        res = await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(20),
          [dan],
          [PC_AUDITOR_ORACLE_TYPE],
          [ether(20)],
          [],
          [],
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          ether(30),
          [bob, eve],
          [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
          [ether(10), ether(20)],
          [],
          [],
          { from: dan }
        );
        this.pId2 = res.logs[0].args.proposalId;
      });

      it('should apply proposed slashes', async function() {
        let res = await this.oracleStakesAccountingX.typeStakeOf(bob, PC_CUSTODIAN_ORACLE_TYPE);
        assert.equal(res, ether(200));
        res = await this.oracleStakesAccountingX.typeStakeOf(eve, PC_AUDITOR_ORACLE_TYPE);
        assert.equal(res, ether(200));

        res = await this.oraclesX.isOracleActive(bob);
        assert.equal(res, true);
        res = await this.oraclesX.isOracleTypeAssigned(bob, PC_CUSTODIAN_ORACLE_TYPE);
        assert.equal(res, true);
        res = await this.oracleStakesAccountingX.isOracleStakeActive(bob, PC_CUSTODIAN_ORACLE_TYPE);
        assert.equal(res, true);

        res = await this.oraclesX.isOracleActive(eve);
        assert.equal(res, true);
        res = await this.oraclesX.isOracleTypeAssigned(eve, PC_AUDITOR_ORACLE_TYPE);
        assert.equal(res, true);
        res = await this.oracleStakesAccountingX.isOracleStakeActive(eve, PC_AUDITOR_ORACLE_TYPE);
        assert.equal(res, true);

        res = await this.claimManager.getProposalVotes(this.cId, this.pId2);
        assert.equal(res.votesFor.length, 1);

        await this.claimManager.vote(this.cId, this.pId2, { from: bob });
        await this.claimManager.vote(this.cId, this.pId2, { from: eve });

        res = await this.oracleStakesAccountingX.typeStakeOf(bob, PC_CUSTODIAN_ORACLE_TYPE);
        assert.equal(res, ether(190));
        res = await this.oracleStakesAccountingX.typeStakeOf(eve, PC_AUDITOR_ORACLE_TYPE);
        assert.equal(res, ether(180));

        res = await this.oraclesX.isOracleActive(bob);
        assert.equal(res, true);
        res = await this.oraclesX.isOracleTypeAssigned(bob, PC_CUSTODIAN_ORACLE_TYPE);
        assert.equal(res, true);
        res = await this.oracleStakesAccountingX.isOracleStakeActive(bob, PC_CUSTODIAN_ORACLE_TYPE);
        assert.equal(res, false);

        res = await this.oraclesX.isOracleActive(eve);
        assert.equal(res, true);
        res = await this.oraclesX.isOracleTypeAssigned(eve, PC_AUDITOR_ORACLE_TYPE);
        assert.equal(res, true);
        res = await this.oracleStakesAccountingX.isOracleStakeActive(eve, PC_AUDITOR_ORACLE_TYPE);
        assert.equal(res, false);

        res = await this.claimManager.getProposalVotes(this.cId, this.pId2);
        assert.equal(res.votesFor.length, 3);

        res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.APPROVED);

        // staking back
        await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(30), { from: alice });
        await this.oracleStakesAccountingX.stake(bob, PC_CUSTODIAN_ORACLE_TYPE, ether(10), { from: alice });
        await this.oracleStakesAccountingX.stake(eve, PC_AUDITOR_ORACLE_TYPE, ether(20), { from: alice });

        res = await this.oraclesX.isOracleActive(bob);
        assert.equal(res, true);
        res = await this.oraclesX.isOracleTypeAssigned(bob, PC_CUSTODIAN_ORACLE_TYPE);
        assert.equal(res, true);
        res = await this.oracleStakesAccountingX.isOracleStakeActive(bob, PC_CUSTODIAN_ORACLE_TYPE);
        assert.equal(res, true);

        res = await this.oraclesX.isOracleActive(eve);
        assert.equal(res, true);
        res = await this.oraclesX.isOracleTypeAssigned(eve, PC_AUDITOR_ORACLE_TYPE);
        assert.equal(res, true);
        res = await this.oracleStakesAccountingX.isOracleStakeActive(eve, PC_AUDITOR_ORACLE_TYPE);
        assert.equal(res, true);
      });

      it('should create transfer claim value to a beneficiary', async function() {
        const txCount = await this.pggMultiSigX.getTransactionCount(true, false);
        await this.claimManager.vote(this.cId, this.pId2, { from: bob });
        await this.claimManager.vote(this.cId, this.pId2, { from: eve });

        let res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.APPROVED);

        res = await this.pggMultiSigX.getTransactionCount(true, false);
        assert.equal(res, parseInt(txCount, 10) + 1);

        const txId = (await this.pggMultiSigX.transactionCount()).toNumber(10) - 1;
        res = await this.pggMultiSigX.transactions(txId);
        assert.equal(res.destination, this.galtToken.address);
        assert.equal(res.value, 0);
        assert.equal(
          res.data,
          `0xa9059cbb000000000000000000000000${alice
            .substr(2)
            .toLowerCase()}000000000000000000000000000000000000000000000001a055690d9db80000`
        );

        const multiSigBalance = await this.galtToken.balanceOf(this.pggMultiSigX.address);
        assert(multiSigBalance > ether(20));
        res = await this.pggMultiSigX.required();
        assert.equal(res, 3);
        res = await this.pggMultiSigX.getConfirmationCount(txId);
        assert.equal(res, 0);
        res = await this.pggMultiSigX.getOwners();
        assert.sameMembers(res, [bob, charlie, dan, eve, frank]);

        const aliceInitialBalance = (await this.galtToken.balanceOf(alice)).toString(10);

        await this.pggMultiSigX.confirmTransaction(txId, { from: bob });
        await this.pggMultiSigX.confirmTransaction(txId, { from: dan });
        await this.pggMultiSigX.confirmTransaction(txId, { from: frank });

        const aliceFinalBalance = (await this.galtToken.balanceOf(alice)).toString(10);

        assertGaltBalanceChanged(aliceInitialBalance, aliceFinalBalance, ether(30));
      });

      it('should reject when REJECT propose reached threshold', async function() {
        let res = await this.claimManager.proposeReject(this.cId, 'blah', { from: dan });
        this.pId3 = res.logs[0].args.proposalId;
        await this.claimManager.vote(this.cId, this.pId3, { from: bob });
        await this.claimManager.vote(this.cId, this.pId3, { from: eve });

        res = await this.claimManager.getProposalVotes(this.cId, this.pId3);
        assert.equal(res.votesFor.length, 3);
        res = await this.claimManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });
    });

    describe('claims fee paid by GALT', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(10000), { from: alice });
        await this.oracleStakesAccountingX.stake(bob, PC_CUSTODIAN_ORACLE_TYPE, ether(200), { from: alice });
        await this.oracleStakesAccountingX.stake(bob, PC_AUDITOR_ORACLE_TYPE, ether(200), { from: alice });
        await this.oracleStakesAccountingX.stake(eve, PC_AUDITOR_ORACLE_TYPE, ether(200), { from: alice });
        await this.oracleStakesAccountingX.stake(dan, PC_AUDITOR_ORACLE_TYPE, ether(200), { from: alice });

        await this.galtToken.approve(this.claimManager.address, ether(47), { from: alice });
        let res = await this.claimManager.submit(
          this.mX,
          alice,
          ether(350),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          ether(47),
          { from: alice }
        );

        // override default which paid by ETH
        this.cId = res.logs[0].args.applicationId;

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
        await this.claimManager.lock(this.cId, { from: eve });

        res = await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(10),
          [dan],
          [PC_AUDITOR_ORACLE_TYPE],
          [ether(20)],
          [],
          [],
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          ether(30),
          [bob, eve],
          [PC_AUDITOR_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
          [ether(10), ether(20)],
          [],
          [],
          { from: dan }
        );
        this.pId2 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeReject(this.cId, 'its fake', {
          from: eve
        });
        this.pId3 = res.logs[0].args.proposalId;

        res = await this.claimManager.getApplicationRewards(this.cId);
        assert.equal(res.currency, Currency.GALT);

        assert.equal(res.arbitratorsReward, '40890000000000000000');
        assert.equal(res.galtProtocolFee, '6110000000000000000');
      });

      describe('on success proposal win (APPROVED status)', () => {
        it('should revert arbitrator claims when status is SUBMITTED', async function() {
          await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: bob }));
        });

        describe('with 4 active slots', () => {
          beforeEach(async function() {
            await this.claimManager.lock(this.cId, { from: charlie });
            await this.claimManager.vote(this.cId, this.pId2, { from: bob });
            await this.claimManager.vote(this.cId, this.pId2, { from: eve });
          });

          it('should calculate and assign rewards for arbitrators and galt space', async function() {
            let res = await this.claimManager.getApplicationRewards(this.cId);
            assert.equal(res.arbitratorReward, '10222500000000000000');

            res = await this.claimManager.getApplication(this.cId);
            assert.equal(res.slotsTaken, '4');
            assert.equal(res.totalSlots, '5');
          });

          it('should do nothing on withdrawal if transaction has not executed yet', async function() {
            const galtSpaceBalanceBefore = await this.galtToken.balanceOf(feeMixerAddress);
            await this.claimManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });
            const galtSpaceBalanceAfter = await this.galtToken.balanceOf(feeMixerAddress);

            assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(0));
          });

          describe('after transaction was executed', () => {
            beforeEach(async function() {
              const txId = (await this.pggMultiSigX.transactionCount()).toNumber(10) - 1;

              await this.pggMultiSigX.confirmTransaction(txId, { from: bob });
              await this.pggMultiSigX.confirmTransaction(txId, { from: dan });
              await this.pggMultiSigX.confirmTransaction(txId, { from: frank });
            });

            it('should allow galt space withdrawal only once', async function() {
              await this.claimManager.claimArbitratorReward(this.cId, { from: bob });
              let galtSpaceBalanceBefore = await this.galtToken.balanceOf(feeMixerAddress);
              await this.claimManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });
              let galtSpaceBalanceAfter = await this.galtToken.balanceOf(feeMixerAddress);

              assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(6.11));

              galtSpaceBalanceBefore = await this.galtToken.balanceOf(feeMixerAddress);
              await this.claimManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });
              galtSpaceBalanceAfter = await this.galtToken.balanceOf(feeMixerAddress);

              assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(0));
            });

            it('should allow oracles claiming their rewards', async function() {
              const bobBalanceBefore = await this.galtToken.balanceOf(bob);
              const danBalanceBefore = await this.galtToken.balanceOf(dan);
              const charlieBalanceBefore = await this.galtToken.balanceOf(charlie);
              const eveBalanceBefore = await this.galtToken.balanceOf(eve);

              await this.claimManager.claimArbitratorReward(this.cId, { from: bob });
              await this.claimManager.claimArbitratorReward(this.cId, { from: dan });
              await this.claimManager.claimArbitratorReward(this.cId, { from: charlie });
              await this.claimManager.claimArbitratorReward(this.cId, { from: eve });

              const bobBalanceAfter = await this.galtToken.balanceOf(bob);
              const danBalanceAfter = await this.galtToken.balanceOf(dan);
              const charlieBalanceAfter = await this.galtToken.balanceOf(charlie);
              const eveBalanceAfter = await this.galtToken.balanceOf(eve);

              assertGaltBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(10.2225));
              assertGaltBalanceChanged(danBalanceBefore, danBalanceAfter, ether(10.2225));
              assertGaltBalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(10.2225));
              assertGaltBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(10.2225));
            });

            it('should deny oracles claiming their rewards twice', async function() {
              await this.claimManager.claimArbitratorReward(this.cId, { from: bob });
              await this.claimManager.claimArbitratorReward(this.cId, { from: dan });
              await this.claimManager.claimArbitratorReward(this.cId, { from: charlie });
              await this.claimManager.claimArbitratorReward(this.cId, { from: eve });

              await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: bob }));
              await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: dan }));
              await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: charlie }));
              await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: eve }));
            });
          });
        });

        describe('with 3 active slots', () => {
          beforeEach(async function() {
            await this.claimManager.vote(this.cId, this.pId2, { from: bob });
            await this.claimManager.vote(this.cId, this.pId2, { from: eve });

            const txId = (await this.pggMultiSigX.transactionCount()).toNumber(10) - 1;

            await this.pggMultiSigX.confirmTransaction(txId, { from: bob });
            await this.pggMultiSigX.confirmTransaction(txId, { from: dan });
            await this.pggMultiSigX.confirmTransaction(txId, { from: frank });
          });

          it('should calculate and assign rewards for arbitrators and galt space', async function() {
            let res = await this.claimManager.getApplicationRewards(this.cId);
            assert.equal(res.arbitratorReward, '13630000000000000000');

            res = await this.claimManager.getApplication(this.cId);
            assert.equal(res.slotsTaken, '3');
            assert.equal(res.totalSlots, '5');
          });

          it('should allow oracles claiming their rewards', async function() {
            const bobBalanceBefore = await this.galtToken.balanceOf(bob);
            const danBalanceBefore = await this.galtToken.balanceOf(dan);
            const eveBalanceBefore = await this.galtToken.balanceOf(eve);

            await this.claimManager.claimArbitratorReward(this.cId, { from: bob });
            await this.claimManager.claimArbitratorReward(this.cId, { from: dan });
            await this.claimManager.claimArbitratorReward(this.cId, { from: eve });

            const bobBalanceAfter = await this.galtToken.balanceOf(bob);
            const danBalanceAfter = await this.galtToken.balanceOf(dan);
            const eveBalanceAfter = await this.galtToken.balanceOf(eve);

            assertGaltBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(13.63));
            assertGaltBalanceChanged(danBalanceBefore, danBalanceAfter, ether(13.63));
            assertGaltBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(13.63));
          });

          it('should deny oracles claiming their rewards twice', async function() {
            await this.claimManager.claimArbitratorReward(this.cId, { from: bob });
            await this.claimManager.claimArbitratorReward(this.cId, { from: dan });
            await this.claimManager.claimArbitratorReward(this.cId, { from: eve });

            await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: bob }));
            await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: dan }));
            await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: eve }));
          });

          it('should deny oracles who dont locked application claiming revards', async function() {
            await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: charlie }));
          });
        });
      });

      describe('on reject proposal win (REJECTED status) with 3 active slots', () => {
        beforeEach(async function() {
          await this.claimManager.vote(this.cId, this.pId3, { from: dan });
          await this.claimManager.vote(this.cId, this.pId3, { from: bob });
        });

        it('should calculate and assign rewards for arbitrators and galt space', async function() {
          let res = await this.claimManager.getApplicationRewards(this.cId);
          assert.equal(res.arbitratorReward, '13630000000000000000');

          res = await this.claimManager.getApplication(this.cId);
          assert.equal(res.status, ApplicationStatus.REJECTED);
          assert.equal(res.slotsTaken, '3');
          assert.equal(res.totalSlots, '5');
        });

        it('should allow oracles claiming their rewards', async function() {
          const bobBalanceBefore = await this.galtToken.balanceOf(bob);
          const danBalanceBefore = await this.galtToken.balanceOf(dan);
          const eveBalanceBefore = await this.galtToken.balanceOf(eve);

          await this.claimManager.claimArbitratorReward(this.cId, { from: bob });
          await this.claimManager.claimArbitratorReward(this.cId, { from: dan });
          await this.claimManager.claimArbitratorReward(this.cId, { from: eve });

          const bobBalanceAfter = await this.galtToken.balanceOf(bob);
          const danBalanceAfter = await this.galtToken.balanceOf(dan);
          const eveBalanceAfter = await this.galtToken.balanceOf(eve);

          assertGaltBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(13.63));
          assertGaltBalanceChanged(danBalanceBefore, danBalanceAfter, ether(13.63));
          assertGaltBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(13.63));
        });

        it('should deny oracles claiming their rewards twice', async function() {
          await this.claimManager.claimArbitratorReward(this.cId, { from: bob });
          await this.claimManager.claimArbitratorReward(this.cId, { from: dan });
          await this.claimManager.claimArbitratorReward(this.cId, { from: eve });

          await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: bob }));
          await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: dan }));
          await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: eve }));
        });

        it('should deny oracles who dont locked application claiming revards', async function() {
          await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: charlie }));
        });
      });
    });

    describe('claims fee paid by ETH', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(10000), { from: alice });

        await this.oracleStakesAccountingX.stake(bob, PC_CUSTODIAN_ORACLE_TYPE, ether(200), { from: alice });
        await this.oracleStakesAccountingX.stake(bob, PC_AUDITOR_ORACLE_TYPE, ether(200), { from: alice });
        await this.oracleStakesAccountingX.stake(eve, PC_AUDITOR_ORACLE_TYPE, ether(200), { from: alice });
        await this.oracleStakesAccountingX.stake(dan, PC_AUDITOR_ORACLE_TYPE, ether(200), { from: alice });

        let res = await this.claimManager.submit(
          this.mX,
          alice,
          ether(350),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          0,
          { from: alice, value: ether(9) }
        );

        // override default which paid by ETH
        this.cId = res.logs[0].args.applicationId;

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
        await this.claimManager.lock(this.cId, { from: eve });

        res = await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(10),
          [dan],
          [PC_AUDITOR_ORACLE_TYPE],
          [ether(20)],
          [],
          [],
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          ether(10),
          [bob, eve],
          [PC_AUDITOR_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
          [ether(10), ether(20)],
          [],
          [],
          { from: dan }
        );
        this.pId2 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeReject(this.cId, 'its fake', {
          from: eve
        });
        this.pId3 = res.logs[0].args.proposalId;
        // cleanup fees
        await this.claimManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
      });

      describe('on approve proposal win (APPROVED status) with 5 active slots', () => {
        beforeEach(async function() {
          await this.claimManager.lock(this.cId, { from: charlie });
          await this.claimManager.lock(this.cId, { from: frank });

          await this.claimManager.vote(this.cId, this.pId2, { from: eve });
          await this.claimManager.vote(this.cId, this.pId3, { from: charlie });
          await this.claimManager.vote(this.cId, this.pId2, { from: bob });

          const txId = (await this.pggMultiSigX.transactionCount()).toNumber(10) - 1;

          await this.pggMultiSigX.confirmTransaction(txId, { from: bob });
          await this.pggMultiSigX.confirmTransaction(txId, { from: dan });
          await this.pggMultiSigX.confirmTransaction(txId, { from: frank });
        });

        it('should calculate and assign rewards for arbitrators and galt space', async function() {
          let res = await this.claimManager.getApplicationRewards(this.cId);
          assert.equal(res.currency, Currency.ETH);

          assert.equal(res.arbitratorsReward, '6030000000000000000');
          assert.equal(res.galtProtocolFee, '2970000000000000000');

          res = await this.claimManager.getApplication(this.cId);
          assert.equal(res.status, ApplicationStatus.APPROVED);
          assert.equal(res.slotsTaken, '5');
          assert.equal(res.totalSlots, '5');
        });

        it('should allow oracles claiming their rewards', async function() {
          const bobBalanceBefore = await web3.eth.getBalance(bob);
          const danBalanceBefore = await web3.eth.getBalance(dan);
          const eveBalanceBefore = await web3.eth.getBalance(eve);
          const charlieBalanceBefore = await web3.eth.getBalance(charlie);
          const frankBalanceBefore = await web3.eth.getBalance(frank);

          await this.claimManager.claimArbitratorReward(this.cId, { from: bob });
          await this.claimManager.claimArbitratorReward(this.cId, { from: charlie });
          await this.claimManager.claimArbitratorReward(this.cId, { from: dan });
          await this.claimManager.claimArbitratorReward(this.cId, { from: eve });
          await this.claimManager.claimArbitratorReward(this.cId, { from: frank });

          const bobBalanceAfter = await web3.eth.getBalance(bob);
          const charlieBalanceAfter = await web3.eth.getBalance(charlie);
          const danBalanceAfter = await web3.eth.getBalance(dan);
          const eveBalanceAfter = await web3.eth.getBalance(eve);
          const frankBalanceAfter = await web3.eth.getBalance(frank);

          assertEthBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(1.206));
          assertEthBalanceChanged(danBalanceBefore, danBalanceAfter, ether(1.206));
          assertEthBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(1.206));
          assertEthBalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(1.206));
          assertEthBalanceChanged(frankBalanceBefore, frankBalanceAfter, ether(1.206));
        });

        it('should allow galt space claiming reward onlce', async function() {
          await this.claimManager.claimArbitratorReward(this.cId, { from: bob });

          let galtSpaceBalanceBefore = await web3.eth.getBalance(feeMixerAddress);
          await this.claimManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
          let galtSpaceBalanceAfter = await web3.eth.getBalance(feeMixerAddress);

          assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(2.97));

          galtSpaceBalanceBefore = await web3.eth.getBalance(feeMixerAddress);
          await this.claimManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
          galtSpaceBalanceAfter = await web3.eth.getBalance(feeMixerAddress);

          assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(0));
        });

        it('should deny oracles claiming their rewards twice', async function() {
          await this.claimManager.claimArbitratorReward(this.cId, { from: bob });
          await this.claimManager.claimArbitratorReward(this.cId, { from: dan });
          await this.claimManager.claimArbitratorReward(this.cId, { from: eve });

          await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: bob }));
          await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: dan }));
          await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: eve }));
        });
      });

      describe('on reject proposal win (REJECTED status) with 3 active slots', () => {
        beforeEach(async function() {
          await this.claimManager.vote(this.cId, this.pId3, { from: dan });
          await this.claimManager.vote(this.cId, this.pId3, { from: bob });
        });

        it('should calculate and assign rewards for arbitrators and galt space', async function() {
          let res = await this.claimManager.getApplicationRewards(this.cId);
          assert.equal(res.currency, Currency.ETH);

          assert.equal(res.arbitratorsReward, '6030000000000000000');
          assert.equal(res.galtProtocolFee, '2970000000000000000');

          res = await this.claimManager.getApplication(this.cId);
          assert.equal(res.status, ApplicationStatus.REJECTED);
          assert.equal(res.slotsTaken, '3');
          assert.equal(res.totalSlots, '5');
        });

        it('should allow oracles claiming their rewards', async function() {
          const bobBalanceBefore = await web3.eth.getBalance(bob);
          const danBalanceBefore = await web3.eth.getBalance(dan);
          const eveBalanceBefore = await web3.eth.getBalance(eve);

          await this.claimManager.claimArbitratorReward(this.cId, { from: bob });
          await this.claimManager.claimArbitratorReward(this.cId, { from: dan });
          await this.claimManager.claimArbitratorReward(this.cId, { from: eve });

          const bobBalanceAfter = await web3.eth.getBalance(bob);
          const danBalanceAfter = await web3.eth.getBalance(dan);
          const eveBalanceAfter = await web3.eth.getBalance(eve);

          assertEthBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(2.01));
          assertEthBalanceChanged(danBalanceBefore, danBalanceAfter, ether(2.01));
          assertEthBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(2.01));
        });

        it('should allow galt space claiming reward', async function() {
          await this.claimManager.claimArbitratorReward(this.cId, { from: bob });

          const galtSpaceBalanceBefore = await web3.eth.getBalance(feeMixerAddress);
          await this.claimManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
          const galtSpaceBalanceAfter = await web3.eth.getBalance(feeMixerAddress);

          assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(2.97));
        });

        it('should deny oracles claiming their rewards twice', async function() {
          await this.claimManager.claimArbitratorReward(this.cId, { from: bob });
          await this.claimManager.claimArbitratorReward(this.cId, { from: dan });
          await this.claimManager.claimArbitratorReward(this.cId, { from: eve });

          await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: bob }));
          await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: dan }));
          await assertRevert(this.claimManager.claimArbitratorReward(this.cId, { from: eve }));
        });
      });
    });
  });
});
