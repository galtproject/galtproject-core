const NewPropertyManager = artifacts.require('./NewPropertyManager.sol');
const NewPropertyManagerLib = artifacts.require('./NewPropertyManagerLib.sol');
const PropertyManagerFeeCalculator = artifacts.require('./PropertyManagerFeeCalculator.sol');
const ACL = artifacts.require('./ACL.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const MockGeodesic = artifacts.require('./MockGeodesic.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const PGGOracleStakeAccounting = artifacts.require('./PGGOracleStakeAccounting.sol');
const StakeTracker = artifacts.require('./StakeTracker.sol');

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
  deploySpaceGeoData,
  addressToEvmWord,
  numberToEvmWord,
  paymentMethods,
  clearLibCache
} = require('../../helpers');
const { deployPGGFactory, buildPGG } = require('../../deploymentHelpers');

const web3 = new Web3(NewPropertyManager.web3.currentProvider);
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const bytes32 = utf8ToHex;

// eslint-disable-next-line no-underscore-dangle
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');

const PM_SURVEYOR = bytes32('PM_SURVEYOR_ORACLE_TYPE');
const PM_LAWYER = bytes32('PM_LAWYER_ORACLE_TYPE');

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

const AreaSource = {
  USER_INPUT: 0,
  CONTRACT: 1
};

Object.freeze(ApplicationStatus);
Object.freeze(ValidationStatus);
Object.freeze(PaymentMethods);
Object.freeze(Currency);
Object.freeze(AreaSource);

contract('NewPropertyManager', accounts => {
  const [
    coreTeam,
    feeMixerAddress,
    oracleModifier,
    claimManagerAddress,
    spaceReputationAccountingAddress,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank
  ] = accounts;

  before(async function() {
    clearLibCache();

    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initContour2 = ['dddd', 'bbbb', 'cccc'];
    this.initContour3 = ['qqqq', 'wwww', 'eeee'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.heights = [1, 2, 3];
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);
    this.description = 'test description';

    this.acl = await ACL.new({ from: coreTeam });
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();

    this.newPropertyManagerLib = await NewPropertyManagerLib.new({ from: coreTeam });
    this.feeCalculator = await PropertyManagerFeeCalculator.new({ from: coreTeam });

    this.geodesicMock = await MockGeodesic.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.pggRegistry = await PGGRegistry.new({ from: coreTeam });
    this.myPGGOracleStakeAccounting = await PGGOracleStakeAccounting.new(alice, { from: coreTeam });
    this.stakeTracker = await StakeTracker.new({ from: coreTeam });

    await this.pggRegistry.initialize(this.ggr.address);
    await this.stakeTracker.initialize(this.ggr.address);

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.CLAIM_MANAGER(), claimManagerAddress, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.STAKE_TRACKER(), this.stakeTracker.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_RA(), spaceReputationAccountingAddress, {
      from: coreTeam
    });

    await this.galtToken.mint(alice, ether(10000000000), { from: coreTeam });

    await this.feeRegistry.setProtocolEthShare(33, { from: coreTeam });
    await this.feeRegistry.setProtocolGaltShare(13, { from: coreTeam });

    this.pggFactory = await deployPGGFactory(this.ggr, coreTeam);

    await this.feeRegistry.setGaltFee(await this.pggFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.pggFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.pggFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });
    await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactory.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ORACLE_MODIFIER'), oracleModifier, true, { from: coreTeam });
    await this.acl.setRole(bytes32('FEE_COLLECTOR'), feeMixerAddress, true, { from: coreTeam });

    NewPropertyManager.link('NewPropertyManagerLib', this.newPropertyManagerLib.address);

    this.newPropertyManager = await NewPropertyManager.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });

    this.spaceGeoData = await deploySpaceGeoData(this.ggr);
    await this.ggr.setContract(await this.ggr.GEODESIC(), this.geodesicMock.address, { from: coreTeam });

    await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });

    const applicationConfig = {};
    applicationConfig[bytes32('PM_FEE_CALCULATOR')] = addressToEvmWord(this.feeCalculator.address, 64);
    applicationConfig[bytes32('PM_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_AND_GALT);

    // [52, 48],
    applicationConfig[await this.newPropertyManager.getOracleTypeShareKey(PM_SURVEYOR)] = numberToEvmWord(52);
    applicationConfig[await this.newPropertyManager.getOracleTypeShareKey(PM_LAWYER)] = numberToEvmWord(48);

    // Oracle minimal stake values setup
    const surveyorKey = await this.myPGGOracleStakeAccounting.oracleTypeMinimalStakeKey(PM_SURVEYOR);
    const lawyerKey = await this.myPGGOracleStakeAccounting.oracleTypeMinimalStakeKey(PM_LAWYER);

    applicationConfig[surveyorKey] = numberToEvmWord(ether(1500));
    applicationConfig[lawyerKey] = numberToEvmWord(ether(1500));

    // MultiSig setup
    this.pggX = await buildPGG(
      this.pggFactory,
      [bob, charlie, dan, eve, frank],
      3,
      7,
      10,
      60,
      ether(1000),
      [30, 30, 30, 30, 30, 30, 30, 30],
      applicationConfig,
      alice
    );

    this.mX = this.pggX.config.address;
    this.pggMultiSigX = this.pggX.multiSig;
    this.pggConfigX = this.pggX.config;
    this.oracleStakesAccountingX = this.pggX.oracleStakeAccounting;
    this.oraclesX = this.pggX.oracles;

    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_GEO_DATA(), this.spaceGeoData.address, { from: coreTeam });

    await this.newPropertyManager.initialize(this.ggr.address, {
      from: coreTeam
    });

    await this.spaceToken.addRoleTo(this.newPropertyManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.spaceGeoData.address, 'minter');
    await this.spaceToken.addRoleTo(this.spaceGeoData.address, 'operator');

    await this.oraclesX.addOracle(bob, BOB, MN, '', [], [PM_SURVEYOR], { from: oracleModifier });
    await this.oraclesX.addOracle(charlie, CHARLIE, MN, '', [], [PM_LAWYER], { from: oracleModifier });
    await this.oraclesX.addOracle(dan, DAN, MN, '', [], [PM_LAWYER], { from: oracleModifier });

    await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(10000), { from: alice });

    await this.oracleStakesAccountingX.stake(bob, PM_SURVEYOR, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(charlie, PM_LAWYER, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(dan, PM_LAWYER, ether(2000), { from: alice });
  });

  beforeEach(async function() {
    this.newPropertyManager = await NewPropertyManager.new({ from: coreTeam });
    await this.newPropertyManager.initialize(this.ggr.address, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), this.newPropertyManager.address, true, { from: coreTeam });
  });

  describe('application pipeline for GALT payment method', () => {
    before(async function() {
      await this.geodesicMock.calculateContourArea(this.contour);
      const area = await this.geodesicMock.setSpaceTokenArea(this.contour);
      assert.equal(area.toString(10), ether(3000).toString(10));
      this.fee = await this.newPropertyManager.getSubmissionFeeByArea(this.pggConfigX.address, Currency.GALT, area);
      assert.equal(this.fee, ether(15));
    });

    beforeEach(async function() {
      await this.galtToken.approve(this.newPropertyManager.address, this.fee, { from: alice });
      const res = await this.newPropertyManager.submitApplication(
        this.pggConfigX.address,
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
        const res1 = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res1.status, 1);
        assert.equal(res1.applicant, alice);
        assert.equal(parseInt(res1.createdAt, 10) > 0, true);

        const res2 = await this.newPropertyManager.getApplicationDetailsById(this.aId);
        assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
        assert.equal(res2.description, this.description);
        assert.equal(res2.areaSource, AreaSource.CONTRACT);
        assert.equal(parseInt(res2.area, 10) > 0, true);

        const res3 = await this.spaceGeoData.getSpaceTokenContour(
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        // assertions
        for (let i = 0; i < res3.length; i++) {
          assert.equal(res3[i].toString(10), this.initContour[i]);
        }
      });
    });

    describe('#submitApplication() with area calculated by geodesic contract', () => {
      beforeEach(async function() {
        this.fee = ether(26);
        await this.galtToken.approve(this.newPropertyManager.address, this.fee, { from: alice });
      });

      it('should submit applications in galt', async function() {
        await this.newPropertyManager.submitApplication(
          this.pggConfigX.address,
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
      });

      describe('payable', () => {
        it('should split fee between GaltSpace and Oracle', async function() {
          const res = await this.newPropertyManager.submitApplication(
            this.pggConfigX.address,
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
          const res4 = await this.newPropertyManager.getApplicationFees(this.aId);
          assert.equal(res4.currency, Currency.GALT);
          assert.equal(res4.oraclesReward, '22620000000000000000');
          assert.equal(res4.galtProtocolFee, '3380000000000000000');
        });

        it('should reject fees less than returned from getter', async function() {
          await assertRevert(
            this.newPropertyManager.submitApplication(
              this.pggConfigX.address,
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
          const expectedFee = ether(26);
          await this.galtToken.approve(this.newPropertyManager.address, expectedFee, { from: alice });
          let res = await this.newPropertyManager.submitApplication(
            this.pggConfigX.address,
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

          res = await this.newPropertyManager.getApplicationFees(aId);
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
          assert.equal(res.currency, Currency.GALT);

          assert.equal(res.oraclesReward, 22620000000000000000);
          assert.equal(res.galtProtocolFee, 3380000000000000000);

          res = await this.newPropertyManager.getApplicationById(aId);
          assert.sameMembers(res.assignedOracleTypes.map(hexToUtf8), [PM_SURVEYOR, PM_LAWYER].map(hexToUtf8));

          res = await this.newPropertyManager.getApplicationOracle(aId, PM_SURVEYOR);
          assert.equal(res.reward.toString(), '11762400000000000000');

          res = await this.newPropertyManager.getApplicationOracle(aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '10857600000000000000');
        });
      });
    });

    describe('#submitApplication() with area provided by the applicant', () => {
      beforeEach(async function() {
        this.fee = await this.newPropertyManager.getSubmissionFeeByArea(
          this.pggConfigX.address,
          Currency.GALT,
          ether(600)
        );
        assert.equal(this.fee, ether(5));

        await this.galtToken.approve(this.newPropertyManager.address, this.fee, { from: alice });
      });

      it('should submit applications in galt', async function() {
        await this.newPropertyManager.submitApplication(
          this.pggConfigX.address,
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
          await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
          await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });
          await this.newPropertyManager.revertApplication(this.aId, 'dont like it', { from: bob });
          await this.newPropertyManager.closeApplication(this.aId, { from: alice });

          const res = await this.newPropertyManager.getApplicationById(this.aId);
          assert.equal(res.status, ApplicationStatus.CLOSED);
        });
      });
    });

    describe('#resubmitApplication()', () => {
      beforeEach(async function() {
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });
        await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: dan });
        await this.newPropertyManager.revertApplication(this.aId, 'blah', { from: bob });
      });

      describe('contour changed', () => {
        beforeEach(async function() {
          this.newContour = ['sezu112c', 'sezu113b1', 'sezu114', 'sezu116'].map(galt.geohashToGeohash5);
          await this.geodesicMock.calculateContourArea(this.newContour);
          const area = await this.geodesicMock.setSpaceTokenArea(this.newContour);
          assert.equal(area.toString(10), ether(4000).toString(10));
          this.fee = await this.newPropertyManager.getResubmissionFeeByArea(this.aId, area);

          await this.galtToken.approve(this.newPropertyManager.address, this.fee, { from: alice });
        });

        it('should require another payment', async function() {
          assert.equal(this.fee, ether(5));
          await this.newPropertyManager.resubmitApplication(
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

          const res = await this.newPropertyManager.getApplicationById(this.aId);
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
        });

        it('should reject on payment both in ETH and GALT', async function() {
          await assertRevert(
            this.newPropertyManager.resubmitApplication(
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

          const res = await this.newPropertyManager.getApplicationById(this.aId);
          assert.equal(res.status, ApplicationStatus.REVERTED);
        });

        it('should not require additional payment when fee is less than previous onw', async function() {
          const smallerContour = ['sezu112c', 'sezu113b1'].map(galt.geohashToGeohash5);
          await this.geodesicMock.calculateContourArea(smallerContour);
          const area = await this.geodesicMock.setSpaceTokenArea(smallerContour);
          assert.equal(area.toString(10), ether(2000).toString(10));
          const fee = await this.newPropertyManager.getResubmissionFeeByArea(this.aId, area);
          assert.equal(fee, 0);

          await this.newPropertyManager.resubmitApplication(
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

          const res = await this.newPropertyManager.getApplicationById(this.aId);
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
        });
      });

      it('should change old details data with a new', async function() {
        let res = await this.newPropertyManager.getApplicationDetailsById(this.aId);
        assert.equal(res.credentialsHash, this.credentials);
        assert.equal(res.areaSource, AreaSource.CONTRACT);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));

        const newCredentiasHash = web3.utils.keccak256('AnotherPerson');
        const newLedgerIdentifier = bytes32('foo-123');
        const newDescripton = 'new-test-description';

        await this.newPropertyManager.resubmitApplication(
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

        res = await this.newPropertyManager.getApplicationDetailsById(this.aId);
        assert.equal(res.credentialsHash, newCredentiasHash);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
        assert.equal(res.areaSource, AreaSource.CONTRACT);
        assert.equal(res.description, newDescripton);
      });

      it('should change old details data with a new if fee area used', async function() {
        let res = await this.newPropertyManager.getApplicationDetailsById(this.aId);
        assert.equal(res.credentialsHash, this.credentials);
        assert.equal(res.areaSource, AreaSource.CONTRACT);
        assert.equal(parseInt(res.area, 10) > 0, true);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));

        const newCredentiasHash = web3.utils.keccak256('AnotherPerson');
        const newLedgerIdentifier = bytes32('foo-123');
        const newDescripton = 'new-test-description';

        await this.newPropertyManager.resubmitApplication(
          this.aId,
          newCredentiasHash,
          newLedgerIdentifier,
          newDescripton,
          [],
          [],
          9,
          3000,
          0,
          {
            from: alice
          }
        );

        res = await this.newPropertyManager.getApplicationDetailsById(this.aId);
        assert.equal(res.area, 3000);
        assert.equal(res.areaSource, AreaSource.USER_INPUT);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
        assert.equal(res.description, newDescripton);
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        const surveyorKey = await this.newPropertyManager.getOracleTypeShareKey(PM_SURVEYOR);
        const lawyerKey = await this.newPropertyManager.getOracleTypeShareKey(PM_LAWYER);

        let res = await this.pggConfigX.applicationConfig(surveyorKey);
        assert.equal(res, 52);
        res = await this.pggConfigX.applicationConfig(lawyerKey);
        assert.equal(res, 48);

        this.fee = ether(20);
        await this.galtToken.approve(this.newPropertyManager.address, this.fee, { from: alice });
        res = await this.newPropertyManager.submitApplication(
          this.pggConfigX.address,
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

        res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });
      });

      describe('on approve', () => {
        beforeEach(async function() {
          await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: bob });
          await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: dan });
          // TODO: add plotmanager as minter role to geodatamanager
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString(10));

          await this.newPropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.newPropertyManager.claimOracleReward(this.aId, { from: dan });
          await this.newPropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString(10));

          let res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
          assert.equal(res.reward.toString(), '9048000000000000000');
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '8352000000000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('9048000000000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('8352000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('2600000000000000000')));
        });
      });

      describe('on reject', () => {
        beforeEach(async function() {
          await this.newPropertyManager.rejectApplication(this.aId, 'malicious', { from: bob });
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString(10));

          await this.newPropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.newPropertyManager.claimOracleReward(this.aId, { from: dan });
          await this.newPropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString(10));

          const res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
          assert.equal(res.reward.toString(), '9048000000000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('9048000000000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('8352000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('2600000000000000000')));
        });
      });

      describe('on close', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.newPropertyManager.revertApplication(this.aId, this.credentials, { from: bob });
          await this.newPropertyManager.closeApplication(this.aId, { from: alice });

          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString());

          await this.newPropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.newPropertyManager.claimOracleReward(this.aId, { from: dan });
          await this.newPropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString(10));

          const res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
          assert.equal(res.reward.toString(), '9048000000000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('9048000000000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('8352000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('2600000000000000000')));
        });
      });
    });
  });

  describe('application pipeline for ETH', () => {
    before(async function() {
      await this.geodesicMock.calculateContourArea(this.contour);
      const area = await this.geodesicMock.setSpaceTokenArea(this.contour);
      assert.equal(area.toString(10), ether(3000).toString(10));
      const expectedFee = await this.newPropertyManager.getSubmissionFeeByArea(
        this.pggConfigX.address,
        Currency.ETH,
        area
      );
      assert.equal(expectedFee, ether(1.5));
      this.fee = ether(2);
    });

    beforeEach(async function() {
      await this.galtToken.approve(this.newPropertyManager.address, this.fee, { from: alice });

      let res = await this.newPropertyManager.submitApplication(
        this.pggConfigX.address,
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

      res = await this.newPropertyManager.getApplicationById(this.aId);
      this.packageTokenId = res.packageTokenId;
      assert.equal(res.status, ApplicationStatus.SUBMITTED);
    });

    describe('#submitApplication()', () => {
      it('should provide methods to create and read an application', async function() {
        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, 1);
        assert.equal(res.applicant, alice);

        res = await this.newPropertyManager.getApplicationDetailsById(this.aId);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), this.initLedgerIdentifier);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(
            this.newPropertyManager.submitApplication(
              this.pggConfigX.address,
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
            this.newPropertyManager.submitApplication(
              this.pggConfigX.address,
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
          const res = await this.newPropertyManager.getApplicationFees(this.aId);
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
          assert.equal(res.oraclesReward, 1340000000000000000);
          assert.equal(res.galtProtocolFee, 660000000000000000);
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          let res = await this.newPropertyManager.getApplicationFees(this.aId);
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
          assert.equal(res.currency, Currency.ETH);
          assert.equal(res.oraclesReward, 1340000000000000000);

          res = await this.newPropertyManager.getApplicationById(this.aId);
          assert.sameMembers(res.assignedOracleTypes.map(hexToUtf8), [PM_SURVEYOR, PM_LAWYER].map(hexToUtf8));

          // 52%
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
          assert.equal(res.reward.toString(), '696800000000000000');

          // 48%
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '643200000000000000');
        });
      });
    });

    describe('#closeApplication()', () => {
      describe('for applications paid by ETH', () => {
        describe('with status REVERTED', () => {
          it('should change status to CLOSED', async function() {
            await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
            await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });
            await this.newPropertyManager.revertApplication(this.aId, 'dont like it', { from: bob });

            let res = await this.newPropertyManager.getApplicationById(this.aId);
            assert.equal(res.status, ApplicationStatus.REVERTED);

            await this.newPropertyManager.closeApplication(this.aId, { from: alice });

            res = await this.newPropertyManager.getApplicationById(this.aId);
            assert.equal(res.status, ApplicationStatus.CLOSED);
          });
        });
      });
    });

    describe('#resubmitApplication()', () => {
      beforeEach(async function() {
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });
        await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: dan });
        await this.newPropertyManager.revertApplication(this.aId, 'blah', { from: bob });
      });

      it('should change old details data with a new', async function() {
        let res = await this.newPropertyManager.getApplicationDetailsById(this.aId);
        assert.equal(res.credentialsHash, this.credentials);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));

        const newCredentiasHash = web3.utils.keccak256('AnotherPerson');
        const newLedgerIdentifier = bytes32('foo-123');

        await this.newPropertyManager.resubmitApplication(
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

        res = await this.newPropertyManager.getApplicationDetailsById(this.aId);
        assert.equal(res.credentialsHash, newCredentiasHash);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
      });

      it('should revert if additional payment required', async function() {
        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);

        // NOTICE: for 1.5 eth required we have already 2 eth paid as a fee
        const newCredentiasHash = web3.utils.keccak256('AnotherPerson');
        const newLedgerIdentifier = bytes32('foo-123');
        const newContour = ['sezu1', 'sezu2', 'sezu3', 'sezu4', 'sezu5'].map(galt.geohashToNumber);

        await this.geodesicMock.calculateContourArea(newContour);
        const area = await this.geodesicMock.setSpaceTokenArea(newContour);
        assert.equal(area.toString(10), ether(5000).toString(10));
        const fee = await this.newPropertyManager.getResubmissionFeeByArea(this.aId, area);
        assert.equal(fee, ether(0.5));

        await assertRevert(
          this.newPropertyManager.resubmitApplication(
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

        await this.newPropertyManager.resubmitApplication(
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

        res = await this.newPropertyManager.getApplicationDetailsById(this.aId);
        assert.equal(res.credentialsHash, newCredentiasHash);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
      });

      it('should allow submit reverted application to the same oracle who reverted it', async function() {
        await this.newPropertyManager.resubmitApplication(
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

        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
        assert.equal(res.oracle, dan);
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
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });

        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);
      });

      // eslint-disable-next-line
      it("should deny a oracle with the same role to lock an application which is already on consideration", async function() {
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
        await assertRevert(this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: charlie }));
      });

      it('should push an application id to the oracles list for caching', async function() {
        let res = await this.newPropertyManager.submitApplication(
          this.pggConfigX.address,
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
        await this.newPropertyManager.lockApplicationForReview(a1Id, PM_SURVEYOR, { from: bob });

        // submit second
        res = await this.newPropertyManager.submitApplication(
          this.pggConfigX.address,
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
        await this.newPropertyManager.lockApplicationForReview(a2Id, PM_SURVEYOR, { from: bob });

        res = await this.newPropertyManager.getApplicationsByOracle(bob);
        assert.equal(res.length, 2);
        assert.equal(res[0], a1Id);
        assert.equal(res[1], a2Id);
      });

      it('should deny oracle to lock an application which is already approved', async function() {
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });

        await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: bob });
        await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: dan });

        await assertRevert(this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: charlie }));
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      it.skip('should deny non-oracle to lock an application', async function() {
        await assertRevert(this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: coreTeam }));
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });
    });

    describe('#unlock()', () => {
      beforeEach(async function() {
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
      });

      it('should should allow a contract owner to unlock an application under consideration', async function() {
        await this.newPropertyManager.unlock(this.aId, PM_SURVEYOR, { from: alice });

        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
        assert.equal(res.oracle, zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      it('should deny non-owner to unlock an application under consideration', async function() {
        await assertRevert(this.newPropertyManager.unlock(this.aId, PM_SURVEYOR, { from: charlie }));

        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);
      });
    });

    describe('#approveApplication()', () => {
      beforeEach(async function() {
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });
      });

      it('should allow a oracle approve application', async function() {
        await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: bob });

        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: dan });

        res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      // eslint-disable-next-line
      it("should mint a pack, geohash, swap the geohash into the pack and keep it at NewPropertyManager address", async function() {
        await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: bob });
        let res = await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: dan });
        const { tokenId } = res.logs[2].args;

        res = await this.spaceToken.balanceOf(this.newPropertyManager.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.ownerOf(tokenId);
        assert.equal(res, this.newPropertyManager.address);
      });

      it('should deny a oracle approve application if hash doesnt match', async function() {
        await assertRevert(this.newPropertyManager.approveApplication(this.aId, web3.utils.sha3(`foo`), { from: bob }));
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny non-oracle approve application', async function() {
        await assertRevert(this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: alice }));
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      // eslint-disable-next-line
      it("should deny oracle approve application with other than consideration or partially locked status", async function() {
        await this.newPropertyManager.rejectApplication(this.aId, 'suspicious', { from: bob });

        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);

        await assertRevert(this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: bob }));
        res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });
    });

    describe('#revertApplication()', () => {
      beforeEach(async function() {
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });
      });

      it('should allow a oracle revert application', async function() {
        await this.newPropertyManager.revertApplication(this.aId, 'it looks suspicious', { from: bob });
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      // eslint-disable-next-line
      it("should deny another assigned oracle revert application after it was already reverted", async function() {
        await this.newPropertyManager.revertApplication(this.aId, 'it looks suspicious', { from: bob });
        await assertRevert(this.newPropertyManager.revertApplication(this.aId, 'blah', { from: dan }));
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should not reset validation statuses of another oracles', async function() {
        await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: dan });
        await this.newPropertyManager.revertApplication(this.aId, 'it looks suspicious', { from: bob });

        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.REVERTED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.APPROVED);
      });

      it('should deny non-oracle revert application', async function() {
        await assertRevert(this.newPropertyManager.revertApplication(this.aId, 'blah', { from: alice }));
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny oracle revert an application with non-consideration status', async function() {
        await this.newPropertyManager.rejectApplication(this.aId, 'suspicious', { from: bob });

        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);

        await assertRevert(this.newPropertyManager.revertApplication(this.aId, 'blah', { from: bob }));
        res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });
    });

    describe('#rejectApplication()', () => {
      beforeEach(async function() {
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });
      });

      it('should allow a oracle reject application', async function() {
        await this.newPropertyManager.rejectApplication(this.aId, 'my reason', { from: bob });
        // TODO: check the message

        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.REJECTED);
        assert.equal(res.message, 'my reason');

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);
        assert.equal(res.message, '');
      });

      it('should deny non-oracle reject application', async function() {
        await assertRevert(this.newPropertyManager.rejectApplication(this.aId, 'hey', { from: alice }));
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny oracle revert an application with non-submitted status', async function() {
        await this.newPropertyManager.revertApplication(this.aId, 'some reason', { from: bob });
        await assertRevert(this.newPropertyManager.rejectApplication(this.aId, 'another reason', { from: bob }));
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });
    });

    describe('#claimSpaceToken()', () => {
      beforeEach(async function() {
        let res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });

        await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: bob });
        res = await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: dan });
        this.tokenId = res.logs[2].args.tokenId;
      });

      // eslint-disable-next-line
      it('should transfer SpaceToken to the applicant', async function() {
        await this.newPropertyManager.claimSpaceToken(this.aId, { from: alice });

        let res = await this.spaceToken.balanceOf(this.newPropertyManager.address);
        assert.equal(res.toString(), 0);
        res = await this.spaceToken.balanceOf(alice);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.ownerOf(this.tokenId);
        assert.equal(res, alice);
      });

      it('should NOT transfer SpaceToken to non-applicant', async function() {
        await assertRevert(this.newPropertyManager.claimSpaceToken(this.aId, { from: bob }));
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        const res = await this.newPropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lockApplicationForReview(this.aId, PM_LAWYER, { from: dan });
      });

      describe('on approve', () => {
        beforeEach(async function() {
          await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: bob });
          await this.newPropertyManager.approveApplication(this.aId, this.credentials, { from: dan });
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = await web3.eth.getBalance(bob);
          const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          await this.newPropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.newPropertyManager.claimOracleReward(this.aId, { from: dan });

          let res = await this.newPropertyManager.protocolFeesEth();
          assert.equal(res, ether(0.66));
          await this.newPropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

          const bobsFinalBalance = await web3.eth.getBalance(bob);
          const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
          assert.equal(res.reward.toString(), '696800000000000000');
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '643200000000000000');

          res = await this.newPropertyManager.getApplicationFees(this.aId);
          assert.equal(res.galtProtocolFee.toString(), '660000000000000000');

          assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(0.696));
          assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(0.6432));
          assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(0.66));
        });
      });

      describe('on reject', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.newPropertyManager.rejectApplication(this.aId, this.credentials, { from: bob });

          const bobsInitialBalance = await web3.eth.getBalance(bob);
          const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          await this.newPropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.newPropertyManager.claimOracleReward(this.aId, { from: dan });
          await this.newPropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

          const bobsFinalBalance = await web3.eth.getBalance(bob);
          const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          let res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
          assert.equal(res.reward.toString(), '696800000000000000');
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '643200000000000000');

          res = await this.newPropertyManager.getApplicationFees(this.aId);
          assert.equal(res.galtProtocolFee.toString(), '660000000000000000');

          assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(0.696));
          assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(0.6432));
          assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(0.66));
        });
      });

      describe('on reject', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.newPropertyManager.revertApplication(this.aId, 'dont like it', { from: bob });
          await this.newPropertyManager.closeApplication(this.aId, { from: alice });

          const bobsInitialBalance = await web3.eth.getBalance(bob);
          const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          await this.newPropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.newPropertyManager.claimOracleReward(this.aId, { from: dan });
          await this.newPropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

          const bobsFinalBalance = await web3.eth.getBalance(bob);
          const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          let res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
          assert.equal(res.reward.toString(), '696800000000000000');
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '643200000000000000');

          res = await this.newPropertyManager.getApplicationFees(this.aId);
          assert.equal(res.galtProtocolFee.toString(), '660000000000000000');

          assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(0.696));
          assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(0.6432));
          assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(0.66));
        });
      });
    });
  });
});
