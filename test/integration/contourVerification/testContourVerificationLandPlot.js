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
ContourVerificationManagerLib.numberFormat = 'String';
GaltToken.numberFormat = 'String';

const {
  ether,
  deploySpaceGeoDataLight,
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

contract('ContourVerification', accounts => {
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
    o1,
    o2,
    o3,
    o4,
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

    // Contour #3 (doesn't intersect 1)
    // 40.594803, -73.949607 dr5qvnp9c7b2
    // 40.594777, -73.949852 dr5qvnp3ewcv
    // 40.594727, -73.949838 dr5qvnp37vs4
    // 40.594754, -73.949594 dr5qvnp99ddh

    // Contour #4 (completely included by 1)
    // 40.594840, -73.949792 dr5qvnp6hfwt
    // 40.594838, -73.949829 dr5qvnp6h46c
    // 40.594797, -73.949845 dr5qvnp3gdwu
    // 40.594801, -73.949828 dr5qvnp3u57s

    // Contour #5 (intersects both 1 and 3)
    // 40.594806, -73.949748 dr5qvnp3vur6
    // 40.594813, -73.949713 dr5qvnp3yv97
    // 40.594784, -73.949705 dr5qvnp3ybpq
    // 40.594778, -73.949744 dr5qvnp3wp47
    this.rawContour1 = ['dr5qvnpd300r', 'dr5qvnp655pq', 'dr5qvnp3g3w0', 'dr5qvnp9cnpt'];
    this.contour1 = this.rawContour1.map(galt.geohashToNumber).map(a => a.toString(10));
    this.rawContour2 = ['dr5qvnpd0eqs', 'dr5qvnpd5npy', 'dr5qvnp9grz7', 'dr5qvnpd100z'];
    this.contour2 = this.rawContour2.map(galt.geohashToNumber).map(a => a.toString(10));
    this.rawContour3 = ['dr5qvnp9c7b2', 'dr5qvnp3ewcv', 'dr5qvnp37vs4', 'dr5qvnp99ddh'];
    this.contour3 = this.rawContour3.map(galt.geohashToNumber).map(a => a.toString(10));
    this.rawContour4 = ['dr5qvnp6hfwt', 'dr5qvnp6h46c', 'dr5qvnp3gdwu', 'dr5qvnp3u57s'];
    this.contour4 = this.rawContour4.map(galt.geohashToNumber).map(a => a.toString(10));
    this.rawContour5 = ['dr5qvnp3vur6', 'dr5qvnp3yv97', 'dr5qvnp3ybpq', 'dr5qvnp3wp47'];
    this.contour5 = this.rawContour5.map(galt.geohashToNumber).map(a => a.toString(10));

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

    this.contourVerificationSourceRegistry.addSource(this.newPropertyManager.address);
    this.contourVerificationSourceRegistry.addSource(this.updatePropertyManager.address);
    this.contourVerificationSourceRegistry.addSource(this.modifyPropertyManager.address);

    await this.contourVerificationManager.setRequiredConfirmations(3);

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v1 });
    await this.contourVerifiers.deposit(ether(200), { from: v1 });
    await this.contourVerifiers.setOperator(o1, { from: v1 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v2 });
    await this.contourVerifiers.deposit(ether(200), { from: v2 });
    await this.contourVerifiers.setOperator(o2, { from: v2 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v3 });
    await this.contourVerifiers.deposit(ether(200), { from: v3 });
    await this.contourVerifiers.setOperator(o3, { from: v3 });

    await this.galtToken.approve(this.contourVerifiers.address, ether(200), { from: v4 });
    await this.contourVerifiers.deposit(ether(200), { from: v4 });
    await this.contourVerifiers.setOperator(o4, { from: v4 });
  });

  describe('new property application', async function() {
    it('should allow approving any contour', async function() {
      let res = await this.spaceToken.mint(alice, { from: minter });
      const tokenId1 = res.logs[0].args.tokenId.toNumber();
      await this.spaceGeoData.setSpaceTokenContour(tokenId1, this.contour1, { from: geoDateManagement });

      res = await this.spaceToken.mint(alice, { from: minter });
      const tokenId2 = res.logs[0].args.tokenId.toNumber();
      await this.spaceGeoData.setSpaceTokenContour(tokenId2, this.contour2, { from: geoDateManagement });

      res = await this.spaceToken.mint(alice, { from: minter });
      const tokenId3 = res.logs[0].args.tokenId.toNumber();
      await this.spaceGeoData.setSpaceTokenContour(tokenId3, this.contour3, { from: geoDateManagement });

      // Create a new NewPropertyManager application
      res = await this.newPropertyManager.submit(this.contour4, 6, SpaceTokenType.LAND_PLOT);
      const aId = res.logs[0].args.applicationId;

      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

      await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });

      await this.contourVerificationManager.approve(0, v2, { from: o2 });
      await this.contourVerificationManager.approve(0, v4, { from: o4 });
      await this.contourVerificationManager.approve(0, v3, { from: o3 });

      await evmIncreaseTime(3600 * 4);

      assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

      res = await this.contourVerificationManager.getApplication(0);
      assert.equal(res.approvalCount, 3);
      assert.equal(res.action, 0);
      assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);

      // too early
      await assertRevert(this.contourVerificationManager.pushApproval(0));

      await evmIncreaseTime(3600 * 5);

      await this.contourVerificationManager.pushApproval(0);

      assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.SUBMITTED);

      res = await this.contourVerificationManager.getApplication(0);
      assert.equal(res.status, CVStatus.APPROVED);
    });

    describe('with intersecting contours', async function() {
      beforeEach(async function() {
        let res = await this.spaceToken.mint(alice, { from: minter });
        this.tokenId1 = res.logs[0].args.tokenId.toNumber();

        res = await this.spaceToken.mint(alice, { from: minter });
        this.tokenId2 = res.logs[0].args.tokenId.toNumber();

        res = await this.spaceToken.mint(alice, { from: minter });
        this.tokenId3 = res.logs[0].args.tokenId.toNumber();
      });

      describe('existing token', () => {
        beforeEach(async function() {
          await this.spaceGeoData.setSpaceTokenContour(this.tokenId3, this.contour1, { from: geoDateManagement });
          await this.spaceGeoData.setSpaceTokenType(this.tokenId3, SpaceTokenType.LAND_PLOT, {
            from: geoDateManagement
          });
        });

        it('should deny rejecting with non-intersecting contours', async function() {
          const res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));
          await this.contourVerificationManager.approve(0, v4, { from: o4 });
          await assertRevert(
            this.contourVerificationManager.rejectWithExistingContourIntersectionProof(
              0,
              v2,
              this.tokenId3,
              3,
              galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
              galt.geohashToNumber('dr5qvnpd300r').toString(10),
              0,
              galt.geohashToNumber('dr5qvnp9c7b2').toString(10),
              galt.geohashToNumber('dr5qvnp99ddh').toString(10),
              { from: o2 }
            )
          );
        });

        it('should allow rejecting with existing token intersection proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
          await this.contourVerificationManager.rejectWithExistingContourIntersectionProof(
            cvId2,
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
          await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId2);
        });

        it('should allow rejecting with existing token inclusion proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });

          await this.contourVerificationManager.rejectWithExistingPointInclusionProof(
            0,
            v2,
            Inclusion.VERIFYING_INSIDE_EXISTING,
            this.tokenId3,
            3,
            galt.geohashToNumber('dr5qvnpd100z').toString(10),
            { from: o2 }
          );
          await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId2);
        });

        it('should allow catching invalid approvals with existing token intersection proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
          await this.contourVerificationManager.approve(cvId2, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId2, v3, { from: o3 });

          await evmIncreaseTime(3600 * 4);

          assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

          res = await this.contourVerificationManager.getApplication(0);
          assert.equal(res.approvalCount, 3);
          assert.equal(res.action, 0);
          assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);

          await this.contourVerificationManager.reportInvalidApprovalWithExistingContourIntersectionProof(
            cvId2,
            this.tokenId3,
            3,
            galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
            galt.geohashToNumber('dr5qvnpd300r').toString(10),
            0,
            galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
            galt.geohashToNumber('dr5qvnpd5npy').toString(10),
            { from: charlie }
          );
          await afterReportChecks.call(this, this.newPropertyManager, aId, cvId2);
        });

        it('should allow catching invalid approvals with existing token inclusion proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
          await this.contourVerificationManager.approve(cvId2, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId2, v3, { from: o3 });

          await evmIncreaseTime(3600 * 4);

          assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

          res = await this.contourVerificationManager.getApplication(0);
          assert.equal(res.approvalCount, 3);
          assert.equal(res.action, 0);
          assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);

          await this.contourVerificationManager.reportInvalidApprovalWithExistingPointInclusionProof(
            0,
            this.tokenId3,
            Inclusion.VERIFYING_INSIDE_EXISTING,
            3,
            galt.geohashToNumber('dr5qvnpd100z').toString(10),
            { from: charlie }
          );
          await afterReportChecks.call(this, this.newPropertyManager, aId, cvId2);
        });
      });

      describe('application approved contour', () => {
        beforeEach(async function() {
          let res = await this.updatePropertyManager.submit(this.tokenId1, this.contour1, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;
          this.existingAId = aId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, { from: alice });
          const cvId1 = res.logs[0].args.applicationId;
          this.cvId1 = cvId1;

          await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
          await this.contourVerificationManager.approve(cvId1, v4, { from: o4 });
          await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });

          await evmIncreaseTime(3600 * 9);

          await this.contourVerificationManager.pushApproval(cvId1);
        });

        it('should deny rejecting with non-intersecting contours', async function() {
          let res = await this.newPropertyManager.submit(this.contour3, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId1 = res.logs[0].args.applicationId;

          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));
          await this.contourVerificationManager.approve(cvId1, v4, { from: o4 });
          await assertRevert(
            this.contourVerificationManager.rejectWithApplicationApprovedContourIntersectionProof(
              cvId1,
              v2,
              this.updatePropertyManager.address,
              this.existingAId,
              3,
              galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
              galt.geohashToNumber('dr5qvnpd300r').toString(10),
              0,
              galt.geohashToNumber('dr5qvnp9c7b2').toString(10),
              galt.geohashToNumber('dr5qvnp99ddh').toString(10),
              { from: o2 }
            )
          );
        });

        it('should allow rejecting with contour in another application contract intersection proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
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

          await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId2);
        });

        it('should allow rejecting with contour in another application contract inclusion proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });

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

          await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId2);
        });

        // eslint-disable-next-line max-len
        it('should allow catching invalid approvals with contour in another application contract intersection proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
          await this.contourVerificationManager.approve(cvId2, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId2, v3, { from: o3 });

          await evmIncreaseTime(3600 * 4);

          assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

          res = await this.contourVerificationManager.getApplication(cvId2);
          assert.equal(res.approvalCount, 3);
          assert.equal(res.action, 0);
          assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);

          await this.contourVerificationManager.reportInvalidApprovalWithApplicationApprovedContourIntersectionProof(
            cvId2,
            this.updatePropertyManager.address,
            this.existingAId,
            3,
            galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
            galt.geohashToNumber('dr5qvnpd300r').toString(10),
            0,
            galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
            galt.geohashToNumber('dr5qvnpd5npy').toString(10),
            { from: charlie }
          );

          await afterReportChecks.call(this, this.newPropertyManager, aId, cvId2);
        });

        // eslint-disable-next-line max-len
        it('should allow catching invalid approvals with contour in another application contract inclusion proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
          await this.contourVerificationManager.approve(cvId2, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId2, v3, { from: o3 });

          await evmIncreaseTime(3600 * 4);

          assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

          res = await this.contourVerificationManager.getApplication(cvId2);
          assert.equal(res.approvalCount, 3);
          assert.equal(res.action, 0);
          assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);

          await this.contourVerificationManager.reportInvalidApprovalWithApplicationApprovedPointInclusionProof(
            cvId2,
            Inclusion.VERIFYING_INSIDE_EXISTING,
            this.updatePropertyManager.address,
            this.existingAId,
            0,
            galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
            { from: charlie }
          );

          await afterReportChecks.call(this, this.newPropertyManager, aId, cvId2);
        });
      });

      describe('approved timeout contour', () => {
        beforeEach(async function() {
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

          await evmIncreaseTime(3600 * 2);
        });

        it('should deny rejecting with non-intersecting contours', async function() {
          let res = await this.newPropertyManager.submit(this.contour3, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;

          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));
          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
          await assertRevert(
            this.contourVerificationManager.rejectWithApplicationApprovedTimeoutContourIntersectionProof(
              cvId2,
              v2,
              this.existingAId,
              3,
              galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
              galt.geohashToNumber('dr5qvnpd300r').toString(10),
              0,
              galt.geohashToNumber('dr5qvnp9c7b2').toString(10),
              galt.geohashToNumber('dr5qvnp99ddh').toString(10),
              { from: o2 }
            )
          );
        });

        it('should allow rejecting with contour in another application contract intersection proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });

          res = await this.contourVerificationManager.getApplication(this.cvId1);
          assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);
          res = await this.newPropertyManager.isCVApplicationApproved(this.existingAId);
          assert.equal(res, false);

          await assertRevert(
            this.contourVerificationManager.rejectWithApplicationApprovedContourIntersectionProof(
              cvId2,
              v2,
              this.newPropertyManager.address,
              this.existingAId,
              3,
              galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
              galt.geohashToNumber('dr5qvnpd300r').toString(10),
              0,
              galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
              galt.geohashToNumber('dr5qvnpd5npy').toString(10),
              { from: o2 }
            )
          );
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
          await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId2);
        });

        it('should allow rejecting with contour in another application contract inclusion proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });

          res = await this.contourVerificationManager.getApplication(this.cvId1);
          assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);
          res = await this.newPropertyManager.isCVApplicationApproved(this.existingAId);
          assert.equal(res, false);

          await assertRevert(
            this.contourVerificationManager.rejectWithApplicationApprovedPointInclusionProof(
              cvId2,
              v2,
              Inclusion.VERIFYING_INSIDE_EXISTING,
              this.updatePropertyManager.address,
              this.existingAId,
              0,
              galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
              { from: o2 }
            )
          );

          await this.contourVerificationManager.rejectWithApplicationApprovedTimeoutPointInclusionProof(
            cvId2,
            v2,
            Inclusion.VERIFYING_INSIDE_EXISTING,
            this.cvId1,
            0,
            galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
            { from: o2 }
          );
          await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId2);
        });

        // eslint-disable-next-line max-len
        it('should allow catching invalid approval with contour in another application contract intersection proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
          await this.contourVerificationManager.approve(cvId2, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId2, v3, { from: o3 });

          await evmIncreaseTime(3600 * 4);

          assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

          res = await this.contourVerificationManager.getApplication(cvId2);
          assert.equal(res.approvalCount, 3);
          assert.equal(res.action, 0);
          assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);
          res = await this.newPropertyManager.isCVApplicationApproved(aId);
          assert.equal(res, false);

          res = await this.contourVerificationManager.getApplication(this.cvId1);
          assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);
          res = await this.newPropertyManager.isCVApplicationApproved(this.existingAId);
          assert.equal(res, false);

          await assertRevert(
            this.contourVerificationManager.rejectWithApplicationApprovedContourIntersectionProof(
              cvId2,
              v2,
              this.newPropertyManager.address,
              this.existingAId,
              3,
              galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
              galt.geohashToNumber('dr5qvnpd300r').toString(10),
              0,
              galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
              galt.geohashToNumber('dr5qvnpd5npy').toString(10),
              { from: o2 }
            )
          );
          await assertRevert(
            this.contourVerificationManager.reportInvalidApprovalWithApplicationApprovedTimeoutContourIntersectionProof(
              this.cvId1,
              cvId2,
              0,
              galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
              galt.geohashToNumber('dr5qvnpd5npy').toString(10),
              3,
              galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
              galt.geohashToNumber('dr5qvnpd300r').toString(10),
              { from: charlie }
            ),
            'Existing application ID should be less than reporting ID'
          );
          // eslint-disable-next-line max-len
          await this.contourVerificationManager.reportInvalidApprovalWithApplicationApprovedTimeoutContourIntersectionProof(
            cvId2,
            this.cvId1,
            3,
            galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
            galt.geohashToNumber('dr5qvnpd300r').toString(10),
            0,
            galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
            galt.geohashToNumber('dr5qvnpd5npy').toString(10),
            { from: charlie }
          );
          await afterReportChecks.call(this, this.newPropertyManager, aId, cvId2);
        });

        it('should allow rejecting with contour in another application contract inclusion proof', async function() {
          let res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
          const aId = res.logs[0].args.applicationId;

          await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

          res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
          const cvId2 = res.logs[0].args.applicationId;
          assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

          assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
          await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
          await this.contourVerificationManager.approve(cvId2, v1, { from: o1 });
          await this.contourVerificationManager.approve(cvId2, v3, { from: o3 });

          await evmIncreaseTime(3600 * 4);

          assert.equal(await this.newPropertyManager.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

          res = await this.contourVerificationManager.getApplication(cvId2);
          assert.equal(res.approvalCount, 3);
          assert.equal(res.action, 0);
          assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);
          res = await this.newPropertyManager.isCVApplicationApproved(aId);
          assert.equal(res, false);

          res = await this.contourVerificationManager.getApplication(this.cvId1);
          assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);
          res = await this.newPropertyManager.isCVApplicationApproved(this.existingAId);
          assert.equal(res, false);

          await this.contourVerificationManager.reportInvalidApprovalWithApplicationApprovedTimeoutPointInclusionProof(
            cvId2,
            this.cvId1,
            Inclusion.VERIFYING_INSIDE_EXISTING,
            0,
            galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
            { from: charlie }
          );
          await afterReportChecks.call(this, this.newPropertyManager, aId, cvId2);
        });
      });
    });

    describe('inclusion cases', async function() {
      beforeEach(async function() {
        let res = await this.spaceToken.mint(alice, { from: minter });
        this.tokenId1 = res.logs[0].args.tokenId.toNumber();
        // await this.spaceGeoData.setSpaceTokenContour(this.tokenId1, this.contour1, { from: geoDateManagement });

        res = await this.spaceToken.mint(alice, { from: minter });
        this.tokenId2 = res.logs[0].args.tokenId.toNumber();
        // await this.spaceGeoData.setSpaceTokenContour(this.tokenId2, this.contour2, { from: geoDateManagement });

        res = await this.spaceToken.mint(alice, { from: minter });
        this.tokenId3 = res.logs[0].args.tokenId.toNumber();
      });

      describe('existing contours', () => {
        describe('verifying point inside existing', () => {
          beforeEach(async function() {
            await this.spaceGeoData.setSpaceTokenContour(this.tokenId3, this.contour1, { from: geoDateManagement });
            await this.spaceGeoData.setSpaceTokenType(this.tokenId3, SpaceTokenType.LAND_PLOT, {
              from: geoDateManagement
            });
          });

          it('should deny rejecting with non-intersecting contour', async function() {
            const res = await this.newPropertyManager.submit(this.contour2, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));
            await this.contourVerificationManager.approve(0, v4, { from: o4 });
            await assertRevert(
              this.contourVerificationManager.rejectWithExistingPointInclusionProof(
                0,
                v2,
                Inclusion.VERIFYING_INSIDE_EXISTING,
                this.tokenId3,
                2,
                galt.geohashToNumber('dr5qvnp9grz7').toString(10),
                { from: o2 }
              )
            );
          });

          it('should allow rejecting with existing token inclusion proof', async function() {
            let res = await this.newPropertyManager.submit(this.contour4, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            const cvId = res.logs[0].args.applicationId;

            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));
            await this.contourVerificationManager.approve(cvId, v4, { from: o4 });
            await this.contourVerificationManager.rejectWithExistingPointInclusionProof(
              cvId,
              v2,
              Inclusion.VERIFYING_INSIDE_EXISTING,
              this.tokenId3,
              1,
              galt.geohashToNumber('dr5qvnp6h46c').toString(10),
              { from: o2 }
            );
            await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId);
          });
        });

        describe('existing point inside verifying', () => {
          beforeEach(async function() {
            await this.spaceGeoData.setSpaceTokenContour(this.tokenId3, this.contour2, { from: geoDateManagement });
            await this.spaceGeoData.setSpaceTokenType(this.tokenId3, SpaceTokenType.LAND_PLOT, {
              from: geoDateManagement
            });
          });

          it('should deny rejecting with non-intersecting contour', async function() {
            const res = await this.newPropertyManager.submit(this.contour1, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));
            await this.contourVerificationManager.approve(0, v4, { from: o4 });
            await assertRevert(
              this.contourVerificationManager.rejectWithExistingPointInclusionProof(
                0,
                v2,
                Inclusion.EXISTING_INSIDE_VERIFYING,
                this.tokenId3,
                1,
                galt.geohashToNumber('dr5qvnpd5npy').toString(10),
                { from: o2 }
              )
            );
          });

          it('should allow rejecting with existing token inclusion proof', async function() {
            let res = await this.newPropertyManager.submit(this.contour1, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            const cvId = res.logs[0].args.applicationId;

            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));
            await this.contourVerificationManager.approve(cvId, v4, { from: o4 });
            await this.contourVerificationManager.rejectWithExistingPointInclusionProof(
              cvId,
              v2,
              Inclusion.EXISTING_INSIDE_VERIFYING,
              this.tokenId3,
              0,
              galt.geohashToNumber('dr5qvnpd0eqs').toString(10),
              { from: o2 }
            );
            await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId);
          });
        });
      });

      describe('application approved contour', () => {
        describe('verifying point inside existing', () => {
          beforeEach(async function() {
            let res = await this.updatePropertyManager.submit(
              this.tokenId1,
              this.contour1,
              42,
              SpaceTokenType.LAND_PLOT
            );
            const aId = res.logs[0].args.applicationId;
            this.existingAId = aId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, {
              from: alice
            });
            const cvId1 = res.logs[0].args.applicationId;
            this.cvId1 = cvId1;

            await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
            await this.contourVerificationManager.approve(cvId1, v4, { from: o4 });
            await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });

            await evmIncreaseTime(3600 * 9);

            await this.contourVerificationManager.pushApproval(cvId1);
          });

          it('should deny rejecting with non-intersecting contours', async function() {
            let res = await this.newPropertyManager.submit(this.contour3, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            const cvId2 = res.logs[0].args.applicationId;

            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));
            await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
            await assertRevert(
              this.contourVerificationManager.rejectWithApplicationApprovedPointInclusionProof(
                cvId2,
                v2,
                Inclusion.VERIFYING_INSIDE_EXISTING,
                this.updatePropertyManager.address,
                this.existingAId,
                1,
                galt.geohashToNumber('dr5qvnp3ewcv').toString(10),
                { from: o2 }
              ),
              "Existing contour doesn't include verifying"
            );
          });

          it('should allow rejecting with contour in another application contract cinclusion proof', async function() {
            let res = await this.newPropertyManager.submit(this.contour4, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            const cvId2 = res.logs[0].args.applicationId;
            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

            assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
            await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
            await this.contourVerificationManager.rejectWithApplicationApprovedPointInclusionProof(
              cvId2,
              v2,
              Inclusion.VERIFYING_INSIDE_EXISTING,
              this.updatePropertyManager.address,
              this.existingAId,
              0,
              galt.geohashToNumber('dr5qvnp6hfwt').toString(10),
              { from: o2 }
            );
            await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId2);
          });
        });
        describe('existing point inside verifying', () => {
          beforeEach(async function() {
            let res = await this.updatePropertyManager.submit(
              this.tokenId2,
              this.contour5,
              42,
              SpaceTokenType.LAND_PLOT
            );
            const aId = res.logs[0].args.applicationId;
            this.existingAId = aId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, {
              from: alice
            });
            const cvId1 = res.logs[0].args.applicationId;
            this.cvId1 = cvId1;

            await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
            await this.contourVerificationManager.approve(cvId1, v4, { from: o4 });
            await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });

            await evmIncreaseTime(3600 * 9);

            await this.contourVerificationManager.pushApproval(cvId1);
          });

          it('should deny rejecting with non-intersecting contours', async function() {
            let res = await this.newPropertyManager.submit(this.contour3, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            const cvId2 = res.logs[0].args.applicationId;

            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));
            await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
            await assertRevert(
              this.contourVerificationManager.rejectWithApplicationApprovedPointInclusionProof(
                cvId2,
                v2,
                Inclusion.EXISTING_INSIDE_VERIFYING,
                this.updatePropertyManager.address,
                this.existingAId,
                0,
                galt.geohashToNumber('dr5qvnp3vur6').toString(10),
                { from: o2 }
              ),
              "Existing contour doesn't include verifying"
            );
          });

          it('should allow rejecting with contour in another application contract cinclusion proof', async function() {
            let res = await this.newPropertyManager.submit(this.contour3, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            const cvId2 = res.logs[0].args.applicationId;
            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

            assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
            await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
            await this.contourVerificationManager.rejectWithApplicationApprovedPointInclusionProof(
              cvId2,
              v2,
              Inclusion.EXISTING_INSIDE_VERIFYING,
              this.updatePropertyManager.address,
              this.existingAId,
              3,
              galt.geohashToNumber('dr5qvnp3wp47').toString(10),
              { from: o2 }
            );
            await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId2);
          });
        });
      });

      describe('approved timeout contour', () => {
        describe('verifying point inside existing', () => {
          beforeEach(async function() {
            let res = await this.updatePropertyManager.submit(
              this.tokenId1,
              this.contour1,
              42,
              SpaceTokenType.LAND_PLOT
            );
            const aId = res.logs[0].args.applicationId;
            this.existingAId = aId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, {
              from: alice
            });
            const cvId1 = res.logs[0].args.applicationId;
            this.cvId1 = cvId1;

            await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
            await this.contourVerificationManager.approve(cvId1, v4, { from: o4 });
            await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });

            await evmIncreaseTime(3600 * 3);
          });

          it('should deny rejecting with non-intersecting contours', async function() {
            let res = await this.newPropertyManager.submit(this.contour3, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            const cvId2 = res.logs[0].args.applicationId;

            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));
            await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
            await assertRevert(
              this.contourVerificationManager.rejectWithApplicationApprovedTimeoutPointInclusionProof(
                cvId2,
                v2,
                Inclusion.VERIFYING_INSIDE_EXISTING,
                this.cvId1,
                1,
                galt.geohashToNumber('dr5qvnp3ewcv').toString(10),
                { from: o2 }
              ),
              "Existing contour doesn't include verifying"
            );
          });

          it('should allow rejecting with contour in another application contract inclusion proof', async function() {
            let res = await this.newPropertyManager.submit(this.contour4, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            const cvId2 = res.logs[0].args.applicationId;
            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

            assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
            await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });

            res = await this.contourVerificationManager.getApplication(this.cvId1);
            assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);
            res = await this.updatePropertyManager.isCVApplicationApproved(this.existingAId);
            assert.equal(res, false);
            res = await this.updatePropertyManager.isCVApplicationPending(this.existingAId);
            assert.equal(res, true);
            res = await this.newPropertyManager.isCVApplicationPending(aId);
            assert.equal(res, true);

            await this.contourVerificationManager.rejectWithApplicationApprovedTimeoutPointInclusionProof(
              cvId2,
              v2,
              Inclusion.VERIFYING_INSIDE_EXISTING,
              this.cvId1,
              0,
              galt.geohashToNumber('dr5qvnp6hfwt').toString(10),
              { from: o2 }
            );
            await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId2);
          });
        });

        describe('existing point inside verifying', () => {
          beforeEach(async function() {
            let res = await this.updatePropertyManager.submit(
              this.tokenId1,
              this.contour5,
              42,
              SpaceTokenType.LAND_PLOT
            );
            const aId = res.logs[0].args.applicationId;
            this.existingAId = aId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, {
              from: alice
            });
            const cvId1 = res.logs[0].args.applicationId;
            this.cvId1 = cvId1;

            await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
            await this.contourVerificationManager.approve(cvId1, v4, { from: o4 });
            await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });

            await evmIncreaseTime(3600 * 3);
          });

          it('should deny rejecting with non-intersecting contours', async function() {
            let res = await this.newPropertyManager.submit(this.contour3, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            const cvId2 = res.logs[0].args.applicationId;

            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));
            await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
            await assertRevert(
              this.contourVerificationManager.rejectWithApplicationApprovedTimeoutPointInclusionProof(
                cvId2,
                v2,
                Inclusion.EXISTING_INSIDE_VERIFYING,
                this.cvId1,
                0,
                galt.geohashToNumber('dr5qvnp3vur6').toString(10),
                { from: o2 }
              ),
              "Existing contour doesn't include verifying"
            );
          });

          it('should allow rejecting with contour in another application contract inclusion proof', async function() {
            let res = await this.newPropertyManager.submit(this.contour3, 42, SpaceTokenType.LAND_PLOT);
            const aId = res.logs[0].args.applicationId;

            await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

            res = await this.contourVerificationManager.submit(this.newPropertyManager.address, aId, { from: alice });
            const cvId2 = res.logs[0].args.applicationId;
            assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(0));

            assert.equal(await this.contourVerifiers.isVerifierValid(v2, o2), true);
            await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });

            res = await this.contourVerificationManager.getApplication(this.cvId1);
            assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);
            res = await this.updatePropertyManager.isCVApplicationApproved(this.existingAId);
            assert.equal(res, false);
            res = await this.updatePropertyManager.isCVApplicationPending(this.existingAId);
            assert.equal(res, true);
            res = await this.newPropertyManager.isCVApplicationPending(aId);
            assert.equal(res, true);

            await this.contourVerificationManager.rejectWithApplicationApprovedTimeoutPointInclusionProof(
              cvId2,
              v2,
              Inclusion.EXISTING_INSIDE_VERIFYING,
              this.cvId1,
              2,
              galt.geohashToNumber('dr5qvnp3ybpq').toString(10),
              { from: o2 }
            );
            await afterRejectChecks.call(this, this.newPropertyManager, aId, cvId2);
          });
        });
      });
    });
  });

  describe('update property application', async function() {
    // contour 1 > contour 5
    it('should allow approving any contour', async function() {
      let res = await this.spaceToken.mint(alice, { from: minter });
      const tokenId1 = res.logs[0].args.tokenId.toNumber();
      await this.spaceGeoData.setSpaceTokenContour(tokenId1, this.contour1, { from: geoDateManagement });

      res = await this.spaceToken.mint(alice, { from: minter });
      const tokenId2 = res.logs[0].args.tokenId.toNumber();
      await this.spaceGeoData.setSpaceTokenContour(tokenId2, this.contour2, { from: geoDateManagement });

      res = await this.spaceToken.mint(alice, { from: minter });
      const tokenId3 = res.logs[0].args.tokenId.toNumber();
      await this.spaceGeoData.setSpaceTokenContour(tokenId3, this.contour3, { from: geoDateManagement });

      res = await this.updatePropertyManager.submit(tokenId1, this.contour5, 42, SpaceTokenType.LAND_PLOT);
      const aId = res.logs[0].args.applicationId;

      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

      await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, { from: alice });

      await this.contourVerificationManager.approve(0, v2, { from: o2 });
      await this.contourVerificationManager.approve(0, v4, { from: o4 });
      await this.contourVerificationManager.approve(0, v3, { from: o3 });

      await evmIncreaseTime(3600 * 4);

      assert.equal(await this.updatePropertyManager.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

      res = await this.contourVerificationManager.getApplication(0);
      assert.equal(res.approvalCount, 3);
      assert.equal(res.action, 0);
      assert.equal(res.status, CVStatus.APPROVAL_TIMEOUT);

      // too early
      await assertRevert(this.contourVerificationManager.pushApproval(0));

      await evmIncreaseTime(3600 * 5);

      await this.contourVerificationManager.pushApproval(0);

      assert.equal(await this.updatePropertyManager.getApplicationStatus(aId), ApplicationStatus.SUBMITTED);

      res = await this.contourVerificationManager.getApplication(0);
      assert.equal(res.status, CVStatus.APPROVED);
    });

    // contour 1 > contour 5
    describe('existing token', () => {
      beforeEach(async function() {
        await this.spaceToken.mint(alice, { from: minter });

        let res = await this.spaceToken.mint(alice, { from: minter });
        this.tokenId2 = res.logs[0].args.tokenId.toNumber();
        await this.spaceGeoData.setSpaceTokenContour(this.tokenId2, this.contour1, { from: geoDateManagement });
        await this.spaceGeoData.setSpaceTokenType(this.tokenId2, SpaceTokenType.LAND_PLOT, { from: geoDateManagement });

        res = await this.spaceToken.mint(alice, { from: minter });
        this.tokenId3 = res.logs[0].args.tokenId.toNumber();
        await this.spaceGeoData.setSpaceTokenContour(this.tokenId3, this.contour3, { from: geoDateManagement });
        await this.spaceGeoData.setSpaceTokenType(this.tokenId3, SpaceTokenType.LAND_PLOT, { from: geoDateManagement });
      });

      it('should allow rejecting only with another existing token intersection proof', async function() {
        // Create a new UpdatePropertyManager application
        let res = await this.updatePropertyManager.submit(this.tokenId2, this.contour5, 42, SpaceTokenType.LAND_PLOT);
        const aId = res.logs[0].args.applicationId;

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

        res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, { from: alice });
        const cvId = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId, v4, { from: o4 });
        assert.equal(await this.contourVerificationManager.isSelfUpdateCase(cvId, this.tokenId2), true);

        await assertRevert(
          this.contourVerificationManager.rejectWithExistingContourIntersectionProof(
            cvId,
            v2,
            this.tokenId2,
            3,
            galt.geohashToNumber('dr5qvnp3g3w0').toString(10),
            galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
            1,
            galt.geohashToNumber('dr5qvnp3yv97').toString(10),
            galt.geohashToNumber('dr5qvnp3ybpq').toString(10),
            { from: o2 }
          ),
          "Can't reject self-update action"
        );
        await this.contourVerificationManager.rejectWithExistingContourIntersectionProof(
          cvId,
          v2,
          this.tokenId3,
          0,
          galt.geohashToNumber('dr5qvnp9c7b2').toString(10),
          galt.geohashToNumber('dr5qvnp3ewcv').toString(10),
          1,
          galt.geohashToNumber('dr5qvnp3yv97').toString(10),
          galt.geohashToNumber('dr5qvnp3ybpq').toString(10),
          { from: o2 }
        );
        await afterRejectChecks.call(this, this.updatePropertyManager, aId, cvId);
      });

      it('should allow rejecting only with another existing token inclusion proof', async function() {
        // Create a new UpdatePropertyManager application
        let res = await this.updatePropertyManager.submit(this.tokenId2, this.contour5, 42, SpaceTokenType.LAND_PLOT);
        const aId = res.logs[0].args.applicationId;

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

        res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, { from: alice });
        const cvId = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId, v4, { from: o4 });
        assert.equal(await this.contourVerificationManager.isSelfUpdateCase(cvId, this.tokenId2), true);

        await assertRevert(
          this.contourVerificationManager.rejectWithExistingPointInclusionProof(
            cvId,
            v2,
            Inclusion.VERIFYING_INSIDE_EXISTING,
            this.tokenId2,
            3,
            galt.geohashToNumber('dr5qvnpd100z').toString(10),
            { from: o2 }
          ),
          "Can't reject self-update action"
        );
        await this.contourVerificationManager.rejectWithExistingPointInclusionProof(
          cvId,
          v2,
          Inclusion.VERIFYING_INSIDE_EXISTING,
          this.tokenId3,
          3,
          galt.geohashToNumber('dr5qvnp3wp47').toString(10),
          { from: o2 }
        );

        await afterRejectChecks.call(this, this.updatePropertyManager, aId, cvId);
      });
    });

    describe('application approved contour', () => {
      // 2 => 1
      // 3 => 5
      // doesn't matter that initially contours 1 & 2 overlaps
      beforeEach(async function() {
        await this.spaceToken.mint(alice, { from: minter });

        let res = await this.spaceToken.mint(alice, { from: minter });
        this.tokenId2 = res.logs[0].args.tokenId.toNumber();
        await this.spaceGeoData.setSpaceTokenContour(this.tokenId2, this.contour2, { from: geoDateManagement });

        res = await this.spaceToken.mint(alice, { from: minter });
        this.tokenId3 = res.logs[0].args.tokenId.toNumber();
        await this.spaceGeoData.setSpaceTokenContour(this.tokenId3, this.contour3, { from: geoDateManagement });

        res = await this.updatePropertyManager.submit(this.tokenId2, this.contour1, 42, SpaceTokenType.LAND_PLOT);
        const aId = res.logs[0].args.applicationId;
        this.existingAId = aId;

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

        res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, { from: alice });
        const cvId1 = res.logs[0].args.applicationId;
        this.cvId1 = cvId1;

        await this.contourVerificationManager.approve(cvId1, v2, { from: o2 });
        await this.contourVerificationManager.approve(cvId1, v4, { from: o4 });
        await this.contourVerificationManager.approve(cvId1, v3, { from: o3 });

        await evmIncreaseTime(3600 * 9);

        await this.contourVerificationManager.pushApproval(cvId1);
      });

      it('should allow rejecting only with another approved contour intersection proof', async function() {
        // Create a new UpdatePropertyManager application
        let res = await this.updatePropertyManager.submit(this.tokenId3, this.contour5, 42, SpaceTokenType.LAND_PLOT);
        const aId = res.logs[0].args.applicationId;

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

        res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, { from: alice });
        const cvId2 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
        assert.equal(await this.contourVerificationManager.isSelfUpdateCase(cvId2, this.tokenId3), true);
        assert.equal(await this.contourVerificationManager.isSelfUpdateCase(this.cvId1, this.tokenId2), true);

        await this.contourVerificationManager.rejectWithApplicationApprovedContourIntersectionProof(
          cvId2,
          v2,
          this.updatePropertyManager.address,
          this.existingAId,
          2,
          galt.geohashToNumber('dr5qvnp3g3w0').toString(10),
          galt.geohashToNumber('dr5qvnp9cnpt').toString(10),
          3,
          galt.geohashToNumber('dr5qvnp3wp47').toString(10),
          galt.geohashToNumber('dr5qvnp3vur6').toString(10),
          { from: o2 }
        );

        await afterRejectChecks.call(this, this.updatePropertyManager, aId, cvId2);
      });

      it('should allow rejecting only with another approved contour inclusion proof', async function() {
        // Create a new UpdatePropertyManager application
        let res = await this.updatePropertyManager.submit(this.tokenId3, this.contour5, 42, SpaceTokenType.LAND_PLOT);
        const aId = res.logs[0].args.applicationId;

        await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });

        res = await this.contourVerificationManager.submit(this.updatePropertyManager.address, aId, { from: alice });
        const cvId2 = res.logs[0].args.applicationId;

        await this.contourVerificationManager.approve(cvId2, v4, { from: o4 });
        assert.equal(await this.contourVerificationManager.isSelfUpdateCase(cvId2, this.tokenId3), true);
        assert.equal(await this.contourVerificationManager.isSelfUpdateCase(this.cvId1, this.tokenId2), true);

        await this.contourVerificationManager.rejectWithApplicationApprovedPointInclusionProof(
          cvId2,
          v2,
          Inclusion.VERIFYING_INSIDE_EXISTING,
          this.updatePropertyManager.address,
          this.existingAId,
          1,
          galt.geohashToNumber('dr5qvnp3yv97').toString(10),
          { from: o2 }
        );

        await afterRejectChecks.call(this, this.updatePropertyManager, aId, cvId2);
      });
    });
  });

  async function afterRejectChecks(applicationContract, aId, cvId) {
    await assertRevert(this.contourVerificationManager.approve(1, v3, { from: o3 }));
    assert.equal(await this.contourVerifiers.slashedRewards(v2), ether(174));
    assert.equal(await applicationContract.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

    let res = await this.contourVerificationManager.getApplication(cvId);
    assert.equal(res.approvalCount, 1);
    assert.equal(res.action, 0);
    assert.equal(res.status, CVStatus.REJECTED);

    res = await this.contourVerificationManager.getApplication(cvId);
    assert.equal(res.status, CVStatus.REJECTED);
  }

  async function afterReportChecks(applicationContract, aId, cvId, numberOfApprovals = 3) {
    await assertRevert(this.contourVerificationManager.approve(cvId, v3, { from: o3 }));
    assert.equal(await this.contourVerifiers.slashedRewards(charlie), ether(174 * numberOfApprovals));
    assert.equal(await applicationContract.getApplicationStatus(aId), ApplicationStatus.CONTOUR_VERIFICATION);

    let res = await this.contourVerificationManager.getApplication(cvId);
    assert.equal(res.approvalCount, numberOfApprovals);
    assert.equal(res.action, 0);
    assert.equal(res.status, CVStatus.REJECTED);

    res = await this.contourVerificationManager.getApplication(cvId);
    assert.equal(res.status, CVStatus.REJECTED);
  }

  // T-H (Tail-Head)
  describe('queue', () => {
    beforeEach(async function() {
      const res = await this.newPropertyManager.submit(this.contour4, 42, SpaceTokenType.LAND_PLOT);
      this.aId = res.logs[0].args.applicationId;
    });

    it('should move queue correctly', async function() {
      // 0-0
      assert.equal(await this.contourVerificationManager.tail(), 0);
      assert.equal(await this.contourVerificationManager.head(), 0);

      // 0-1
      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
      this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, { from: alice });

      assert.equal(await this.contourVerificationManager.tail(), 0);
      assert.equal(await this.contourVerificationManager.head(), 1);

      // 0-2
      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: bob });
      this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, { from: bob });

      assert.equal(await this.contourVerificationManager.tail(), 0);
      assert.equal(await this.contourVerificationManager.head(), 2);

      // 1-2
      await assertRevert(this.contourVerificationManager.approve(1, v1, { from: o1 }));

      await this.contourVerificationManager.approve(0, v1, { from: o1 });
      await this.contourVerificationManager.approve(0, v2, { from: o2 });

      assert.equal(await this.contourVerificationManager.tail(), 0);
      await this.contourVerificationManager.approve(0, v3, { from: o3 });

      assert.equal(await this.contourVerificationManager.tail(), 1);
      assert.equal(await this.contourVerificationManager.head(), 2);

      await assertRevert(this.contourVerificationManager.approve(0, v4, { from: o4 }));

      // 2-2
      await assertRevert(this.contourVerificationManager.approve(2, v1, { from: o1 }));

      await this.contourVerificationManager.approve(1, v2, { from: o2 });
      await this.contourVerificationManager.approve(1, v3, { from: o3 });

      assert.equal(await this.contourVerificationManager.tail(), 1);
      await this.contourVerificationManager.approve(1, v4, { from: o4 });

      assert.equal(await this.contourVerificationManager.tail(), 2);
      assert.equal(await this.contourVerificationManager.head(), 2);

      // 2-3
      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: bob });
      this.contourVerificationManager.submit(this.newPropertyManager.address, this.aId, { from: bob });

      assert.equal(await this.contourVerificationManager.tail(), 2);
      assert.equal(await this.contourVerificationManager.head(), 3);

      // 3-3
    });
  });
});
