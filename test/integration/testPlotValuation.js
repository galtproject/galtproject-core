const PlotManager = artifacts.require('./PlotManager.sol');
const PlotManagerLib = artifacts.require('./PlotManagerLib.sol');
const PlotValuation = artifacts.require('./PlotValuation.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const Web3 = require('web3');
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  initHelperArtifacts,
  ether,
  assertGaltBalanceChanged,
  assertRevert,
  zeroAddress,
  deploySplitMerge,
  clearLibCache
} = require('../helpers');

const web3 = new Web3(PlotValuation.web3.currentProvider);
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const bytes32 = utf8ToHex;

const NEW_APPLICATION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const VALUATION_APPLICATION = '0x619647f9036acf2e8ad4ea6c06ae7256e68496af59818a2b63e51b27a46624e9';

const PV_APPRAISER_ORACLE_TYPE = bytes32('PV_APPRAISER_ORACLE_TYPE');
const PV_APPRAISER2_ORACLE_TYPE = bytes32('PV_APPRAISER2_ORACLE_TYPE');
const PV_AUDITOR_ORACLE_TYPE = bytes32('PV_AUDITOR_ORACLE_TYPE');

const FOO = bytes32('foo');
const BAR = bytes32('bar');
const BUZZ = bytes32('buzz');
// eslint-disable-next-line no-underscore-dangle
const _ES = bytes32('');
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');
const EVE = bytes32('Eve');
const DOG = bytes32('dog');
const CAT = bytes32('cat');
const HUMAN = bytes32('human');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const ApplicationStatus = {
  NOT_EXISTS: 0,
  SUBMITTED: 1,
  VALUATED: 2,
  CONFIRMED: 3,
  REVERTED: 4,
  APPROVED: 5
};

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

Object.freeze(ApplicationStatus);
Object.freeze(ValidationStatus);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

// eslint-disable-next-line
contract('PlotValuation', (accounts) => {
  before(clearLibCache);
  const [
    coreTeam,
    galtSpaceOrg,
    feeManager,
    multiSigX,
    stakesNotifier,
    applicationTypeManager,
    oracleManager,
    alice,
    bob,
    charlie,
    dan,
    eve
  ] = accounts;

  beforeEach(async function() {
    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';
    this.attachedDocuments = [
      '0xa80470dba00d5faf620fd6c51a1ca94668e13cd66fffaee3702f5497a8549053',
      '0xe96a061ac2a6eeb4a87eecdba4624500b6eae61e18c64ff0672434d3ae137825',
      '0x9850d829b57b233101525397603baedc32d20288a866514dd5441abe286f4d2e'
    ];

    this.heights = [1, 2, 3];
    this.contour = this.initContour.map(galt.geohashToNumber);
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.plotManagerLib = await PlotManagerLib.new({ from: coreTeam });
    PlotManager.link('PlotManagerLib', this.plotManagerLib.address);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.plotValuation = await PlotValuation.new({ from: coreTeam });
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

    await this.splitMerge.addRoleTo(this.plotManager.address, await this.splitMerge.GEO_DATA_MANAGER());

    await this.plotManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotManager.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.plotValuation.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotValuation.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotValuation.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotValuation.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.spaceToken.addRoleTo(this.plotManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.oracles.addRoleTo(stakesNotifier, await this.oracles.ROLE_ORACLE_STAKES_NOTIFIER(), {
      from: coreTeam
    });

    await this.oracles.setOracleTypeMinimalDeposit(FOO, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(BAR, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(BUZZ, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(HUMAN, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(DOG, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(CAT, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(PV_APPRAISER_ORACLE_TYPE, ether(30), {
      from: applicationTypeManager
    });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.plotValuationWeb3 = new web3.eth.Contract(this.plotValuation.abi, this.plotValuation.address);
    this.galtTokenWeb3 = new web3.eth.Contract(this.galtToken.abi, this.galtToken.address);
  });

  it('should be initialized successfully', async function() {
    assert.equal(await this.plotValuationWeb3.methods.minimalApplicationFeeInEth().call(), ether(6));
  });

  describe('contract config modifiers', () => {
    describe('#setGaltSpaceRewardsAddress()', () => {
      it('should allow an galt space oracle type set rewards address', async function() {
        await this.plotValuation.setGaltSpaceRewardsAddress(bob, { from: galtSpaceOrg });
        // const res = await web3.eth.getStorageAt(this.plotValuation.address, 5);
        // assert.equal(res, bob);
      });

      it('should deny non-galt space oracle type set rewards address', async function() {
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
        [_ES, _ES, _ES],
        { from: applicationTypeManager }
      );

      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        VALUATION_APPLICATION,
        [PV_APPRAISER_ORACLE_TYPE, PV_APPRAISER2_ORACLE_TYPE, PV_AUDITOR_ORACLE_TYPE],
        [50, 25, 25],
        [_ES, _ES, _ES],
        { from: applicationTypeManager }
      );

      await this.oracles.addOracle(multiSigX, bob, BOB, MN, [], [PV_APPRAISER_ORACLE_TYPE, FOO], {
        from: oracleManager
      });
      await this.oracles.addOracle(multiSigX, charlie, CHARLIE, MN, [], [BAR], { from: oracleManager });
      await this.oracles.addOracle(multiSigX, dan, DAN, MN, [], [PV_APPRAISER2_ORACLE_TYPE, BUZZ], {
        from: oracleManager
      });
      await this.oracles.addOracle(multiSigX, eve, EVE, MN, [], [PV_AUDITOR_ORACLE_TYPE], { from: oracleManager });

      await this.oracles.onOracleStakeChanged(multiSigX, bob, PV_APPRAISER_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, bob, FOO, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, charlie, BAR, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, dan, PV_APPRAISER2_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, dan, BUZZ, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, eve, PV_AUDITOR_ORACLE_TYPE, ether(30), {
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
    });

    describe('#submitApplication()', () => {
      beforeEach(async () => {});

      it('should allow an applicant pay commission in Galt', async function() {
        await this.galtToken.approve(this.plotValuation.address, ether(45), { from: alice });
        let res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, ether(45), {
          from: alice
        });
        this.aId = res.logs[0].args.id;

        res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();

        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications without neither payment', async function() {
          await this.galtToken.approve(this.plotValuation.address, ether(45), { from: alice });
          await assertRevert(
            this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await this.galtToken.approve(this.plotValuation.address, ether(45), { from: alice });
          await assertRevert(
            this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, ether(43), {
              from: alice
            })
          );
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          await this.galtToken.approve(this.plotValuation.address, ether(47), { from: alice });
          let res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, ether(47), {
            from: alice
          });
          this.aId = res.logs[0].args.id;

          // oracle share - 87%
          // galtspace share - 13%

          res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.oraclesReward, '40890000000000000000');
          assert.equal(res.galtSpaceReward, '6110000000000000000');
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          await this.galtToken.approve(this.plotValuation.address, ether(47), { from: alice });
          let res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, ether(47), {
            from: alice
          });
          this.aId = res.logs[0].args.id;

          // oracle share - 87% (50%/25%/25%)
          // galtspace share - 13%

          res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(
            res.assignedOracleTypes.map(hexToUtf8),
            [PV_APPRAISER_ORACLE_TYPE, PV_APPRAISER2_ORACLE_TYPE, PV_AUDITOR_ORACLE_TYPE].map(hexToUtf8)
          );

          res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_APPRAISER2_ORACLE_TYPE).call();
          assert.equal(res.reward.toString(), '10222500000000000000');

          res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_AUDITOR_ORACLE_TYPE).call();
          assert.equal(res.reward.toString(), '10222500000000000000');

          res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_APPRAISER_ORACLE_TYPE).call();
          assert.equal(res.reward.toString(), '20445000000000000000');
        });
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.plotValuation.address, ether(57), { from: alice });
        const res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, ether(57), {
          from: alice
        });
        this.aId = res.logs[0].args.id;
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ORACLE_TYPE, { from: bob });
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER2_ORACLE_TYPE, { from: dan });
        await this.plotValuation.lockApplication(this.aId, PV_AUDITOR_ORACLE_TYPE, { from: eve });
        await this.plotValuation.valuatePlot(this.aId, ether(4500), { from: bob });
        await this.plotValuation.valuatePlot2(this.aId, ether(4500), { from: dan });
        await this.plotValuation.approveValuation(this.aId, { from: eve });
      });

      it('should be allowed', async function() {
        await this.plotValuation.claimOracleReward(this.aId, { from: bob });
        await this.plotValuation.claimOracleReward(this.aId, { from: dan });
        await this.plotValuation.claimOracleReward(this.aId, { from: eve });
        await this.plotValuation.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

        let res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);
        assert.equal(res.galtSpaceRewardPaidOut, true);

        res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_APPRAISER_ORACLE_TYPE).call();
        assert.equal(res.rewardPaidOut, true);

        res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_APPRAISER2_ORACLE_TYPE).call();
        assert.equal(res.rewardPaidOut, true);

        res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_AUDITOR_ORACLE_TYPE).call();
        assert.equal(res.rewardPaidOut, true);
      });

      it('should send funds to claimers', async function() {
        const bobsInitialBalance = await this.galtTokenWeb3.methods.balanceOf(bob).call();
        const dansInitialBalance = await this.galtTokenWeb3.methods.balanceOf(dan).call();
        const evesInitialBalance = await this.galtTokenWeb3.methods.balanceOf(eve).call();
        const orgsInitialBalance = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();

        await this.plotValuation.claimOracleReward(this.aId, { from: bob });
        await this.plotValuation.claimOracleReward(this.aId, { from: dan });
        await this.plotValuation.claimOracleReward(this.aId, { from: eve });
        await this.plotValuation.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

        const bobsFinalBalance = await this.galtTokenWeb3.methods.balanceOf(bob).call();
        const dansFinalBalance = await this.galtTokenWeb3.methods.balanceOf(dan).call();
        const evesFinalBalance = await this.galtTokenWeb3.methods.balanceOf(eve).call();
        const orgsFinalBalance = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();

        const res = await this.plotValuationWeb3.methods
          .getApplicationOracle(this.aId, PV_APPRAISER_ORACLE_TYPE)
          .call();
        assert.equal(res.reward.toString(), '24795000000000000000');

        // bobs fee is (100 - 13) / 100 * 57 ether * 50%  = 24795000000000000000 wei

        assertGaltBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(24.795));
        assertGaltBalanceChanged(dansInitialBalance, dansFinalBalance, ether(12.3975));
        assertGaltBalanceChanged(evesInitialBalance, evesFinalBalance, ether(12.3975));
        assertGaltBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(7.41));
      });

      it('should revert on double claim', async function() {
        await this.plotValuation.claimOracleReward(this.aId, { from: bob });
        await this.plotValuation.claimOracleReward(this.aId, { from: dan });
        await this.plotValuation.claimOracleReward(this.aId, { from: eve });
        await this.plotValuation.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
        await assertRevert(this.plotValuation.claimOracleReward(this.aId, { from: bob }));
        await assertRevert(this.plotValuation.claimOracleReward(this.aId, { from: dan }));
        await assertRevert(this.plotValuation.claimOracleReward(this.aId, { from: eve }));
        await assertRevert(this.plotValuation.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
      });

      it('should revert on non-oracle claim', async function() {
        await assertRevert(this.plotValuation.claimOracleReward(this.aId, { from: alice }));
        await assertRevert(this.plotValuation.claimGaltSpaceReward(this.aId, { from: bob }));
      });

      it('should revert on applicant claim attempt', async function() {
        await assertRevert(this.plotValuation.claimOracleReward(this.aId, { from: alice }));
        await assertRevert(this.plotValuation.claimGaltSpaceReward(this.aId, { from: alice }));
      });
    });
  });

  describe('application pipeline for ETH', () => {
    beforeEach(async function() {
      this.resNewAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        [FOO, BAR, BUZZ],
        [50, 25, 25],
        [_ES, _ES, _ES],
        { from: applicationTypeManager }
      );

      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        VALUATION_APPLICATION,
        [PV_APPRAISER_ORACLE_TYPE, PV_APPRAISER2_ORACLE_TYPE, PV_AUDITOR_ORACLE_TYPE],
        [50, 25, 25],
        [_ES, _ES, _ES],
        { from: applicationTypeManager }
      );

      await this.oracles.addOracle(multiSigX, bob, BOB, MN, [], [PV_APPRAISER_ORACLE_TYPE, FOO], {
        from: oracleManager
      });
      await this.oracles.addOracle(multiSigX, charlie, CHARLIE, MN, [], [BAR], { from: oracleManager });
      await this.oracles.addOracle(multiSigX, dan, DAN, MN, [], [PV_APPRAISER2_ORACLE_TYPE, BUZZ], {
        from: oracleManager
      });
      await this.oracles.addOracle(multiSigX, eve, EVE, MN, [], [PV_AUDITOR_ORACLE_TYPE], { from: oracleManager });

      await this.oracles.onOracleStakeChanged(multiSigX, bob, PV_APPRAISER_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, bob, FOO, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, charlie, BAR, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, dan, PV_APPRAISER2_ORACLE_TYPE, ether(30), {
        from: stakesNotifier
      });
      await this.oracles.onOracleStakeChanged(multiSigX, dan, BUZZ, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(multiSigX, eve, PV_AUDITOR_ORACLE_TYPE, ether(30), {
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

    describe('#submitApplication()', () => {
      it('should allow an applicant pay commission in ETH', async function() {
        let res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
          from: alice,
          value: ether(6)
        });
        this.aId = res.logs[0].args.id;

        res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();

        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(
            this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await assertRevert(
            this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
              from: alice,
              value: 10
            })
          );
        });

        it('should allow applications with payment greater than required', async function() {
          await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
            from: alice,
            value: ether(23)
          });
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          let res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          // oracle share - 67%
          // galtspace share - 33%

          res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.galtSpaceReward, '2310000000000000000');
          assert.equal(res.oraclesReward, '4690000000000000000');
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          let res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
            from: alice,
            value: ether(13)
          });
          this.aId = res.logs[0].args.id;
          // oracle share - 67%
          // galtspace share - 33% (50%/25%/25%);

          res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(
            res.assignedOracleTypes.map(hexToUtf8),
            [PV_APPRAISER_ORACLE_TYPE, PV_APPRAISER2_ORACLE_TYPE, PV_AUDITOR_ORACLE_TYPE].map(hexToUtf8)
          );

          res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_APPRAISER_ORACLE_TYPE).call();
          assert.equal(res.reward.toString(), '4355000000000000000');

          res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_APPRAISER2_ORACLE_TYPE).call();
          assert.equal(res.reward.toString(), '2177500000000000000');

          res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_AUDITOR_ORACLE_TYPE).call();
          assert.equal(res.reward.toString(), '2177500000000000000');
        });
      });
    });

    describe('#lockApplication()', () => {
      beforeEach(async function() {
        const res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
      });

      it('should allow multiple oracles of different roles to lock a submitted application', async function() {
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ORACLE_TYPE, { from: bob });
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER2_ORACLE_TYPE, { from: dan });

        let res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_APPRAISER_ORACLE_TYPE).call();
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_APPRAISER2_ORACLE_TYPE).call();
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_AUDITOR_ORACLE_TYPE).call();
        assert.equal(res.oracle, zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      // eslint-disable-next-line
      it('should deny a oracle with the same role to lock an application which is already on consideration', async function() {
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ORACLE_TYPE, { from: bob });
        await assertRevert(this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ORACLE_TYPE, { from: charlie }));
      });

      it('should deny non-oracle lock application', async function() {
        await assertRevert(this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ORACLE_TYPE, { from: coreTeam }));
      });
    });

    describe('#valuatePlot()', () => {
      beforeEach(async function() {
        const res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ORACLE_TYPE, { from: bob });
      });

      it('should allow first appraiser valuate a submitted application', async function() {
        await this.plotValuation.valuatePlot(this.aId, ether(4500), { from: bob });

        const res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.VALUATED);
        assert.equal(res.firstValuation, ether(4500));
      });

      it('should allow first appraiser valuate a reverted application', async function() {
        await this.plotValuation.valuatePlot(this.aId, ether(4500), { from: bob });

        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER2_ORACLE_TYPE, { from: dan });
        await this.plotValuation.valuatePlot2(this.aId, ether(4502), { from: dan });

        await this.plotValuation.valuatePlot(this.aId, ether(6400), { from: bob });

        const res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.VALUATED);
        assert.equal(res.firstValuation, ether(6400));
      });

      it('should deny non-oracle valuate application', async function() {
        await assertRevert(this.plotValuation.valuatePlot(this.aId, ether(4500), { from: coreTeam }));
        const res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      // eslint-disable-next-line
      it('should deny oracle whose role doesnt present in application type to approve application', async function() {
        await assertRevert(this.plotValuation.valuatePlot(this.aId, ether(4500), { from: charlie }));
      });
    });

    describe('#valuatePlot2() by a second appraiser', () => {
      beforeEach(async function() {
        const res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ORACLE_TYPE, { from: bob });
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER2_ORACLE_TYPE, { from: dan });
        await this.plotValuation.valuatePlot(this.aId, ether(4500), { from: bob });
      });

      it('should change status to CONFIRMED when valuations match', async function() {
        await this.plotValuation.valuatePlot2(this.aId, ether(4500), { from: dan });

        const res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.CONFIRMED);
        assert.equal(res.secondValuation, ether(4500));
      });

      it('should allow a second appraiser re-valuate a reverted application', async function() {
        await this.plotValuation.valuatePlot2(this.aId, ether(6000), { from: dan });

        let res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
        assert.equal(res.firstValuation, ether(4500));
        assert.equal(res.secondValuation, ether(6000));

        await this.plotValuation.valuatePlot(this.aId, ether(6400), { from: bob });
        await this.plotValuation.valuatePlot2(this.aId, ether(6400), { from: dan });

        res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.CONFIRMED);
        assert.equal(res.firstValuation, ether(6400));
        assert.equal(res.secondValuation, ether(6400));
      });

      it('should change status to REVERTED when valuations dont match', async function() {
        await this.plotValuation.valuatePlot2(this.aId, ether(4501), { from: dan });

        const res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should deny non-oracle re-valuate a plot', async function() {
        await assertRevert(this.plotValuation.valuatePlot2(this.aId, ether(4500), { from: coreTeam }));
        const res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.VALUATED);
      });

      // eslint-disable-next-line
      it('should deny oracle whose role doesnt present in application type to re-valuate application', async function() {
        await assertRevert(this.plotValuation.valuatePlot2(this.aId, ether(4500), { from: charlie }));
      });
    });

    describe('#approveValuation() by auditor', () => {
      beforeEach(async function() {
        const res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ORACLE_TYPE, { from: bob });
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER2_ORACLE_TYPE, { from: dan });
        await this.plotValuation.valuatePlot(this.aId, ether(4500), { from: bob });
        await this.plotValuation.valuatePlot2(this.aId, ether(4500), { from: dan });
      });

      it('should change status to REVERTED when an auditor reject plot valuation', async function() {
        await this.plotValuation.lockApplication(this.aId, PV_AUDITOR_ORACLE_TYPE, { from: eve });
        await this.plotValuation.rejectValuation(this.aId, 'Fix it', { from: eve });

        const res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should change status to APPROVED when an auditor approves plot valuation', async function() {
        await this.plotValuation.lockApplication(this.aId, PV_AUDITOR_ORACLE_TYPE, { from: eve });
        await this.plotValuation.approveValuation(this.aId, { from: eve });

        const res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);
        assert.equal(res.secondValuation, ether(4500));
      });

      // eslint-disable-next-line
      it('should make a record in plotValuations mapping when an auditor approves plot valuation', async function() {
        await this.plotValuation.lockApplication(this.aId, PV_AUDITOR_ORACLE_TYPE, { from: eve });
        await this.plotValuation.approveValuation(this.aId, { from: eve });

        const res = await this.plotValuationWeb3.methods.plotValuations(this.spaceTokenId).call();
        assert.equal(res, ether(4500));
      });

      it('should deny non-auditor audit a plot', async function() {
        await assertRevert(this.plotValuation.approveValuation(this.aId, { from: coreTeam }));
        const res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.CONFIRMED);
      });

      // eslint-disable-next-line
      it('should deny oracle whose role doesnt present in application type to re-valuate application', async function() {
        await assertRevert(this.plotValuation.approveValuation(this.aId, { from: charlie }));
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        const res = await this.plotValuation.submitApplication(this.spaceTokenId, this.attachedDocuments, 0, {
          from: alice,
          value: ether(6)
        });
        this.aId = res.logs[0].args.id;
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ORACLE_TYPE, { from: bob });
        await this.plotValuation.lockApplication(this.aId, PV_APPRAISER2_ORACLE_TYPE, { from: dan });
        await this.plotValuation.lockApplication(this.aId, PV_AUDITOR_ORACLE_TYPE, { from: eve });
        await this.plotValuation.valuatePlot(this.aId, ether(4500), { from: bob });
        await this.plotValuation.valuatePlot2(this.aId, ether(4500), { from: dan });
        await this.plotValuation.approveValuation(this.aId, { from: eve });
      });

      it('should be allowed', async function() {
        await this.plotValuation.claimOracleReward(this.aId, { from: bob });
        await this.plotValuation.claimOracleReward(this.aId, { from: dan });
        await this.plotValuation.claimOracleReward(this.aId, { from: eve });
        await this.plotValuation.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

        let res = await this.plotValuationWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);
        assert.equal(res.galtSpaceRewardPaidOut, true);

        res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_APPRAISER_ORACLE_TYPE).call();
        assert.equal(res.rewardPaidOut, true);

        res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_APPRAISER2_ORACLE_TYPE).call();
        assert.equal(res.rewardPaidOut, true);

        res = await this.plotValuationWeb3.methods.getApplicationOracle(this.aId, PV_AUDITOR_ORACLE_TYPE).call();
        assert.equal(res.rewardPaidOut, true);
      });

      it('should send funds to claimers', async function() {
        const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
        const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
        const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
        const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

        await this.plotValuation.claimOracleReward(this.aId, { from: bob });
        await this.plotValuation.claimOracleReward(this.aId, { from: dan });
        await this.plotValuation.claimOracleReward(this.aId, { from: eve });
        await this.plotValuation.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

        const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
        const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
        const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
        const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

        const res = await this.plotValuationWeb3.methods
          .getApplicationOracle(this.aId, PV_APPRAISER_ORACLE_TYPE)
          .call();
        assert.equal(res.reward.toString(), '2010000000000000000');

        // eves fee is around (100 - 33) / 100 * 6 ether * 50%  = 1005000000000000000 wei
        // assume that the commission paid by bob isn't greater than 0.1 ether

        const diffBob = bobsFinalBalance
          .sub(new BN('2010000000000000000')) // <- the diff
          .sub(bobsInitialBalance)
          .add(new BN('10000000000000000')); // <- 0.01 ether

        const diffDan = dansFinalBalance
          .sub(new BN('1005000000000000000')) // <- the diff
          .sub(dansInitialBalance)
          .add(new BN('10000000000000000')); // <- 0.01 ether

        const diffEve = evesFinalBalance
          .sub(new BN('1005000000000000000')) // <- the diff
          .sub(evesInitialBalance)
          .add(new BN('10000000000000000')); // <- 0.01 ether

        const diffOrg = orgsFinalBalance
          .sub(new BN('1980000000000000000')) // <- the diff
          .sub(orgsInitialBalance)
          .add(new BN('10000000000000000')); // <- 0.01 ether

        const max = new BN('10000000000000000'); // <- 0.01 ether
        const min = new BN('0');

        // lt
        assert(
          diffBob.lt(max), // diff < 0.01 ether
          `Expected ${web3.utils.fromWei(diffBob.toString(10))} to be less than 0.01 ether`
        );

        assert(
          diffDan.lt(max), // diff < 0.01 ether
          `Expected ${web3.utils.fromWei(diffDan.toString(10))} to be less than 0.01 ether`
        );

        assert(
          diffEve.lt(max), // diff < 0.01 ether
          `Expected ${web3.utils.fromWei(diffEve.toString(10))} to be less than 0.01 ether`
        );

        assert(
          diffOrg.lt(max), // diff < 0.01 ether
          `Expected ${web3.utils.fromWei(diffOrg.toString(10))} to be less than 0.01 ether`
        );

        // gt
        assert(
          diffBob.gt(min), // diff > 0
          `Expected ${web3.utils.fromWei(diffBob.toString(10))} to be greater than 0`
        );

        assert(
          diffDan.gt(min), // diff > 0
          `Expected ${web3.utils.fromWei(diffDan.toString(10))} to be greater than 0`
        );

        assert(
          diffEve.gt(min), // diff > 0
          `Expected ${web3.utils.fromWei(diffEve.toString(10))} to be greater than 0`
        );

        assert(
          diffOrg.gt(min), // diff > 0
          `Expected ${web3.utils.fromWei(diffOrg.toString(10))} to be greater than 0`
        );
      });

      it('should revert on double claim', async function() {
        await this.plotValuation.claimOracleReward(this.aId, { from: bob });
        await this.plotValuation.claimOracleReward(this.aId, { from: dan });
        await this.plotValuation.claimOracleReward(this.aId, { from: eve });
        await this.plotValuation.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
        await assertRevert(this.plotValuation.claimOracleReward(this.aId, { from: bob }));
        await assertRevert(this.plotValuation.claimOracleReward(this.aId, { from: dan }));
        await assertRevert(this.plotValuation.claimOracleReward(this.aId, { from: eve }));
        await assertRevert(this.plotValuation.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
      });

      it('should revert on non-oracle claim', async function() {
        await assertRevert(this.plotValuation.claimOracleReward(this.aId, { from: alice }));
        await assertRevert(this.plotValuation.claimGaltSpaceReward(this.aId, { from: bob }));
      });

      it('should revert on applicant claim attempt', async function() {
        await assertRevert(this.plotValuation.claimOracleReward(this.aId, { from: alice }));
        await assertRevert(this.plotValuation.claimGaltSpaceReward(this.aId, { from: alice }));
      });
    });
  });
});
