const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const MockAddContourApplication = artifacts.require('./MockAddContourApplication.sol');
const MockUpdateContourApplication = artifacts.require('./MockUpdateContourApplication.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const ContourVerificationManager = artifacts.require('./ContourVerificationManager.sol');
const ContourVerificationManagerLib = artifacts.require('./ContourVerificationManagerLib.sol');
const ContourVerifiers = artifacts.require('./ContourVerifiers.sol');
const ContourVerificationSourceRegistry = artifacts.require('./ContourVerificationSourceRegistry.sol');
const LandUtils = artifacts.require('./LandUtils.sol');
const PolygonUtils = artifacts.require('./PolygonUtils.sol');
const galt = require('@galtproject/utils');

const Web3 = require('web3');

ContourVerifiers.numberFormat = 'String';
ContourVerificationManager.numberFormat = 'String';
GaltToken.numberFormat = 'String';

const {
  ether,
  deploySpaceGeoDataLight,
  assertGaltBalanceChanged,
  assertEthBalanceChanged,
  assertRevert,
  initHelperWeb3,
  initHelperArtifacts,
  evmIncreaseTime,
  paymentMethods
} = require('../../helpers');

const { web3 } = SpaceRA;

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const ApplicationStatus = {
  NOT_EXISTS: 0,
  CONTOUR_VERIFICATION: 1,
  SUBMITTED: 2,
  APPROVED: 3,
  REJECTED: 4,
  REVERTED: 5,
  CLOSED: 6
};

const CVStatus = {
  NULL: 0,
  PENDING: 1,
  APPROVAL_TIMEOUT: 2,
  APPROVED: 3,
  REJECTED: 4
};

const Currency = {
  ETH: 0,
  GALT: 1
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

contract('ContourVerification Reward Distribution', accounts => {
  const [
    coreTeam,
    minter,
    alice,
    bob,
    charlie,
    v1,
    v2,
    v3,
    v4,
    v5,
    v6,
    o1,
    o2,
    o3,
    o4,
    o5,
    o6,
    geoDateManagement,
    feeMixerAddress
  ] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });

    // Contour #1
    // 40.594870, -73.949618 dr5qvnpd300r
    // 40.594843, -73.949866 dr5qvnp655pq
    // 40.594791, -73.949857 dr5qvnp3g3w0
    // 40.594816, -73.949608 dr5qvnp9cnpt

    // Contour #2 (intersects 1)
    // 40.594844, -73.949631 dr5qvnpd0eqs
    // 40.594859, -73.949522 dr5qvnpd5npy
    // 40.594825, -73.949512 dr5qvnp9grz7
    // 40.594827, -73.949617 dr5qvnpd100z
    this.rawContour1 = ['dr5qvnpd300r', 'dr5qvnp655pq', 'dr5qvnp3g3w0', 'dr5qvnp9cnpt'];
    this.contour1 = this.rawContour1.map(galt.geohashToNumber).map(a => a.toString(10));
    this.rawContour2 = ['dr5qvnpd0eqs', 'dr5qvnpd5npy', 'dr5qvnp9grz7', 'dr5qvnpd100z'];
    this.contour2 = this.rawContour2.map(galt.geohashToNumber).map(a => a.toString(10));

    await this.acl.initialize();
    await this.ggr.initialize();

    this.spaceToken = await SpaceToken.new(this.ggr.address, 'Name', 'Symbol', { from: coreTeam });
    this.spaceGeoData = await deploySpaceGeoDataLight(this.ggr);
    this.galtToken = await GaltToken.new({ from: coreTeam });

    this.newPropertyManager = await MockAddContourApplication.new(this.ggr.address, { from: coreTeam });
    this.updatePropertyManager = await MockUpdateContourApplication.new(this.ggr.address, { from: coreTeam });
    this.modifyPropertyManager = await MockUpdateContourApplication.new(this.ggr.address, { from: coreTeam });

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

    await this.contourVerificationManager.initialize(this.ggr.address, 5, 3600 * 8);
    await this.contourVerifiers.initialize(this.ggr.address, ether(200));

    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.pggRegistry = await PGGRegistry.new({ from: coreTeam });

    await this.pggRegistry.initialize(this.ggr.address);

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(charlie, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(v1, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(v2, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(v3, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(v4, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(v5, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(v6, ether(10000000), { from: coreTeam });

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.CONTOUR_VERIFIERS(), this.contourVerifiers.address, { from: coreTeam });
    await this.ggr.setContract(
      await this.ggr.CONTOUR_VERIFICATION_SOURCE_REGISTRY(),
      this.contourVerificationSourceRegistry.address,
      { from: coreTeam }
    );

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
    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), geoDateManagement, true, { from: coreTeam });
    await this.acl.setRole(bytes32('FEE_COLLECTOR'), feeMixerAddress, true, { from: coreTeam });
    await this.acl.setRole(bytes32('CV_SLASHER'), this.contourVerificationManager.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('CONTOUR_VERIFIER'), this.contourVerificationManager.address, true, {
      from: coreTeam
    });

    await this.feeRegistry.setProtocolEthShare(33, { from: coreTeam });
    await this.feeRegistry.setProtocolGaltShare(13, { from: coreTeam });

    await this.contourVerificationSourceRegistry.addSource(this.newPropertyManager.address);
    await this.contourVerificationSourceRegistry.addSource(this.updatePropertyManager.address);
    await this.contourVerificationSourceRegistry.addSource(this.modifyPropertyManager.address);

    await this.contourVerificationManager.setRequiredConfirmations(5);

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v1 });
    await this.contourVerifiers.deposit(ether(200), v1, { from: v1 });
    await this.contourVerifiers.setOperator(o1, { from: v1 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v2 });
    await this.contourVerifiers.deposit(ether(200), v2, { from: v2 });
    await this.contourVerifiers.setOperator(o2, { from: v2 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v3 });
    await this.contourVerifiers.deposit(ether(200), v3, { from: v3 });
    await this.contourVerifiers.setOperator(o3, { from: v3 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v4 });
    await this.contourVerifiers.deposit(ether(200), v4, { from: v4 });
    await this.contourVerifiers.setOperator(o4, { from: v4 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v5 });
    await this.contourVerifiers.deposit(ether(200), v5, { from: v5 });
    await this.contourVerifiers.setOperator(o5, { from: v5 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v6 });
    await this.contourVerifiers.deposit(ether(200), v6, { from: v6 });
    await this.contourVerifiers.setOperator(o6, { from: v6 });

    let res = await this.spaceToken.mint(alice, { from: minter });
    this.tokenId1 = res.logs[0].args.tokenId.toNumber();

    res = await this.spaceToken.mint(alice, { from: minter });
    this.tokenId2 = res.logs[0].args.tokenId.toNumber();

    res = await this.spaceToken.mint(alice, { from: minter });
    this.tokenId3 = res.logs[0].args.tokenId.toNumber();
  });

  describe('GALT payment', () => {
    describe('approval', () => {
      it('should correctly distribute rewards for 1 of 1 verifiers', async function() {
        await approveGalt.call(this, 1);
        await checkGaltApproveDistributionFor1.call(this);
      });

      it('should correctly distribute rewards for 3 of 3 verifiers', async function() {
        await approveGalt.call(this, 3);
        await checkGaltApproveDistributionFor3.call(this);
      });
    });

    describe('rejection', () => {
      describe('for intersection proofs', () => {
        describe('rejected due existing token', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectExistingIntersection.call(this, 0, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 0, 0, 0);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectExistingIntersection.call(this, 1, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 1, 0, 0);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectExistingIntersection.call(this, 2, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 2, 0, 0);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectExistingIntersection.call(this, 4, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 4, 0, 0);
          });
        });

        describe('rejected due applicationApproved contour', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectApplicationApprovedIntersection.call(this, 0, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 0, 0, 1);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectApplicationApprovedIntersection.call(this, 1, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 1, 0, 1);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectApplicationApprovedIntersection.call(this, 2, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 2, 0, 1);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectApplicationApprovedIntersection.call(this, 4, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 4, 0, 1);
          });
        });

        describe('rejected due applicationApprovedTimeout contour', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutIntersection.call(this, 0, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 0, 0, 1);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutIntersection.call(this, 1, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 1, 0, 1);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutIntersection.call(this, 2, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 2, 0, 1);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutIntersection.call(this, 4, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 4, 0, 1);
          });
        });
      });

      describe('for inclusion proofs', () => {
        describe('rejected due existing token', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectExistingInclusion.call(this, 0, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 0, 0, 0);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectExistingInclusion.call(this, 1, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 1, 0, 0);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectExistingInclusion.call(this, 2, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 2, 0, 0);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectExistingInclusion.call(this, 4, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 4, 0, 0);
          });
        });

        describe('rejected due applicationApproved contour', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectApplicationApprovedInclusion.call(this, 0, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 0, 0, 1);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectApplicationApprovedInclusion.call(this, 1, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 1, 0, 1);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectApplicationApprovedInclusion.call(this, 2, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 2, 0, 1);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectApplicationApprovedInclusion.call(this, 4, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 4, 0, 1);
          });
        });

        describe('rejected due applicationApprovedTimeout contour', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutInclusion.call(this, 0, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 0, 0, 1);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutInclusion.call(this, 1, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 1, 0, 1);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutInclusion.call(this, 2, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 2, 0, 1);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutInclusion.call(this, 4, Currency.GALT);
            await checkGaltRejectDistribution.call(this, 4, 0, 1);
          });
        });
      });
    });
  });

  describe('ETH payment', () => {
    describe('approval', () => {
      it('should correctly distribute rewards for 1 of 1 verifiers', async function() {
        await approveEth.call(this, 1);
        await checkEthApproveDistributionFor1.call(this);
      });

      it('should correctly distribute rewards for 3 of 3 verifiers', async function() {
        await approveEth.call(this, 3);
        await checkEthApproveDistributionFor3.call(this);
      });
    });

    describe('rejection', () => {
      describe('for intersection proofs', () => {
        describe('rejected due existing token', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectExistingIntersection.call(this, 0, Currency.ETH);
            await checkEthRejectDistribution.call(this, 0, 0, 0);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectExistingIntersection.call(this, 1, Currency.ETH);
            await checkEthRejectDistribution.call(this, 1, 0, 0);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectExistingIntersection.call(this, 2, Currency.ETH);
            await checkEthRejectDistribution.call(this, 2, 0, 0);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectExistingIntersection.call(this, 4, Currency.ETH);
            await checkEthRejectDistribution.call(this, 4, 0, 0);
          });
        });

        describe('rejected due applicationApproved contour', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectApplicationApprovedIntersection.call(this, 0, Currency.ETH);
            await checkEthRejectDistribution.call(this, 0, 0, 1);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectApplicationApprovedIntersection.call(this, 1, Currency.ETH);
            await checkEthRejectDistribution.call(this, 1, 0, 1);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectApplicationApprovedIntersection.call(this, 2, Currency.ETH);
            await checkEthRejectDistribution.call(this, 2, 0, 1);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectApplicationApprovedIntersection.call(this, 4, Currency.ETH);
            await checkEthRejectDistribution.call(this, 4, 0, 1);
          });
        });

        describe('rejected due applicationApprovedTimeout contour', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutIntersection.call(this, 0, Currency.ETH);
            await checkEthRejectDistribution.call(this, 0, 0, 1);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutIntersection.call(this, 1, Currency.ETH);
            await checkEthRejectDistribution.call(this, 1, 0, 1);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutIntersection.call(this, 2, Currency.ETH);
            await checkEthRejectDistribution.call(this, 2, 0, 1);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutIntersection.call(this, 4, Currency.ETH);
            await checkEthRejectDistribution.call(this, 4, 0, 1);
          });
        });
      });

      describe('for inclusion proofs', () => {
        describe('rejected due existing token', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectExistingInclusion.call(this, 0, Currency.ETH);
            await checkEthRejectDistribution.call(this, 0, 0, 0);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectExistingInclusion.call(this, 1, Currency.ETH);
            await checkEthRejectDistribution.call(this, 1, 0, 0);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectExistingInclusion.call(this, 2, Currency.ETH);
            await checkEthRejectDistribution.call(this, 2, 0, 0);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectExistingInclusion.call(this, 4, Currency.ETH);
            await checkEthRejectDistribution.call(this, 4, 0, 0);
          });
        });

        describe('rejected due applicationApproved contour', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectApplicationApprovedInclusion.call(this, 0, Currency.ETH);
            await checkEthRejectDistribution.call(this, 0, 0, 1);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectApplicationApprovedInclusion.call(this, 1, Currency.ETH);
            await checkEthRejectDistribution.call(this, 1, 0, 1);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectApplicationApprovedInclusion.call(this, 2, Currency.ETH);
            await checkEthRejectDistribution.call(this, 2, 0, 1);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectApplicationApprovedInclusion.call(this, 4, Currency.ETH);
            await checkEthRejectDistribution.call(this, 4, 0, 1);
          });
        });

        describe('rejected due applicationApprovedTimeout contour', () => {
          it('should distribute proper reward if 0 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutInclusion.call(this, 0, Currency.ETH);
            await checkEthRejectDistribution.call(this, 0, 0, 1);
          });

          it('should distribute proper reward if 1 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutInclusion.call(this, 1, Currency.ETH);
            await checkEthRejectDistribution.call(this, 1, 0, 1);
          });

          it('should distribute proper reward if 2 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutInclusion.call(this, 2, Currency.ETH);
            await checkEthRejectDistribution.call(this, 2, 0, 1);
          });

          it('should distribute proper reward if 4 CVs has voted before', async function() {
            await rejectApplicationApprovedTimeoutInclusion.call(this, 4, Currency.ETH);
            await checkEthRejectDistribution.call(this, 4, 0, 1);
          });
        });
      });
    });
  });

  async function checkGaltApproveDistributionFor1() {
    const res = await this.contourVerificationManager.getApplicationRewards(0);
    assert.equal(res.currency, Currency.GALT);
    assert.equal(res.totalPaidFee, ether(10));
    assert.equal(res.verifiersReward, ether(8.7));
    assert.equal(res.galtProtocolReward, ether(1.3));

    assert.equal(res.verifierReward, ether(8.7));

    const v1BalanceBefore = await this.galtToken.balanceOf(v1);
    const mixerBalanceBefore = await this.galtToken.balanceOf(feeMixerAddress);

    await this.contourVerificationManager.claimVerifierApprovalReward(0, v1, { from: o1 });
    await assertRevert(
      this.contourVerificationManager.claimVerifierApprovalReward(0, v1, { from: o1 }),
      'Reward has already paid out'
    );
    await assertRevert(
      this.contourVerificationManager.claimVerifierApprovalReward(0, v2, { from: o2 }),
      'Not voted on the application'
    );
    await this.contourVerificationManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

    const v1BalanceAfter = await this.galtToken.balanceOf(v1);
    const mixerBalanceAfter = await this.galtToken.balanceOf(feeMixerAddress);

    assertGaltBalanceChanged(v1BalanceBefore, v1BalanceAfter, ether(8.7));
    assertGaltBalanceChanged(mixerBalanceBefore, mixerBalanceAfter, ether(1.3));
  }

  async function checkEthApproveDistributionFor1() {
    const res = await this.contourVerificationManager.getApplicationRewards(0);
    assert.equal(res.currency, Currency.ETH);
    assert.equal(res.totalPaidFee, ether(5));
    assert.equal(res.verifiersReward, ether(3.35));
    assert.equal(res.galtProtocolReward, ether(1.65));

    assert.equal(res.verifierReward, ether(3.35));

    const v1BalanceBefore = await web3.eth.getBalance(v1);
    const mixerBalanceBefore = await web3.eth.getBalance(feeMixerAddress);

    await this.contourVerificationManager.claimVerifierApprovalReward(0, v1, { from: o1 });
    await assertRevert(
      this.contourVerificationManager.claimVerifierApprovalReward(0, v1, { from: o1 }),
      'Reward has already paid out'
    );
    await assertRevert(
      this.contourVerificationManager.claimVerifierApprovalReward(0, v2, { from: o2 }),
      'Not voted on the application'
    );
    await this.contourVerificationManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

    const v1BalanceAfter = await web3.eth.getBalance(v1);
    const mixerBalanceAfter = await web3.eth.getBalance(feeMixerAddress);

    assertEthBalanceChanged(v1BalanceBefore, v1BalanceAfter, ether(3.35));
    assertEthBalanceChanged(mixerBalanceBefore, mixerBalanceAfter, ether(1.65));
  }

  async function checkGaltApproveDistributionFor3() {
    const res = await this.contourVerificationManager.getApplicationRewards(0);
    assert.equal(res.currency, Currency.GALT);
    assert.equal(res.totalPaidFee, ether(10));
    assert.equal(res.verifiersReward, ether(8.7));
    assert.equal(res.galtProtocolReward, ether(1.3));

    assert.equal(res.verifierReward, ether(2.9));

    const v1BalanceBefore = await this.galtToken.balanceOf(v1);
    const v2BalanceBefore = await this.galtToken.balanceOf(v2);
    const v3BalanceBefore = await this.galtToken.balanceOf(v3);
    // const v4BalanceBefore = await this.galtToken.balanceOf(v4);
    const mixerBalanceBefore = await this.galtToken.balanceOf(feeMixerAddress);

    await this.contourVerificationManager.claimVerifierApprovalReward(0, v1, { from: o1 });
    await this.contourVerificationManager.claimVerifierApprovalReward(0, v2, { from: o2 });
    await this.contourVerificationManager.claimVerifierApprovalReward(0, v3, { from: o3 });
    // await this.contourVerificationManager.claimVerifierApprovalReward(0, v4, { from: o4 });
    await assertRevert(this.contourVerificationManager.claimVerifierApprovalReward(0, v1, { from: o1 }));
    await assertRevert(this.contourVerificationManager.claimVerifierApprovalReward(0, v2, { from: o2 }));
    await this.contourVerificationManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

    const v1BalanceAfter = await this.galtToken.balanceOf(v1);
    const v2BalanceAfter = await this.galtToken.balanceOf(v2);
    const v3BalanceAfter = await this.galtToken.balanceOf(v3);
    // const v4BalanceAfter = await this.galtToken.balanceOf(v4);
    const mixerBalanceAfter = await this.galtToken.balanceOf(feeMixerAddress);

    assertGaltBalanceChanged(v1BalanceBefore, v1BalanceAfter, ether(2.9));
    assertGaltBalanceChanged(v2BalanceBefore, v2BalanceAfter, ether(2.9));
    assertGaltBalanceChanged(v3BalanceBefore, v3BalanceAfter, ether(2.9));
    // assertGaltBalanceChanged(v4BalanceBefore, v4BalanceAfter, ether(2.9));
    assertGaltBalanceChanged(mixerBalanceBefore, mixerBalanceAfter, ether(1.3));
  }

  async function checkEthApproveDistributionFor3() {
    const res = await this.contourVerificationManager.getApplicationRewards(0);
    assert.equal(res.currency, Currency.ETH);
    assert.equal(res.totalPaidFee, ether(5));
    assert.equal(res.verifiersReward, ether(3.35));
    assert.equal(res.galtProtocolReward, ether(1.65));

    assert.equal(res.verifierReward, '1116666666666666666');

    const v1BalanceBefore = await web3.eth.getBalance(v1);
    const v2BalanceBefore = await web3.eth.getBalance(v2);
    const v3BalanceBefore = await web3.eth.getBalance(v3);
    // const v4BalanceBefore = await web3.eth.getBalance(v4);
    const mixerBalanceBefore = await web3.eth.getBalance(feeMixerAddress);

    await this.contourVerificationManager.claimVerifierApprovalReward(0, v1, { from: o1 });
    await this.contourVerificationManager.claimVerifierApprovalReward(0, v2, { from: o2 });
    await this.contourVerificationManager.claimVerifierApprovalReward(0, v3, { from: o3 });
    // await this.contourVerificationManager.claimVerifierApprovalReward(0, v4, { from: o4 });
    await assertRevert(this.contourVerificationManager.claimVerifierApprovalReward(0, v1, { from: o1 }));
    await assertRevert(this.contourVerificationManager.claimVerifierApprovalReward(0, v2, { from: o2 }));
    await this.contourVerificationManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

    const v1BalanceAfter = await web3.eth.getBalance(v1);
    const v2BalanceAfter = await web3.eth.getBalance(v2);
    const v3BalanceAfter = await web3.eth.getBalance(v3);
    // const v4BalanceAfter = await web3.eth.getBalance(v4);
    const mixerBalanceAfter = await web3.eth.getBalance(feeMixerAddress);

    assertEthBalanceChanged(v1BalanceBefore, v1BalanceAfter, '1116666666666666666');
    assertEthBalanceChanged(v2BalanceBefore, v2BalanceAfter, '1116666666666666666');
    assertEthBalanceChanged(v3BalanceBefore, v3BalanceAfter, '1116666666666666666');
    // assertEthBalanceChanged(v4BalanceBefore, v4BalanceAfter, ether(2.9));
    assertEthBalanceChanged(mixerBalanceBefore, mixerBalanceAfter, ether(1.65));
  }

  async function approveEth(numberOfApprovals) {
    return approve.call(this, numberOfApprovals, Currency.ETH);
  }

  async function approveGalt(numberOfApprovals) {
    return approve.call(this, numberOfApprovals, Currency.GALT);
  }

  async function approve(numberOfApprovals, paymentType) {
    assert.equal(numberOfApprovals <= 6, true, 'Too many numberOfApprovalsBeforeReject');

    await this.contourVerificationManager.setRequiredConfirmations(numberOfApprovals);

    await this.spaceToken.mint(alice, { from: minter });
    await this.spaceToken.mint(alice, { from: minter });

    // Create a new NewPropertyManager application
    let res = await this.newPropertyManager.submit(this.contour1, 42, SpaceTokenType.LAND_PLOT);
    const aId = res.logs[0].args.applicationId;

    if (paymentType === Currency.ETH) {
      res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, {
        from: alice,
        value: ether(5)
      });
    } else {
      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

      res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
    }
    const cvId2 = res.logs[0].args.applicationId;

    const asyncFuncsToCall = [];
    for (let i = 1; i <= numberOfApprovals; i++) {
      // eslint-disable-next-line no-eval
      asyncFuncsToCall.push(this.contourVerificationManager.approve(cvId2, eval(`v${i}`), { from: eval(`o${i}`) }));
    }
    await Promise.all(asyncFuncsToCall);

    await evmIncreaseTime(3600 * 4);

    assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

    res = await this.contourVerificationManager.getApplication(0);
    assert.equal(res.approvalCount, numberOfApprovals);
    assert.equal(res.action, 0);
    assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);

    // too early
    await assertRevert(this.contourVerificationManager.pushApproval(0), 'Timeout period has not passed yet');

    await evmIncreaseTime(3600 * 5);

    await this.contourVerificationManager.pushApproval(0);

    assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.SUBMITTED);

    res = await this.contourVerificationManager.getApplication(0);
    assert.equal(res.status, CVStatus.APPROVED);
  }

  async function rejectExistingIntersection(numberOfApprovalsBeforeReject, paymentType) {
    await this.spaceGeoData.setSpaceTokenContour(this.tokenId3, this.contour1, { from: geoDateManagement });
    await this.spaceGeoData.setSpaceTokenType(this.tokenId3, SpaceTokenType.LAND_PLOT, {
      from: geoDateManagement
    });
    await reject.call(this, numberOfApprovalsBeforeReject, paymentType, async function() {
      await this.contourVerificationManager.rejectWithExistingContourIntersectionProof(
        0,
        v2,
        this.tokenId3,
        3,
        galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
        galt.geohashToNumber('dr5qvnpd300r').toString(10),
        0,
        galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
        galt.geohashToNumber('dr5qvnpd5npy').toString(10),
        { from: o2 }
      );
    });
  }

  async function rejectApplicationApprovedIntersection(numberOfApprovalsBeforeReject, paymentType) {
    let res = await this.updatePropertyManager.submit(this.tokenId3, this.contour1, 42, SpaceTokenType.LAND_PLOT);
    const aId = res.logs[0].args.applicationId;
    this.existingAId = aId;

    await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

    res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, { from: alice });
    const cvId1 = res.logs[0].args.applicationId;
    this.cvId1 = cvId1;

    await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
    await this.contourVerificationManager.approve(cvId1, v4, { from: o4 });
    await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
    await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
    await this.contourVerificationManager.approve(cvId1, v5, { from: o5 });

    await evmIncreaseTime(3600 * 9);

    await this.contourVerificationManager.pushApproval(cvId1);

    await reject.call(this, numberOfApprovalsBeforeReject, paymentType, async function(cvId2) {
      await this.contourVerificationManager.rejectWithApplicationApprovedContourIntersectionProof(
        cvId2,
        v2,
        this.updatePropertyManager.address,
        this.existingAId,
        3,
        galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
        galt.geohashToNumber('dr5qvnpd300r').toString(10),
        0,
        galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
        galt.geohashToNumber('dr5qvnpd5npy').toString(10),
        { from: o2 }
      );
    });
  }

  async function rejectApplicationApprovedTimeoutIntersection(numberOfApprovalsBeforeReject, paymentType) {
    let res = await this.newPropertyManager.submit(this.contour1, 42, SpaceTokenType.LAND_PLOT);
    const aId = res.logs[0].args.applicationId;
    this.existingAId = aId;

    await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

    res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
    const cvId1 = res.logs[0].args.applicationId;
    this.cvId1 = cvId1;

    await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
    await this.contourVerificationManager.approve(cvId1, v4, { from: o4 });
    await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
    await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
    await this.contourVerificationManager.approve(cvId1, v5, { from: o5 });

    await evmIncreaseTime(3600 * 3);

    await reject.call(this, numberOfApprovalsBeforeReject, paymentType, async function(cvId2) {
      await this.contourVerificationManager.rejectWithApplicationApprovedTimeoutContourIntersectionProof(
        cvId2,
        v2,
        this.cvId1,
        3,
        galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
        galt.geohashToNumber('dr5qvnpd300r').toString(10),
        0,
        galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
        galt.geohashToNumber('dr5qvnpd5npy').toString(10),
        { from: o2 }
      );
    });
  }

  async function rejectExistingInclusion(numberOfApprovalsBeforeReject, paymentType) {
    await this.spaceGeoData.setSpaceTokenContour(this.tokenId3, this.contour1, { from: geoDateManagement });
    await this.spaceGeoData.setSpaceTokenType(this.tokenId3, SpaceTokenType.LAND_PLOT, {
      from: geoDateManagement
    });
    await reject.call(this, numberOfApprovalsBeforeReject, paymentType, async function() {
      await this.contourVerificationManager.rejectWithExistingPointInclusionProof(
        0,
        v2,
        Inclusion.VERIFYING_INSIDE_EXISTING,
        this.tokenId3,
        3,
        galt.geohashToNumber('dr5qvnpd100z').toString(10),
        { from: o2 }
      );
    });
  }

  async function rejectApplicationApprovedInclusion(numberOfApprovalsBeforeReject, paymentType) {
    let res = await this.updatePropertyManager.submit(this.tokenId3, this.contour1, 42, SpaceTokenType.LAND_PLOT);
    const aId = res.logs[0].args.applicationId;
    this.existingAId = aId;

    await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

    res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, { from: alice });
    const cvId1 = res.logs[0].args.applicationId;
    this.cvId1 = cvId1;

    await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
    await this.contourVerificationManager.approve(cvId1, v4, { from: o4 });
    await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
    await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
    await this.contourVerificationManager.approve(cvId1, v5, { from: o5 });

    await evmIncreaseTime(3600 * 9);

    await this.contourVerificationManager.pushApproval(cvId1);

    await reject.call(this, numberOfApprovalsBeforeReject, paymentType, async function(cvId2) {
      await this.contourVerificationManager.rejectWithApplicationApprovedPointInclusionProof(
        cvId2,
        v2,
        Inclusion.VERIFYING_INSIDE_EXISTING,
        this.updatePropertyManager.address,
        this.existingAId,
        0,
        galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
        { from: o2 }
      );
    });
  }

  async function rejectApplicationApprovedTimeoutInclusion(numberOfApprovalsBeforeReject, paymentType) {
    let res = await this.newPropertyManager.submit(this.contour1, 42, SpaceTokenType.LAND_PLOT);
    const aId = res.logs[0].args.applicationId;
    this.existingAId = aId;

    await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

    res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
    const cvId1 = res.logs[0].args.applicationId;
    this.cvId1 = cvId1;

    await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
    await this.contourVerificationManager.approve(cvId1, v4, { from: o4 });
    await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });
    await this.contourVerificationManager.approve(cvId1, v1, { from: o1 });
    await this.contourVerificationManager.approve(cvId1, v5, { from: o5 });

    await evmIncreaseTime(3600 * 3);

    await reject.call(this, numberOfApprovalsBeforeReject, paymentType, async function(cvId2) {
      await this.contourVerificationManager.rejectWithApplicationApprovedTimeoutPointInclusionProof(
        cvId2,
        v2,
        Inclusion.VERIFYING_INSIDE_EXISTING,
        this.cvId1,
        0,
        galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
        { from: o2 }
      );
    });
  }

  async function reject(numberOfApprovalsBeforeReject, paymentType, rejectFunction) {
    assert.equal(numberOfApprovalsBeforeReject <= 6, true, 'Too many numberOfApprovalsBeforeReject');

    let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
    const aId = res.logs[0].args.applicationId;

    if (paymentType === Currency.ETH) {
      res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, {
        from: alice,
        value: ether(5)
      });
    } else {
      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

      res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
    }

    const cvId2 = res.logs[0].args.applicationId;
    assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

    const asyncFuncsToCall = [];
    let limit = numberOfApprovalsBeforeReject;
    for (let i = 1; i <= limit; i++) {
      // 2 reserved for rejecter
      if (i === 2) {
        // eslint-disable-next-line no-param-reassign
        limit++;
        i++;
      }
      // eslint-disable-next-line no-eval
      asyncFuncsToCall.push(this.contourVerificationManager.approve(cvId2, eval(`v${i}`), { from: eval(`o${i}`) }));
    }
    await Promise.all(asyncFuncsToCall);

    assert.equal(await this.contourVerificationManager.requiredConfirmations(), 5);

    res = await this.contourVerificationManager.getApplication(cvId2);
    assert.equal(res.approvalCount, numberOfApprovalsBeforeReject);
    assert.equal(res.action, 0);
    assert.equal(res.status, CVStatus.PENDING);

    await rejectFunction.call(this, cvId2);
    const v3stillActive = await this.contourVerifiers.isVerifierValid(v3, o3);
    await assertRevert(
      this.contourVerificationManager.approve(cvId2, v3, { from: o3 }),
      v3stillActive ? 'ID mismatches with the current' : 'Invalid operator'
    );
    const slashedReward = 174;
    assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(slashedReward * numberOfApprovalsBeforeReject));

    await evmIncreaseTime(3600 * 4);

    assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

    res = await this.contourVerificationManager.getApplication(cvId2);
    assert.equal(res.approvalCount, 1 * numberOfApprovalsBeforeReject);
    assert.equal(res.action, 0);
    assert.equal(res.status, CVStatus.REJECTED);

    // already rejected
    await assertRevert(this.contourVerificationManager.pushApproval(cvId2), 'Expect APPROVAL_TIMEOUT status');

    await evmIncreaseTime(3600 * 5);

    // surprisingly still rejected
    await assertRevert(this.contourVerificationManager.pushApproval(cvId2), 'Expect APPROVAL_TIMEOUT status');

    assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

    res = await this.contourVerificationManager.getApplication(cvId2);
    assert.equal(res.status, CVStatus.REJECTED);
  }

  async function checkGaltRejectDistribution(numberOfApprovalsBeforeReject, aId, cvId) {
    const res = await this.contourVerificationManager.getApplicationRewards(cvId);
    assert.equal(res.currency, Currency.GALT);
    assert.equal(res.totalPaidFee, ether(10));
    assert.equal(res.verifiersReward, ether(8.7));
    assert.equal(res.galtProtocolReward, ether(1.3));
    assert.equal(res.verifierReward, ether(8.7));

    let v2BalanceBefore = await this.galtToken.balanceOf(v2);
    let v3BalanceBefore = await this.galtToken.balanceOf(v3);
    const v4BalanceBefore = await this.galtToken.balanceOf(v4);
    let mixerBalanceBefore = await this.galtToken.balanceOf(feeMixerAddress);

    await assertRevert(
      this.contourVerificationManager.claimVerifierApprovalReward(cvId, v4, { from: o1 }),
      'Invalid operator'
    );
    await assertRevert(
      this.contourVerificationManager.claimVerifierApprovalReward(cvId, v2, { from: o2 }),
      'Expect APPROVED status'
    );
    await this.contourVerificationManager.claimVerifierRejectionReward(cvId, v2, { from: o2 });
    await this.contourVerificationManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });
    await this.contourVerificationManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

    let v2BalanceAfter = await this.galtToken.balanceOf(v2);
    let v3BalanceAfter = await this.galtToken.balanceOf(v3);
    const v4BalanceAfter = await this.galtToken.balanceOf(v4);
    let mixerBalanceAfter = await this.galtToken.balanceOf(feeMixerAddress);

    assertGaltBalanceChanged(v2BalanceBefore, v2BalanceAfter, ether(8.7));
    assertGaltBalanceChanged(v3BalanceBefore, v3BalanceAfter, ether(0));
    assertGaltBalanceChanged(v4BalanceBefore, v4BalanceAfter, ether(0));
    assertGaltBalanceChanged(mixerBalanceBefore, mixerBalanceAfter, ether(1.3));

    v2BalanceBefore = await this.galtToken.balanceOf(v2);
    v3BalanceBefore = await this.galtToken.balanceOf(v3);
    await this.contourVerifiers.claimSlashedReward({ from: v3 });
    await this.contourVerifiers.claimSlashedReward({ from: v2 });
    await this.contourVerifiers.claimSlashedReward({ from: v2 });
    v2BalanceAfter = await this.galtToken.balanceOf(v2);
    v3BalanceAfter = await this.galtToken.balanceOf(v3);

    assertGaltBalanceChanged(v2BalanceBefore, v2BalanceAfter, ether(174 * numberOfApprovalsBeforeReject));
    assertGaltBalanceChanged(v3BalanceBefore, v3BalanceAfter, ether(0));

    mixerBalanceBefore = await this.galtToken.balanceOf(feeMixerAddress);
    await assertRevert(
      this.contourVerifiers.claimSlashedProtocolReward({ from: v2 }),
      'Only FEE_COLLECTOR role allowed'
    );
    await this.contourVerifiers.claimSlashedProtocolReward({ from: feeMixerAddress });
    await this.contourVerifiers.claimSlashedProtocolReward({ from: feeMixerAddress });
    mixerBalanceAfter = await this.galtToken.balanceOf(feeMixerAddress);

    assertGaltBalanceChanged(mixerBalanceBefore, mixerBalanceAfter, ether(26 * numberOfApprovalsBeforeReject));
  }

  async function checkEthRejectDistribution(numberOfApprovalsBeforeReject, aId, cvId) {
    const res = await this.contourVerificationManager.getApplicationRewards(cvId);
    assert.equal(res.currency, Currency.ETH);
    assert.equal(res.totalPaidFee, ether(5));
    assert.equal(res.verifiersReward, ether(3.35));
    assert.equal(res.galtProtocolReward, ether(1.65));
    assert.equal(res.verifierReward, ether(3.35));

    let v2BalanceBefore = await web3.eth.getBalance(v2);
    let v3BalanceBefore = await web3.eth.getBalance(v3);
    const v4BalanceBefore = await web3.eth.getBalance(v4);
    let mixerBalanceBefore = await web3.eth.getBalance(feeMixerAddress);

    await assertRevert(
      this.contourVerificationManager.claimVerifierApprovalReward(cvId, v4, { from: o1 }),
      'Invalid operator'
    );
    await assertRevert(
      this.contourVerificationManager.claimVerifierApprovalReward(cvId, v2, { from: o2 }),
      'Expect APPROVED status'
    );
    await this.contourVerificationManager.claimVerifierRejectionReward(cvId, v2, { from: o2 });
    await this.contourVerificationManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
    await this.contourVerificationManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

    let v2BalanceAfter = await web3.eth.getBalance(v2);
    let v3BalanceAfter = await web3.eth.getBalance(v3);
    const v4BalanceAfter = await web3.eth.getBalance(v4);
    let mixerBalanceAfter = await web3.eth.getBalance(feeMixerAddress);

    assertEthBalanceChanged(v2BalanceBefore, v2BalanceAfter, ether(3.35));
    assertEthBalanceChanged(v3BalanceBefore, v3BalanceAfter, ether(0));
    assertEthBalanceChanged(v4BalanceBefore, v4BalanceAfter, ether(0));
    assertEthBalanceChanged(mixerBalanceBefore, mixerBalanceAfter, ether(1.65));

    v2BalanceBefore = await this.galtToken.balanceOf(v2);
    v3BalanceBefore = await this.galtToken.balanceOf(v3);
    await this.contourVerifiers.claimSlashedReward({ from: v3 });
    await this.contourVerifiers.claimSlashedReward({ from: v2 });
    await this.contourVerifiers.claimSlashedReward({ from: v2 });
    v2BalanceAfter = await this.galtToken.balanceOf(v2);
    v3BalanceAfter = await this.galtToken.balanceOf(v3);

    assertGaltBalanceChanged(v2BalanceBefore, v2BalanceAfter, ether(174 * numberOfApprovalsBeforeReject));
    assertGaltBalanceChanged(v3BalanceBefore, v3BalanceAfter, ether(0));

    mixerBalanceBefore = await this.galtToken.balanceOf(feeMixerAddress);
    await assertRevert(
      this.contourVerifiers.claimSlashedProtocolReward({ from: v2 }),
      'Only FEE_COLLECTOR role allowed'
    );
    await this.contourVerifiers.claimSlashedProtocolReward({ from: feeMixerAddress });
    await this.contourVerifiers.claimSlashedProtocolReward({ from: feeMixerAddress });
    mixerBalanceAfter = await this.galtToken.balanceOf(feeMixerAddress);

    assertGaltBalanceChanged(mixerBalanceBefore, mixerBalanceAfter, ether(26 * numberOfApprovalsBeforeReject));
  }
});
