const NewPropertyManager = artifacts.require('./NewPropertyManager.sol');
const AbstractPropertyManagerLib = artifacts.require('./AbstractPropertyManagerLib.sol');
const ACL = artifacts.require('./ACL.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const MockGeodesic = artifacts.require('./MockGeodesic.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const PGGOracleStakeAccounting = artifacts.require('./PGGOracleStakeAccounting.sol');
const StakeTracker = artifacts.require('./StakeTracker.sol');
const SharedMultiSigWallet = artifacts.require('./SharedMultiSigWallet.sol');
const ContourVerificationManager = artifacts.require('./ContourVerificationManager.sol');
const ContourVerificationManagerLib = artifacts.require('./ContourVerificationManagerLib.sol');
const ContourVerifiers = artifacts.require('./ContourVerifiers.sol');
const ContourVerificationSourceRegistry = artifacts.require('./ContourVerificationSourceRegistry.sol');
const LandUtils = artifacts.require('./LandUtils.sol');
const PolygonUtils = artifacts.require('./PolygonUtils.sol');

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
  numberToEvmWord,
  paymentMethods,
  evmIncreaseTime,
  clearLibCache
} = require('../../helpers');
const { deployPGGFactory, buildPGG } = require('../../deploymentHelpers');

const { web3 } = NewPropertyManager;
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const bytes32 = utf8ToHex;

// eslint-disable-next-line no-underscore-dangle
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');

const PM_SURVEYOR = bytes32('PM_SURVEYOR_ORACLE_TYPE');
const PM_LAWYER = bytes32('PM_LAWYER_ORACLE_TYPE');

NewPropertyManager.numberFormat = 'String';

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const ApplicationStatus = {
  NOT_EXISTS: 0,
  PARTIALLY_SUBMITTED: 1,
  CONTOUR_VERIFICATION: 2,
  CANCELLED: 3,
  CV_REJECTED: 4,
  PENDING: 5,
  APPROVED: 6,
  REJECTED: 7,
  REVERTED: 8,
  PARTIALLY_RESUBMITTED: 9,
  STORED: 10,
  CLOSED: 11
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

const SpaceTokenType = {
  NULL: 0,
  LAND_PLOT: 1,
  BUILDING: 2,
  ROOM: 3
};

const Inclusion = {
  VERIFYING_INSIDE_EXISTING: 0,
  EXISTING_INSIDE_VERIFYING: 1
};

Object.freeze(ApplicationStatus);
Object.freeze(ValidationStatus);
Object.freeze(PaymentMethods);
Object.freeze(Currency);
Object.freeze(AreaSource);
Object.freeze(SpaceTokenType);
Object.freeze(Inclusion);

contract('NewPropertyManager', accounts => {
  const [
    coreTeam,
    feeMixerAddress,
    oracleModifier,
    spaceReputationAccountingAddress,
    unauthorized,
    minter,
    geoDataManager,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank,
    v1,
    v2,
    v3,
    o1,
    o2,
    o3
  ] = accounts;

  before(async function() {
    clearLibCache();

    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initContour2 = ['dddd', 'bbbb', 'cccc'];
    this.initContour3 = ['qqqq', 'wwww', 'eeee'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';

    this.contour = this.initContour.map(galt.geohashToNumber).map(a => a.toString(10));
    this.contour2 = this.initContour2.map(galt.geohashToNumber).map(a => a.toString(10));
    this.heights = [1, 2, 3];
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);
    this.dataLink = 'test dataLink';
    this.humanAddress = 'intersection of A & B';

    this.acl = await ACL.new({ from: coreTeam });
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();

    this.newPropertyManagerLib = await AbstractPropertyManagerLib.new({ from: coreTeam });

    this.landUtils = await LandUtils.new();
    PolygonUtils.link('LandUtils', this.landUtils.address);

    this.polygonUtils = await PolygonUtils.new();

    ContourVerificationManagerLib.link('LandUtils', this.landUtils.address);
    ContourVerificationManagerLib.link('PolygonUtils', this.polygonUtils.address);
    this.contourVerificationManagerLib = await ContourVerificationManagerLib.new();

    ContourVerificationManager.link('ContourVerificationManagerLib', this.contourVerificationManagerLib.address);

    this.contourVerificationSourceRegistry = await ContourVerificationSourceRegistry.new({ from: coreTeam });
    this.contourVerificationManager = await ContourVerificationManager.new({ from: coreTeam });
    this.contourVerifiers = await ContourVerifiers.new({ from: coreTeam });

    await this.contourVerificationManager.initialize(this.ggr.address, 3, 3600 * 8);
    await this.contourVerifiers.initialize(this.ggr.address, ether(200));

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
    await this.ggr.setContract(await this.ggr.STAKE_TRACKER(), this.stakeTracker.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_RA(), spaceReputationAccountingAddress, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.CONTOUR_VERIFIERS(), this.contourVerifiers.address, { from: coreTeam });
    await this.ggr.setContract(
      await this.ggr.CONTOUR_VERIFICATION_SOURCE_REGISTRY(),
      this.contourVerificationSourceRegistry.address,
      { from: coreTeam }
    );

    await this.galtToken.mint(alice, ether(10000000000), { from: coreTeam });
    await this.galtToken.mint(v1, ether(10000), { from: coreTeam });
    await this.galtToken.mint(v2, ether(10000), { from: coreTeam });
    await this.galtToken.mint(v3, ether(10000), { from: coreTeam });

    await this.feeRegistry.setProtocolEthShare(33, { from: coreTeam });
    await this.feeRegistry.setProtocolGaltShare(13, { from: coreTeam });

    this.pggFactory = await deployPGGFactory(this.ggr, coreTeam);

    await this.feeRegistry.setGaltFee(await this.pggFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.pggFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.pggFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });

    await this.feeRegistry.setGaltFee(await this.contourVerificationManager.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.contourVerificationManager.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(
      await this.contourVerificationManager.FEE_KEY(),
      paymentMethods.ETH_AND_GALT,
      {
        from: coreTeam
      }
    );
    await this.acl.setRole(bytes32('SPACE_MINTER'), minter, true, { from: coreTeam });
    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), geoDataManager, true, { from: coreTeam });
    await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactory.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ORACLE_MODIFIER'), oracleModifier, true, { from: coreTeam });
    await this.acl.setRole(bytes32('FEE_COLLECTOR'), feeMixerAddress, true, { from: coreTeam });
    await this.acl.setRole(bytes32('CONTOUR_VERIFIER'), this.contourVerificationManager.address, true, {
      from: coreTeam
    });
    await this.acl.setRole(bytes32('CV_SLASHER'), this.contourVerificationManager.address, true, { from: coreTeam });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v1 });
    await this.contourVerifiers.deposit(ether(200), { from: v1 });
    await this.contourVerifiers.setOperator(o1, { from: v1 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v2 });
    await this.contourVerifiers.deposit(ether(200), { from: v2 });
    await this.contourVerifiers.setOperator(o2, { from: v2 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v3 });
    await this.contourVerifiers.deposit(ether(200), { from: v3 });
    await this.contourVerifiers.setOperator(o3, { from: v3 });

    NewPropertyManager.link('AbstractPropertyManagerLib', this.newPropertyManagerLib.address);

    this.newPropertyManager = await NewPropertyManager.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new(this.ggr.address, 'Space Token', 'SPACE', { from: coreTeam });

    this.spaceGeoData = await deploySpaceGeoData(this.ggr);
    await this.ggr.setContract(await this.ggr.GEODESIC(), this.geodesicMock.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });

    await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });

    const applicationConfig = {};
    applicationConfig[bytes32('PM_MINIMAL_FEE_ETH')] = numberToEvmWord(ether(6));
    applicationConfig[bytes32('PM_MINIMAL_FEE_GALT')] = numberToEvmWord(ether(45));
    applicationConfig[bytes32('PM_APPLICATION_CANCEL_TIMEOUT')] = numberToEvmWord(180);
    applicationConfig[bytes32('PM_APPLICATION_CLOSE_TIMEOUT')] = numberToEvmWord(240);
    applicationConfig[bytes32('PM_ORACLE_TYPE_UNLOCK_TIMEOUT')] = numberToEvmWord(360);
    applicationConfig[bytes32('PM_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_AND_GALT);

    // [52, 48],
    applicationConfig[await this.newPropertyManager.getOracleTypeShareKey(PM_SURVEYOR)] = numberToEvmWord(52);
    applicationConfig[await this.newPropertyManager.getOracleTypeShareKey(PM_LAWYER)] = numberToEvmWord(48);

    // Oracle minimal stake values setup
    const surveyorKey = await this.myPGGOracleStakeAccounting.oracleTypeMinimalStakeKey(PM_SURVEYOR);
    const lawyerKey = await this.myPGGOracleStakeAccounting.oracleTypeMinimalStakeKey(PM_LAWYER);

    applicationConfig[surveyorKey] = numberToEvmWord(ether(1500));
    applicationConfig[lawyerKey] = numberToEvmWord(ether(1500));

    this.applicationConfig = applicationConfig;

    // MultiSig setup
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

    this.mX = this.pggX.config.address;
    this.pggMultiSigX = this.pggX.multiSig;
    this.pggConfigX = this.pggX.config;
    this.oracleStakesAccountingX = this.pggX.oracleStakeAccounting;
    this.oraclesX = this.pggX.oracles;

    await this.newPropertyManager.initialize(this.ggr.address, {
      from: coreTeam
    });

    await this.oraclesX.addOracle(bob, BOB, MN, '', [], [PM_SURVEYOR], { from: oracleModifier });
    await this.oraclesX.addOracle(charlie, CHARLIE, MN, '', [], [PM_LAWYER], { from: oracleModifier });
    await this.oraclesX.addOracle(dan, DAN, MN, '', [], [PM_LAWYER], { from: oracleModifier });

    await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(10000), { from: alice });

    await this.oracleStakesAccountingX.stake(bob, PM_SURVEYOR, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(charlie, PM_LAWYER, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(dan, PM_LAWYER, ether(2000), { from: alice });

    this.sharedMultiSig = await SharedMultiSigWallet.new(
      [alice, bob, charlie],
      [ether(20), ether(50), ether(30)],
      ether(50)
    );
    await this.galtToken.transfer(this.sharedMultiSig.address, ether(200000), { from: alice });
    await web3.eth.sendTransaction({ to: this.sharedMultiSig.address, from: frank, value: ether(3000) });
  });

  beforeEach(async function() {
    this.newPropertyManager = await NewPropertyManager.new({ from: coreTeam });
    await this.newPropertyManager.initialize(this.ggr.address, {
      from: coreTeam
    });
    await this.contourVerificationSourceRegistry.addSource(this.newPropertyManager.address);

    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), this.newPropertyManager.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_MINTER'), this.newPropertyManager.address, true, { from: coreTeam });
  });

  describe('application pipeline for GALT payment method', () => {
    before(async function() {
      this.fee = ether(50);
    });

    beforeEach(async function() {
      await this.galtToken.approve(this.newPropertyManager.address, this.fee, { from: alice });
      const res = await this.newPropertyManager.submit(
        this.pggConfigX.address,
        SpaceTokenType.LAND_PLOT,
        // area
        123,
        frank,
        this.dataLink,
        this.humanAddress,
        this.credentials,
        this.ledgerIdentifier,
        this.fee,
        {
          from: alice
        }
      );

      this.aId = res.logs[0].args.applicationId;
      assert.notEqual(this.aId, undefined);

      await this.newPropertyManager.setContour(this.aId, 771000, this.contour, { from: alice });
    });

    it('should provide methods to create and read an application', async function() {
      const res = await this.newPropertyManager.getApplication(this.aId);
      assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);
      assert.equal(res.applicant, alice);
      assert.equal(res.beneficiary, frank);
      assert.equal(parseInt(res.createdAt, 10) > 0, true);

      const res2 = await this.newPropertyManager.getApplicationDetails(this.aId);
      assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
      assert.equal(res2.dataLink, this.dataLink);
      assert.equal(res2.areaSource, AreaSource.USER_INPUT);
      assert.equal(res2.humanAddress, this.humanAddress);
      assert.equal(res2.highestPoint, 771000);
      assert.equal(parseInt(res2.area, 10) > 0, true);

      const res3 = await this.spaceGeoData.getSpaceTokenContour(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      );

      // assertions
      for (let i = 0; i < res3.length; i++) {
        assert.equal(res3[i].toString(10), this.contour[i]);
      }
    });

    describe('#submit()', () => {
      beforeEach(async function() {
        this.fee = ether(50);
        await this.galtToken.approve(this.newPropertyManager.address, this.fee, { from: alice });
      });

      describe('custom area checks', () => {
        it('should require custom area for a LAND_PLOT token submission', async function() {
          await assertRevert(
            this.newPropertyManager.submit(
              this.pggConfigX.address,
              SpaceTokenType.LAND_PLOT,
              // area
              0,
              frank,
              this.dataLink,
              this.humanAddress,
              this.credentials,
              this.ledgerIdentifier,
              ether(50),
              { from: alice }
            ),
            'Provide custom area value'
          );
        });

        it('should require custom area for a BUILDING token submission', async function() {
          await assertRevert(
            this.newPropertyManager.submit(
              this.pggConfigX.address,
              SpaceTokenType.LAND_PLOT,
              // area
              0,
              frank,
              this.dataLink,
              this.humanAddress,
              this.credentials,
              this.ledgerIdentifier,
              ether(50),
              { from: alice }
            ),
            'Provide custom area value'
          );
        });

        it('should require custom area for a ROOM token submission', async function() {
          await assertRevert(
            this.newPropertyManager.submit(
              this.pggConfigX.address,
              SpaceTokenType.LAND_PLOT,
              // area
              0,
              frank,
              this.dataLink,
              this.humanAddress,
              this.credentials,
              this.ledgerIdentifier,
              ether(50),
              { from: alice }
            ),
            'Provide custom area value'
          );
        });
      });

      it('should submit applications in galt', async function() {
        await this.newPropertyManager.submit(
          this.pggConfigX.address,
          SpaceTokenType.LAND_PLOT,
          // area
          123,
          frank,
          this.dataLink,
          this.humanAddress,
          this.credentials,
          this.ledgerIdentifier,
          this.fee,
          { from: alice }
        );
      });

      describe('payable', () => {
        it('should reject applications if GALT payment is disabled', async function() {
          await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });
          this.applicationConfig[bytes32('PM_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_ONLY);

          // disabled GALT payments
          const pggDisabledGalt = await buildPGG(
            this.pggFactory,
            [bob, charlie, dan],
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

          await this.galtToken.approve(this.newPropertyManager.address, ether(this.fee), { from: alice });
          await assertRevert(
            this.newPropertyManager.submit(
              pggDisabledGalt.config.address,
              SpaceTokenType.LAND_PLOT,
              // area
              123,
              frank,
              this.dataLink,
              this.humanAddress,
              this.credentials,
              this.ledgerIdentifier,
              this.fee,
              { from: alice }
            )
          );
        });

        it('should split fee between GaltSpace and Oracle', async function() {
          await this.galtToken.approve(this.newPropertyManager.address, ether(60), { from: alice });
          const res = await this.newPropertyManager.submit(
            this.pggConfigX.address,
            SpaceTokenType.LAND_PLOT,
            // area
            123,
            frank,
            this.dataLink,
            this.humanAddress,
            this.credentials,
            this.ledgerIdentifier,
            ether(60),
            { from: alice }
          );
          this.aId = res.logs[0].args.applicationId;
          const res4 = await this.newPropertyManager.getApplicationRewards(this.aId);
          assert.equal(res4.currency, Currency.GALT);
          assert.equal(res4.oraclesReward, '52200000000000000000');
          assert.equal(res4.galtProtocolFee, '7800000000000000000');
        });

        it('should reject fees less than returned from getter', async function() {
          await assertRevert(
            this.newPropertyManager.submit(
              this.pggConfigX.address,
              SpaceTokenType.LAND_PLOT,
              // area
              123,
              frank,
              this.dataLink,
              this.humanAddress,
              this.credentials,
              this.ledgerIdentifier,
              // expect minimum is 44
              ether(44),
              { from: alice, value: this.deposit }
            )
          );
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          const expectedFee = ether(260);
          await this.galtToken.approve(this.newPropertyManager.address, expectedFee, { from: alice });
          let res = await this.newPropertyManager.submit(
            this.pggConfigX.address,
            SpaceTokenType.LAND_PLOT,
            // area
            123,
            frank,
            this.dataLink,
            this.humanAddress,
            this.credentials,
            this.ledgerIdentifier,
            expectedFee,
            { from: alice }
          );
          const aId = res.logs[0].args.applicationId;

          res = await this.newPropertyManager.getApplicationRewards(aId);
          assert.equal(res.status, ApplicationStatus.PARTIALLY_SUBMITTED);
          assert.equal(res.currency, Currency.GALT);

          assert.equal(res.oraclesReward, 226200000000000000000);
          assert.equal(res.galtProtocolFee, 33800000000000000000);

          res = await this.newPropertyManager.getApplication(aId);
          assert.sameMembers(res.assignedOracleTypes.map(hexToUtf8), [PM_SURVEYOR, PM_LAWYER].map(hexToUtf8));

          res = await this.newPropertyManager.getApplicationOracle(aId, PM_SURVEYOR);
          assert.equal(res.reward.toString(), '117624000000000000000');

          res = await this.newPropertyManager.getApplicationOracle(aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '108576000000000000000');
        });
      });
    });

    describe('#setContour() after CV reject', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.newPropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
      });

      describe('after cv reject', () => {
        it('should be able to be approved after a second cv reveiw', async function() {
          let res = await this.spaceToken.mint(alice, { from: minter });
          const tokenId1 = res.logs[0].args.tokenId.toNumber();

          const rawContour1 = ['dr5qvnpd300r', 'dr5qvnp655pq', 'dr5qvnp3g3w0', 'dr5qvnp9cnpt'];
          const contour1 = rawContour1.map(galt.geohashToNumber).map(a => a.toString(10));
          const rawContour4 = ['dr5qvnp6hfwt', 'dr5qvnp6h46c', 'dr5qvnp3gdwu', 'dr5qvnp3u57s'];
          const contour4 = rawContour4.map(galt.geohashToNumber).map(a => a.toString(10));

          await this.spaceGeoData.setSpaceTokenContour(tokenId1, contour1, { from: geoDataManager });
          await this.spaceGeoData.setSpaceTokenType(tokenId1, SpaceTokenType.LAND_PLOT, { from: geoDataManager });

          const expectedFee = ether(45);

          await this.galtToken.approve(this.newPropertyManager.address, expectedFee, { from: alice });
          res = await this.newPropertyManager.submit(
            this.pggConfigX.address,
            SpaceTokenType.LAND_PLOT,
            // area
            123,
            frank,
            this.dataLink,
            this.humanAddress,
            this.credentials,
            this.ledgerIdentifier,
            expectedFee,
            {
              from: alice
            }
          );

          this.aId = res.logs[0].args.applicationId;
          assert.notEqual(this.aId, undefined);

          await this.newPropertyManager.setContour(this.aId, 771000, contour4, { from: alice });

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
            from: alice
          });
          const cvId1 = res.logs[0].args.applicationId;

          await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
          await this.contourVerificationManager.rejectWithExistingPointInclusionProof(
            cvId1,
            v3,
            Inclusion.VERIFYING_INSIDE_EXISTING,
            tokenId1,
            0,
            galt.geohashToNumber('dr5qvnp6hfwt').toString(10),
            { from: o3 }
          );
          await this.contourVerificationManager.pushRejection(cvId1);

          res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.CV_REJECTED);

          // resubmit
          await this.newPropertyManager.setContour(
            this.aId,
            // customArea
            123,
            contour4,
            {
              from: alice
            }
          );

          // submit CV again
          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
            from: alice
          });
          const cvId2 = res.logs[0].args.applicationId;

          // v1 and v2 were slashed
          await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v1 });
          await this.contourVerifiers.deposit(ether(200), { from: v1 });

          await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v2 });
          await this.contourVerifiers.deposit(ether(200), { from: v2 });

          await this.contourVerificationManager.approve(cvId2, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId2, v2, { from: o2 });
          await this.contourVerificationManager.approve(cvId2, v3, { from: o3 });

          await assertRevert(this.contourVerificationManager.pushRejection(cvId1), 'Already executed');
          await assertRevert(this.contourVerificationManager.pushApproval(cvId1), 'Expect APPROVAL_TIMEOUT status');

          await evmIncreaseTime(3600 * 9);
          await assertRevert(this.contourVerificationManager.pushRejection(cvId2), 'Expect REJECTED status');
          await this.contourVerificationManager.pushApproval(cvId2);

          res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.PENDING);
        });
      });
    });

    describe('#cancel()', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.newPropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should allow an applicant cancelling never locked application', async function() {
        // timeout is 180
        await assertRevert(this.newPropertyManager.cancel(this.aId, { from: alice }), 'Timeout has not passed yet');

        await evmIncreaseTime(170);

        // timeout still has not passed yet
        await assertRevert(this.newPropertyManager.cancel(this.aId, { from: alice }), 'Timeout has not passed yet');

        await evmIncreaseTime(20);

        // now it's passed
        await assertRevert(this.newPropertyManager.cancel(this.aId, { from: frank }), 'Invalid applicant');

        await this.newPropertyManager.cancel(this.aId, { from: alice });

        await assertRevert(
          this.newPropertyManager.cancel(this.aId, { from: alice }),
          'Application status should be PENDING'
        );

        const aliceInitialBalance = new BN((await this.galtToken.balanceOf(alice)).toString(10));
        await this.newPropertyManager.claimApplicantFee(this.aId, { from: alice });
        const aliceFinalBalance = new BN((await this.galtToken.balanceOf(alice)).toString(10));

        assertEqualBN(aliceFinalBalance, aliceInitialBalance.add(new BN(ether(50))));

        await assertRevert(
          this.newPropertyManager.claimApplicantFee(this.aId, { from: alice }),
          'Fee already paid out'
        );
      });
    });

    describe('#close()', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.newPropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
      });

      describe('after oracle revert', () => {
        beforeEach(async function() {
          const res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
            from: alice
          });
          const cvId1 = res.logs[0].args.applicationId;

          await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
          await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
          await evmIncreaseTime(3600 * 9);
          await this.contourVerificationManager.pushApproval(cvId1);
          await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
          await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });
          await this.newPropertyManager.revert(this.aId, 'dont like it', { from: bob });
          // timeout is 240
        });

        it('should immediately change status to CLOSED on the applicant call', async function() {
          await this.newPropertyManager.close(this.aId, { from: alice });

          const res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.CLOSED);
        });

        it('should expect a timeout if called by non-applicant', async function() {
          await evmIncreaseTime(230);
          await assertRevert(this.newPropertyManager.close(this.aId, { from: bob }), 'Timeout has not passed yet');
          await evmIncreaseTime(20);
          await this.newPropertyManager.close(this.aId, { from: bob });

          const res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.CLOSED);

          await assertRevert(this.newPropertyManager.close(this.aId, { from: bob }));
          await assertRevert(this.newPropertyManager.close(this.aId, { from: alice }));
        });
      });
    });

    describe('#resubmit()', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.newPropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        const res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });
        await this.newPropertyManager.approve(this.aId, this.credentials, { from: dan });
        await this.newPropertyManager.revert(this.aId, 'blah', { from: bob });
      });

      const newCredentiasHash = web3.utils.keccak256('AnotherPerson');
      const newLedgerIdentifier = bytes32('foo-123');
      const newDataLink = 'new-test-dataLink';
      const newHumanAddress = 'beyondTheHouse';
      const newHighestPoint = 44000;
      const newContour = ['sezu112c', 'sezu113b1', 'sezu114', 'sezu116'].map(galt.geohashToGeohash5);

      describe('contour changed', () => {
        beforeEach(async function() {
          this.fee = ether(1);

          await this.galtToken.approve(this.newPropertyManager.address, this.fee, { from: alice });
        });

        it('could accept another payment', async function() {
          await this.newPropertyManager.resubmit(
            this.aId,
            true,
            newCredentiasHash,
            newLedgerIdentifier,
            newDataLink,
            newHumanAddress,
            // customArea
            123,
            this.fee,
            { from: alice }
          );

          let res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.PARTIALLY_RESUBMITTED);

          await this.newPropertyManager.setContour(this.aId, newHighestPoint, newContour, { from: alice });

          res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);

          res = await this.newPropertyManager.getApplicationDetails(this.aId);
          assert.equal(res.credentialsHash, newCredentiasHash);
          assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
          assert.equal(res.areaSource, AreaSource.USER_INPUT);
          assert.equal(res.area, 123);
          assert.equal(res.dataLink, newDataLink);
          assert.equal(res.humanAddress, newHumanAddress);
          assert.equal(res.highestPoint, newHighestPoint);
          assert.sameMembers(res.contour, newContour);
        });

        it('should reject ETH payment', async function() {
          await assertRevert(
            this.newPropertyManager.resubmit(
              this.aId,
              true,
              newCredentiasHash,
              newLedgerIdentifier,
              newDataLink,
              newHumanAddress,
              // customArea
              123,
              0,
              { from: alice, value: '123' }
            ),
            'ETH payment not expected'
          );

          const res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.REVERTED);
        });
      });

      describe('contour doesnt changed', () => {
        it('should change old details data with a new', async function() {
          let res = await this.newPropertyManager.getApplicationDetails(this.aId);
          assert.equal(res.credentialsHash, this.credentials);
          assert.equal(res.areaSource, AreaSource.USER_INPUT);
          assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));

          await this.newPropertyManager.resubmit(
            this.aId,
            false,
            newCredentiasHash,
            newLedgerIdentifier,
            newDataLink,
            newHumanAddress,
            // customArea
            123,
            0,
            {
              from: alice
            }
          );

          res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.PENDING);

          res = await this.newPropertyManager.getApplicationDetails(this.aId);
          assert.equal(res.credentialsHash, newCredentiasHash);
          assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
          assert.equal(res.areaSource, AreaSource.USER_INPUT);
          assert.equal(res.area, 123);
          assert.equal(res.dataLink, newDataLink);
          assert.equal(res.humanAddress, newHumanAddress);
          assert.equal(res.highestPoint, 771000);
          assert.sameMembers(res.contour, this.contour);
        });
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

        this.fee = ether(200);
        await this.galtToken.approve(this.newPropertyManager.address, this.fee, { from: alice });
        res = await this.newPropertyManager.submit(
          this.pggConfigX.address,
          SpaceTokenType.LAND_PLOT,
          // area
          123,
          frank,
          this.dataLink,
          this.humanAddress,
          this.credentials,
          this.ledgerIdentifier,
          this.fee,
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.applicationId;

        await this.newPropertyManager.setContour(this.aId, 771000, this.contour, { from: alice });

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);

        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.newPropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

        res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });
      });

      describe('on approved(->stored)', () => {
        beforeEach(async function() {
          await this.newPropertyManager.approve(this.aId, this.credentials, { from: bob });
          await this.newPropertyManager.approve(this.aId, this.credentials, { from: dan });
          await this.newPropertyManager.store(this.aId, { from: unauthorized });
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
          assert.equal(res.reward.toString(), '90480000000000000000');
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '83520000000000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('90480000000000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('83520000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('26000000000000000000')));
        });
      });

      describe('on reject', () => {
        beforeEach(async function() {
          await this.newPropertyManager.reject(this.aId, 'malicious', { from: bob });
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
          assert.equal(res.reward.toString(), '90480000000000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('90480000000000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('83520000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('26000000000000000000')));
        });
      });

      describe('on close', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.newPropertyManager.revert(this.aId, this.credentials, { from: bob });
          await this.newPropertyManager.close(this.aId, { from: alice });

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
          assert.equal(res.reward.toString(), '90480000000000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('90480000000000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('83520000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('26000000000000000000')));
        });
      });
    });

    // SKIPPED: multisig acts only as a beneficiary
    it.skip('should allow galt application pipeline for applications from shared multiSig', async function() {
      // approve galts
      const approveData = this.galtToken.contract.methods
        .approve(this.newPropertyManager.address, this.fee)
        .encodeABI();
      let res = await this.sharedMultiSig.submitTransaction(this.galtToken.address, 0, approveData, {
        from: alice
      });
      let txId = res.logs[0].args.transactionId;
      res = await this.sharedMultiSig.confirmTransaction(txId, { from: charlie });

      // submit application
      const submitData = this.newPropertyManager.contract.methods
        .submit(SpaceTokenType.LAND_PLOT, 771000, this.contour, 0, this.pggConfigX.address, this.fee)
        .encodeABI();
      res = await this.sharedMultiSig.submitTransaction(this.newPropertyManager.address, 0, submitData, {
        from: alice
      });
      txId = res.logs[0].args.transactionId;
      await this.sharedMultiSig.confirmTransaction(txId, { from: charlie });
      res = await this.sharedMultiSig.transactions(txId);
      assert.equal(res.executed, true);

      // fetch txId from tx response field response
      this.aId = res.lastResponse;

      // assert id is correct
      res = await this.newPropertyManager.getApplication(this.aId);
      assert.equal(res.status, ApplicationStatus.PARTIALLY_SUBMITTED);

      // cv
      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

      res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
        from: alice
      });
      const cvId1 = res.logs[0].args.applicationId;

      await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
      await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
      await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
      await evmIncreaseTime(3600 * 9);
      await this.contourVerificationManager.pushApproval(cvId1);

      res = await this.newPropertyManager.getApplication(this.aId);
      assert.equal(res.status, ApplicationStatus.PENDING);

      // lock
      await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
      await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });

      // approve
      await this.newPropertyManager.approve(this.aId, this.credentials, { from: bob });
      await this.newPropertyManager.approve(this.aId, this.credentials, { from: dan });

      // withdraw token
      const claimData = this.newPropertyManager.contract.methods.claimSpaceToken(this.aId).encodeABI();
      res = await this.sharedMultiSig.submitTransaction(this.newPropertyManager.address, 0, claimData, {
        from: alice
      });
      txId = res.logs[0].args.transactionId;
      await this.sharedMultiSig.confirmTransaction(txId, { from: charlie });
      res = await this.sharedMultiSig.transactions(txId);
      assert.equal(res.executed, true);

      res = await this.newPropertyManager.getApplication(this.aId);
      res = await this.spaceToken.ownerOf(res.spaceTokenId);
      assert.equal(res, this.sharedMultiSig.address);
    });
  });

  describe('application pipeline for ETH', () => {
    before(async function() {
      this.fee = ether(20);
    });

    beforeEach(async function() {
      let res = await this.newPropertyManager.submit(
        this.pggConfigX.address,
        SpaceTokenType.LAND_PLOT,
        // area
        123,
        frank,
        this.dataLink,
        this.humanAddress,
        this.credentials,
        this.ledgerIdentifier,
        0,
        {
          from: alice,
          value: this.fee
        }
      );

      this.aId = res.logs[0].args.applicationId;
      assert.notEqual(this.aId, undefined);

      await assertRevert(
        this.newPropertyManager.setContour(this.aId, 771000, this.contour, { from: bob }),
        'Invalid applicant'
      );
      await this.newPropertyManager.setContour(this.aId, 771000, this.contour, { from: alice });

      res = await this.newPropertyManager.getApplication(this.aId);
      assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);
    });

    describe('#submit()', () => {
      it('should provide methods to create and read an application', async function() {
        let res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);
        assert.equal(res.applicant, alice);

        res = await this.newPropertyManager.getApplicationDetails(this.aId);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), this.initLedgerIdentifier);
      });

      describe('payable', () => {
        it('should reject applications if ETH payment is disabled', async function() {
          await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });
          this.applicationConfig[bytes32('PM_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.GALT_ONLY);

          // disabled GALT payments
          const pggDisabledEth = await buildPGG(
            this.pggFactory,
            [bob, charlie, dan, frank],
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
            this.newPropertyManager.submit(
              pggDisabledEth.config.address,
              SpaceTokenType.LAND_PLOT,
              // area
              123,
              frank,
              this.dataLink,
              this.humanAddress,
              this.credentials,
              this.ledgerIdentifier,
              0,
              {
                from: alice,
                value: ether(40)
              }
            ),
            'Invalid payment type'
          );
        });

        it('should reject applications without payment', async function() {
          await assertRevert(
            this.newPropertyManager.submit(
              this.pggConfigX.address,
              SpaceTokenType.LAND_PLOT,
              // area
              123,
              frank,
              this.dataLink,
              this.humanAddress,
              this.credentials,
              this.ledgerIdentifier,
              0,
              {
                from: alice,
                value: 0
              }
            ),
            'Insufficient payment'
          );
        });

        it('should reject applications with payment less than required', async function() {
          await assertRevert(
            this.newPropertyManager.submit(
              this.pggConfigX.address,
              SpaceTokenType.LAND_PLOT,
              // area
              123,
              frank,
              this.dataLink,
              this.humanAddress,
              this.credentials,
              this.ledgerIdentifier,
              0,
              {
                from: alice,
                value: ether(1)
              }
            ),
            'Insufficient payment'
          );
        });

        it('should calculate corresponding oracle and coreTeam rewards in Eth', async function() {
          const res = await this.newPropertyManager.getApplicationRewards(this.aId);
          assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);
          assert.equal(res.oraclesReward, 13400000000000000000);
          assert.equal(res.galtProtocolFee, 6600000000000000000);
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          let res = await this.newPropertyManager.getApplicationRewards(this.aId);
          assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);
          assert.equal(res.currency, Currency.ETH);
          assert.equal(res.oraclesReward, 13400000000000000000);

          res = await this.newPropertyManager.getApplication(this.aId);
          assert.sameMembers(res.assignedOracleTypes.map(hexToUtf8), [PM_SURVEYOR, PM_LAWYER].map(hexToUtf8));

          // 52%
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
          assert.equal(res.reward.toString(), '6968000000000000000');

          // 48%
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '6432000000000000000');
        });
      });
    });

    describe('#close()', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.newPropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        const res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);
        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });
        await this.newPropertyManager.revert(this.aId, 'dont like it', { from: bob });
        // timeout is 240
      });

      it('should immediately change status to CLOSED on the applicant call', async function() {
        await this.newPropertyManager.close(this.aId, { from: alice });

        const res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.CLOSED);
      });

      it('should expect a timeout if called by non-applicant', async function() {
        await evmIncreaseTime(230);
        await assertRevert(this.newPropertyManager.close(this.aId, { from: bob }), 'Timeout has not passed yet');
        await evmIncreaseTime(20);
        await this.newPropertyManager.close(this.aId, { from: bob });

        const res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.CLOSED);
      });
    });

    describe('#resubmit()', () => {
      beforeEach(async function() {
        let res = await this.newPropertyManager.submit(
          this.pggConfigX.address,
          SpaceTokenType.LAND_PLOT,
          // area
          123,
          frank,
          this.dataLink,
          this.humanAddress,
          this.credentials,
          this.ledgerIdentifier,
          0,
          {
            from: alice,
            value: this.fee
          }
        );

        this.aId = res.logs[0].args.applicationId;

        await this.newPropertyManager.setContour(this.aId, 771000, this.contour, { from: alice });
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.newPropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });
        await this.newPropertyManager.approve(this.aId, this.credentials, { from: dan });
        await this.newPropertyManager.revert(this.aId, 'blah', { from: bob });
      });

      const newCredentiasHash = web3.utils.keccak256('AnotherPerson');
      const newLedgerIdentifier = bytes32('foo-123');
      const newDataLink = 'new-test-dataLink';
      const newHumanAddress = 'beyondTheHouse';
      const newHighestPoint = 44000;
      const newContour = ['sezu112c', 'sezu113b1', 'sezu114', 'sezu116'].map(galt.geohashToGeohash5);

      describe('contour changed', () => {
        beforeEach(async function() {
          this.fee = ether(1);
        });

        it('could accept another ETH payment', async function() {
          await this.newPropertyManager.resubmit(
            this.aId,
            true,
            newCredentiasHash,
            newLedgerIdentifier,
            newDataLink,
            newHumanAddress,
            // customArea
            123,
            0,
            { from: alice, value: 123 }
          );

          let res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.PARTIALLY_RESUBMITTED);

          await this.newPropertyManager.setContour(this.aId, newHighestPoint, newContour, { from: alice });

          res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);

          res = await this.newPropertyManager.getApplicationDetails(this.aId);
          assert.equal(res.credentialsHash, newCredentiasHash);
          assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
          assert.equal(res.areaSource, AreaSource.USER_INPUT);
          assert.equal(res.area, 123);
          assert.equal(res.dataLink, newDataLink);
          assert.equal(res.humanAddress, newHumanAddress);
          assert.equal(res.highestPoint, newHighestPoint);
          assert.sameMembers(res.contour, newContour);

          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
          assert.equal(res.oracle, bob);
          assert.equal(res.status, ValidationStatus.LOCKED);

          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.oracle, dan);
          assert.equal(res.status, ValidationStatus.LOCKED);
        });

        it('should reject on payment both in ETH and GALT', async function() {
          await assertRevert(
            this.newPropertyManager.resubmit(
              this.aId,
              true,
              newCredentiasHash,
              newLedgerIdentifier,
              newDataLink,
              newHumanAddress,
              // customArea
              123,
              this.fee,
              { from: alice, value: '123' }
            ),
            'GALT payment not expected'
          );

          const res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.REVERTED);
        });

        it('should reject on GALT payment', async function() {
          await assertRevert(
            this.newPropertyManager.resubmit(
              this.aId,
              true,
              newCredentiasHash,
              newLedgerIdentifier,
              newDataLink,
              newHumanAddress,
              // customArea
              123,
              this.fee,
              { from: alice }
            ),
            'GALT payment not expected'
          );

          const res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.REVERTED);
        });

        it('should accept a resubmission without payment', async function() {
          await this.newPropertyManager.resubmit(
            this.aId,
            true,
            newCredentiasHash,
            newLedgerIdentifier,
            newDataLink,
            newHumanAddress,
            // customArea
            123,
            0,
            { from: alice }
          );

          const res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.PARTIALLY_RESUBMITTED);
        });
      });

      describe('contour doesnt changed', () => {
        it('should change old details data with a new', async function() {
          let res = await this.newPropertyManager.getApplicationDetails(this.aId);
          assert.equal(res.credentialsHash, this.credentials);
          assert.equal(res.areaSource, AreaSource.USER_INPUT);
          assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));

          await this.newPropertyManager.resubmit(
            this.aId,
            false,
            newCredentiasHash,
            newLedgerIdentifier,
            newDataLink,
            newHumanAddress,
            // customArea
            123,
            0,
            {
              from: alice
            }
          );

          res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.PENDING);

          res = await this.newPropertyManager.getApplicationDetails(this.aId);
          assert.equal(res.credentialsHash, newCredentiasHash);
          assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
          assert.equal(res.areaSource, AreaSource.USER_INPUT);
          assert.equal(res.area, 123);
          assert.equal(res.dataLink, newDataLink);
          assert.equal(res.humanAddress, newHumanAddress);
          assert.equal(res.highestPoint, 771000);
          assert.sameMembers(res.contour, this.contour);

          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
          assert.equal(res.oracle, bob);
          assert.equal(res.status, ValidationStatus.LOCKED);

          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.oracle, dan);
          assert.equal(res.status, ValidationStatus.LOCKED);
        });
      });
    });

    describe('#cancel()', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.newPropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should allow an applicant cancelling never locked application', async function() {
        // timeout is 180
        await assertRevert(this.newPropertyManager.cancel(this.aId, { from: alice }), 'Timeout has not passed yet');

        await evmIncreaseTime(170);

        // timeout still has not passed yet
        await assertRevert(this.newPropertyManager.cancel(this.aId, { from: alice }), 'Timeout has not passed yet');

        await evmIncreaseTime(20);

        // now it's passed
        await assertRevert(this.newPropertyManager.cancel(this.aId, { from: frank }), 'Invalid applicant');

        await this.newPropertyManager.cancel(this.aId, { from: alice });

        await assertRevert(
          this.newPropertyManager.cancel(this.aId, { from: alice }),
          'Application status should be PENDING'
        );

        const aliceInitialBalance = await web3.eth.getBalance(alice);
        await this.newPropertyManager.claimApplicantFee(this.aId, { from: alice });
        const aliceFinalBalance = await web3.eth.getBalance(alice);

        assertEthBalanceChanged(aliceInitialBalance, aliceFinalBalance, ether(20));

        await assertRevert(
          this.newPropertyManager.claimApplicantFee(this.aId, { from: alice }),
          'Fee already paid out'
        );
      });

      it('should deny an applicant cancelling the application if it was locked once', async function() {
        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.unlock(this.aId, PM_SURVEYOR, { from: bob });

        // timeout is 180
        await assertRevert(this.newPropertyManager.cancel(this.aId, { from: alice }), 'Timeout has not passed yet');

        await evmIncreaseTime(170);

        // timeout still has not passed yet
        await assertRevert(this.newPropertyManager.cancel(this.aId, { from: alice }), 'Timeout has not passed yet');

        await evmIncreaseTime(20);

        // now it's passed, but since the application was locked before, you can't cancel it
        await assertRevert(
          this.newPropertyManager.cancel(this.aId, { from: alice }),
          'The application has been already locked at least once'
        );
      });
    });

    describe('#lock()', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.newPropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should allow multiple oracles of different roles to lock a submitted application', async function() {
        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });

        let res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);
      });

      // eslint-disable-next-line
      it("should deny a oracle with the same role to lock an application which is already on consideration", async function() {
        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await assertRevert(this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: charlie }));
      });

      it('should push an application id to the oracles list for caching', async function() {
        let res = await this.newPropertyManager.submit(
          this.pggConfigX.address,
          SpaceTokenType.LAND_PLOT,
          // area
          123,
          frank,
          this.dataLink,
          this.humanAddress,
          this.credentials,
          this.ledgerIdentifier,
          0,
          {
            from: charlie,
            value: ether(7)
          }
        );

        const a1Id = res.logs[0].args.applicationId;

        await this.newPropertyManager.setContour(a1Id, 771000, this.contour, { from: charlie });

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        res = await this.contourVerificationManager.submit(this.newPropertyManager.address, a1Id, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        // lock first
        await this.newPropertyManager.lock(a1Id, PM_SURVEYOR, { from: bob });

        // submit second
        res = await this.newPropertyManager.submit(
          this.pggConfigX.address,
          SpaceTokenType.LAND_PLOT,
          // area
          123,
          frank,
          this.dataLink,
          this.humanAddress,
          this.credentials,
          this.ledgerIdentifier,
          0,
          {
            from: charlie,
            value: ether(7)
          }
        );
        const a2Id = res.logs[0].args.applicationId;

        await this.newPropertyManager.setContour(a2Id, 771000, this.contour, { from: charlie });

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        res = await this.contourVerificationManager.submit(this.newPropertyManager.address, a2Id, {
          from: alice
        });
        const cvId2 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId2, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId2, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId2, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId2);

        // lock second
        await this.newPropertyManager.lock(a2Id, PM_SURVEYOR, { from: bob });

        res = await this.newPropertyManager.getApplicationsByOracle(bob);
        assert.equal(res.length, 2);
        assert.equal(res[0], a1Id);
        assert.equal(res[1], a2Id);
      });

      it('should deny oracle to lock an application which is already approved', async function() {
        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });

        await this.newPropertyManager.approve(this.aId, this.credentials, { from: bob });
        await this.newPropertyManager.approve(this.aId, this.credentials, { from: dan });

        await assertRevert(this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: charlie }));
        const res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      it('should deny non-oracle to lock an application', async function() {
        await assertRevert(this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: coreTeam }));
        const res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });
    });

    describe('#unlock() for oracle roles in LOCKED status', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.newPropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
      });

      // an oracle could unlock himself without any timeout
      // anyone could unlock an oracle after timeout
      it('should allow the oracle unlocking himself anytime', async function() {
        await this.newPropertyManager.unlock(this.aId, PM_SURVEYOR, { from: bob });

        let res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
        assert.equal(res.oracle, zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);

        await assertRevert(
          this.newPropertyManager.unlock(this.aId, PM_SURVEYOR, { from: bob }),
          'Validation status should be LOCKED'
        );
      });

      it('should allow anyone unlocking an oracle after timeout', async function() {
        // timeout is 360
        await assertRevert(
          this.newPropertyManager.unlock(this.aId, PM_SURVEYOR, { from: alice }),
          'Timeout has not passed yet'
        );

        await evmIncreaseTime(350);

        // timeout still not passed yet
        await assertRevert(
          this.newPropertyManager.unlock(this.aId, PM_SURVEYOR, { from: alice }),
          'Timeout has not passed yet'
        );

        let res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        await evmIncreaseTime(20);

        // not it's passed
        await this.newPropertyManager.unlock(this.aId, PM_SURVEYOR, { from: alice });

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
        assert.equal(res.oracle, zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);

        await assertRevert(
          this.newPropertyManager.unlock(this.aId, PM_SURVEYOR, { from: alice }),
          'Validation status should be LOCKED'
        );
      });
    });

    describe('#approve()', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });
      });

      it('should allow a oracle approve application', async function() {
        await this.newPropertyManager.approve(this.aId, this.credentials, { from: bob });

        let res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.newPropertyManager.approve(this.aId, this.credentials, { from: dan });

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      // eslint-disable-next-line
      it("should mint a pack, geohash, swap the geohash into the pack and keep it at NewPropertyManager address", async function() {
        await this.newPropertyManager.approve(this.aId, this.credentials, { from: bob });
        let res = await this.newPropertyManager.approve(this.aId, this.credentials, { from: dan });
        const { spaceTokenId } = res.logs[2].args;

        res = await this.spaceToken.balanceOf(this.newPropertyManager.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.ownerOf(spaceTokenId);
        assert.equal(res, this.newPropertyManager.address);
      });

      it('should deny a oracle approve application if hash doesnt match', async function() {
        await assertRevert(this.newPropertyManager.approve(this.aId, web3.utils.sha3(`foo`), { from: bob }));
        const res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should deny non-oracle approve application', async function() {
        await assertRevert(this.newPropertyManager.approve(this.aId, this.credentials, { from: alice }));
        const res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      // eslint-disable-next-line
      it("should deny oracle approve application with other than consideration or partially locked status", async function() {
        await this.newPropertyManager.reject(this.aId, 'suspicious', { from: bob });

        let res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);

        await assertRevert(this.newPropertyManager.approve(this.aId, this.credentials, { from: bob }));
        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });
    });

    describe('#revert()', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });
      });

      it('should allow a oracle revert application', async function() {
        await this.newPropertyManager.revert(this.aId, 'it looks suspicious', { from: bob });
        const res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      // eslint-disable-next-line
      it("should deny another assigned oracle revert application after it was already reverted", async function() {
        await this.newPropertyManager.revert(this.aId, 'it looks suspicious', { from: bob });
        await assertRevert(this.newPropertyManager.revert(this.aId, 'blah', { from: dan }));
        const res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should not reset validation statuses of another oracles', async function() {
        await this.newPropertyManager.approve(this.aId, this.credentials, { from: dan });
        await this.newPropertyManager.revert(this.aId, 'it looks suspicious', { from: bob });

        let res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.REVERTED);

        res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.APPROVED);
      });

      it('should deny non-oracle revert application', async function() {
        await assertRevert(this.newPropertyManager.revert(this.aId, 'blah', { from: alice }));
        const res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should deny oracle revert an application with non-consideration status', async function() {
        await this.newPropertyManager.reject(this.aId, 'suspicious', { from: bob });

        let res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);

        await assertRevert(this.newPropertyManager.revert(this.aId, 'blah', { from: bob }));
        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });
    });

    describe('#reject()', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });
      });

      it('should allow a oracle reject application', async function() {
        await this.newPropertyManager.reject(this.aId, 'my reason', { from: bob });
        // TODO: check the message

        let res = await this.newPropertyManager.getApplication(this.aId);
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
        await assertRevert(this.newPropertyManager.reject(this.aId, 'hey', { from: alice }));
        const res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should deny oracle revert an application with non-submitted status', async function() {
        await this.newPropertyManager.revert(this.aId, 'some reason', { from: bob });
        await assertRevert(this.newPropertyManager.reject(this.aId, 'another reason', { from: bob }));
        const res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });
    });

    describe('#claimSpaceToken()', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });

        await this.newPropertyManager.approve(this.aId, this.credentials, { from: bob });
        res = await this.newPropertyManager.approve(this.aId, this.credentials, { from: dan });
        this.spaceTokenId = res.logs[2].args.spaceTokenId;

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);

        await this.newPropertyManager.store(this.aId, { from: unauthorized });

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.STORED);
      });

      // eslint-disable-next-line
      it('should transfer SpaceToken to the applicant', async function() {
        await this.newPropertyManager.claimSpaceToken(this.aId, { from: alice });
        assert.equal(await this.spaceToken.ownerOf(this.spaceTokenId), frank);
      });

      it('should NOT transfer SpaceToken to non-applicant', async function() {
        await assertRevert(this.newPropertyManager.claimSpaceToken(this.aId, { from: bob }));
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.newPropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
        await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });
      });

      describe('on approve(->stored)', () => {
        beforeEach(async function() {
          await this.newPropertyManager.approve(this.aId, this.credentials, { from: bob });
          await this.newPropertyManager.approve(this.aId, this.credentials, { from: dan });
          await this.newPropertyManager.store(this.aId, { from: unauthorized });

          const res = await this.newPropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.STORED);
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = await web3.eth.getBalance(bob);
          const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          await this.newPropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.newPropertyManager.claimOracleReward(this.aId, { from: dan });

          let res = await this.newPropertyManager.protocolFeesEth();
          assert.equal(res, ether(6.6));
          await this.newPropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

          const bobsFinalBalance = await web3.eth.getBalance(bob);
          const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_SURVEYOR);
          assert.equal(res.reward.toString(), '6968000000000000000');
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '6432000000000000000');

          res = await this.newPropertyManager.getApplicationRewards(this.aId);
          assert.equal(res.galtProtocolFee.toString(), '6600000000000000000');

          assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(6.968));
          assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(6.432));
          assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(6.6));
        });
      });

      describe('on reject', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.newPropertyManager.reject(this.aId, this.credentials, { from: bob });

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
          assert.equal(res.reward.toString(), '6968000000000000000');
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '6432000000000000000');

          res = await this.newPropertyManager.getApplicationRewards(this.aId);
          assert.equal(res.galtProtocolFee.toString(), '6600000000000000000');

          assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(6.968));
          assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(6.432));
          assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(6.6));
        });
      });

      describe('on close', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.newPropertyManager.revert(this.aId, 'dont like it', { from: bob });
          await this.newPropertyManager.close(this.aId, { from: alice });

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
          assert.equal(res.reward.toString(), '6968000000000000000');
          res = await this.newPropertyManager.getApplicationOracle(this.aId, PM_LAWYER);
          assert.equal(res.reward.toString(), '6432000000000000000');

          res = await this.newPropertyManager.getApplicationRewards(this.aId);
          assert.equal(res.galtProtocolFee.toString(), '6600000000000000000');

          assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(6.968));
          assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(6.432));
          assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(6.6));
        });
      });
    });

    // SKIPPED: multisig acts only as a beneficiary
    it.skip('should allow eth application pipeline for applications from shared multiSig', async function() {
      // submit application
      const submitData = this.newPropertyManager.contract.methods
        .submit(
          SpaceTokenType.BUILDING,
          this.dataLink,
          this.humanAddress,
          771000,
          this.credentials,
          this.ledgerIdentifier,
          this.contour,
          123,
          this.pggConfigX.address,
          0
        )
        .encodeABI();
      let res = await this.sharedMultiSig.submitTransaction(this.newPropertyManager.address, this.fee, submitData, {
        from: alice
      });
      let txId = res.logs[0].args.transactionId;
      await this.sharedMultiSig.confirmTransaction(txId, { from: charlie });
      res = await this.sharedMultiSig.transactions(txId);
      assert.equal(res.executed, true);

      // fetch txId from tx response field response
      this.aId = res.lastResponse;

      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
      res = await this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, {
        from: alice
      });
      const cvId1 = res.logs[0].args.applicationId;

      await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
      await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
      await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
      await evmIncreaseTime(3600 * 9);
      await this.contourVerificationManager.pushApproval(cvId1);

      // assert id is correct
      res = await this.newPropertyManager.getApplication(this.aId);
      assert.equal(res.status, ApplicationStatus.PENDING);

      // lock
      await this.newPropertyManager.lock(this.aId, PM_SURVEYOR, { from: bob });
      await this.newPropertyManager.lock(this.aId, PM_LAWYER, { from: dan });

      // approve
      await this.newPropertyManager.approve(this.aId, this.credentials, { from: bob });
      await this.newPropertyManager.approve(this.aId, this.credentials, { from: dan });

      // withdraw token
      const claimData = this.newPropertyManager.contract.methods.claimSpaceToken(this.aId).encodeABI();
      res = await this.sharedMultiSig.submitTransaction(this.newPropertyManager.address, 0, claimData, {
        from: alice
      });
      txId = res.logs[0].args.transactionId;
      await this.sharedMultiSig.confirmTransaction(txId, { from: charlie });
      res = await this.sharedMultiSig.transactions(txId);
      assert.equal(res.executed, true);

      res = await this.newPropertyManager.getApplication(this.aId);
      res = await this.spaceToken.ownerOf(res.spaceTokenId);
      assert.equal(res, this.sharedMultiSig.address);
    });
  });
});
