const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const MockApplication = artifacts.require('./MockApplication.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const ContourVerificationManager = artifacts.require('./ContourVerificationManager.sol');
const ContourVerifiers = artifacts.require('./ContourVerifiers.sol');

const Web3 = require('web3');

ContourVerifiers.numberFormat = 'String';
ContourVerificationManager.numberFormat = 'String';
GaltToken.numberFormat = 'String';

const {
  ether,
  deploySpaceGeoDataLight,
  assertRevert,
  initHelperWeb3,
  initHelperArtifacts,
  paymentMethods
} = require('../helpers');
const { deployPGGFactory, buildPGG } = require('../deploymentHelpers');

const { web3 } = SpaceRA;
const galt = require('@galtproject/utils');

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

contract('SpaceRA', accounts => {
  const [coreTeam, minter, alice, bob, charlie, v1, v2, v3, v4, o1, o2, o3,  o4, geoDateManagement] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });

    this.rawContour1 = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.contour1 = this.rawContour1.map(galt.geohashToNumber).map(a => a.toString(10));

    this.rawContour2 = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.contour2 = this.rawContour2.map(galt.geohashToNumber).map(a => a.toString(10));

    this.rawContour3 = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.contour3 = this.rawContour3.map(galt.geohashToNumber).map(a => a.toString(10));

    this.rawContour4 = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.contour4 = this.rawContour4.map(galt.geohashToNumber).map(a => a.toString(10));

    await this.acl.initialize();
    await this.ggr.initialize();

    this.spaceToken = await SpaceToken.new(this.ggr.address, 'Name', 'Symbol', { from: coreTeam });
    this.spaceGeoData = await deploySpaceGeoDataLight(this.ggr);
    this.galtToken = await GaltToken.new({ from: coreTeam });

    this.newPropertyManager = await MockApplication.new({ from: coreTeam });
    this.updatePropertyManager = await MockApplication.new({ from: coreTeam });
    this.modifyPropertyManager = await MockApplication.new({ from: coreTeam });
    this.contourVerificationManager = await ContourVerificationManager.new({ from: coreTeam });
    this.contourVerifiers = await ContourVerifiers.new({ from: coreTeam });

    await this.contourVerificationManager.initialize(this.ggr.address, 5);
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
  });

  describe('new property application', async function() {
    it('should', async function() {
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
      await this.newPropertyManager.addActiveApplication(this.contour4);

      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
      await this.contourVerificationManager.submit(this.contour4, { from: alice });

      // TODO: expose lists of an active application ids and their contours

      // TODO: test contourVerifiers.
      // TODO: test current submission/queue/approvals
    });
  });

  // T-H (Tail-Head)
  describe('queue', () => {
    beforeEach(async function() {
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

    it.only('should move queue correctly', async function() {
      // 0-0
      assert.equal(await this.contourVerificationManager.tail(), 0);
      assert.equal(await this.contourVerificationManager.head(), 0);

      // 0-1
      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: alice });
      this.contourVerificationManager.submit(this.contour4, { from: alice });

      assert.equal(await this.contourVerificationManager.tail(), 0);
      assert.equal(await this.contourVerificationManager.head(), 1);

      // 0-2
      await this.galtToken.approve(this.contourVerificationManager.address, ether(10), { from: bob });
      this.contourVerificationManager.submit(this.contour4, { from: bob });

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
      this.contourVerificationManager.submit(this.contour4, { from: bob });

      assert.equal(await this.contourVerificationManager.tail(), 2);
      assert.equal(await this.contourVerificationManager.head(), 3);

      // 3-3
    });
  });

  describe('reward withdrawal', () => {
    it('should');
  });
});
