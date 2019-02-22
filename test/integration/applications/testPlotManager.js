const PlotManager = artifacts.require('./PlotManager.sol');
const PlotManagerLib = artifacts.require('./PlotManagerLib.sol');
const PlotManagerFeeCalculator = artifacts.require('./PlotManagerFeeCalculator.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const Geodesic = artifacts.require('./MockGeodesic.sol');
const Web3 = require('web3');
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  initHelperArtifacts,
  ether,
  assertEthBalanceChanged,
  assertEqualBN,
  assertRevert,
  zeroAddress,
  deploySplitMerge,
  clearLibCache
} = require('../../helpers');

const web3 = new Web3(PlotManager.web3.currentProvider);
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const bytes32 = utf8ToHex;

const NEW_APPLICATION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const ANOTHER_APPLICATION = '0x2baf79c183ad5c683c3f4ffdffdd719a123a402f9474acde6ca3060ac1e46095';

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
const FRANK = bytes32('Frank');
const DOG = bytes32('dog');
const CAT = bytes32('cat');
const HUMAN = bytes32('human');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const ApplicationStatus = {
  NOT_EXISTS: 0,
  SUBMITTED: 1,
  APPROVED: 2,
  REJECTED: 3,
  REVERTED: 4,
  CLOSED: 5
};

const ValidationStatus = {
  NOT_EXISTS: 0,
  PENDING: 1,
  LOCKED: 2,
  APPROVED: 3,
  REJECTED: 4,
  REVERTED: 5
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

/**
 * Alice is an applicant
 * Bob is a validator
 */
contract('PlotManager', accounts => {
  before(clearLibCache);
  const [
    coreTeam,
    galtSpaceOrg,
    feeManager,
    multiSigX,
    stakesNotifier,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank
  ] = accounts;

  beforeEach(async function() {
    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initContour2 = ['dddd', 'bbbb', 'cccc'];
    this.initContour3 = ['qqqq', 'wwww', 'eeee'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.contour2 = this.initContour2.map(galt.geohashToNumber);
    this.contour3 = this.initContour3.map(galt.geohashToNumber);
    this.heights = [1, 2, 3];
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);
    this.description = 'test description';

    this.plotManagerLib = await PlotManagerLib.new({ from: coreTeam });
    PlotManager.link('PlotManagerLib', this.plotManagerLib.address);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.geodesicMock = await Geodesic.new({ from: coreTeam });

    this.splitMerge = await deploySplitMerge(this.spaceToken.address);
    this.feeCalculator = await PlotManagerFeeCalculator.new({ from: coreTeam });

    await this.plotManager.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.oracles.address,
      this.galtToken.address,
      this.geodesicMock.address,
      this.feeCalculator.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.splitMerge.initialize(this.spaceToken.address, { from: coreTeam });
    await this.plotManager.addRoleTo(feeManager, await this.plotManager.ROLE_FEE_MANAGER(), {
      from: coreTeam
    });

    await this.plotManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotManager.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.splitMerge.addRoleTo(this.plotManager.address, await this.splitMerge.GEO_DATA_MANAGER());

    await this.spaceToken.addRoleTo(this.plotManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.oracles.addRoleTo(coreTeam, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(coreTeam, await this.oracles.ROLE_ORACLE_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(coreTeam, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(coreTeam, await this.oracles.ROLE_GALT_SHARE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(stakesNotifier, await this.oracles.ROLE_ORACLE_STAKES_NOTIFIER(), {
      from: coreTeam
    });

    await this.plotManager.addRoleTo(galtSpaceOrg, await this.plotManager.ROLE_GALT_SPACE(), {
      from: coreTeam
    });

    await this.oracles.setOracleTypeMinimalDeposit(FOO, ether(30), { from: coreTeam });
    await this.oracles.setOracleTypeMinimalDeposit(BAR, ether(30), { from: coreTeam });
    await this.oracles.setOracleTypeMinimalDeposit(BUZZ, ether(30), { from: coreTeam });
    await this.oracles.setOracleTypeMinimalDeposit(HUMAN, ether(30), { from: coreTeam });
    await this.oracles.setOracleTypeMinimalDeposit(DOG, ether(30), { from: coreTeam });
    await this.oracles.setOracleTypeMinimalDeposit(CAT, ether(30), { from: coreTeam });
    await this.oracles.setOracleTypeMinimalDeposit(bytes32('🦋'), ether(30), { from: coreTeam });
    await this.oracles.setOracleTypeMinimalDeposit(bytes32('🦆'), ether(30), { from: coreTeam });
    await this.oracles.setOracleTypeMinimalDeposit(bytes32('🦄'), ether(30), { from: coreTeam });

    await this.galtToken.mint(alice, ether(10000000000), { from: coreTeam });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.galtTokenWeb3 = new web3.eth.Contract(this.galtToken.abi, this.galtToken.address);

    const res = await this.plotManager.feeCalculator();
    assert.equal(res, this.feeCalculator.address);
  });

  it('should be initialized successfully', async function() {
    assert.equal(await this.plotManagerWeb3.methods.minimalApplicationFeeInEth().call(), ether(6));
  });

  describe('contract config modifiers', () => {
    describe('#setGaltSpaceRewardsAddress()', () => {
      it('should allow an galt space oracle type set rewards address', async function() {
        await this.plotManager.setGaltSpaceRewardsAddress(bob, { from: galtSpaceOrg });
        // const res = await web3.eth.getStorageAt(this.plotManager.address, 5);
        // assert.equal(res, bob);
      });

      it('should deny any other than a fee manager account set rewards address', async function() {
        await assertRevert(this.plotManager.setGaltSpaceRewardsAddress(bob, { from: alice }));
      });
    });

    describe('#setPaymentMethod()', () => {
      it('should allow a fee manager set a payment method', async function() {
        await this.plotManager.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: feeManager });
        const res = await this.plotManager.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_ONLY);
      });

      it('should deny any other than a fee manager account set a payment method', async function() {
        await assertRevert(this.plotManager.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: coreTeam }));
        const res = await this.plotManager.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_AND_GALT);
      });
    });

    describe('#setMinimalApplicationFeeInEth()', () => {
      it('should allow a fee manager set a new minimum fee in ETH', async function() {
        await this.plotManager.setMinimalApplicationFeeInEth(ether(0.05), { from: feeManager });
        const res = await this.plotManager.minimalApplicationFeeInEth();
        assert.equal(res, ether(0.05));
      });

      it('should deny any other than a fee manager account set fee in ETH', async function() {
        await assertRevert(this.plotManager.setMinimalApplicationFeeInEth(ether(0.05), { from: coreTeam }));
      });
    });

    describe('#setMinimalApplicationFeeInGalt()', () => {
      it('should allow a fee manager set a new minimum fee in GALT', async function() {
        await this.plotManager.setMinimalApplicationFeeInGalt(ether(0.15), { from: feeManager });
        const res = await this.plotManager.minimalApplicationFeeInGalt();
        assert.equal(res, ether(0.15));
      });

      it('should deny any other than a fee manager account set fee in GALT', async function() {
        await assertRevert(this.plotManager.setMinimalApplicationFeeInGalt(ether(0.15), { from: coreTeam }));
      });
    });

    describe('#setGaltSpaceEthShare()', () => {
      it('should allow fee manager set galtSpace ETH share in percents', async function() {
        await this.plotManager.setGaltSpaceEthShare('42', { from: feeManager });
        const res = await this.plotManager.galtSpaceEthShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny fee manager set Galt Space EHT share grater than 100 percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceEthShare('101', { from: feeManager }));
      });

      it('should deny any other than a fee manager account set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceEthShare('20', { from: coreTeam }));
      });
    });

    describe('#setGaltSpaceGaltShare()', () => {
      it('should allow a fee manager set galtSpace Galt share in percents', async function() {
        await this.plotManager.setGaltSpaceGaltShare('42', { from: feeManager });
        const res = await this.plotManager.galtSpaceGaltShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny a fee manager set Galt Space Galt share grater than 100 percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceGaltShare('101', { from: feeManager }));
      });

      it('should deny any other than a fee manager account set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceGaltShare('20', { from: coreTeam }));
      });
    });
  });

  describe('application pipeline for GALT payment method', () => {
    beforeEach(async function() {
      this.resAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        [bytes32('🦄'), bytes32('🦆'), bytes32('🦋')],
        [25, 30, 45],
        [_ES, _ES, _ES],
        { from: coreTeam }
      );

      await this.geodesicMock.calculateContourArea(this.contour);
      const area = await this.geodesicMock.getContourArea(this.contour);
      assert.equal(area.toString(10), ether(3000).toString(10));
      this.fee = await this.plotManager.getSubmissionFeeByArea(Currency.GALT, area);
      assert.equal(this.fee, ether(15));
      await this.galtToken.approve(this.plotManager.address, this.fee, { from: alice });

      const res = await this.plotManager.submitApplication(
        this.contour,
        this.heights,
        0,
        0,
        this.credentials,
        this.ledgerIdentifier,
        this.description,
        this.fee,
        {
          from: alice
        }
      );

      this.aId = res.logs[0].args.id;
      assert.notEqual(this.aId, undefined);
    });

    describe('#submitApplication() Galt', () => {
      it('should provide methods to create and read an application', async function() {
        const res2 = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        const res3 = await this.splitMerge.getPackageContour(
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        // assertions
        for (let i = 0; i < res3.length; i++) {
          assert.equal(res3[i].toString(10), this.initContour[i]);
        }

        assert.equal(res2.status, 1);
        assert.equal(res2.applicant, alice);
        assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
        assert.equal(res2.description, this.description);
      });
    });

    describe('#submitApplication() with area calculated by geodesic contract', () => {
      beforeEach(async function() {
        this.fee = ether(26);
        await this.galtToken.approve(this.plotManager.address, this.fee, { from: alice });
      });

      it('should submit applications in galt', async function() {
        await this.plotManager.submitApplication(
          this.contour,
          this.heights,
          0,
          0,
          this.credentials,
          this.ledgerIdentifier,
          this.description,
          this.fee,
          { from: alice, value: this.deposit }
        );
      });

      describe('payable', () => {
        it('should split fee between GaltSpace and Oracle', async function() {
          const res = await this.plotManager.submitApplication(
            this.contour,
            this.heights,
            0,
            0,
            this.credentials,
            this.ledgerIdentifier,
            this.description,
            this.fee,
            { from: alice }
          );
          this.aId = res.logs[0].args.id;
          const res4 = await this.plotManagerWeb3.methods.getApplicationFees(this.aId).call();
          assert.equal(res4.currency, Currency.GALT);
          assert.equal(res4.oraclesReward, '22620000000000000000');
          assert.equal(res4.galtSpaceReward, '3380000000000000000');
        });

        it('should reject fees less than returned from getter', async function() {
          await assertRevert(
            this.plotManager.submitApplication(
              this.contour,
              this.heights,
              0,
              0,
              this.credentials,
              this.ledgerIdentifier,
              this.description,
              // expect minimum is 20
              ether(10),
              { from: alice, value: this.deposit }
            )
          );
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          await this.oracles.deleteApplicationType(NEW_APPLICATION, { from: coreTeam });
          this.resAddRoles = await this.oracles.setApplicationTypeOracleTypes(
            NEW_APPLICATION,
            [CAT, DOG, HUMAN],
            [52, 47, 1],
            [_ES, _ES, _ES],
            { from: coreTeam }
          );

          const expectedFee = ether(26);
          await this.galtToken.approve(this.plotManager.address, expectedFee, { from: alice });
          let res = await this.plotManager.submitApplication(
            this.contour,
            this.heights,
            0,
            0,
            this.credentials,
            this.ledgerIdentifier,
            this.description,
            expectedFee,
            { from: alice }
          );
          const aId = res.logs[0].args.id;

          res = await this.plotManagerWeb3.methods.getApplicationFees(aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
          assert.equal(res.currency, Currency.GALT);

          assert.equal(res.oraclesReward, 22620000000000000000);
          assert.equal(res.galtSpaceReward, 3380000000000000000);

          res = await this.plotManagerWeb3.methods.getApplicationById(aId).call();
          assert.sameMembers(res.assignedOracleTypes.map(hexToUtf8), [CAT, DOG, HUMAN].map(hexToUtf8));

          res = await this.plotManagerWeb3.methods.getApplicationOracle(aId, CAT).call();
          assert.equal(res.reward.toString(), '11762400000000000000');

          res = await this.plotManagerWeb3.methods.getApplicationOracle(aId, DOG).call();
          assert.equal(res.reward.toString(), '10631400000000000000');

          res = await this.plotManagerWeb3.methods.getApplicationOracle(aId, HUMAN).call();
          assert.equal(res.reward.toString(), '226200000000000000');
        });
      });
    });

    describe('#submitApplication() with area provided by the applicant', () => {
      beforeEach(async function() {
        this.fee = await this.plotManager.getSubmissionFeeByArea(Currency.GALT, ether(600));
        assert.equal(this.fee, ether(5));

        await this.galtToken.approve(this.plotManager.address, this.fee, { from: alice });

        await this.galtToken.approve(this.plotManager.address, this.fee, { from: alice });
      });

      it('should submit applications in galt', async function() {
        await this.plotManager.submitApplication(
          this.contour,
          this.heights,
          0,
          600,
          this.credentials,
          this.ledgerIdentifier,
          this.description,
          ether(5),
          { from: alice }
        );
      });
    });

    describe('#closeApplication()', () => {
      describe('with status REVERTED', () => {
        it('should change status to CLOSED', async function() {
          await this.oracles.addOracle(multiSigX, charlie, CHARLIE, MN, '', [], [bytes32('🦄')], { from: coreTeam });
          await this.oracles.addOracle(multiSigX, dan, DAN, MN, '', [], [bytes32('🦆')], { from: coreTeam });
          await this.oracles.addOracle(multiSigX, eve, EVE, MN, '', [], [bytes32('🦋')], { from: coreTeam });

          await this.oracles.onOracleStakeChanged(charlie, bytes32('🦄'), ether(30), {
            from: stakesNotifier
          });
          await this.oracles.onOracleStakeChanged(dan, bytes32('🦆'), ether(30), { from: stakesNotifier });
          await this.oracles.onOracleStakeChanged(eve, bytes32('🦋'), ether(30), { from: stakesNotifier });

          await this.plotManager.lockApplicationForReview(this.aId, bytes32('🦄'), { from: charlie });
          await this.plotManager.lockApplicationForReview(this.aId, bytes32('🦆'), { from: dan });
          await this.plotManager.lockApplicationForReview(this.aId, bytes32('🦋'), { from: eve });
          await this.plotManager.revertApplication(this.aId, 'dont like it', { from: charlie });
          await this.plotManager.closeApplication(this.aId, { from: alice });

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.CLOSED);
        });
      });
    });

    describe('#resubmitApplication()', () => {
      beforeEach(async function() {
        await this.oracles.deleteApplicationType(NEW_APPLICATION, { from: coreTeam });
        this.resAddRoles = await this.oracles.setApplicationTypeOracleTypes(
          NEW_APPLICATION,
          [CAT, DOG, HUMAN],
          [52, 47, 1],
          [_ES, _ES, _ES],
          { from: coreTeam }
        );
        await this.oracles.addOracle(multiSigX, bob, BOB, MN, '', [], [HUMAN], { from: coreTeam });
        await this.oracles.addOracle(multiSigX, charlie, CHARLIE, MN, '', [], [HUMAN], { from: coreTeam });

        await this.oracles.addOracle(multiSigX, dan, DAN, MN, '', [], [CAT], { from: coreTeam });
        await this.oracles.addOracle(multiSigX, eve, EVE, MN, '', [], [DOG], { from: coreTeam });

        await this.oracles.onOracleStakeChanged(bob, HUMAN, ether(30), { from: stakesNotifier });
        await this.oracles.onOracleStakeChanged(charlie, HUMAN, ether(30), { from: stakesNotifier });
        await this.oracles.onOracleStakeChanged(dan, CAT, ether(30), { from: stakesNotifier });
        await this.oracles.onOracleStakeChanged(eve, DOG, ether(30), { from: stakesNotifier });

        await this.geodesicMock.calculateContourArea(this.contour);
        const area = await this.geodesicMock.getContourArea(this.contour);
        assert.equal(area.toString(10), ether(3000).toString(10));
        this.fee = await this.plotManager.getSubmissionFeeByArea(Currency.GALT, area);
        assert.equal(this.fee, ether(15));

        await this.galtToken.approve(this.plotManager.address, ether(15), { from: alice });
        const res = await this.plotManager.submitApplication(
          this.contour,
          this.heights,
          0,
          0,
          this.credentials,
          this.ledgerIdentifier,
          this.description,
          // expect minimum is 20
          ether(15),
          { from: alice }
        );
        this.aId = res.logs[0].args.id;

        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, DOG, { from: eve });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });
        await this.plotManager.revertApplication(this.aId, 'blah', { from: bob });
      });

      describe('contour changed', () => {
        beforeEach(async function() {
          this.newContour = ['sezu112c', 'sezu113b1', 'sezu114', 'sezu116'].map(galt.geohashToGeohash5);
          await this.geodesicMock.calculateContourArea(this.newContour);
          const area = await this.geodesicMock.getContourArea(this.newContour);
          assert.equal(area.toString(10), ether(4000).toString(10));
          this.fee = await this.plotManager.getResubmissionFeeByArea(this.aId, area);

          await this.galtToken.approve(this.plotManager.address, this.fee, { from: alice });
        });

        it('should require another payment', async function() {
          assert.equal(this.fee, ether(5));
          await this.plotManager.resubmitApplication(
            this.aId,
            this.credentials,
            this.ledgerIdentifier,
            this.description,
            this.newContour,
            this.heights,
            9,
            0,
            this.fee,
            { from: alice }
          );

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
        });

        it('should reject on payment both in ETH and GALT', async function() {
          await assertRevert(
            this.plotManager.resubmitApplication(
              this.aId,
              this.credentials,
              this.ledgerIdentifier,
              this.description,
              this.newContour,
              this.heights,
              9,
              0,
              this.fee,
              { from: alice, value: '123' }
            )
          );

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.REVERTED);
        });

        it('should not require additional payment when fee is less than previous onw', async function() {
          const smallerContour = ['sezu112c', 'sezu113b1'].map(galt.geohashToGeohash5);
          await this.geodesicMock.calculateContourArea(smallerContour);
          const area = await this.geodesicMock.getContourArea(smallerContour);
          assert.equal(area.toString(10), ether(2000).toString(10));
          const fee = await this.plotManager.getResubmissionFeeByArea(this.aId, area);
          assert.equal(fee, 0);

          await this.plotManager.resubmitApplication(
            this.aId,
            this.credentials,
            this.ledgerIdentifier,
            this.description,
            smallerContour,
            this.heights,
            9,
            0,
            0,
            { from: alice }
          );

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
        });
      });

      it('should change old details data with a new', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.credentialsHash, this.credentials);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));

        const newCredentiasHash = web3.utils.keccak256('AnotherPerson');
        const newLedgerIdentifier = bytes32('foo-123');
        const newDescripton = 'new-test-description';

        await this.plotManager.resubmitApplication(
          this.aId,
          newCredentiasHash,
          newLedgerIdentifier,
          newDescripton,
          [],
          [],
          9,
          0,
          0,
          {
            from: alice
          }
        );

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.credentialsHash, newCredentiasHash);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
        assert.equal(res.description, newDescripton);
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.oracles.deleteApplicationType(NEW_APPLICATION);
        this.resAddRoles = await this.oracles.setApplicationTypeOracleTypes(
          NEW_APPLICATION,
          [HUMAN, DOG, CAT],
          [50, 25, 25],
          [_ES, _ES, _ES],
          { from: coreTeam }
        );

        // const expectedFee = await this.plotManager.getSubmissionFee(Currency.GALT, this.contour);
        this.fee = ether(20);
        await this.galtToken.approve(this.plotManager.address, this.fee, { from: alice });
        let res = await this.plotManager.submitApplication(
          this.contour,
          this.heights,
          0,
          0,
          this.credentials,
          this.ledgerIdentifier,
          this.description,
          this.fee,
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.id;

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.oracles.addOracle(multiSigX, bob, BOB, MN, '', [], [HUMAN], { from: coreTeam });
        await this.oracles.addOracle(multiSigX, charlie, CHARLIE, MN, '', [], [HUMAN], { from: coreTeam });

        await this.oracles.addOracle(multiSigX, dan, DAN, MN, '', [], [CAT], { from: coreTeam });
        await this.oracles.addOracle(multiSigX, eve, EVE, MN, '', [], [DOG], { from: coreTeam });

        await this.oracles.onOracleStakeChanged(bob, HUMAN, ether(30), { from: stakesNotifier });
        await this.oracles.onOracleStakeChanged(charlie, HUMAN, ether(30), { from: stakesNotifier });
        await this.oracles.onOracleStakeChanged(dan, CAT, ether(30), { from: stakesNotifier });
        await this.oracles.onOracleStakeChanged(eve, DOG, ether(30), { from: stakesNotifier });

        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, DOG, { from: eve });
      });

      describe('on approve', () => {
        beforeEach(async function() {
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString(10));
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString(10));

          await this.plotManager.claimOracleReward(this.aId, { from: bob });
          await this.plotManager.claimOracleReward(this.aId, { from: dan });
          await this.plotManager.claimOracleReward(this.aId, { from: eve });
          await this.plotManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString(10));
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString(10));

          const res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
          assert.equal(res.reward.toString(), '8700000000000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('8700000000000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('4350000000000000000')));
          assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('4350000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('2600000000000000000')));
        });
      });

      describe('on reject', () => {
        beforeEach(async function() {
          await this.plotManager.rejectApplication(this.aId, 'malicious', { from: bob });
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString(10));
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString(10));

          await this.plotManager.claimOracleReward(this.aId, { from: bob });
          await this.plotManager.claimOracleReward(this.aId, { from: dan });
          await this.plotManager.claimOracleReward(this.aId, { from: eve });
          await this.plotManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString(10));
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString(10));

          const res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
          assert.equal(res.reward.toString(), '8700000000000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('8700000000000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('4350000000000000000')));
          assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('4350000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('2600000000000000000')));
        });
      });

      describe('on close', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.plotManager.revertApplication(this.aId, this.credentials, { from: bob });
          await this.plotManager.closeApplication(this.aId, { from: alice });

          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString(10));
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

          await this.plotManager.claimOracleReward(this.aId, { from: bob });
          await this.plotManager.claimOracleReward(this.aId, { from: dan });
          await this.plotManager.claimOracleReward(this.aId, { from: eve });
          await this.plotManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString(10));
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString(10));

          const res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
          assert.equal(res.reward.toString(), '8700000000000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('8700000000000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('4350000000000000000')));
          assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('4350000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('2600000000000000000')));
        });
      });
    });
  });

  describe('application pipeline for ETH', () => {
    beforeEach(async function() {
      this.resAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        [HUMAN, DOG, CAT],
        [50, 25, 25],
        [_ES, _ES, _ES],
        { from: coreTeam }
      );

      await this.geodesicMock.calculateContourArea(this.contour);
      const area = await this.geodesicMock.getContourArea(this.contour);
      assert.equal(area.toString(10), ether(3000).toString(10));
      const expectedFee = await this.plotManager.getSubmissionFeeByArea(Currency.ETH, area);
      assert.equal(expectedFee, ether(1.5));
      this.fee = ether(2);
      await this.galtToken.approve(this.plotManager.address, this.fee, { from: alice });

      let res = await this.plotManager.submitApplication(
        this.contour,
        this.heights,
        0,
        0,
        this.credentials,
        this.ledgerIdentifier,
        this.description,
        0,
        {
          from: alice,
          value: this.fee
        }
      );

      this.aId = res.logs[0].args.id;

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.packageTokenId = res.packageTokenId;
      assert.equal(res.status, ApplicationStatus.SUBMITTED);

      await this.oracles.addOracle(multiSigX, bob, BOB, MN, '', [], [HUMAN], { from: coreTeam });
      await this.oracles.addOracle(multiSigX, charlie, CHARLIE, MN, '', [], [HUMAN], { from: coreTeam });

      await this.oracles.addOracle(multiSigX, dan, DAN, MN, '', [], [CAT], { from: coreTeam });
      await this.oracles.addOracle(multiSigX, eve, EVE, MN, '', [], [DOG], { from: coreTeam });

      await this.oracles.onOracleStakeChanged(bob, HUMAN, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(charlie, HUMAN, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(dan, CAT, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(eve, DOG, ether(30), { from: stakesNotifier });
    });

    describe('#submitApplication()', () => {
      it('should provide methods to create and read an application', async function() {
        const res2 = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        const res3 = await this.splitMerge.getPackageContour(
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        // assertions
        for (let i = 0; i < res3.length; i++) {
          assert.equal(res3[i].toString(10), this.initContour[i]);
        }

        assert.equal(res2.status, 1);
        assert.equal(res2.applicant, alice);
        assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(
            this.plotManager.submitApplication(
              this.contour,
              this.heights,
              0,
              0,
              this.credentials,
              this.ledgerIdentifier,
              this.description,
              0,
              {
                from: alice,
                value: 0
              }
            )
          );
        });

        it('should reject applications with payment less than required', async function() {
          await assertRevert(
            this.plotManager.submitApplication(
              this.contour,
              this.heights,
              0,
              0,
              this.credentials,
              this.ledgerIdentifier,
              this.description,
              0,
              {
                from: alice,
                value: ether(1)
              }
            )
          );
        });

        it('should calculate corresponding oracle and coreTeam rewards in Eth', async function() {
          const res = await this.plotManagerWeb3.methods.getApplicationFees(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
          assert.equal(res.oraclesReward, 1340000000000000000);
          assert.equal(res.galtSpaceReward, 660000000000000000);
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          let res = await this.plotManagerWeb3.methods.getApplicationFees(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
          assert.equal(res.currency, Currency.ETH);
          assert.equal(res.oraclesReward, 1340000000000000000);

          res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(res.assignedOracleTypes.map(hexToUtf8), [CAT, DOG, HUMAN].map(hexToUtf8));

          // 50%
          res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
          assert.equal(res.reward.toString(), '670000000000000000');

          // 25%
          res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
          assert.equal(res.reward.toString(), '335000000000000000');

          // 25%
          res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
          assert.equal(res.reward.toString(), '335000000000000000');
        });
      });
    });

    describe('#closeApplication()', () => {
      describe('for applications paid by ETH', () => {
        describe('with status REVERTED', () => {
          it('should change status to CLOSED', async function() {
            await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
            await this.plotManager.lockApplicationForReview(this.aId, CAT, { from: dan });
            await this.plotManager.lockApplicationForReview(this.aId, DOG, { from: eve });
            await this.plotManager.revertApplication(this.aId, 'dont like it', { from: bob });

            let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
            assert.equal(res.status, ApplicationStatus.REVERTED);

            await this.plotManager.closeApplication(this.aId, { from: alice });

            res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
            assert.equal(res.status, ApplicationStatus.CLOSED);
          });
        });
      });
    });

    describe('#resubmitApplication()', () => {
      beforeEach(async function() {
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, DOG, { from: eve });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });
        await this.plotManager.revertApplication(this.aId, 'blah', { from: bob });
      });

      it('should change old details data with a new', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.credentialsHash, this.credentials);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));

        const newCredentiasHash = web3.utils.keccak256('AnotherPerson');
        const newLedgerIdentifier = bytes32('foo-123');

        await this.plotManager.resubmitApplication(
          this.aId,
          newCredentiasHash,
          newLedgerIdentifier,
          this.description,
          [],
          [],
          9,
          0,
          0,
          {
            from: alice
          }
        );

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.credentialsHash, newCredentiasHash);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
      });

      it('should revert if additional payment required', async function() {
        let res = await this.plotManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);

        // NOTICE: for 1.5 eth required we have already 2 eth paid as a fee
        const newCredentiasHash = web3.utils.keccak256('AnotherPerson');
        const newLedgerIdentifier = bytes32('foo-123');
        const newContour = ['sezu1', 'sezu2', 'sezu3', 'sezu4', 'sezu5'].map(galt.geohashToNumber);

        await this.geodesicMock.calculateContourArea(newContour);
        const area = await this.geodesicMock.getContourArea(newContour);
        assert.equal(area.toString(10), ether(5000).toString(10));
        const fee = await this.plotManager.getResubmissionFeeByArea(this.aId, area);
        assert.equal(fee, ether(0.5));

        await assertRevert(
          this.plotManager.resubmitApplication(
            this.aId,
            newCredentiasHash,
            newLedgerIdentifier,
            this.description,
            newContour,
            [],
            9,
            0,
            0,
            {
              from: alice
            }
          )
        );

        await this.plotManager.resubmitApplication(
          this.aId,
          newCredentiasHash,
          newLedgerIdentifier,
          this.description,
          newContour,
          [],
          9,
          0,
          0,
          {
            from: alice,
            value: ether(0.6)
          }
        );

        res = await this.plotManager.getApplicationById(this.aId);
        assert.equal(res.credentialsHash, newCredentiasHash);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
      });

      it('should allow submit reverted application to the same oracle who reverted it', async function() {
        await this.plotManager.resubmitApplication(
          this.aId,
          this.credentials,
          this.ledgerIdentifier,
          this.description,
          [],
          [],
          9,
          0,
          0,
          {
            from: alice
          }
        );

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
        assert.equal(res.oracle, eve);
        assert.equal(res.status, ValidationStatus.LOCKED);
      });

      describe('when countour changed', () => {
        beforeEach(async function() {
          this.newContour = ['sezu112c', 'sezu113b1', 'sezu114'].map(galt.geohashToGeohash5);
        });
      });
    });

    describe('#lockApplicationForReview()', () => {
      it('should allow multiple oracles of different roles to lock a submitted application', async function() {
        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, CAT, { from: dan });

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
        assert.equal(res.oracle, zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      // eslint-disable-next-line
      it("should deny a oracle with the same role to lock an application which is already on consideration", async function() {
        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await assertRevert(this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: charlie }));
      });

      it('should push an application id to the oracles list for caching', async function() {
        let res = await this.plotManager.submitApplication(
          this.contour,
          this.heights,
          0,
          0,
          this.credentials,
          this.ledgerIdentifier,
          this.description,
          0,
          {
            from: charlie,
            value: ether(2)
          }
        );
        const a1Id = res.logs[0].args.id;

        // lock first
        await this.plotManager.lockApplicationForReview(a1Id, HUMAN, { from: bob });

        // submit second
        res = await this.plotManager.submitApplication(
          this.contour,
          this.heights,
          0,
          0,
          this.credentials,
          this.ledgerIdentifier,
          this.description,
          0,
          {
            from: charlie,
            value: ether(2)
          }
        );
        const a2Id = res.logs[0].args.id;

        // lock second
        await this.plotManager.lockApplicationForReview(a2Id, HUMAN, { from: bob });

        res = await this.plotManager.getApplicationsByOracle(bob);
        assert.equal(res.length, 2);
        assert.equal(res[0], a1Id);
        assert.equal(res[1], a2Id);
      });

      it('should deny oracle to lock an application which is already approved', async function() {
        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, DOG, { from: eve });

        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });

        await assertRevert(this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: charlie }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      it('should deny non-oracle to lock an application', async function() {
        await assertRevert(this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: coreTeam }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });
    });

    describe.skip('#resetApplicationRole()', () => {
      beforeEach(async function() {
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
      });

      it('should should allow a contract owner to unlock an application under consideration', async function() {
        await this.plotManager.resetApplicationRole(this.aId, HUMAN, { from: coreTeam });

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
        assert.equal(res.oracle, zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      it('should deny non-owner to unlock an application under consideration', async function() {
        await assertRevert(this.plotManager.resetApplicationRole(this.aId, HUMAN, { from: charlie }));

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);
      });
    });

    describe('#approveApplication()', () => {
      beforeEach(async function() {
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, DOG, { from: eve });
      });

      it('should allow a oracle approve application', async function() {
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      // eslint-disable-next-line
      it("should mint a pack, geohash, swap the geohash into the pack and keep it at PlotManager address", async function() {
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });

        let res = await this.spaceToken.totalSupply();
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.balanceOf(this.plotManager.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.ownerOf('0x0000000000000000000000000000000000000000000000000000000000000000');
        assert.equal(res, this.plotManager.address);
      });

      it('should deny a oracle approve application if hash doesnt match', async function() {
        await assertRevert(this.plotManager.approveApplication(this.aId, web3.utils.sha3(`foo`), { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny non-oracle approve application', async function() {
        await assertRevert(this.plotManager.approveApplication(this.aId, this.credentials, { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      // eslint-disable-next-line
      it("should deny oracle whose role doesnt present in application type to approve application", async function() {
        await this.oracles.setApplicationTypeOracleTypes(
          ANOTHER_APPLICATION,
          [FOO, BAR, BUZZ],
          [50, 25, 25],
          [_ES, _ES, _ES],
          { from: coreTeam }
        );

        await this.oracles.addOracle(multiSigX, frank, FRANK, MN, '', [], [FOO], { from: coreTeam });

        await this.oracles.onOracleStakeChanged(frank, FOO, ether(30), { from: stakesNotifier });
        await assertRevert(this.plotManager.approveApplication(this.aId, this.credentials, { from: frank }));
      });

      // eslint-disable-next-line
      it("should deny oracle approve application with other than consideration or partially locked status", async function() {
        await this.plotManager.rejectApplication(this.aId, 'suspicious', { from: bob });

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REJECTED);

        await assertRevert(this.plotManager.approveApplication(this.aId, this.credentials, { from: bob }));
        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });
    });

    describe('#revertApplication()', () => {
      beforeEach(async function() {
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, DOG, { from: eve });
      });

      it('should allow a oracle revert application', async function() {
        await this.plotManager.revertApplication(this.aId, 'it looks suspicious', { from: bob });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      // eslint-disable-next-line
      it("should deny another assigned oracle revert application after it was already reverted", async function() {
        await this.plotManager.revertApplication(this.aId, 'it looks suspicious', { from: bob });
        await assertRevert(this.plotManager.revertApplication(this.aId, 'blah', { from: dan }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should not reset validation statuses of another oracles', async function() {
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
        await this.plotManager.revertApplication(this.aId, 'it looks suspicious', { from: eve });

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.APPROVED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
        assert.equal(res.oracle, eve);
        assert.equal(res.status, ValidationStatus.REVERTED);
      });

      it('should deny non-oracle revert application', async function() {
        await assertRevert(this.plotManager.revertApplication(this.aId, 'blah', { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny oracle revert an application with non-consideration status', async function() {
        await this.plotManager.rejectApplication(this.aId, 'suspicious', { from: bob });

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REJECTED);

        await assertRevert(this.plotManager.revertApplication(this.aId, 'blah', { from: bob }));
        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });
    });

    describe('#rejectApplication()', () => {
      beforeEach(async function() {
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, DOG, { from: eve });
      });

      it('should allow a oracle reject application', async function() {
        await this.plotManager.rejectApplication(this.aId, 'my reason', { from: bob });
        // TODO: check the message

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REJECTED);

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.REJECTED);
        assert.equal(res.message, 'my reason');

        res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);
        assert.equal(res.message, '');
      });

      it('should deny non-oracle reject application', async function() {
        await assertRevert(this.plotManager.rejectApplication(this.aId, 'hey', { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny oracle revert an application with non-submitted status', async function() {
        await this.plotManager.revertApplication(this.aId, 'some reason', { from: bob });
        await assertRevert(this.plotManager.rejectApplication(this.aId, 'another reason', { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });
    });

    describe('#claimSpaceToken()', () => {
      beforeEach(async function() {
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, DOG, { from: eve });

        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });
      });

      // eslint-disable-next-line
      it('should transfer SpaceToken to the applicant', async function() {
        await this.plotManager.claimSpaceToken(this.aId, { from: alice });

        let res = await this.spaceToken.totalSupply();
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.balanceOf(this.plotManager.address);
        assert.equal(res.toString(), 0);
        res = await this.spaceToken.balanceOf(alice);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.ownerOf('0x0000000000000000000000000000000000000000000000000000000000000000');
        assert.equal(res, alice);
      });

      it('should NOT transfer SpaceToken to non-applicant', async function() {
        await assertRevert(this.plotManager.claimSpaceToken(this.aId, { from: bob }));
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, DOG, { from: eve });
      });

      describe('on approve', () => {
        beforeEach(async function() {
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = await web3.eth.getBalance(bob);
          const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
          const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          await this.plotManager.claimOracleReward(this.aId, { from: bob });
          await this.plotManager.claimOracleReward(this.aId, { from: dan });
          await this.plotManager.claimOracleReward(this.aId, { from: eve });
          await this.plotManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = await web3.eth.getBalance(bob);
          const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
          const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          let res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
          assert.equal(res.reward.toString(), '670000000000000000');
          res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
          assert.equal(res.reward.toString(), '335000000000000000');
          res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
          assert.equal(res.reward.toString(), '335000000000000000');

          res = await this.plotManagerWeb3.methods.getApplicationFees(this.aId).call();
          assert.equal(res.galtSpaceReward.toString(), '660000000000000000');

          assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(0.67));
          assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(0.335));
          assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(0.335));
          assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(0.66));
        });
      });

      describe('on reject', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.plotManager.rejectApplication(this.aId, this.credentials, { from: bob });

          const bobsInitialBalance = await web3.eth.getBalance(bob);
          const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
          const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          await this.plotManager.claimOracleReward(this.aId, { from: bob });
          await this.plotManager.claimOracleReward(this.aId, { from: dan });
          await this.plotManager.claimOracleReward(this.aId, { from: eve });
          await this.plotManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = await web3.eth.getBalance(bob);
          const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
          const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          let res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
          assert.equal(res.reward.toString(), '670000000000000000');
          res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
          assert.equal(res.reward.toString(), '335000000000000000');
          res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
          assert.equal(res.reward.toString(), '335000000000000000');

          res = await this.plotManagerWeb3.methods.getApplicationFees(this.aId).call();
          assert.equal(res.galtSpaceReward.toString(), '660000000000000000');

          assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(0.67));
          assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(0.335));
          assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(0.335));
          assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(0.66));
        });
      });

      describe('on reject', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.plotManager.revertApplication(this.aId, 'dont like it', { from: bob });
          await this.plotManager.closeApplication(this.aId, { from: alice });

          const bobsInitialBalance = await web3.eth.getBalance(bob);
          const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
          const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          await this.plotManager.claimOracleReward(this.aId, { from: bob });
          await this.plotManager.claimOracleReward(this.aId, { from: dan });
          await this.plotManager.claimOracleReward(this.aId, { from: eve });
          await this.plotManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = await web3.eth.getBalance(bob);
          const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
          const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          let res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
          assert.equal(res.reward.toString(), '670000000000000000');
          res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
          assert.equal(res.reward.toString(), '335000000000000000');
          res = await this.plotManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
          assert.equal(res.reward.toString(), '335000000000000000');

          res = await this.plotManagerWeb3.methods.getApplicationFees(this.aId).call();
          assert.equal(res.galtSpaceReward.toString(), '660000000000000000');

          assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(0.67));
          assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(0.335));
          assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(0.335));
          assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(0.66));
        });
      });
    });
  });
});
