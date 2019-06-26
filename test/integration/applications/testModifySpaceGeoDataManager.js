const ModifySpaceGeoDataManager = artifacts.require('./ModifySpaceGeoDataManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
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
  deploySpaceGeoDataMock,
  paymentMethods,
  assertRevert
} = require('../../helpers');
const { deployPGGFactory, buildPGG } = require('../../deploymentHelpers');

GaltToken.numberFormat = 'String';
ModifySpaceGeoDataManager.numberFormat = 'String';

const web3 = new Web3(ModifySpaceGeoDataManager.web3.currentProvider);
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

const AreaSource = {
  USER_INPUT: 0,
  CONTRACT: 1
};

Object.freeze(ApplicationStatus);
Object.freeze(Action);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

// eslint-disable-next-line
contract("ModifySpaceGeoDataManager", (accounts) => {
  const [
    coreTeam,
    feeMixerAddress,
    spaceRA,
    oracleModifier,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank,
    george,
    minter
  ] = accounts;

  before(async function() {
    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.newContourRaw = ['xxxxxx', 'yyyyyyy', 'zzzzzzzzz'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';
    this.attachedDocuments = [
      'QmYNQJoKGNHTpPxCBPh9KkDpaExgd2duMa3aF6ytMpHdao',
      'QmeveuwF5wWBSgUXLG6p1oxF3GKkgjEnhA6AAwHUoVsx6E',
      'QmSrPmbaUKA3ZodhzPWZnpFgcPMFWF4QsxXbkWfEptTBJd'
    ];

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);
    this.newContour = this.newContourRaw.map(galt.geohashToNumber).map(a => a.toString(10));
    this.newHeights = this.newContour.map(() => ether(10));
    this.heights = [1, 2, 3];
    this.newLevel = 1;
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.description = 'test description';

    this.modifySpaceGeoDataManager = await ModifySpaceGeoDataManager.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });

    this.acl = await ACL.new({ from: coreTeam });
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.pggRegistry = await PGGRegistry.new({ from: coreTeam });
    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.stakeTracker = await StakeTracker.new({ from: coreTeam });
    this.myPGGOracleStakeAccounting = await PGGOracleStakeAccounting.new(alice, { from: coreTeam });
    this.spaceToken = await SpaceToken.new(this.ggr.address, 'Space Token', 'SPACE', { from: coreTeam });

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.STAKE_TRACKER(), this.stakeTracker.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_RA(), spaceRA, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });

    await this.galtToken.mint(alice, ether(1000000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(1000000000), { from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.pggRegistry.initialize(this.ggr.address);
    await this.stakeTracker.initialize(this.ggr.address);
    await this.modifySpaceGeoDataManager.initialize(this.ggr.address);

    await this.feeRegistry.setProtocolEthShare(33, { from: coreTeam });
    await this.feeRegistry.setProtocolGaltShare(13, { from: coreTeam });

    const { spaceGeoData } = await deploySpaceGeoDataMock(this.ggr);
    this.spaceGeoData = spaceGeoData;
    this.pggFactory = await deployPGGFactory(this.ggr, coreTeam);

    await this.feeRegistry.setGaltFee(await this.pggFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.pggFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.pggFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactory.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), this.modifySpaceGeoDataManager.address, true, {
      from: coreTeam
    });
    await this.acl.setRole(bytes32('FEE_COLLECTOR'), feeMixerAddress, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ORACLE_MODIFIER'), oracleModifier, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_MINTER'), minter, true, { from: coreTeam });

    await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });

    const applicationConfig = {};
    applicationConfig[bytes32('MS_MINIMAL_FEE_ETH')] = numberToEvmWord(ether(6));
    applicationConfig[bytes32('MS_MINIMAL_FEE_GALT')] = numberToEvmWord(ether(45));
    applicationConfig[bytes32('MS_M')] = numberToEvmWord(3);
    applicationConfig[bytes32('MS_N')] = numberToEvmWord(5);
    applicationConfig[bytes32('MS_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_AND_GALT);

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
    this.pggConfigX = this.pggX.config.address;
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
        await this.galtToken.approve(this.modifySpaceGeoDataManager.address, ether(45), { from: alice });
        let res = await this.modifySpaceGeoDataManager.submit(
          this.pggConfigX,
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          ether(45),
          { from: alice }
        );

        this.aId = res.logs[0].args.applicationId;

        res = await this.modifySpaceGeoDataManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications if GALT payment is disabled', async function() {
          await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });
          this.applicationConfig[bytes32('MS_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_ONLY);

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

          await this.galtToken.approve(this.modifySpaceGeoDataManager.address, ether(45), { from: alice });
          await assertRevert(
            this.modifySpaceGeoDataManager.submit(
              pggDisabledGalt.config.address,
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              ether(45),
              {
                from: alice
              }
            )
          );
        });

        it('should reject applications without payment', async function() {
          await this.galtToken.approve(this.modifySpaceGeoDataManager.address, ether(45), { from: alice });
          await assertRevert(
            this.modifySpaceGeoDataManager.submit(
              this.pggConfigX,
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              0,
              {
                from: alice
              }
            )
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await this.galtToken.approve(this.modifySpaceGeoDataManager.address, ether(45), { from: alice });
          await assertRevert(
            this.modifySpaceGeoDataManager.submit(
              this.pggConfigX,
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              ether(20),
              {
                from: alice
              }
            )
          );
        });

        it('should reject applications with both ETH and GALT payments', async function() {
          await this.galtToken.approve(this.modifySpaceGeoDataManager.address, ether(45), { from: alice });
          await assertRevert(
            this.modifySpaceGeoDataManager.submit(
              this.pggConfigX,
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
          await this.galtToken.approve(this.modifySpaceGeoDataManager.address, ether(53), { from: alice });
          let res = await this.modifySpaceGeoDataManager.submit(
            this.pggConfigX,
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            ether(53),
            { from: alice }
          );

          this.aId = res.logs[0].args.applicationId;

          res = await this.modifySpaceGeoDataManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
          assert.equal(parseInt(res.createdAt, 10) > 0, true);

          res = await this.modifySpaceGeoDataManager.getApplicationRewards(this.aId);
          assert.equal(res.currency, Currency.GALT);

          assert.equal(res.arbitratorsReward, ether('46.11'));
          assert.equal(res.galtProtocolFee, ether('6.89'));
        });
      });
    });

    describe('with ETH payments', () => {
      it('should create a new application with SUBMITTED status', async function() {
        let res = await this.modifySpaceGeoDataManager.submit(
          this.pggConfigX,
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          0,
          { from: alice, value: ether(7) }
        );

        this.aId = res.logs[0].args.applicationId;

        res = await this.modifySpaceGeoDataManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications if ETH payment is disabled', async function() {
          await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });
          this.applicationConfig[bytes32('MS_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.GALT_ONLY);

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
            this.modifySpaceGeoDataManager.submit(
              pggDisabledEth.config.address,
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
            this.modifySpaceGeoDataManager.submit(
              this.pggConfigX,
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              0,
              {
                from: alice
              }
            )
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await assertRevert(
            this.modifySpaceGeoDataManager.submit(
              this.pggConfigX,
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              0,
              {
                from: alice,
                value: ether(4)
              }
            )
          );
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          let res = await this.modifySpaceGeoDataManager.submit(
            this.pggConfigX,
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            0,
            { from: alice, value: ether(13) }
          );

          this.aId = res.logs[0].args.applicationId;

          res = await this.modifySpaceGeoDataManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.SUBMITTED);

          res = await this.modifySpaceGeoDataManager.getApplicationRewards(this.aId);
          assert.equal(res.currency, Currency.ETH);

          assert.equal(res.arbitratorsReward, ether('8.71'));
          assert.equal(res.galtProtocolFee, ether('4.29'));
        });
      });
    });
  });

  describe('pipeline', () => {
    before(async function() {
      this.args = [
        this.ledgerIdentifier,
        this.newLevel,
        0,
        AreaSource.CONTRACT,
        this.description,
        this.newContour,
        this.newHeights
      ];
    });

    beforeEach(async function() {
      await evmMineBlock();
      let res = await this.modifySpaceGeoDataManager.submit(
        this.pggConfigX,
        this.attachedDocuments.map(galt.ipfsHashToBytes32),
        0,
        { from: alice, value: ether(7) }
      );

      this.cId = res.logs[0].args.applicationId;

      res = await this.spaceToken.mint(alice, { from: minter });
      this.spaceTokenId = res.logs[0].args.tokenId.toNumber();
      res = await this.spaceToken.mint(bob, { from: minter });
      this.spaceTokenId2 = res.logs[0].args.tokenId.toNumber();
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
    });

    describe('#lock()', () => {
      it('should allow any super-oracle lock <=m slots', async function() {
        let res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.modifySpaceGeoDataManager.lock(this.cId, { from: bob });
        await assertRevert(this.modifySpaceGeoDataManager.lock(this.cId, { from: bob }));
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: charlie });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: dan });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: eve });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: frank });
        await assertRevert(this.modifySpaceGeoDataManager.lock(this.cId, { from: george }));

        res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 5);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);
      });

      it('should deny non-oracle locking a claim', async function() {
        await assertRevert(this.modifySpaceGeoDataManager.lock(this.cId, { from: coreTeam }));
      });

      it('should deny proposal when claim is executed');
    });

    // WARNING: it is still possible to propose an approval when some of the candidates have no specified roles
    // and even inactive candidates
    describe('#proposeApproval()', () => {
      beforeEach(async function() {
        const res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.modifySpaceGeoDataManager.lock(this.cId, { from: bob });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: dan });
      });

      it('should allow new proposals from members who has already locked the application', async function() {
        let res = await this.modifySpaceGeoDataManager.proposeApproval(
          this.cId,
          'good enough',
          this.spaceTokenId,
          ...this.args,
          {
            from: bob
          }
        );
        const pId1 = res.logs[0].args.proposalId;

        res = await this.modifySpaceGeoDataManager.proposeApproval(
          this.cId,
          'looks good',
          this.spaceTokenId2,
          ...this.args,
          { from: dan }
        );
        const pId2 = res.logs[0].args.proposalId;

        res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
        assert.equal(res.slotsTaken, 2);

        res = await this.modifySpaceGeoDataManager.getProposalList(this.cId);
        assert.sameMembers(res, [pId1, pId2]);

        res = await this.modifySpaceGeoDataManager.getProposal(this.cId, pId1);
        assert.equal(res.from, bob);
        assert.equal(res.message, 'good enough');
        assert.equal(res.action, Action.APPROVE);

        res = await this.modifySpaceGeoDataManager.getProposalDetails(this.cId, pId1);
        assert.equal(res.spaceTokenId, this.spaceTokenId);
        assert.equal(hexToString(res.ledgerIdentifier), hexToString(this.args[0]));
        assert.equal(res.level, this.args[1]);
        assert.equal(res.area, this.args[2]);
        assert.equal(res.areaSource, this.args[3]);
        assert.equal(res.description, this.args[4]);
        assert.sameMembers(res.contour, this.args[5]);
        assert.sameMembers(res.heights, this.args[6]);

        res = await this.modifySpaceGeoDataManager.getProposal(this.cId, pId2);
        assert.equal(res.from, dan);
        assert.equal(res.message, 'looks good');
        assert.equal(res.action, Action.APPROVE);

        res = await this.modifySpaceGeoDataManager.getProposalDetails(this.cId, pId2);
        assert.equal(res.spaceTokenId, this.spaceTokenId2);
        assert.equal(hexToString(res.ledgerIdentifier), hexToString(this.args[0]));
        assert.equal(res.level, this.args[1]);
        assert.equal(res.area, this.args[2]);
        assert.equal(res.areaSource, this.args[3]);
        assert.equal(res.description, this.args[4]);
        assert.sameMembers(res.contour, this.args[5]);
        assert.sameMembers(res.heights, this.args[6]);
      });

      it('should deny non-oracle proposing a proposal', async function() {
        await assertRevert(
          this.modifySpaceGeoDataManager.proposeApproval(this.cId, 'good enough', this.spaceTokenId, ...this.args, {
            from: coreTeam
          })
        );
      });

      it('should deny oracle proposing when claim is not locked', async function() {
        await assertRevert(
          this.modifySpaceGeoDataManager.proposeApproval(this.cId, 'good enough', this.spaceTokenId, ...this.args, {
            from: eve
          })
        );
      });

      it('should allow multiple proposals from the same oracle', async function() {
        this.modifySpaceGeoDataManager.proposeApproval(this.cId, 'good enough', this.spaceTokenId, ...this.args, {
          from: bob
        });
        this.modifySpaceGeoDataManager.proposeApproval(this.cId, 'good enough', this.spaceTokenId2, ...this.args, {
          from: bob
        });
        await this.modifySpaceGeoDataManager.proposeReject(this.cId, 'looks bad', { from: bob });
      });

      it('should deny proposal when claim is executed');
      it('should oracle votes for proposal');
    });

    describe('#proposeReject()', () => {
      beforeEach(async function() {
        const res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.modifySpaceGeoDataManager.lock(this.cId, { from: bob });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: dan });
      });

      it('should allow new proposals from members who has already locked the application', async function() {
        let res = await this.modifySpaceGeoDataManager.proposeReject(this.cId, 'NOT good enough', { from: bob });
        const pId1 = res.logs[0].args.proposalId;
        res = await this.modifySpaceGeoDataManager.proposeReject(this.cId, 'odd', { from: dan });
        const pId2 = res.logs[0].args.proposalId;

        res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
        assert.equal(res.slotsTaken, 2);

        res = await this.modifySpaceGeoDataManager.getProposalList(this.cId);
        assert.sameMembers(res, [pId1, pId2]);

        res = await this.modifySpaceGeoDataManager.getProposal(this.cId, pId1);
        assert.equal(res.from, bob);
        assert.equal(res.message, 'NOT good enough');
        assert.equal(res.action, Action.REJECT);

        res = await this.modifySpaceGeoDataManager.getProposal(this.cId, pId2);
        assert.equal(res.from, dan);
        assert.equal(res.message, 'odd');
        assert.equal(res.action, Action.REJECT);
      });

      it('should deny non-oracle proposing a proposal', async function() {
        await assertRevert(this.modifySpaceGeoDataManager.proposeReject(this.cId, 'looks bad', { from: coreTeam }));
      });

      it('should deny oracle proposing when claim is not locked', async function() {
        await assertRevert(this.modifySpaceGeoDataManager.proposeReject(this.cId, 'looks bad', { from: eve }));
      });

      it('should deny proposal when claim is executed');
      it('oracle votes for proposal');
    });

    describe('#vote()', () => {
      beforeEach(async function() {
        let res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.modifySpaceGeoDataManager.lock(this.cId, { from: bob });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: dan });

        res = await this.modifySpaceGeoDataManager.proposeApproval(
          this.cId,
          'good enough',
          this.spaceTokenId,
          ...this.args,
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.modifySpaceGeoDataManager.proposeApproval(
          this.cId,
          'good enough',
          this.spaceTokenId,
          ...this.args,
          {
            from: dan
          }
        );
        this.pId2 = res.logs[0].args.proposalId;

        res = await this.modifySpaceGeoDataManager.proposeReject(this.cId, 'NOT good enough', { from: bob });
        this.pId3 = res.logs[0].args.proposalId;
      });

      it('should automatically count proposer voice', async function() {
        // empty array since the vote reassigned to pId3
        let res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId1);
        assert.sameMembers(res.votesFor, []);

        res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId2);
        assert.sameMembers(res.votesFor, [dan]);

        res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId3);
        assert.sameMembers(res.votesFor, [bob]);
      });

      it('should reassign slots according a last vote', async function() {
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: bob });
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: dan });

        let res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId1);
        assert.sameMembers(res.votesFor, [bob, dan]);

        res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId2);
        assert.sameMembers(res.votesFor, []);

        res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId3);
        assert.sameMembers(res.votesFor, []);
      });

      it('should deny oracles with non-locked slots voting', async function() {
        await assertRevert(this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: eve }));
      });

      it('should allow re-voting if oracle has changed is mind', async function() {
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: bob });
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: dan });

        let res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId1);
        assert.sameMembers(res.votesFor, [bob, dan]);
        res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId2);
        assert.sameMembers(res.votesFor, []);
        res = await this.modifySpaceGeoDataManager.getVotedFor(this.cId, bob);
        assert.equal(res, this.pId1);
        res = await this.modifySpaceGeoDataManager.getVotedFor(this.cId, dan);
        assert.equal(res, this.pId1);

        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId2, { from: bob });

        res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId1);
        assert.sameMembers(res.votesFor, [dan]);
        res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId2);
        assert.sameMembers(res.votesFor, [bob]);
        res = await this.modifySpaceGeoDataManager.getVotedFor(this.cId, bob);
        assert.equal(res, this.pId2);
        res = await this.modifySpaceGeoDataManager.getVotedFor(this.cId, dan);
        assert.equal(res, this.pId1);
      });

      it('should deny voting if status is not SUBMITTED', async function() {
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: bob });
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: dan });

        await this.modifySpaceGeoDataManager.lock(this.cId, { from: charlie });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: eve });

        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: charlie });

        await assertRevert(this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: eve }));

        let res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
        assert.equal(res.slotsTaken, 4);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        res = await this.modifySpaceGeoDataManager.getProposal(this.cId, this.pId1);
        assert.equal(res.from, bob);
        assert.equal(res.action, Action.APPROVE);
        res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId1);
        assert.sameMembers(res.votesFor, [dan, bob, charlie]);
      });

      it('should deny new proposal voting if status is not SUBMITTED', async function() {
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: bob });
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: dan });

        await this.modifySpaceGeoDataManager.lock(this.cId, { from: charlie });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: eve });

        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: charlie });

        await assertRevert(
          this.modifySpaceGeoDataManager.proposeApproval(this.cId, 'good enough', this.spaceTokenId, ...this.args, {
            from: dan
          })
        );
      });
    });

    describe('on threshold reach', () => {
      beforeEach(async function() {
        let res = await this.modifySpaceGeoDataManager.getApplication(this.cId);

        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: bob });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: dan });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: eve });

        this.customContour = ['qqqqqqqq', 'zzzzzzzz', 'pppppp'].map(galt.geohashToNumber).map(a => a.toString(10));
        this.customHeights = this.customContour.map(() => ether(10));

        res = await this.modifySpaceGeoDataManager.proposeApproval(
          this.cId,
          'good enough',
          this.spaceTokenId2,
          this.ledgerIdentifier,
          -1,
          987,
          AreaSource.CONTRACT,
          'blah blah',
          this.customContour,
          this.customHeights,
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.modifySpaceGeoDataManager.proposeApproval(
          this.cId,
          'good enough',
          this.spaceTokenId2,
          this.ledgerIdentifier,
          -1,
          987,
          AreaSource.USER_INPUT,
          'blah blah',
          this.customContour,
          this.customHeights,
          {
            from: dan
          }
        );
        this.pId2 = res.logs[0].args.proposalId;
      });

      it('should apply proposed geo registry changes with user-input area', async function() {
        let res = await this.spaceGeoData.getSpaceTokenGeoData(this.spaceTokenId2);
        assert.equal(res.contour.length, 0);
        assert.equal(res.heights.length, 0);
        assert.equal(res.level, 0);
        assert.equal(res.area, 0);
        assert.equal(res.areaSource, 0);
        assert.equal(hexToString(res.ledgerIdentifier), '');
        assert.equal(res.description, '');

        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId2, { from: bob });
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId2, { from: eve });

        res = await this.spaceGeoData.getSpaceTokenGeoData(this.spaceTokenId2);
        assert.sameMembers(res.contour, this.customContour);
        assert.sameMembers(res.heights, this.customHeights);
        assert.equal(res.level, -1);
        assert.equal(res.area, 987);
        assert.equal(res.areaSource, AreaSource.USER_INPUT);
        assert.equal(hexToString(res.ledgerIdentifier), hexToString(this.ledgerIdentifier));
        assert.equal(res.description, 'blah blah');
      });

      it('should apply proposed geo registry changes with contract-calculated area', async function() {
        let res = await this.spaceGeoData.getSpaceTokenGeoData(this.spaceTokenId2);
        assert.equal(res.contour.length, 0);
        assert.equal(res.heights.length, 0);
        assert.equal(res.level, 0);
        assert.equal(res.area, 0);
        assert.equal(res.areaSource, 0);
        assert.equal(hexToString(res.ledgerIdentifier), '');
        assert.equal(res.description, '');

        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: eve });
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId1, { from: dan });

        res = await this.spaceGeoData.getSpaceTokenGeoData(this.spaceTokenId2);
        assert.sameMembers(res.contour, this.customContour);
        assert.sameMembers(res.heights, this.customHeights);
        assert.equal(res.level, -1);
        assert.equal(res.area, 3000000000000000000000);
        assert.equal(res.areaSource, AreaSource.CONTRACT);
        assert.equal(hexToString(res.ledgerIdentifier), hexToString(this.ledgerIdentifier));
        assert.equal(res.description, 'blah blah');
      });

      it('should reject when REJECT propose reached threshold', async function() {
        let res = await this.modifySpaceGeoDataManager.proposeReject(this.cId, 'blah', { from: dan });
        this.pId3 = res.logs[0].args.proposalId;
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId3, { from: bob });
        await this.modifySpaceGeoDataManager.vote(this.cId, this.pId3, { from: eve });

        res = await this.modifySpaceGeoDataManager.getProposalVotes(this.cId, this.pId3);
        assert.equal(res.votesFor.length, 3);
        res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });
    });

    describe('claims fee paid by GALT', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.modifySpaceGeoDataManager.address, ether(47), { from: alice });
        let res = await this.modifySpaceGeoDataManager.submit(
          this.pggConfigX,
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          ether(47),
          { from: alice }
        );

        // override default which paid by ETH
        this.cId = res.logs[0].args.applicationId;

        await this.modifySpaceGeoDataManager.lock(this.cId, { from: bob });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: dan });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: eve });

        res = await this.modifySpaceGeoDataManager.proposeApproval(
          this.cId,
          'good enough',
          this.spaceTokenId,
          ...this.args,
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.modifySpaceGeoDataManager.proposeApproval(
          this.cId,
          'good enough',
          this.spaceTokenId2,
          ...this.args,
          {
            from: dan
          }
        );
        this.pId2 = res.logs[0].args.proposalId;

        res = await this.modifySpaceGeoDataManager.proposeReject(this.cId, 'its fake', {
          from: eve
        });
        this.pId3 = res.logs[0].args.proposalId;

        res = await this.modifySpaceGeoDataManager.getApplicationRewards(this.cId);
        assert.equal(res.currency, Currency.GALT);

        assert.equal(res.arbitratorsReward, '40890000000000000000');
        assert.equal(res.galtProtocolFee, '6110000000000000000');
      });

      describe('on success proposal win (APPROVED status)', () => {
        it('should revert arbitrator claims when status is SUBMITTED', async function() {
          await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob }));
        });

        describe('with 4 active slots', () => {
          beforeEach(async function() {
            await this.modifySpaceGeoDataManager.lock(this.cId, { from: charlie });
            await this.modifySpaceGeoDataManager.vote(this.cId, this.pId2, { from: bob });
            await this.modifySpaceGeoDataManager.vote(this.cId, this.pId2, { from: eve });
          });

          it('should calculate and assign rewards for arbitrators and galt space', async function() {
            let res = await this.modifySpaceGeoDataManager.getApplicationRewards(this.cId);
            assert.equal(res.arbitratorReward, '10222500000000000000');

            res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
            assert.equal(res.slotsTaken, '4');
            assert.equal(res.totalSlots, '5');
          });

          it('should allow galt space withdrawal only once', async function() {
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });
            let galtSpaceBalanceBefore = await this.galtToken.balanceOf(feeMixerAddress);
            await this.modifySpaceGeoDataManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });
            let galtSpaceBalanceAfter = await this.galtToken.balanceOf(feeMixerAddress);

            assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(6.11));

            galtSpaceBalanceBefore = await this.galtToken.balanceOf(feeMixerAddress);
            await this.modifySpaceGeoDataManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });
            galtSpaceBalanceAfter = await this.galtToken.balanceOf(feeMixerAddress);

            assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(0));
          });

          it('should allow oracles claiming their rewards', async function() {
            const bobBalanceBefore = await this.galtToken.balanceOf(bob);
            const danBalanceBefore = await this.galtToken.balanceOf(dan);
            const charlieBalanceBefore = await this.galtToken.balanceOf(charlie);
            const eveBalanceBefore = await this.galtToken.balanceOf(eve);

            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan });
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: charlie });
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve });

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
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan });
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: charlie });
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve });

            await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob }));
            await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan }));
            await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: charlie }));
            await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve }));
          });
        });

        describe('with 3 active slots', () => {
          beforeEach(async function() {
            await this.modifySpaceGeoDataManager.vote(this.cId, this.pId2, { from: bob });
            await this.modifySpaceGeoDataManager.vote(this.cId, this.pId2, { from: eve });
          });

          it('should calculate and assign rewards for arbitrators and galt space', async function() {
            let res = await this.modifySpaceGeoDataManager.getApplicationRewards(this.cId);
            assert.equal(res.arbitratorReward, '13630000000000000000');

            res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
            assert.equal(res.slotsTaken, '3');
            assert.equal(res.totalSlots, '5');
          });

          it('should allow oracles claiming their rewards', async function() {
            const bobBalanceBefore = await this.galtToken.balanceOf(bob);
            const danBalanceBefore = await this.galtToken.balanceOf(dan);
            const eveBalanceBefore = await this.galtToken.balanceOf(eve);

            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan });
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve });

            const bobBalanceAfter = await this.galtToken.balanceOf(bob);
            const danBalanceAfter = await this.galtToken.balanceOf(dan);
            const eveBalanceAfter = await this.galtToken.balanceOf(eve);

            assertGaltBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(13.63));
            assertGaltBalanceChanged(danBalanceBefore, danBalanceAfter, ether(13.63));
            assertGaltBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(13.63));
          });

          it('should deny oracles claiming their rewards twice', async function() {
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan });
            await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve });

            await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob }));
            await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan }));
            await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve }));
          });

          it('should deny oracles who dont locked application claiming revards', async function() {
            await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: charlie }));
          });
        });
      });

      describe('on reject proposal win (REJECTED status) with 3 active slots', () => {
        beforeEach(async function() {
          await this.modifySpaceGeoDataManager.vote(this.cId, this.pId3, { from: dan });
          await this.modifySpaceGeoDataManager.vote(this.cId, this.pId3, { from: bob });
        });

        it('should calculate and assign rewards for arbitrators and galt space', async function() {
          let res = await this.modifySpaceGeoDataManager.getApplicationRewards(this.cId);
          assert.equal(res.arbitratorReward, '13630000000000000000');

          res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
          assert.equal(res.status, ApplicationStatus.REJECTED);
          assert.equal(res.slotsTaken, '3');
          assert.equal(res.totalSlots, '5');
        });

        it('should allow oracles claiming their rewards', async function() {
          const bobBalanceBefore = await this.galtToken.balanceOf(bob);
          const danBalanceBefore = await this.galtToken.balanceOf(dan);
          const eveBalanceBefore = await this.galtToken.balanceOf(eve);

          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve });

          const bobBalanceAfter = await this.galtToken.balanceOf(bob);
          const danBalanceAfter = await this.galtToken.balanceOf(dan);
          const eveBalanceAfter = await this.galtToken.balanceOf(eve);

          assertGaltBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(13.63));
          assertGaltBalanceChanged(danBalanceBefore, danBalanceAfter, ether(13.63));
          assertGaltBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(13.63));
        });

        it('should deny oracles claiming their rewards twice', async function() {
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve });

          await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob }));
          await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan }));
          await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve }));
        });

        it('should deny oracles who dont locked application claiming revards', async function() {
          await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: charlie }));
        });
      });
    });

    describe('claims fee paid by ETH', () => {
      beforeEach(async function() {
        let res = await this.modifySpaceGeoDataManager.submit(
          this.pggConfigX,
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          0,
          { from: alice, value: ether(9) }
        );

        // override default which paid by ETH
        this.cId = res.logs[0].args.applicationId;

        await this.modifySpaceGeoDataManager.lock(this.cId, { from: bob });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: dan });
        await this.modifySpaceGeoDataManager.lock(this.cId, { from: eve });

        res = await this.modifySpaceGeoDataManager.proposeApproval(
          this.cId,
          'good enough',
          this.spaceTokenId,
          ...this.args,
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.modifySpaceGeoDataManager.proposeApproval(
          this.cId,
          'good enough',
          this.spaceTokenId2,
          ...this.args,
          {
            from: dan
          }
        );
        this.pId2 = res.logs[0].args.proposalId;

        res = await this.modifySpaceGeoDataManager.proposeReject(this.cId, 'its fake', {
          from: eve
        });
        this.pId3 = res.logs[0].args.proposalId;
        // cleanup fees
        await this.modifySpaceGeoDataManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
      });

      describe('on approve proposal win (APPROVED status) with 5 active slots', () => {
        beforeEach(async function() {
          await this.modifySpaceGeoDataManager.lock(this.cId, { from: charlie });
          await this.modifySpaceGeoDataManager.lock(this.cId, { from: frank });

          await this.modifySpaceGeoDataManager.vote(this.cId, this.pId2, { from: eve });
          await this.modifySpaceGeoDataManager.vote(this.cId, this.pId3, { from: charlie });
          await this.modifySpaceGeoDataManager.vote(this.cId, this.pId2, { from: bob });
        });

        it('should calculate and assign rewards for arbitrators and galt space', async function() {
          let res = await this.modifySpaceGeoDataManager.getApplicationRewards(this.cId);
          assert.equal(res.currency, Currency.ETH);

          assert.equal(res.arbitratorsReward, '6030000000000000000');
          assert.equal(res.galtProtocolFee, '2970000000000000000');

          res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
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

          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: charlie });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: frank });

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
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });

          let galtSpaceBalanceBefore = await web3.eth.getBalance(feeMixerAddress);
          await this.modifySpaceGeoDataManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
          let galtSpaceBalanceAfter = await web3.eth.getBalance(feeMixerAddress);

          assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(2.97));

          galtSpaceBalanceBefore = await web3.eth.getBalance(feeMixerAddress);
          await this.modifySpaceGeoDataManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
          galtSpaceBalanceAfter = await web3.eth.getBalance(feeMixerAddress);

          assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(0));
        });

        it('should deny oracles claiming their rewards twice', async function() {
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve });

          await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob }));
          await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan }));
          await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve }));
        });
      });

      describe('on reject proposal win (REJECTED status) with 3 active slots', () => {
        beforeEach(async function() {
          await this.modifySpaceGeoDataManager.vote(this.cId, this.pId3, { from: dan });
          await this.modifySpaceGeoDataManager.vote(this.cId, this.pId3, { from: bob });
        });

        it('should calculate and assign rewards for arbitrators and galt space', async function() {
          let res = await this.modifySpaceGeoDataManager.getApplicationRewards(this.cId);
          assert.equal(res.currency, Currency.ETH);

          assert.equal(res.arbitratorsReward, '6030000000000000000');
          assert.equal(res.galtProtocolFee, '2970000000000000000');

          res = await this.modifySpaceGeoDataManager.getApplication(this.cId);
          assert.equal(res.status, ApplicationStatus.REJECTED);
          assert.equal(res.slotsTaken, '3');
          assert.equal(res.totalSlots, '5');
        });

        it('should allow oracles claiming their rewards', async function() {
          const bobBalanceBefore = await web3.eth.getBalance(bob);
          const danBalanceBefore = await web3.eth.getBalance(dan);
          const eveBalanceBefore = await web3.eth.getBalance(eve);

          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve });

          const bobBalanceAfter = await web3.eth.getBalance(bob);
          const danBalanceAfter = await web3.eth.getBalance(dan);
          const eveBalanceAfter = await web3.eth.getBalance(eve);

          assertEthBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(2.01));
          assertEthBalanceChanged(danBalanceBefore, danBalanceAfter, ether(2.01));
          assertEthBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(2.01));
        });

        it('should allow galt space claiming reward', async function() {
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });

          const galtSpaceBalanceBefore = await web3.eth.getBalance(feeMixerAddress);
          await this.modifySpaceGeoDataManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
          const galtSpaceBalanceAfter = await web3.eth.getBalance(feeMixerAddress);

          assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(2.97));
        });

        it('should deny oracles claiming their rewards twice', async function() {
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan });
          await this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve });

          await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: bob }));
          await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: dan }));
          await assertRevert(this.modifySpaceGeoDataManager.claimArbitratorReward(this.cId, { from: eve }));
        });
      });
    });
  });
});
