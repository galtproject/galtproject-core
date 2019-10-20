const UpdatePropertyManager = artifacts.require('./UpdatePropertyManager.sol');
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

const { web3 } = UpdatePropertyManager;
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const bytes32 = utf8ToHex;

// eslint-disable-next-line no-underscore-dangle
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');
const EVE = bytes32('Eve');

const PM_SURVEYOR = bytes32('PM_SURVEYOR_ORACLE_TYPE');
const PM_LAWYER = bytes32('PM_LAWYER_ORACLE_TYPE');
const PM_AUDITOR = bytes32('PM_AUDITOR_ORACLE_TYPE');
const PL_SURVEYOR = bytes32('PL_SURVEYOR_ORACLE_TYPE');
const PL_LAWYER = bytes32('PL_LAWYER_ORACLE_TYPE');
const PL_AUDITOR = bytes32('PL_AUDITOR_ORACLE_TYPE');

UpdatePropertyManager.numberFormat = 'String';

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

contract('UpdatePropertyManager', accounts => {
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

    this.updatePropertyManagerLib = await AbstractPropertyManagerLib.new({ from: coreTeam });

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
    await this.contourVerifiers.deposit(ether(200), v1, { from: v1 });
    await this.contourVerifiers.setOperator(o1, { from: v1 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v2 });
    await this.contourVerifiers.deposit(ether(200), v2, { from: v2 });
    await this.contourVerifiers.setOperator(o2, { from: v2 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v3 });
    await this.contourVerifiers.deposit(ether(200), v3, { from: v3 });
    await this.contourVerifiers.setOperator(o3, { from: v3 });

    UpdatePropertyManager.link('AbstractPropertyManagerLib', this.updatePropertyManagerLib.address);

    this.updatePropertyManager = await UpdatePropertyManager.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new(this.ggr.address, 'Space Token', 'SPACE', { from: coreTeam });

    this.spaceGeoData = await deploySpaceGeoData(this.ggr);
    await this.ggr.setContract(await this.ggr.GEODESIC(), this.geodesicMock.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });

    await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });

    const applicationConfig = {};
    applicationConfig[bytes32('PL_MINIMAL_FEE_ETH')] = numberToEvmWord(ether(6));
    applicationConfig[bytes32('PL_MINIMAL_FEE_GALT')] = numberToEvmWord(ether(45));
    applicationConfig[bytes32('PL_APPLICATION_CANCEL_TIMEOUT')] = numberToEvmWord(180);
    applicationConfig[bytes32('PL_APPLICATION_CLOSE_TIMEOUT')] = numberToEvmWord(240);
    applicationConfig[bytes32('PL_ORACLE_TYPE_UNLOCK_TIMEOUT')] = numberToEvmWord(360);
    applicationConfig[bytes32('PL_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_AND_GALT);

    // [52, 48],
    applicationConfig[await this.updatePropertyManager.getOracleTypeShareKey(PL_SURVEYOR)] = numberToEvmWord(52);
    applicationConfig[await this.updatePropertyManager.getOracleTypeShareKey(PL_LAWYER)] = numberToEvmWord(48);

    // Oracle minimal stake values setup
    const surveyorKey = await this.myPGGOracleStakeAccounting.oracleTypeMinimalStakeKey(PL_SURVEYOR);
    const lawyerKey = await this.myPGGOracleStakeAccounting.oracleTypeMinimalStakeKey(PL_LAWYER);

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

    await this.updatePropertyManager.initialize(this.ggr.address, {
      from: coreTeam
    });

    await this.oraclesX.addOracle(bob, BOB, MN, '', [], [PM_SURVEYOR, PL_SURVEYOR], {
      from: oracleModifier
    });
    await this.oraclesX.addOracle(charlie, CHARLIE, MN, '', [], [PM_LAWYER, PL_LAWYER], {
      from: oracleModifier
    });
    await this.oraclesX.addOracle(dan, DAN, MN, '', [], [PM_LAWYER, PL_LAWYER], {
      from: oracleModifier
    });
    await this.oraclesX.addOracle(eve, EVE, MN, '', [], [PM_AUDITOR, PL_AUDITOR], {
      from: oracleModifier
    });

    await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(30000), { from: alice });

    await this.oracleStakesAccountingX.stake(bob, PM_SURVEYOR, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(charlie, PM_LAWYER, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(dan, PM_LAWYER, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(eve, PM_AUDITOR, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(bob, PL_SURVEYOR, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(charlie, PL_LAWYER, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(dan, PL_LAWYER, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(eve, PL_AUDITOR, ether(2000), { from: alice });

    this.sharedMultiSig = await SharedMultiSigWallet.new(
      [alice, bob, charlie],
      [ether(20), ether(50), ether(30)],
      ether(50)
    );
    await this.galtToken.transfer(this.sharedMultiSig.address, ether(200000), { from: alice });
    await web3.eth.sendTransaction({ to: this.sharedMultiSig.address, from: frank, value: ether(3000) });
  });

  beforeEach(async function() {
    this.updatePropertyManager = await UpdatePropertyManager.new({ from: coreTeam });
    await this.updatePropertyManager.initialize(this.ggr.address, {
      from: coreTeam
    });
    await this.contourVerificationSourceRegistry.addSource(this.updatePropertyManager.address);

    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), this.updatePropertyManager.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_MINTER'), this.updatePropertyManager.address, true, { from: coreTeam });

    let res = await this.spaceToken.mint(alice, { from: minter });
    this.tokenId = res.logs[0].args.tokenId.toNumber();
    res = await this.spaceToken.ownerOf(this.tokenId);
    assert.equal(res, alice);
    await this.spaceToken.approve(this.updatePropertyManager.address, this.tokenId, { from: alice });
  });

  describe('application pipeline for GALT payment method', () => {
    before(async function() {
      this.fee = ether(50);
    });

    it('should provide methods to create and read an application', async function() {
      await this.galtToken.approve(this.updatePropertyManager.address, this.fee, { from: alice });
      let res = await this.updatePropertyManager.submit(
        this.pggConfigX.address,
        this.tokenId,
        true,
        // area
        123,
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

      await this.updatePropertyManager.setContour(this.aId, 771000, this.contour, { from: alice });
      res = await this.updatePropertyManager.getApplication(this.aId);
      assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);
      assert.equal(res.applicant, alice);
      assert.equal(res.beneficiary, zeroAddress);
      assert.equal(parseInt(res.createdAt, 10) > 0, true);

      const res2 = await this.updatePropertyManager.getApplicationDetails(this.aId);
      assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
      assert.equal(res2.dataLink, this.dataLink);
      assert.equal(res2.areaSource, AreaSource.USER_INPUT);
      assert.equal(res2.humanAddress, this.humanAddress);
      assert.equal(res2.highestPoint, 771000);
      assert.equal(parseInt(res2.area, 10) > 0, true);

      const res3 = await this.spaceGeoData.getContour(
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
        await this.galtToken.approve(this.updatePropertyManager.address, this.fee, { from: alice });
      });

      it('should require custom area for a LAND_PLOT token submission', async function() {
        await assertRevert(
          this.updatePropertyManager.submit(
            this.pggConfigX.address,
            this.tokenId,
            true,
            // area
            0,
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

      it('should submit applications in galt', async function() {
        await this.updatePropertyManager.submit(
          this.pggConfigX.address,
          this.tokenId,
          true,
          // area
          123,
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
          this.applicationConfig[bytes32('PL_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.NONE);

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

          await this.galtToken.approve(this.updatePropertyManager.address, ether(this.fee), { from: alice });
          await assertRevert(
            this.updatePropertyManager.submit(
              pggDisabledGalt.config.address,
              this.tokenId,
              true,
              // area
              123,
              this.dataLink,
              this.humanAddress,
              this.credentials,
              this.ledgerIdentifier,
              this.fee,
              { from: alice }
            ),
            'Invalid payment type'
          );
        });

        it('should reject applications payment not configured', async function() {
          await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });
          this.applicationConfig[bytes32('PL_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_ONLY);

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

          await this.galtToken.approve(this.updatePropertyManager.address, ether(this.fee), { from: alice });
          await assertRevert(
            this.updatePropertyManager.submit(
              pggDisabledGalt.config.address,
              this.tokenId,
              true,
              // area
              123,
              this.dataLink,
              this.humanAddress,
              this.credentials,
              this.ledgerIdentifier,
              this.fee,
              { from: alice }
            ),
            'Invalid payment type'
          );
        });

        it('should split fee between GaltSpace and Oracle', async function() {
          await this.galtToken.approve(this.updatePropertyManager.address, ether(60), { from: alice });
          const res = await this.updatePropertyManager.submit(
            this.pggConfigX.address,
            this.tokenId,
            true,
            // area
            123,
            this.dataLink,
            this.humanAddress,
            this.credentials,
            this.ledgerIdentifier,
            ether(60),
            { from: alice }
          );
          const aId = res.logs[0].args.applicationId;
          const res4 = await this.updatePropertyManager.getApplicationRewards(aId);
          assert.equal(res4.currency, Currency.GALT);
          assert.equal(res4.oraclesReward, '52200000000000000000');
          assert.equal(res4.galtProtocolFee, '7800000000000000000');
        });

        it('should reject fees less than returned from getter', async function() {
          await assertRevert(
            this.updatePropertyManager.submit(
              this.pggConfigX.address,
              this.tokenId,
              true,
              // area
              123,
              this.dataLink,
              this.humanAddress,
              this.credentials,
              this.ledgerIdentifier,
              // expect minimum is 44
              ether(44),
              { from: alice, value: this.deposit }
            ),
            'Insufficient payment'
          );
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          const expectedFee = ether(260);
          await this.galtToken.approve(this.updatePropertyManager.address, expectedFee, { from: alice });
          let res = await this.updatePropertyManager.submit(
            this.pggConfigX.address,
            this.tokenId,
            true,
            // area
            123,
            this.dataLink,
            this.humanAddress,
            this.credentials,
            this.ledgerIdentifier,
            expectedFee,
            { from: alice }
          );
          const aId = res.logs[0].args.applicationId;

          res = await this.updatePropertyManager.getApplicationRewards(aId);
          assert.equal(res.status, ApplicationStatus.PARTIALLY_SUBMITTED);
          assert.equal(res.currency, Currency.GALT);

          assert.equal(res.oraclesReward, 226200000000000000000);
          assert.equal(res.galtProtocolFee, 33800000000000000000);

          res = await this.updatePropertyManager.getApplication(aId);
          assert.sameMembers(res.assignedOracleTypes.map(hexToUtf8), [PL_SURVEYOR, PL_LAWYER].map(hexToUtf8));

          res = await this.updatePropertyManager.getApplicationOracle(aId, PL_SURVEYOR);
          assert.equal(res.reward.toString(), '117624000000000000000');

          res = await this.updatePropertyManager.getApplicationOracle(aId, PL_LAWYER);
          assert.equal(res.reward.toString(), '108576000000000000000');
        });
      });
    });

    describe('#setContour() after CV reject', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.updatePropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
      });

      describe('after cv reject', () => {
        it('should be able to be approved after a second cv review', async function() {
          let res = await this.spaceToken.mint(alice, { from: minter });
          const tokenId1 = res.logs[0].args.tokenId.toNumber();

          res = await this.spaceToken.mint(alice, { from: minter });
          const tokenId2 = res.logs[0].args.tokenId.toNumber();

          const rawContour1 = ['dr5qvnpd300r', 'dr5qvnp655pq', 'dr5qvnp3g3w0', 'dr5qvnp9cnpt'];
          const contour1 = rawContour1.map(galt.geohashToNumber).map(a => a.toString(10));
          // const rawContour4 = ['dr5qvnp6hfwt', 'dr5qvnp6h46c', 'dr5qvnp3gdwu', 'dr5qvnp3u57s'];
          // const contour4 = rawContour4.map(galt.geohashToNumber).map(a => a.toString(10));
          const rawContour3 = ['dr5qvnp9c7b2', 'dr5qvnp3ewcv', 'dr5qvnp37vs4', 'dr5qvnp99ddh'];
          const contour3 = rawContour3.map(galt.geohashToNumber).map(a => a.toString(10));
          const rawContour5 = ['dr5qvnp3vur6', 'dr5qvnp3yv97', 'dr5qvnp3ybpq', 'dr5qvnp3wp47'];
          const contour5 = rawContour5.map(galt.geohashToNumber).map(a => a.toString(10));

          await this.spaceGeoData.setContour(tokenId1, contour1, { from: geoDataManager });
          await this.spaceGeoData.setType(tokenId1, SpaceTokenType.LAND_PLOT, { from: geoDataManager });

          await this.spaceGeoData.setContour(tokenId2, contour3, { from: geoDataManager });
          await this.spaceGeoData.setType(tokenId2, SpaceTokenType.LAND_PLOT, { from: geoDataManager });

          const expectedFee = ether(45);

          await this.galtToken.approve(this.updatePropertyManager.address, expectedFee, { from: alice });
          await this.spaceToken.approve(this.updatePropertyManager.address, tokenId1, { from: alice });
          res = await this.updatePropertyManager.submit(
            this.pggConfigX.address,
            tokenId1,
            true,
            // area
            345,
            this.dataLink,
            this.humanAddress,
            this.credentials,
            this.ledgerIdentifier,
            expectedFee,
            {
              from: alice
            }
          );

          const aId = res.logs[0].args.applicationId;
          assert.notEqual(aId, undefined);

          await this.updatePropertyManager.setContour(aId, 771000, contour5, { from: alice });

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
          res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, {
            from: alice
          });
          const cvId1 = res.logs[0].args.applicationId;

          assert.equal(SpaceTokenType.LAND_PLOT, await this.spaceGeoData.getType(tokenId2));
          assert.equal(SpaceTokenType.LAND_PLOT, await this.updatePropertyManager.getCVSpaceTokenType(aId));

          await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
          await assertRevert(
            this.contourVerificationManager.rejectWithExistingPointInclusionProof(
              cvId1,
              v3,
              Inclusion.VERIFYING_INSIDE_EXISTING,
              tokenId1,
              1,
              galt.geohashToNumber('dr5qvnp3yv97').toString(10),
              { from: o3 }
            ),
            "Can't reject self-update action"
          );
          await this.contourVerificationManager.rejectWithExistingPointInclusionProof(
            cvId1,
            v3,
            Inclusion.VERIFYING_INSIDE_EXISTING,
            tokenId2,
            3,
            galt.geohashToNumber('dr5qvnp3wp47').toString(10),
            { from: o3 }
          );
          await this.contourVerificationManager.pushRejection(cvId1);

          res = await this.updatePropertyManager.getApplication(aId);
          assert.equal(res.status, ApplicationStatus.CV_REJECTED);

          // resubmit
          await this.updatePropertyManager.setContour(
            aId,
            // customArea
            678,
            contour5,
            {
              from: alice
            }
          );

          // submit CV again
          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
          res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, {
            from: alice
          });
          const cvId2 = res.logs[0].args.applicationId;

          // v1 and v2 were slashed
          await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v1 });
          await this.contourVerifiers.deposit(ether(200), v1, { from: v1 });

          await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v2 });
          await this.contourVerifiers.deposit(ether(200), v2, { from: v2 });

          await this.contourVerificationManager.approve(cvId2, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId2, v2, { from: o2 });
          await this.contourVerificationManager.approve(cvId2, v3, { from: o3 });

          await assertRevert(this.contourVerificationManager.pushRejection(cvId1), 'Already executed');
          await assertRevert(this.contourVerificationManager.pushApproval(cvId1), 'Expect APPROVAL_TIMEOUT status');

          await evmIncreaseTime(3600 * 9);
          await assertRevert(this.contourVerificationManager.pushRejection(cvId2), 'Expect REJECTED status');
          await this.contourVerificationManager.pushApproval(cvId2);

          res = await this.updatePropertyManager.getApplication(aId);
          assert.equal(res.status, ApplicationStatus.PENDING);
        });
      });
    });

    describe('pipeline', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.updatePropertyManager.address, this.fee, { from: alice });
        const res = await this.updatePropertyManager.submit(
          this.pggConfigX.address,
          this.tokenId,
          true,
          // area
          123,
          this.dataLink,
          this.humanAddress,
          this.credentials,
          this.ledgerIdentifier,
          this.fee,
          { from: alice }
        );
        this.aId = res.logs[0].args.applicationId;

        await this.updatePropertyManager.setContour(this.aId, 771000, this.contour, { from: alice });
      });

      describe('#cancel()', () => {
        beforeEach(async function() {
          assert.equal(
            await this.contourVerificationSourceRegistry.hasSource(this.updatePropertyManager.address),
            true
          );

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
          let res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
            from: alice
          });
          const cvId1 = res.logs[0].args.applicationId;

          await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
          await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
          await evmIncreaseTime(3600 * 9);
          await this.contourVerificationManager.pushApproval(cvId1);

          res = await this.updatePropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.PENDING);
        });

        it('should allow an applicant cancelling never locked application', async function() {
          // timeout is 180
          await assertRevert(
            this.updatePropertyManager.cancel(this.aId, { from: alice }),
            'Timeout has not passed yet'
          );

          await evmIncreaseTime(170);

          // timeout still has not passed yet
          await assertRevert(
            this.updatePropertyManager.cancel(this.aId, { from: alice }),
            'Timeout has not passed yet'
          );

          await evmIncreaseTime(20);

          // now it's passed
          await assertRevert(this.updatePropertyManager.cancel(this.aId, { from: frank }), 'Invalid applicant');

          await this.updatePropertyManager.cancel(this.aId, { from: alice });

          await assertRevert(
            this.updatePropertyManager.cancel(this.aId, { from: alice }),
            'Application status should be PENDING'
          );

          const aliceInitialBalance = new BN((await this.galtToken.balanceOf(alice)).toString(10));
          await this.updatePropertyManager.claimApplicantFee(this.aId, { from: alice });
          const aliceFinalBalance = new BN((await this.galtToken.balanceOf(alice)).toString(10));

          assertEqualBN(aliceFinalBalance, aliceInitialBalance.add(new BN(ether(50))));

          await assertRevert(
            this.updatePropertyManager.claimApplicantFee(this.aId, { from: alice }),
            'Fee already paid out'
          );
        });
      });

      describe('#close()', () => {
        beforeEach(async function() {
          assert.equal(
            await this.contourVerificationSourceRegistry.hasSource(this.updatePropertyManager.address),
            true
          );

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        });

        describe('after oracle revert', () => {
          beforeEach(async function() {
            const res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
              from: alice
            });
            const cvId1 = res.logs[0].args.applicationId;

            await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
            await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
            await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
            await evmIncreaseTime(3600 * 9);
            await this.contourVerificationManager.pushApproval(cvId1);
            await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
            await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });
            await this.updatePropertyManager.revert(this.aId, 'dont like it', { from: bob });
            // timeout is 240
          });

          it('should immediately change status to CLOSED on the applicant call', async function() {
            await this.updatePropertyManager.close(this.aId, { from: alice });

            const res = await this.updatePropertyManager.getApplication(this.aId);
            assert.equal(res.status, ApplicationStatus.CLOSED);
          });

          it('should expect a timeout if called by non-applicant', async function() {
            await evmIncreaseTime(230);
            await assertRevert(this.updatePropertyManager.close(this.aId, { from: bob }), 'Timeout has not passed yet');
            await evmIncreaseTime(20);
            await this.updatePropertyManager.close(this.aId, { from: bob });

            const res = await this.updatePropertyManager.getApplication(this.aId);
            assert.equal(res.status, ApplicationStatus.CLOSED);

            await assertRevert(this.updatePropertyManager.close(this.aId, { from: bob }));
            await assertRevert(this.updatePropertyManager.close(this.aId, { from: alice }));
          });
        });
      });

      describe('#resubmit()', () => {
        beforeEach(async function() {
          assert.equal(
            await this.contourVerificationSourceRegistry.hasSource(this.updatePropertyManager.address),
            true
          );

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
          const res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
            from: alice
          });
          const cvId1 = res.logs[0].args.applicationId;

          await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
          await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
          await evmIncreaseTime(3600 * 9);
          await this.contourVerificationManager.pushApproval(cvId1);

          await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
          await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });
          await this.updatePropertyManager.approve(this.aId, this.credentials, { from: dan });
          await this.updatePropertyManager.revert(this.aId, 'blah', { from: bob });
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

            await this.galtToken.approve(this.updatePropertyManager.address, this.fee, { from: alice });
          });

          it('could accept another payment', async function() {
            await this.updatePropertyManager.resubmit(
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

            let res = await this.updatePropertyManager.getApplication(this.aId);
            assert.equal(res.status, ApplicationStatus.PARTIALLY_RESUBMITTED);

            await this.updatePropertyManager.setContour(this.aId, newHighestPoint, newContour, { from: alice });

            res = await this.updatePropertyManager.getApplication(this.aId);
            assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);

            res = await this.updatePropertyManager.getApplicationDetails(this.aId);
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
              this.updatePropertyManager.resubmit(
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

            const res = await this.updatePropertyManager.getApplication(this.aId);
            assert.equal(res.status, ApplicationStatus.REVERTED);
          });
        });

        describe('contour doesnt changed', () => {
          it('should change old details data with a new', async function() {
            let res = await this.updatePropertyManager.getApplicationDetails(this.aId);
            assert.equal(res.credentialsHash, this.credentials);
            assert.equal(res.areaSource, AreaSource.USER_INPUT);
            assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));

            await this.updatePropertyManager.resubmit(
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

            res = await this.updatePropertyManager.getApplication(this.aId);
            assert.equal(res.status, ApplicationStatus.PENDING);

            res = await this.updatePropertyManager.getApplicationDetails(this.aId);
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
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        const surveyorKey = await this.updatePropertyManager.getOracleTypeShareKey(PL_SURVEYOR);
        const lawyerKey = await this.updatePropertyManager.getOracleTypeShareKey(PL_LAWYER);

        let res = await this.pggConfigX.applicationConfig(surveyorKey);
        assert.equal(res, 52);
        res = await this.pggConfigX.applicationConfig(lawyerKey);
        assert.equal(res, 48);

        this.fee = ether(200);
        await this.galtToken.approve(this.updatePropertyManager.address, this.fee, { from: alice });
        res = await this.updatePropertyManager.submit(
          this.pggConfigX.address,
          this.tokenId,
          true,
          // area
          123,
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

        await this.updatePropertyManager.setContour(this.aId, 771000, this.contour, { from: alice });

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);

        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.updatePropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

        res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });
      });

      describe('on approved(->stored)', () => {
        beforeEach(async function() {
          await this.updatePropertyManager.approve(this.aId, this.credentials, { from: bob });
          await this.updatePropertyManager.approve(this.aId, this.credentials, { from: dan });
          const res = await this.updatePropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.APPROVED);
          await this.updatePropertyManager.store(this.aId, { from: unauthorized });
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString(10));

          await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
          await this.updatePropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString(10));

          let res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.reward.toString(), '90480000000000000000');
          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.reward.toString(), '83520000000000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('90480000000000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('83520000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('26000000000000000000')));
        });
      });

      describe('on reject', () => {
        beforeEach(async function() {
          await this.updatePropertyManager.reject(this.aId, 'malicious', { from: bob });
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString(10));

          await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
          await this.updatePropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString(10));

          const res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.reward.toString(), '90480000000000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('90480000000000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('83520000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('26000000000000000000')));
        });
      });

      describe('on close', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.updatePropertyManager.revert(this.aId, this.credentials, { from: bob });
          await this.updatePropertyManager.close(this.aId, { from: alice });

          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString());

          await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
          await this.updatePropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString(10));

          const res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
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
        .approve(this.updatePropertyManager.address, this.fee)
        .encodeABI();
      let res = await this.sharedMultiSig.submitTransaction(this.galtToken.address, 0, approveData, {
        from: alice
      });
      let txId = res.logs[0].args.transactionId;
      res = await this.sharedMultiSig.confirmTransaction(txId, { from: charlie });

      // submit application
      const submitData = this.updatePropertyManager.contract.methods
        .submit(SpaceTokenType.LAND_PLOT, 771000, this.contour, 0, this.pggConfigX.address, this.fee)
        .encodeABI();
      res = await this.sharedMultiSig.submitTransaction(this.updatePropertyManager.address, 0, submitData, {
        from: alice
      });
      txId = res.logs[0].args.transactionId;
      await this.sharedMultiSig.confirmTransaction(txId, { from: charlie });
      res = await this.sharedMultiSig.transactions(txId);
      assert.equal(res.executed, true);

      // fetch txId from tx response field response
      this.aId = res.lastResponse;

      // assert id is correct
      res = await this.updatePropertyManager.getApplication(this.aId);
      assert.equal(res.status, ApplicationStatus.PARTIALLY_SUBMITTED);

      // cv
      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

      res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
        from: alice
      });
      const cvId1 = res.logs[0].args.applicationId;

      await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
      await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
      await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
      await evmIncreaseTime(3600 * 9);
      await this.contourVerificationManager.pushApproval(cvId1);

      res = await this.updatePropertyManager.getApplication(this.aId);
      assert.equal(res.status, ApplicationStatus.PENDING);

      // lock
      await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
      await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });

      // approve
      await this.updatePropertyManager.approve(this.aId, this.credentials, { from: bob });
      await this.updatePropertyManager.approve(this.aId, this.credentials, { from: dan });

      // withdraw token
      const claimData = this.updatePropertyManager.contract.methods.claimSpaceToken(this.aId).encodeABI();
      res = await this.sharedMultiSig.submitTransaction(this.updatePropertyManager.address, 0, claimData, {
        from: alice
      });
      txId = res.logs[0].args.transactionId;
      await this.sharedMultiSig.confirmTransaction(txId, { from: charlie });
      res = await this.sharedMultiSig.transactions(txId);
      assert.equal(res.executed, true);

      res = await this.updatePropertyManager.getApplication(this.aId);
      res = await this.spaceToken.ownerOf(res.spaceTokenId);
      assert.equal(res, this.sharedMultiSig.address);
    });
  });

  describe('application pipeline for ETH', () => {
    beforeEach(async function() {
      this.fee = ether(20);

      const res = await this.updatePropertyManager.submit(
        this.pggConfigX.address,
        this.tokenId,
        true,
        // area
        123,
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

      await this.updatePropertyManager.setContour(this.aId, 771000, this.contour, { from: alice });
    });

    describe('#submit()', () => {
      it('should provide methods to create and read an application', async function() {
        let res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);
        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);
        assert.equal(res.applicant, alice);

        res = await this.updatePropertyManager.getApplicationDetails(this.aId);
        assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), this.initLedgerIdentifier);
      });

      describe('payable', () => {
        it('should reject applications if ETH payment is disabled', async function() {
          const res = await this.spaceToken.mint(alice, { from: minter });
          const tokenId = res.logs[0].args.tokenId.toNumber();
          await this.spaceToken.approve(this.updatePropertyManager.address, tokenId, { from: alice });

          await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });
          this.applicationConfig[bytes32('PL_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.GALT_ONLY);

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
            this.updatePropertyManager.submit(
              pggDisabledEth.config.address,
              tokenId,
              true,
              // area
              123,
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
          const res = await this.spaceToken.mint(alice, { from: minter });
          const tokenId = res.logs[0].args.tokenId.toNumber();
          await this.spaceToken.approve(this.updatePropertyManager.address, tokenId, { from: alice });
          await assertRevert(
            this.updatePropertyManager.submit(
              this.pggConfigX.address,
              tokenId,
              true,
              // area
              123,
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
          const res = await this.spaceToken.mint(alice, { from: minter });
          const tokenId = res.logs[0].args.tokenId.toNumber();
          await this.spaceToken.approve(this.updatePropertyManager.address, tokenId, { from: alice });
          await assertRevert(
            this.updatePropertyManager.submit(
              this.pggConfigX.address,
              tokenId,
              true,
              // area
              123,
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

        it('should change status to PENDING if no contour or the highest point change required', async function() {
          let res = await this.spaceToken.mint(alice, { from: minter });
          const tokenId = res.logs[0].args.tokenId.toNumber();
          await this.spaceToken.approve(this.updatePropertyManager.address, tokenId, { from: alice });
          res = await this.updatePropertyManager.submit(
            this.pggConfigX.address,
            tokenId,
            false,
            // area
            123,
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
          const aId = res.logs[0].args.applicationId;
          res = await this.updatePropertyManager.getApplication(aId);
          assert.equal(res.status, ApplicationStatus.PENDING);

          await assertRevert(
            this.updatePropertyManager.setContour(aId, 771000, this.contour, { from: alice }),
            'setContour(): Incorrect status',
            false
          );
        });

        it('should calculate corresponding oracle and coreTeam rewards in Eth', async function() {
          const res = await this.updatePropertyManager.getApplicationRewards(this.aId);
          assert.equal(res.oraclesReward, 13400000000000000000);
          assert.equal(res.galtProtocolFee, 6600000000000000000);
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          let res = await this.updatePropertyManager.getApplicationRewards(this.aId);
          assert.equal(res.currency, Currency.ETH);
          assert.equal(res.oraclesReward, 13400000000000000000);

          res = await this.updatePropertyManager.getApplication(this.aId);
          assert.sameMembers(res.assignedOracleTypes.map(hexToUtf8), [PL_SURVEYOR, PL_LAWYER].map(hexToUtf8));

          // 52%
          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.reward.toString(), '6968000000000000000');

          // 48%
          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.reward.toString(), '6432000000000000000');
        });
      });
    });

    describe('#close()', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.updatePropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        const res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);
        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });
        await this.updatePropertyManager.revert(this.aId, 'dont like it', { from: bob });
        // timeout is 240
      });

      it('should immediately change status to CLOSED on the applicant call', async function() {
        await this.updatePropertyManager.close(this.aId, { from: alice });

        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.CLOSED);
      });

      it('should expect a timeout if called by non-applicant', async function() {
        await evmIncreaseTime(230);
        await assertRevert(this.updatePropertyManager.close(this.aId, { from: bob }), 'Timeout has not passed yet');
        await evmIncreaseTime(20);
        await this.updatePropertyManager.close(this.aId, { from: bob });

        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.CLOSED);
      });
    });

    describe('#resubmit()', () => {
      beforeEach(async function() {
        let res = await this.spaceToken.mint(alice, { from: minter });
        const tokenId = res.logs[0].args.tokenId.toNumber();
        await this.spaceToken.approve(this.updatePropertyManager.address, tokenId, { from: alice });
        res = await this.updatePropertyManager.submit(
          this.pggConfigX.address,
          tokenId,
          true,
          // area
          123,
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

        await this.updatePropertyManager.setContour(this.aId, 771000, this.contour, { from: alice });
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.updatePropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });
        await this.updatePropertyManager.approve(this.aId, this.credentials, { from: dan });
        await this.updatePropertyManager.revert(this.aId, 'blah', { from: bob });
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
          await this.updatePropertyManager.resubmit(
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

          let res = await this.updatePropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.PARTIALLY_RESUBMITTED);

          await this.updatePropertyManager.setContour(this.aId, newHighestPoint, newContour, { from: alice });

          res = await this.updatePropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.CONTOUR_VERIFICATION);

          res = await this.updatePropertyManager.getApplicationDetails(this.aId);
          assert.equal(res.credentialsHash, newCredentiasHash);
          assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
          assert.equal(res.areaSource, AreaSource.USER_INPUT);
          assert.equal(res.area, 123);
          assert.equal(res.dataLink, newDataLink);
          assert.equal(res.humanAddress, newHumanAddress);
          assert.equal(res.highestPoint, newHighestPoint);
          assert.sameMembers(res.contour, newContour);

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.oracle, bob);
          assert.equal(res.status, ValidationStatus.LOCKED);

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.oracle, dan);
          assert.equal(res.status, ValidationStatus.LOCKED);
        });

        it('should reject on payment both in ETH and GALT', async function() {
          await assertRevert(
            this.updatePropertyManager.resubmit(
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

          const res = await this.updatePropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.REVERTED);
        });

        it('should reject on GALT payment', async function() {
          await assertRevert(
            this.updatePropertyManager.resubmit(
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

          const res = await this.updatePropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.REVERTED);
        });

        it('should accept a resubmission without payment', async function() {
          await this.updatePropertyManager.resubmit(
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

          const res = await this.updatePropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.PARTIALLY_RESUBMITTED);
        });
      });

      describe('contour doesnt changed', () => {
        it('should change old details data with a new', async function() {
          let res = await this.updatePropertyManager.getApplicationDetails(this.aId);
          assert.equal(res.credentialsHash, this.credentials);
          assert.equal(res.areaSource, AreaSource.USER_INPUT);
          assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));

          await this.updatePropertyManager.resubmit(
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

          res = await this.updatePropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.PENDING);

          res = await this.updatePropertyManager.getApplicationDetails(this.aId);
          assert.equal(res.credentialsHash, newCredentiasHash);
          assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), 'foo-123');
          assert.equal(res.areaSource, AreaSource.USER_INPUT);
          assert.equal(res.area, 123);
          assert.equal(res.dataLink, newDataLink);
          assert.equal(res.humanAddress, newHumanAddress);
          assert.equal(res.highestPoint, 771000);
          assert.sameMembers(res.contour, this.contour);

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.oracle, bob);
          assert.equal(res.status, ValidationStatus.LOCKED);

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.oracle, dan);
          assert.equal(res.status, ValidationStatus.LOCKED);
        });
      });
    });

    describe('#cancel()', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.updatePropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should allow an applicant cancelling never locked application', async function() {
        // timeout is 180
        await assertRevert(this.updatePropertyManager.cancel(this.aId, { from: alice }), 'Timeout has not passed yet');

        await evmIncreaseTime(170);

        // timeout still has not passed yet
        await assertRevert(this.updatePropertyManager.cancel(this.aId, { from: alice }), 'Timeout has not passed yet');

        await evmIncreaseTime(20);

        // now it's passed
        await assertRevert(this.updatePropertyManager.cancel(this.aId, { from: frank }), 'Invalid applicant');

        await this.updatePropertyManager.cancel(this.aId, { from: alice });

        await assertRevert(
          this.updatePropertyManager.cancel(this.aId, { from: alice }),
          'Application status should be PENDING'
        );

        const aliceInitialBalance = await web3.eth.getBalance(alice);
        await this.updatePropertyManager.claimApplicantFee(this.aId, { from: alice });
        const aliceFinalBalance = await web3.eth.getBalance(alice);

        assertEthBalanceChanged(aliceInitialBalance, aliceFinalBalance, ether(20));

        await assertRevert(
          this.updatePropertyManager.claimApplicantFee(this.aId, { from: alice }),
          'Fee already paid out'
        );
      });

      it('should deny an applicant cancelling the application if it was locked once', async function() {
        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.unlock(this.aId, PL_SURVEYOR, { from: bob });

        // timeout is 180
        await assertRevert(this.updatePropertyManager.cancel(this.aId, { from: alice }), 'Timeout has not passed yet');

        await evmIncreaseTime(170);

        // timeout still has not passed yet
        await assertRevert(this.updatePropertyManager.cancel(this.aId, { from: alice }), 'Timeout has not passed yet');

        await evmIncreaseTime(20);

        // now it's passed, but since the application was locked before, you can't cancel it
        await assertRevert(
          this.updatePropertyManager.cancel(this.aId, { from: alice }),
          'The application has been already locked at least once'
        );
      });
    });

    describe('#lock()', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.updatePropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should allow multiple oracles of different roles to lock a submitted application', async function() {
        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });

        let res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);
      });

      // eslint-disable-next-line
      it("should deny a oracle with the same role to lock an application which is already on consideration", async function() {
        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await assertRevert(this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: charlie }));
      });

      it('should deny oracle to lock an application which is already approved', async function() {
        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });

        await this.updatePropertyManager.approve(this.aId, this.credentials, { from: bob });
        await this.updatePropertyManager.approve(this.aId, this.credentials, { from: dan });

        await assertRevert(this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: charlie }));
        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      it('should deny non-oracle to lock an application', async function() {
        await assertRevert(this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: coreTeam }));
        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });
    });

    describe('#unlock() for oracle roles in LOCKED status', () => {
      beforeEach(async function() {
        assert.equal(await this.contourVerificationSourceRegistry.hasSource(this.updatePropertyManager.address), true);

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
      });

      // an oracle could unlock himself without any timeout
      // anyone could unlock an oracle after timeout
      it('should allow the oracle unlocking himself anytime', async function() {
        await this.updatePropertyManager.unlock(this.aId, PL_SURVEYOR, { from: bob });

        let res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
        assert.equal(res.oracle, zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);

        await assertRevert(
          this.updatePropertyManager.unlock(this.aId, PL_SURVEYOR, { from: bob }),
          'Validation status should be LOCKED'
        );
      });

      it('should allow anyone unlocking an oracle after timeout', async function() {
        // timeout is 360
        await assertRevert(
          this.updatePropertyManager.unlock(this.aId, PL_SURVEYOR, { from: alice }),
          'Timeout has not passed yet'
        );

        await evmIncreaseTime(350);

        // timeout still not passed yet
        await assertRevert(
          this.updatePropertyManager.unlock(this.aId, PL_SURVEYOR, { from: alice }),
          'Timeout has not passed yet'
        );

        let res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        await evmIncreaseTime(20);

        // not it's passed
        await this.updatePropertyManager.unlock(this.aId, PL_SURVEYOR, { from: alice });

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
        assert.equal(res.oracle, zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);

        await assertRevert(
          this.updatePropertyManager.unlock(this.aId, PL_SURVEYOR, { from: alice }),
          'Validation status should be LOCKED'
        );
      });
    });

    describe('#approve()', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });
      });

      it('should allow a oracle approve application', async function() {
        await this.updatePropertyManager.approve(this.aId, this.credentials, { from: bob });

        let res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.updatePropertyManager.approve(this.aId, this.credentials, { from: dan });

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      it('should deny a oracle approve application if hash doesnt match', async function() {
        await assertRevert(this.updatePropertyManager.approve(this.aId, web3.utils.sha3(`foo`), { from: bob }));
        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should deny non-oracle approve application', async function() {
        await assertRevert(this.updatePropertyManager.approve(this.aId, this.credentials, { from: alice }));
        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      // eslint-disable-next-line
      it("should deny oracle approve application with other than consideration or partially locked status", async function() {
        await this.updatePropertyManager.reject(this.aId, 'suspicious', { from: bob });

        let res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);

        await assertRevert(this.updatePropertyManager.approve(this.aId, this.credentials, { from: bob }));
        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });

      it('should change status to STORED if there is no contour/highest point change required', async function() {
        let res = await this.spaceToken.mint(alice, { from: minter });
        const tokenId = res.logs[0].args.tokenId.toNumber();
        await this.spaceToken.approve(this.updatePropertyManager.address, tokenId, { from: alice });

        const ledgerIdentifier1 = web3.utils.utf8ToHex('ledger identifier 1');
        const ledgerIdentifier2 = web3.utils.utf8ToHex('ledger identifier 2');

        // TODO: setup existing fields
        await this.spaceGeoData.setType(tokenId, SpaceTokenType.LAND_PLOT, { from: geoDataManager });
        await this.spaceGeoData.setArea(tokenId, 1122, AreaSource.USER_INPUT, { from: geoDataManager });
        await this.spaceGeoData.setDataLink(tokenId, 'data link 1', { from: geoDataManager });
        await this.spaceGeoData.setHumanAddress(tokenId, 'address 1', { from: geoDataManager });
        await this.spaceGeoData.setLedgerIdentifier(tokenId, ledgerIdentifier1, {
          from: geoDataManager
        });

        res = await this.updatePropertyManager.submit(
          this.pggConfigX.address,
          tokenId,
          false,
          // area
          3344,
          'data link 2',
          'human address 2',
          this.credentials,
          ledgerIdentifier2,
          0,
          {
            from: alice,
            value: this.fee
          }
        );
        const aId = res.logs[0].args.applicationId;

        await this.updatePropertyManager.lock(aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(aId, PL_LAWYER, { from: dan });

        await this.updatePropertyManager.approve(aId, this.credentials, { from: bob });
        await this.updatePropertyManager.approve(aId, this.credentials, { from: dan });

        res = await this.updatePropertyManager.getApplication(aId);
        assert.equal(res.status, ApplicationStatus.STORED);

        assert.equal(await this.spaceGeoData.getArea(tokenId), 3344);
        assert.equal(await this.spaceGeoData.getDataLink(tokenId), 'data link 2');
        assert.equal(await this.spaceGeoData.getHumanAddress(tokenId), 'human address 2');
        assert.equal(web3.utils.hexToUtf8(await this.spaceGeoData.getLedgerIdentifier(tokenId)), 'ledger identifier 2');
      });

      it('should change status to STORED after contour/height changed', async function() {
        let res = await this.spaceToken.mint(alice, { from: minter });
        const tokenId = res.logs[0].args.tokenId.toNumber();
        await this.spaceToken.approve(this.updatePropertyManager.address, tokenId, { from: alice });

        const rawContour3 = ['dr5qvnp9c7b2', 'dr5qvnp3ewcv', 'dr5qvnp37vs4', 'dr5qvnp99ddh'];
        const contour3 = rawContour3.map(galt.geohashToNumber).map(a => a.toString(10));
        const rawContour5 = ['dr5qvnp3vur6', 'dr5qvnp3yv97', 'dr5qvnp3ybpq', 'dr5qvnp3wp47'];
        const contour5 = rawContour5.map(galt.geohashToNumber).map(a => a.toString(10));

        const ledgerIdentifier1 = web3.utils.utf8ToHex('ledger identifier 1');
        const ledgerIdentifier2 = web3.utils.utf8ToHex('ledger identifier 2');

        await this.spaceGeoData.setType(tokenId, SpaceTokenType.LAND_PLOT, { from: geoDataManager });
        await this.spaceGeoData.setHighestPoint(tokenId, 999888, { from: geoDataManager });
        await this.spaceGeoData.setContour(tokenId, contour3, { from: geoDataManager });
        await this.spaceGeoData.setArea(tokenId, 1122, AreaSource.USER_INPUT, { from: geoDataManager });
        await this.spaceGeoData.setDataLink(tokenId, 'data link 1', { from: geoDataManager });
        await this.spaceGeoData.setHumanAddress(tokenId, 'address 1', { from: geoDataManager });
        await this.spaceGeoData.setLedgerIdentifier(tokenId, ledgerIdentifier1, {
          from: geoDataManager
        });

        res = await this.updatePropertyManager.submit(
          this.pggConfigX.address,
          tokenId,
          true,
          // area
          3344,
          'data link 2',
          'human address 2',
          this.credentials,
          ledgerIdentifier2,
          0,
          {
            from: alice,
            value: this.fee
          }
        );
        const aId = res.logs[0].args.applicationId;

        await this.updatePropertyManager.setContour(aId, 771000, contour5, { from: alice });

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.updatePropertyManager.getApplication(aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.updatePropertyManager.lock(aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(aId, PL_LAWYER, { from: dan });

        await this.updatePropertyManager.approve(aId, this.credentials, { from: bob });
        await this.updatePropertyManager.approve(aId, this.credentials, { from: dan });

        // check APPROVED
        res = await this.updatePropertyManager.getApplication(aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);

        assert.equal(await this.spaceGeoData.getArea(tokenId), 3344);
        assert.equal(await this.spaceGeoData.getDataLink(tokenId), 'data link 2');
        assert.equal(await this.spaceGeoData.getHumanAddress(tokenId), 'human address 2');
        assert.equal(web3.utils.hexToUtf8(await this.spaceGeoData.getLedgerIdentifier(tokenId)), 'ledger identifier 2');

        assert.equal(await this.spaceGeoData.getHighestPoint(tokenId), 999888);

        res = await this.spaceGeoData.getContour(tokenId);

        for (let i = 0; i < res.length; i++) {
          assert.equal(res[i].toString(10), contour3[i]);
        }

        // check STORED
        await this.updatePropertyManager.store(aId, { from: unauthorized });

        assert.equal(await this.spaceGeoData.getHighestPoint(tokenId), 771000);

        res = await this.spaceGeoData.getContour(tokenId);

        for (let i = 0; i < res.length; i++) {
          assert.equal(res[i].toString(10), contour5[i]);
        }
      });
    });

    describe('#revert()', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });
      });

      it('should allow a oracle revert application', async function() {
        await this.updatePropertyManager.revert(this.aId, 'it looks suspicious', { from: bob });
        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      // eslint-disable-next-line
      it("should deny another assigned oracle revert application after it was already reverted", async function() {
        await this.updatePropertyManager.revert(this.aId, 'it looks suspicious', { from: bob });
        await assertRevert(this.updatePropertyManager.revert(this.aId, 'blah', { from: dan }));
        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should not reset validation statuses of another oracles', async function() {
        await this.updatePropertyManager.approve(this.aId, this.credentials, { from: dan });
        await this.updatePropertyManager.revert(this.aId, 'it looks suspicious', { from: bob });

        let res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.REVERTED);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.APPROVED);
      });

      it('should deny non-oracle revert application', async function() {
        await assertRevert(this.updatePropertyManager.revert(this.aId, 'blah', { from: alice }));
        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should deny oracle revert an application with non-consideration status', async function() {
        await this.updatePropertyManager.reject(this.aId, 'suspicious', { from: bob });

        let res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);

        await assertRevert(this.updatePropertyManager.revert(this.aId, 'blah', { from: bob }));
        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });
    });

    describe('#reject()', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });
      });

      it('should allow a oracle reject application', async function() {
        await this.updatePropertyManager.reject(this.aId, 'my reason', { from: bob });
        // TODO: check the message

        let res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.REJECTED);
        assert.equal(res.message, 'my reason');

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);
        assert.equal(res.message, '');
      });

      it('should deny non-oracle reject application', async function() {
        await assertRevert(this.updatePropertyManager.reject(this.aId, 'hey', { from: alice }));
        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should deny oracle revert an application with non-submitted status', async function() {
        await this.updatePropertyManager.revert(this.aId, 'some reason', { from: bob });
        await assertRevert(this.updatePropertyManager.reject(this.aId, 'another reason', { from: bob }));
        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });
    });

    describe('#withdrawSpaceToken()', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);
      });

      it('should allow withdrawing from CANCELLED status', async function() {
        await assertRevert(
          this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice }),
          'withdrawSpaceToken(): invalid status',
          false
        );

        await evmIncreaseTime(190);

        await this.updatePropertyManager.cancel(this.aId, { from: alice });

        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.CANCELLED);

        await this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice });
        assert.equal(await this.spaceToken.ownerOf(this.tokenId), alice);
      });

      it('should allow withdrawing from CLOSED status', async function() {
        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });

        await this.updatePropertyManager.revert(this.aId, PL_SURVEYOR, { from: bob });
        await assertRevert(
          this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice }),
          'withdrawSpaceToken(): invalid status',
          false
        );

        await evmIncreaseTime(250);

        await this.updatePropertyManager.close(this.aId, { from: unauthorized });

        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.CLOSED);

        await this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice });
        assert.equal(await this.spaceToken.ownerOf(this.tokenId), alice);
      });

      it('should allow withdrawing from STORED status', async function() {
        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });

        await this.updatePropertyManager.approve(this.aId, this.credentials, { from: bob });
        await this.updatePropertyManager.approve(this.aId, this.credentials, { from: dan });

        let res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);

        await assertRevert(
          this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice }),
          'withdrawSpaceToken(): invalid status',
          false
        );
        await this.updatePropertyManager.store(this.aId, { from: unauthorized });

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.STORED);
        await this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice });
        assert.equal(await this.spaceToken.ownerOf(this.tokenId), alice);
      });

      it('should allow withdrawing from REJECTED status', async function() {
        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });

        await this.updatePropertyManager.approve(this.aId, this.credentials, { from: bob });
        await this.updatePropertyManager.reject(this.aId, this.credentials, { from: dan });

        const res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);

        await this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice });
        assert.equal(await this.spaceToken.ownerOf(this.tokenId), alice);
      });

      it('should NOT transfer SpaceToken to non-applicant', async function() {
        await assertRevert(this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: bob }));
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
        let res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
          from: alice
        });
        const cvId1 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
        await evmIncreaseTime(3600 * 9);
        await this.contourVerificationManager.pushApproval(cvId1);

        res = await this.updatePropertyManager.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.PENDING);

        await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });
      });

      describe('on approve(->stored)', () => {
        beforeEach(async function() {
          await this.updatePropertyManager.approve(this.aId, this.credentials, { from: bob });
          await this.updatePropertyManager.approve(this.aId, this.credentials, { from: dan });
          await this.updatePropertyManager.store(this.aId, { from: unauthorized });

          const res = await this.updatePropertyManager.getApplication(this.aId);
          assert.equal(res.status, ApplicationStatus.STORED);
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = await web3.eth.getBalance(bob);
          const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });

          let res = await this.updatePropertyManager.protocolFeesEth();
          assert.equal(res, ether(6.6));
          await this.updatePropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

          const bobsFinalBalance = await web3.eth.getBalance(bob);
          const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.reward.toString(), '6968000000000000000');
          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.reward.toString(), '6432000000000000000');

          res = await this.updatePropertyManager.getApplicationRewards(this.aId);
          assert.equal(res.galtProtocolFee.toString(), '6600000000000000000');

          assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(6.968));
          assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(6.432));
          assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(6.6));
        });
      });

      describe('on reject', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.updatePropertyManager.reject(this.aId, this.credentials, { from: bob });

          const bobsInitialBalance = await web3.eth.getBalance(bob);
          const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
          await this.updatePropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

          const bobsFinalBalance = await web3.eth.getBalance(bob);
          const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          let res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.reward.toString(), '6968000000000000000');
          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.reward.toString(), '6432000000000000000');

          res = await this.updatePropertyManager.getApplicationRewards(this.aId);
          assert.equal(res.galtProtocolFee.toString(), '6600000000000000000');

          assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(6.968));
          assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(6.432));
          assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(6.6));
        });
      });

      describe('on close', () => {
        it('should allow oracles claim reward after reject', async function() {
          await this.updatePropertyManager.revert(this.aId, 'dont like it', { from: bob });
          await this.updatePropertyManager.close(this.aId, { from: alice });

          const bobsInitialBalance = await web3.eth.getBalance(bob);
          const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
          await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
          await this.updatePropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

          const bobsFinalBalance = await web3.eth.getBalance(bob);
          const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

          let res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.reward.toString(), '6968000000000000000');
          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.reward.toString(), '6432000000000000000');

          res = await this.updatePropertyManager.getApplicationRewards(this.aId);
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
      const submitData = this.updatePropertyManager.contract.methods
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
      let res = await this.sharedMultiSig.submitTransaction(this.updatePropertyManager.address, this.fee, submitData, {
        from: alice
      });
      let txId = res.logs[0].args.transactionId;
      await this.sharedMultiSig.confirmTransaction(txId, { from: charlie });
      res = await this.sharedMultiSig.transactions(txId);
      assert.equal(res.executed, true);

      // fetch txId from tx response field response
      this.aId = res.lastResponse;

      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
      res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, this.aId, {
        from: alice
      });
      const cvId1 = res.logs[0].args.applicationId;

      await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
      await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
      await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
      await evmIncreaseTime(3600 * 9);
      await this.contourVerificationManager.pushApproval(cvId1);

      // assert id is correct
      res = await this.updatePropertyManager.getApplication(this.aId);
      assert.equal(res.status, ApplicationStatus.PENDING);

      // lock
      await this.updatePropertyManager.lock(this.aId, PL_SURVEYOR, { from: bob });
      await this.updatePropertyManager.lock(this.aId, PL_LAWYER, { from: dan });

      // approve
      await this.updatePropertyManager.approve(this.aId, this.credentials, { from: bob });
      await this.updatePropertyManager.approve(this.aId, this.credentials, { from: dan });

      // withdraw token
      const claimData = this.updatePropertyManager.contract.methods.claimSpaceToken(this.aId).encodeABI();
      res = await this.sharedMultiSig.submitTransaction(this.updatePropertyManager.address, 0, claimData, {
        from: alice
      });
      txId = res.logs[0].args.transactionId;
      await this.sharedMultiSig.confirmTransaction(txId, { from: charlie });
      res = await this.sharedMultiSig.transactions(txId);
      assert.equal(res.executed, true);

      res = await this.updatePropertyManager.getApplication(this.aId);
      res = await this.spaceToken.ownerOf(res.spaceTokenId);
      assert.equal(res, this.sharedMultiSig.address);
    });
  });
});
