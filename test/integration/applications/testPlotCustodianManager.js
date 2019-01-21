const PlotManager = artifacts.require('./PlotManager.sol');
const PlotManagerLib = artifacts.require('./PlotManagerLib.sol');
const PlotValuation = artifacts.require('./PlotValuation.sol');
const SpaceCustodianRegistry = artifacts.require('./SpaceCustodianRegistry.sol');
const PlotCustodianManager = artifacts.require('./PlotCustodianManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const Web3 = require('web3');
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  initHelperArtifacts,
  assertEthBalanceChanged,
  ether,
  assertEqualBN,
  assertRevert,
  zeroAddress,
  deploySplitMerge,
  clearLibCache,
  applicationStatus
} = require('../../helpers');

const web3 = new Web3(PlotValuation.web3.currentProvider);
const { BN, utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

const NEW_APPLICATION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const VALUATION_APPLICATION = '0x619647f9036acf2e8ad4ea6c06ae7256e68496af59818a2b63e51b27a46624e9';
const CUSTODIAN_APPLICATION = '0xe2ce825e66d1e2b4efe1252bf2f9dc4f1d7274c343ac8a9f28b6776eb58188a6';

const PV_APPRAISER_ORACLE_TYPE = bytes32('PV_APPRAISER_ORACLE_TYPE');
const PV_APPRAISER2_ORACLE_TYPE = bytes32('PV_APPRAISER2_ORACLE_TYPE');
const PV_AUDITOR_ORACLE_TYPE = bytes32('PV_AUDITOR_ORACLE_TYPE');
const PC_CUSTODIAN_ORACLE_TYPE = bytes32('PC_CUSTODIAN_ORACLE_TYPE');
const PC_AUDITOR_ORACLE_TYPE = bytes32('PC_AUDITOR_ORACLE_TYPE');

const FOO = bytes32('foo');
const BAR = bytes32('bar');
const BUZZ = bytes32('buzz');
const ES = bytes32('');
const MN = bytes32('MN');
const BOB = bytes32('bob');
const CHARLIE = bytes32('charlie');
const DAN = bytes32('dan');
const EVE = bytes32('eve');
const FRANK = bytes32('frank');
const GEORGE = bytes32('george');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const ValidationStatus = {
  NOT_EXISTS: 0,
  PENDING: 1,
  LOCKED: 2
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

const Action = {
  ATTACH: 0,
  DETACH: 1
};

Object.freeze(ValidationStatus);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

// eslint-disable-next-line
contract('PlotCustodianManager', (accounts) => {
  before(clearLibCache);
  const [
    coreTeam,
    galtSpaceOrg,
    feeManager,
    multiSigX,
    stakesNotifier,
    applicationTypeManager,
    manualCustodianManager,
    oracleManager,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank,
    george
  ] = accounts;

  beforeEach(async function() {
    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';
    this.attachedDocuments = [
      'QmYNQJoKGNHTpPxCBPh9KkDpaExgd2duMa3aF6ytMpHdao',
      'QmeveuwF5wWBSgUXLG6p1oxF3GKkgjEnhA6AAwHUoVsx6E',
      'QmSrPmbaUKA3ZodhzPWZnpFgcPMFWF4QsxXbkWfEptTBJd'
    ];

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.heights = [1, 2, 3];
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.plotManagerLib = await PlotManagerLib.new({ from: coreTeam });
    PlotManager.link('PlotManagerLib', this.plotManagerLib.address);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.plotValuation = await PlotValuation.new({ from: coreTeam });
    this.plotCustodianManager = await PlotCustodianManager.new({ from: coreTeam });
    this.spaceCustodianRegistry = await SpaceCustodianRegistry.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });

    this.splitMerge = await deploySplitMerge(this.spaceToken.address);

    await this.plotManager.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.oracles.address,
      this.galtToken.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.plotValuation.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.oracles.address,
      this.galtToken.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.plotCustodianManager.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.oracles.address,
      this.galtToken.address,
      // PlotEscrow integration doesn't required here
      zeroAddress,
      this.spaceCustodianRegistry.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.splitMerge.initialize(this.spaceToken.address, {
      from: coreTeam
    });
    await this.plotManager.addRoleTo(feeManager, await this.plotManager.ROLE_FEE_MANAGER(), {
      from: coreTeam
    });
    await this.plotValuation.addRoleTo(feeManager, await this.plotValuation.ROLE_FEE_MANAGER(), {
      from: coreTeam
    });
    await this.plotValuation.addRoleTo(galtSpaceOrg, await this.plotValuation.ROLE_GALT_SPACE(), {
      from: coreTeam
    });
    await this.plotCustodianManager.addRoleTo(feeManager, await this.plotCustodianManager.ROLE_FEE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(applicationTypeManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_STAKES_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(stakesNotifier, await this.oracles.ROLE_ORACLE_STAKES_NOTIFIER(), {
      from: coreTeam
    });
    await this.splitMerge.addRoleTo(this.plotManager.address, await this.splitMerge.GEO_DATA_MANAGER(), {
      from: coreTeam
    });
    await this.spaceCustodianRegistry.addRoleTo(
      this.plotCustodianManager.address,
      await this.spaceCustodianRegistry.ROLE_APPLICATION(),
      {
        from: coreTeam
      }
    );

    await this.spaceCustodianRegistry.addRoleTo(
      manualCustodianManager,
      await this.spaceCustodianRegistry.ROLE_APPLICATION(),
      {
        from: coreTeam
      }
    );

    await this.plotManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotManager.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.plotValuation.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotValuation.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotValuation.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotValuation.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.plotCustodianManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotCustodianManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotCustodianManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotCustodianManager.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.spaceToken.addRoleTo(this.plotManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.oracles.setOracleTypeMinimalDeposit(PV_APPRAISER_ORACLE_TYPE, ether(30), {
      from: applicationTypeManager
    });
    await this.oracles.setOracleTypeMinimalDeposit(PV_APPRAISER2_ORACLE_TYPE, ether(30), {
      from: applicationTypeManager
    });
    await this.oracles.setOracleTypeMinimalDeposit(PV_AUDITOR_ORACLE_TYPE, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(PC_CUSTODIAN_ORACLE_TYPE, ether(30), {
      from: applicationTypeManager
    });
    await this.oracles.setOracleTypeMinimalDeposit(PC_AUDITOR_ORACLE_TYPE, ether(30), { from: applicationTypeManager });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.plotValuationWeb3 = new web3.eth.Contract(this.plotValuation.abi, this.plotValuation.address);
    this.spaceCustodianRegistryWeb3 = new web3.eth.Contract(
      this.spaceCustodianRegistry.abi,
      this.spaceCustodianRegistry.address
    );
    this.plotCustodianManagerWeb3 = new web3.eth.Contract(
      this.plotCustodianManager.abi,
      this.plotCustodianManager.address
    );
  });

  it('should be initialized successfully', async function() {
    assert.equal(await this.plotValuationWeb3.methods.minimalApplicationFeeInEth().call(), ether(6));
  });

  describe('contract config modifiers', () => {
    describe('#setGaltSpaceRewardsAddress()', () => {
      it('should allow an owner set rewards address', async function() {
        await this.plotValuation.setGaltSpaceRewardsAddress(bob, { from: galtSpaceOrg });
        // const res = await web3.eth.getStorageAt(this.plotValuation.address, 5);
        // assert.equal(res, bob);
      });

      it('should deny non-owner set rewards address', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceRewardsAddress(bob, { from: alice }));
      });
    });

    describe('#setPaymentMethod()', () => {
      it('should allow an owner set a payment method', async function() {
        await this.plotValuation.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: feeManager });
        const res = await this.plotValuation.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_ONLY);
      });

      it('should deny non-owner set a payment method', async function() {
        await assertRevert(this.plotValuation.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: alice }));
        const res = await this.plotValuation.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_AND_GALT);
      });
    });

    describe('#setApplicationFeeInEth()', () => {
      it('should allow an owner set a new minimum fee in ETH', async function() {
        await this.plotValuation.setMinimalApplicationFeeInEth(ether(0.05), { from: feeManager });
        const res = await this.plotValuation.minimalApplicationFeeInEth();
        assert.equal(res, ether(0.05));
      });

      it('should deny any other than owner person set fee in ETH', async function() {
        await assertRevert(this.plotValuation.setMinimalApplicationFeeInEth(ether(0.05), { from: alice }));
      });
    });

    describe('#setApplicationFeeInGalt()', () => {
      it('should allow an owner set a new minimum fee in GALT', async function() {
        await this.plotValuation.setMinimalApplicationFeeInGalt(ether(0.15), { from: feeManager });
        const res = await this.plotValuation.minimalApplicationFeeInGalt();
        assert.equal(res, ether(0.15));
      });

      it('should deny any other than owner person set fee in GALT', async function() {
        await assertRevert(this.plotValuation.setMinimalApplicationFeeInGalt(ether(0.15), { from: alice }));
      });
    });

    describe('#setGaltSpaceEthShare()', () => {
      it('should allow an owner set galtSpace ETH share in percents', async function() {
        await this.plotValuation.setGaltSpaceEthShare('42', { from: feeManager });
        const res = await this.plotValuation.galtSpaceEthShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space EHT share grater than 100 percents', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceEthShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceEthShare('20', { from: alice }));
      });
    });

    describe('#setGaltSpaceGaltShare()', () => {
      it('should allow an owner set galtSpace Galt share in percents', async function() {
        await this.plotValuation.setGaltSpaceGaltShare('42', { from: feeManager });
        const res = await this.plotValuation.galtSpaceGaltShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space Galt share grater than 100 percents', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceGaltShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceGaltShare('20', { from: alice }));
      });
    });
  });

  describe('application pipeline for GALT', () => {
    beforeEach(async function() {
      this.resNewAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        [FOO, BAR, BUZZ],
        [50, 25, 25],
        [ES, ES, ES],
        { from: applicationTypeManager }
      );

      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        VALUATION_APPLICATION,
        [PV_APPRAISER_ORACLE_TYPE, PV_APPRAISER2_ORACLE_TYPE, PV_AUDITOR_ORACLE_TYPE],
        [50, 25, 25],
        [ES, ES, ES],
        { from: applicationTypeManager }
      );
      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        CUSTODIAN_APPLICATION,
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
        [60, 40],
        [ES, ES],
        { from: applicationTypeManager }
      );

      await this.oracles.addOracle(
        multiSigX,
        bob,
        BOB,
        MN,
        [],
        [PV_APPRAISER_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE, FOO],
        {
          from: oracleManager
        }
      );
      await this.oracles.addOracle(
        multiSigX,
        charlie,
        CHARLIE,
        MN,
        [],
        [BAR, PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
        {
          from: oracleManager
        }
      );
      await this.oracles.addOracle(multiSigX, dan, DAN, MN, [], [PV_APPRAISER2_ORACLE_TYPE, BUZZ], {
        from: oracleManager
      });
      await this.oracles.addOracle(multiSigX, eve, EVE, MN, [], [PV_AUDITOR_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE], {
        from: oracleManager
      });

      await this.oracles.onOracleStakeChanged(multiSigX, bob, PV_APPRAISER_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, bob, PC_CUSTODIAN_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, bob, FOO, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, charlie, PC_CUSTODIAN_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, charlie, BAR, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, charlie, PC_AUDITOR_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, dan, PV_APPRAISER2_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, dan, BUZZ, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, eve, PV_AUDITOR_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, eve, PC_AUDITOR_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });

      const galts = await this.plotManager.getSubmissionFee(Currency.GALT, this.contour);
      await this.galtToken.approve(this.plotManager.address, galts, { from: alice });

      // Alice obtains a package token
      let res = await this.plotManager.submitApplication(
        this.contour,
        this.heights,
        0,
        this.credentials,
        this.ledgerIdentifier,
        galts,
        {
          from: alice
        }
      );
      this.aId = res.logs[0].args.id;

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.spaceTokenId = res.spaceTokenId;

      await this.plotManager.lockApplicationForReview(this.aId, FOO, { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, BAR, { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, BUZZ, { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      await this.plotManager.claimSpaceToken(this.aId, { from: alice });
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
      await this.galtToken.approve(this.plotValuation.address, ether(45), { from: alice });
      res = await this.plotValuation.submitApplication(
        this.spaceTokenId,
        this.attachedDocuments.map(galt.ipfsHashToBytes32),
        ether(45),
        {
          from: alice
        }
      );
      this.aId = res.logs[0].args.id;
      await this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ORACLE_TYPE, { from: bob });
      await this.plotValuation.lockApplication(this.aId, PV_APPRAISER2_ORACLE_TYPE, { from: dan });
      await this.plotValuation.lockApplication(this.aId, PV_AUDITOR_ORACLE_TYPE, { from: eve });
      await this.plotValuation.valuatePlot(this.aId, ether(4500), { from: bob });
      await this.plotValuation.valuatePlot2(this.aId, ether(4500), { from: dan });
      await this.plotValuation.approveValuation(this.aId, { from: eve });
    });

    describe('#submit()', () => {
      it('should allow an applicant pay commission in Galt', async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
        let res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob], ether(45), {
          from: alice
        });
        this.aId = res.logs[0].args.id;
        res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, applicationStatus.SUBMITTED);
      });

      // TODO: fix after implementation
      it.skip('should allow detaching previously attached custodian', async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
        let res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob], ether(45), {
          from: alice
        });
        this.aId = res.logs[0].args.id;
        res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, applicationStatus.SUBMITTED);
      });

      it('should deny attaching non-unique custodians', async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
        await assertRevert(
          this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, bob], ether(45), {
            from: alice
          })
        );
      });

      it('should deny detaching non-attached custodian', async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
        await assertRevert(
          this.plotCustodianManager.submit(this.spaceTokenId, Action.DETACH, [bob], ether(45), {
            from: alice
          })
        );
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
          await assertRevert(
            this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob], 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
          await assertRevert(
            this.plotCustodianManager.submit(this.spaceTokenId, Action.DETACH, [bob], ether(43), {
              from: alice
            })
          );
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(47), { from: alice });
          let res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob], ether(47), {
            from: alice
          });
          this.aId = res.logs[0].args.id;

          // oracle share - 87%
          // galtspace share - 13%

          res = await this.plotCustodianManagerWeb3.methods.getApplicationRewards(this.aId).call();
          assert.equal(res.galtSpaceReward, '6110000000000000000');
          assert.equal(res.oraclesReward, '40890000000000000000');
          assert.equal(res.totalCustodiansReward, '24534000000000000000');
          assert.equal(res.auditorReward, '16356000000000000000');
        });
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(47), { from: alice });
        const res = await this.plotCustodianManager.submit(
          this.spaceTokenId,
          Action.ATTACH,
          [bob, charlie],
          ether(47),
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.accept(this.aId, { from: bob });
        await this.plotCustodianManager.accept(this.aId, { from: charlie });
        await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
        await this.plotCustodianManager.attachToken(this.aId, { from: alice });
        await this.plotCustodianManager.auditorLock(this.aId, { from: eve });

        await this.plotCustodianManager.approve(this.aId, { from: charlie });
        await this.plotCustodianManager.approve(this.aId, { from: eve });
        await this.plotCustodianManager.approve(this.aId, { from: alice });
      });

      describe('for COMPLETED applications', () => {
        beforeEach(async function() {
          await this.plotCustodianManager.approve(this.aId, { from: bob });
          await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });
        });

        it('should be allowed', async function() {
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.COMPLETED);

          res = await this.plotCustodianManagerWeb3.methods.getApplicationRewards(this.aId).call();
          assert.equal(res.galtSpaceRewardPaidOut, true);
          assert.equal(res.auditorRewardPaidOut, true);

          res = await this.plotCustodianManagerWeb3.methods.getApplicationCustodian(this.aId, bob).call();
          assert.equal(res.approved, true);
          assert.equal(res.rewardPaidOut, true);
          assert.equal(res.involved, true);

          res = await this.plotCustodianManagerWeb3.methods.getApplicationCustodian(this.aId, charlie).call();
          assert.equal(res.approved, true);
          assert.equal(res.rewardPaidOut, false);
          assert.equal(res.involved, true);
        });

        it('should send funds to claimers', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

          const res = await this.plotCustodianManagerWeb3.methods.getApplicationRewards(this.aId).call();

          assert.equal(res.galtSpaceReward, 6110000000000000000);
          assert.equal(res.oraclesReward, 40890000000000000000);
          assert.equal(res.totalCustodiansReward, 24534000000000000000);
          assert.equal(res.custodianReward, 8178000000000000000);
          assert.equal(res.auditorReward, 16356000000000000000);
          assert.equal(res.galtSpaceRewardPaidOut, true);
          assert.equal(res.auditorRewardPaidOut, true);

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('8178000000000000000')));
          assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('16356000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('6110000000000000000')));
        });

        it('should revert on double claim', async function() {
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: bob }));
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: eve }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });

        it('should revert on non-oracle claim', async function() {
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: bob }));
        });

        it('should revert on applicant claim attempt', async function() {
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: alice }));
        });
      });

      describe('for CLOSED applications', () => {
        beforeEach(async function() {
          await this.plotCustodianManager.reject(this.aId, 'fix it', { from: bob });
          await this.plotCustodianManager.close(this.aId, { from: alice });
        });

        it('should be allowed', async function() {
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.CLOSED);

          res = await this.plotCustodianManagerWeb3.methods.getApplicationRewards(this.aId).call();
          assert.equal(res.galtSpaceRewardPaidOut, true);
          assert.equal(res.auditorRewardPaidOut, true);

          res = await this.plotCustodianManagerWeb3.methods.getApplicationCustodian(this.aId, bob).call();
          assert.equal(res.approved, false);
          assert.equal(res.rewardPaidOut, true);
          assert.equal(res.involved, true);

          res = await this.plotCustodianManagerWeb3.methods.getApplicationCustodian(this.aId, charlie).call();
          assert.equal(res.approved, true);
          assert.equal(res.rewardPaidOut, false);
          assert.equal(res.involved, true);
        });

        it('should send funds to claimers', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('8178000000000000000')));
          assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('16356000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('6110000000000000000')));
        });

        it('should revert on double claim', async function() {
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: bob }));
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: eve }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });

        it('should revert on non-oracle claim', async function() {
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: bob }));
        });

        it('should revert on applicant claim attempt', async function() {
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: alice }));
        });
      });
    });
  });

  describe('application pipeline for ETH', () => {
    beforeEach(async function() {
      this.resNewAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        [FOO, BAR, BUZZ],
        [50, 25, 25],
        [ES, ES, ES],
        { from: applicationTypeManager }
      );

      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        VALUATION_APPLICATION,
        [PV_APPRAISER_ORACLE_TYPE, PV_APPRAISER2_ORACLE_TYPE, PV_AUDITOR_ORACLE_TYPE],
        [50, 25, 25],
        [ES, ES, ES],
        { from: applicationTypeManager }
      );
      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        CUSTODIAN_APPLICATION,
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
        [60, 40],
        [ES, ES],
        { from: applicationTypeManager }
      );

      await this.oracles.addOracle(
        multiSigX,
        bob,
        BOB,
        MN,
        [],
        [PV_APPRAISER_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE, FOO],
        {
          from: oracleManager
        }
      );
      await this.oracles.addOracle(
        multiSigX,
        charlie,
        CHARLIE,
        MN,
        [],
        [BAR, PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
        {
          from: oracleManager
        }
      );
      await this.oracles.addOracle(multiSigX, dan, DAN, MN, [], [PV_APPRAISER2_ORACLE_TYPE, BUZZ], {
        from: oracleManager
      });
      await this.oracles.addOracle(multiSigX, eve, EVE, MN, [], [PV_AUDITOR_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE], {
        from: oracleManager
      });
      await this.oracles.addOracle(multiSigX, frank, FRANK, MN, [], [PC_CUSTODIAN_ORACLE_TYPE], {
        from: oracleManager
      });
      await this.oracles.addOracle(multiSigX, george, GEORGE, MN, [], [PC_CUSTODIAN_ORACLE_TYPE], {
        from: oracleManager
      });

      await this.oracles.onOracleStakeChanged(multiSigX, bob, PV_APPRAISER_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, bob, PC_CUSTODIAN_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, bob, FOO, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, charlie, BAR, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, charlie, PC_CUSTODIAN_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, charlie, PC_AUDITOR_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, dan, PV_APPRAISER2_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, dan, BUZZ, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, eve, PV_AUDITOR_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, eve, PC_AUDITOR_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, frank, PC_CUSTODIAN_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, george, PC_CUSTODIAN_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });

      const eths = await this.plotManager.getSubmissionFee(Currency.ETH, this.contour);

      // Alice obtains a package token
      let res = await this.plotManager.submitApplication(
        this.contour,
        this.heights,
        0,
        this.credentials,
        this.ledgerIdentifier,
        0,
        {
          from: alice,
          value: eths
        }
      );
      this.aId = res.logs[0].args.id;

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.spaceTokenId = res.spaceTokenId;

      await this.plotManager.lockApplicationForReview(this.aId, FOO, { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, BAR, { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, BUZZ, { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      await this.plotManager.claimSpaceToken(this.aId, { from: alice });
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
    });

    describe('without current custodians exist', () => {
      describe('#submit() by an applicant', () => {
        it('should allow an applicant pay commission in ETH', async function() {
          let res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.SUBMITTED);
        });

        it('should reject applications if chosen custodian is invalid', async function() {
          await assertRevert(
            this.plotCustodianManager.submit(this.spaceTokenId, Action.DETACH, [dan], 0, {
              from: alice,
              value: ether(20)
            })
          );
        });

        describe('payable', () => {
          it('should reject applications without payment', async function() {
            await assertRevert(
              this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob], 0, {
                from: alice
              })
            );
          });

          it('should reject applications with payment which less than required', async function() {
            await assertRevert(
              this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob], 0, {
                from: alice,
                value: 10
              })
            );
          });

          it('should allow applications with payment greater than required', async function() {
            await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob], 0, {
              from: alice,
              value: ether(23)
            });
          });

          it('should calculate corresponding oracle and galtspace rewards', async function() {
            let res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob], 0, {
              from: alice,
              value: ether(7)
            });
            this.aId = res.logs[0].args.id;
            // oracle share - 67%
            // galtspace share - 33%

            res = await this.plotCustodianManagerWeb3.methods.getApplicationRewards(this.aId).call();

            assert.equal(res.galtSpaceReward, '2310000000000000000');
            assert.equal(res.oraclesReward, '4690000000000000000');
            assert.equal(res.totalCustodiansReward, '2814000000000000000');
            assert.equal(res.auditorReward, '1876000000000000000');
          });
        });
      });

      describe('#accept() by a modifying custodian', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, charlie], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
        });

        it('should allow custodians accepting a submitted application', async function() {
          await this.plotCustodianManager.accept(this.aId, { from: bob });

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.SUBMITTED);
          assert.sameMembers(res.custodiansToModify, [bob, charlie]);
          assert.sameMembers(res.acceptedCustodians, [bob]);
          assert.sameMembers(res.lockedCustodians, []);

          await this.plotCustodianManager.accept(this.aId, { from: charlie });

          // bypasses ACCEPTED status since current custodian array size is 0
          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.LOCKED);
          assert.sameMembers(res.custodiansToModify, [bob, charlie]);
          assert.sameMembers(res.acceptedCustodians, [bob, charlie]);
          assert.sameMembers(res.lockedCustodians, []);
        });

        it('should deny a non-chosen custodian accepting an  application', async function() {
          await assertRevert(this.plotCustodianManager.accept(this.aId, { from: dan }));
        });

        it('should deny non-custodian accepting an application', async function() {
          await assertRevert(this.plotCustodianManager.accept(this.aId, { from: alice }));
        });
      });

      describe('#revert() by a new custodian', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, charlie], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
        });

        it('should allow custodian revert application if he wont work with it', async function() {
          await this.plotCustodianManager.revert(this.aId, { from: bob });

          const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.REVERTED);
        });

        it('should deny a non-chosen custodian reverting an  application', async function() {
          await assertRevert(this.plotCustodianManager.revert(this.aId, { from: dan }));
        });

        it('should deny double revert of the same application', async function() {
          await this.plotCustodianManager.revert(this.aId, { from: bob });
          await assertRevert(this.plotCustodianManager.revert(this.aId, { from: bob }));
        });

        it('should deny non-custodian revert an application', async function() {
          await assertRevert(this.plotCustodianManager.revert(this.aId, { from: alice }));
        });
      });

      describe('#resubmit() by an applicant', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, charlie], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.revert(this.aId, { from: bob });
        });

        it('should allow an applicant to resubmit an application with the same payload', async function() {
          await this.plotCustodianManager.resubmit(this.aId, this.spaceTokenId, Action.ATTACH, [bob], {
            from: alice
          });

          const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.SUBMITTED);
          assert.sameMembers(res.custodiansToModify, [bob]);
          assert.sameMembers(res.acceptedCustodians, []);
          assert.sameMembers(res.lockedCustodians, []);
        });

        it('should allow an applicant to resubmit an application with different payload', async function() {
          await this.plotCustodianManager.resubmit(this.aId, this.spaceTokenId, Action.ATTACH, [charlie, frank], {
            from: alice
          });

          const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.SUBMITTED);
          assert.equal(res.action, Action.ATTACH);

          assert.sameMembers(res.custodiansToModify, [charlie, frank]);
          assert.sameMembers(res.acceptedCustodians, []);
          assert.sameMembers(res.lockedCustodians, []);
        });

        it('should deny a non-applicant resubmitting an  application', async function() {
          await assertRevert(
            this.plotCustodianManager.resubmit(this.aId, this.spaceTokenId, Action.DETACH, [charlie], {
              from: charlie
            })
          );
        });
      });

      describe('#attachToken() by an applicant', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, charlie], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
        });

        it('should allow an applicant attaching package token to the application', async function() {
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, {
            from: alice
          });

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.REVIEW);

          res = await this.spaceToken.ownerOf(this.spaceTokenId);
          assert.equal(res, this.plotCustodianManager.address);
        });

        it('should deny a non-oracle attaching token to an application', async function() {
          await assertRevert(this.plotCustodianManager.attachToken(this.aId, { from: charlie }));
        });
      });

      describe('#attachDocuments() by a custodian', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, charlie], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, {
            from: alice
          });
        });

        it('should allow a custodian attaching documents to an application', async function() {
          await this.plotCustodianManager.attachDocuments(
            this.aId,
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            {
              from: bob
            }
          );

          const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.REVIEW);
          assert.sameMembers(res.custodianDocuments.map(galt.bytes32ToIpfsHash), this.attachedDocuments);
        });

        it('should deny a non-custodian of the application attaching documents to it', async function() {
          await assertRevert(
            this.plotCustodianManager.attachDocuments(this.aId, this.attachedDocuments.map(galt.ipfsHashToBytes32), {
              from: dan
            })
          );
        });
      });

      describe('#audotirLock() by an auditor', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, charlie], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
        });

        describe('with attached token', () => {
          beforeEach(async function() {
            await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
            await this.plotCustodianManager.attachToken(this.aId, {
              from: alice
            });
          });

          it('should allow an auditor locking the application', async function() {
            await this.plotCustodianManager.auditorLock(this.aId, {
              from: eve
            });

            const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
            assert.equal(res.status, applicationStatus.REVIEW);
            assert.equal(res.auditor, eve);
          });

          it('should deny a non-auditor locking the application', async function() {
            await assertRevert(
              this.plotCustodianManager.auditorLock(this.aId, {
                from: dan
              })
            );
          });
        });

        it('should deny an auditor locking the application in non-REVIEW status', async function() {
          await assertRevert(
            this.plotCustodianManager.auditorLock(this.aId, {
              from: eve
            })
          );
        });
      });

      describe('#approve() by 4 of 4 (applicant, custodian and auditors)', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, charlie], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });
        });

        it('should change application status to APPROVED if all 3 roles voted', async function() {
          let res = await this.plotCustodianManagerWeb3.methods.getApplicationVoting(this.aId).call();
          assert.equal(res.approveCount, 0);
          assert.equal(res.required, 4);
          assert.sameMembers(res.voters.map(v => v), [alice, bob, charlie, eve]);

          await this.plotCustodianManager.approve(this.aId, { from: charlie });
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: bob });
          await this.plotCustodianManager.approve(this.aId, { from: alice });

          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.APPROVED);

          res = await this.plotCustodianManagerWeb3.methods.getApplicationVoting(this.aId).call();
          assert.equal(res.approveCount, 4);
          assert.equal(res.required, 4);
          assert.sameMembers(res.voters.map(v => v), [alice, bob, charlie, eve]);

          res = await this.spaceCustodianRegistryWeb3.methods.spaceCustodians(this.spaceTokenId).call();
          assert.sameMembers(res, [bob, charlie]);
        });

        it('should keep application status in REVIEW if not all participants voted yet', async function() {
          await this.plotCustodianManager.approve(this.aId, { from: bob });
          await this.plotCustodianManager.approve(this.aId, { from: alice });

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.REVIEW);

          res = await this.plotCustodianManagerWeb3.methods.getApplicationVoting(this.aId).call();
          assert.equal(res.approveCount, 2);
          assert.equal(res.required, 4);
        });
      });

      describe('#reject() by custodian', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, charlie], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });
        });

        it('should change application status to REJECTED', async function() {
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: alice });
          await this.plotCustodianManager.reject(this.aId, 'fix it', { from: bob });

          const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.REJECTED);
        });

        it('should deny non-custodian perform this action', async function() {
          await assertRevert(this.plotCustodianManager.reject(this.aId, 'fix it', { from: eve }));

          const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.REVIEW);
        });
      });

      describe('#withdrawToken() by an applicant', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, charlie], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });

          await this.plotCustodianManager.approve(this.aId, { from: charlie });
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: bob });
          await this.plotCustodianManager.approve(this.aId, { from: alice });
        });

        it('should allow an applicant withdraw the attached token', async function() {
          await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.COMPLETED);

          res = await this.spaceToken.ownerOf(this.spaceTokenId);
          assert.equal(res, alice);
        });

        it('should deny non-applicant withdraw the token', async function() {
          await assertRevert(this.plotCustodianManager.withdrawToken(this.aId, { from: eve }));

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.APPROVED);

          res = await this.spaceToken.ownerOf(this.spaceTokenId);
          assert.equal(res, this.plotCustodianManager.address);
        });
      });

      describe('#close() by an applicant', () => {
        beforeEach(async function() {
          let res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, charlie], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;

          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });

          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.LOCKED);
        });

        describe('when application status is LOCKED', () => {
          it('should allow an applicant close the application', async function() {
            await this.plotCustodianManager.close(this.aId, { from: alice });

            const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
            assert.equal(res.status, applicationStatus.CLOSED);
          });

          it('should deny non-applicant closing the application', async function() {
            await assertRevert(this.plotCustodianManager.close(this.aId, { from: eve }));
          });
        });

        describe('when application status is REJECTED', () => {
          beforeEach(async function() {
            await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
            await this.plotCustodianManager.attachToken(this.aId, {
              from: alice
            });
            await this.plotCustodianManager.auditorLock(this.aId, { from: eve });
            await this.plotCustodianManager.approve(this.aId, { from: eve });
            await this.plotCustodianManager.approve(this.aId, { from: alice });
            await this.plotCustodianManager.reject(this.aId, 'fix it', { from: bob });
          });

          it('should allow an applicant to close the application', async function() {
            await this.plotCustodianManager.close(this.aId, { from: alice });

            let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
            assert.equal(res.status, applicationStatus.CLOSED);

            res = await this.spaceToken.ownerOf(this.spaceTokenId);
            assert.equal(res, alice);
          });

          it('should deny non-applicant closing the application', async function() {
            await assertRevert(this.plotCustodianManager.close(this.aId, { from: eve }));
          });
        });
      });

      describe('claim reward', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, charlie], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });

          await this.plotCustodianManager.approve(this.aId, { from: charlie });
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: alice });
        });

        describe('for COMPLETED applications', () => {
          beforeEach(async function() {
            await this.plotCustodianManager.approve(this.aId, { from: bob });
            await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });
          });

          it('should be allowed', async function() {
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
            assert.equal(res.status, applicationStatus.COMPLETED);

            res = await this.plotCustodianManagerWeb3.methods.getApplicationRewards(this.aId).call();
            assert.equal(res.galtSpaceRewardPaidOut, true);
            assert.equal(res.auditorRewardPaidOut, true);

            res = await this.plotCustodianManagerWeb3.methods.getApplicationCustodian(this.aId, bob).call();
            assert.equal(res.approved, true);
            assert.equal(res.rewardPaidOut, true);
            assert.equal(res.involved, true);

            res = await this.plotCustodianManagerWeb3.methods.getApplicationCustodian(this.aId, charlie).call();
            assert.equal(res.approved, true);
            assert.equal(res.rewardPaidOut, false);
            assert.equal(res.involved, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
            const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
            const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
            const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
            const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            const res = await this.plotCustodianManagerWeb3.methods.getApplicationRewards(this.aId).call();

            assert.equal(res.galtSpaceReward, 2310000000000000000);
            assert.equal(res.oraclesReward, 4690000000000000000);
            assert.equal(res.totalCustodiansReward, 2814000000000000000);
            assert.equal(res.custodianReward, 938000000000000000);
            assert.equal(res.auditorReward, 1876000000000000000);
            assert.equal(res.galtSpaceRewardPaidOut, true);
            assert.equal(res.auditorRewardPaidOut, true);

            assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(0.938));
            assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(1.876));
            assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(2.31));
          });

          it('should revert on double claim', async function() {
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: eve }));
            await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
          });

          it('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          it('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: alice }));
          });
        });

        describe('for CLOSED applications', () => {
          beforeEach(async function() {
            await this.plotCustodianManager.reject(this.aId, 'fix it', { from: bob });
            await this.plotCustodianManager.close(this.aId, { from: alice });
          });

          it('should be allowed', async function() {
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
            assert.equal(res.status, applicationStatus.CLOSED);

            res = await this.plotCustodianManagerWeb3.methods.getApplicationRewards(this.aId).call();
            assert.equal(res.galtSpaceRewardPaidOut, true);
            assert.equal(res.auditorRewardPaidOut, true);

            res = await this.plotCustodianManagerWeb3.methods.getApplicationCustodian(this.aId, bob).call();
            assert.equal(res.approved, false);
            assert.equal(res.rewardPaidOut, true);
            assert.equal(res.involved, true);

            res = await this.plotCustodianManagerWeb3.methods.getApplicationCustodian(this.aId, charlie).call();
            assert.equal(res.approved, true);
            assert.equal(res.rewardPaidOut, false);
            assert.equal(res.involved, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
            const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
            const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
            const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
            const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            const res = await this.plotCustodianManagerWeb3.methods.getApplicationRewards(this.aId).call();

            assert.equal(res.galtSpaceReward, 2310000000000000000);
            assert.equal(res.oraclesReward, 4690000000000000000);
            assert.equal(res.totalCustodiansReward, 2814000000000000000);
            assert.equal(res.custodianReward, 938000000000000000);
            assert.equal(res.auditorReward, 1876000000000000000);
            assert.equal(res.galtSpaceRewardPaidOut, true);
            assert.equal(res.auditorRewardPaidOut, true);

            assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(0.938));
            assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(1.876));
            assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(2.31));
          });

          it('should revert on double claim', async function() {
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: eve }));
            await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
          });

          it('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          it('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: alice }));
          });
        });
      });
    });

    describe('with current custodians exist', () => {
      beforeEach(async function() {
        await this.spaceCustodianRegistry.attach(this.spaceTokenId, [charlie, frank], { from: manualCustodianManager });
        const res = await this.spaceCustodianRegistryWeb3.methods.spaceCustodians(this.spaceTokenId).call();
        assert.sameMembers(res, [charlie, frank]);
      });

      describe('attach', () => {
        describe('#submit()', () => {
          it('should deny attaching existing custodians', async function() {
            await assertRevert(
              this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, frank], 0, {
                from: alice,
                value: ether(7)
              })
            );
          });

          it('should allow submitting non existing custodians', async function() {
            await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, george], 0, {
              from: alice,
              value: ether(7)
            });
          });
        });

        it('should allow simple pipeline', async function() {
          let res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.ATTACH, [bob, george], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: george });
          await this.plotCustodianManager.lock(this.aId, { from: charlie });
          await this.plotCustodianManager.lock(this.aId, { from: frank });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });

          await this.plotCustodianManager.approve(this.aId, { from: charlie });
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: alice });
          await this.plotCustodianManager.approve(this.aId, { from: bob });

          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.REVIEW);

          await this.plotCustodianManager.approve(this.aId, { from: george });
          await this.plotCustodianManager.approve(this.aId, { from: frank });

          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.APPROVED);

          res = await this.spaceCustodianRegistryWeb3.methods.spaceCustodians(this.spaceTokenId).call();
          assert.sameMembers(res, [charlie, frank, bob, george]);
        });
      });

      describe('detach', () => {
        describe('#submit()', () => {
          it('should deny detaching non-existing custodians', async function() {
            await assertRevert(
              this.plotCustodianManager.submit(this.spaceTokenId, Action.DETACH, [bob, frank], 0, {
                from: alice,
                value: ether(7)
              })
            );
          });

          it('should allow detaching existing custodians', async function() {
            const res = await this.spaceCustodianRegistryWeb3.methods.spaceCustodians(this.spaceTokenId).call();
            assert.sameMembers(res, [charlie, frank]);
            await this.plotCustodianManager.submit(this.spaceTokenId, Action.DETACH, [charlie, frank], 0, {
              from: alice,
              value: ether(7)
            });
          });
        });

        it('should allow simple pipeline', async function() {
          await this.spaceCustodianRegistry.attach(this.spaceTokenId, [bob, george], { from: manualCustodianManager });
          let res = await this.spaceCustodianRegistryWeb3.methods.spaceCustodians(this.spaceTokenId).call();
          assert.sameMembers(res, [charlie, frank, bob, george]);

          // Now there are 4 custodians: [charlie, frank, bob, george]
          res = await this.plotCustodianManager.submit(this.spaceTokenId, Action.DETACH, [charlie, george], 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;

          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.SUBMITTED);

          await this.plotCustodianManager.accept(this.aId, { from: george });
          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.ACCEPTED);

          await this.plotCustodianManager.lock(this.aId, { from: charlie });
          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.ACCEPTED);

          await this.plotCustodianManager.lock(this.aId, { from: george });
          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.ACCEPTED);

          await this.plotCustodianManager.lock(this.aId, { from: bob });
          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.ACCEPTED);

          await this.plotCustodianManager.lock(this.aId, { from: frank });
          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.LOCKED);

          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });

          await this.plotCustodianManager.approve(this.aId, { from: charlie });
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: alice });
          await this.plotCustodianManager.approve(this.aId, { from: bob });

          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.REVIEW);

          await this.plotCustodianManager.approve(this.aId, { from: george });
          await this.plotCustodianManager.approve(this.aId, { from: frank });

          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, applicationStatus.APPROVED);

          res = await this.spaceCustodianRegistryWeb3.methods.spaceCustodians(this.spaceTokenId).call();
          assert.sameMembers(res, [frank, bob]);
        });
      });
    });
  });
});
