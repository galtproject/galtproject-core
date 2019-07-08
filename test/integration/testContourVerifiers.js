const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const MockApplication = artifacts.require('./MockApplication.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const ContourVerifiers = artifacts.require('./ContourVerifiers.sol');

const Web3 = require('web3');

ContourVerifiers.numberFormat = 'String';
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

contract('ContourVerifiers', accounts => {
  const [coreTeam, minter, alice, bob, charlie, v1, v2, v3, v4, geoDateManagement] = accounts;

  before(async function() {
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
    this.contourVerifiers = await ContourVerifiers.new({ from: coreTeam });

    await this.contourVerifiers.initialize(this.ggr.address, ether(200));

    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.pggRegistry = await PGGRegistry.new({ from: coreTeam });

    await this.pggRegistry.initialize(this.ggr.address);

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(charlie, ether(10000000), { from: coreTeam });

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });

    await this.acl.setRole(bytes32('SPACE_MINTER'), minter, true, { from: coreTeam });
    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), geoDateManagement, true, { from: coreTeam });
  });

  beforeEach(async function() {
    this.contourVerifiers = await ContourVerifiers.new({ from: coreTeam });
    await this.contourVerifiers.initialize(this.ggr.address, ether(200));
  });

  describe('owners interface', async function() {
    it('should allow setting required deposit', async function() {
      assert.equal(await this.contourVerifiers.requiredDeposit(), ether(200));

      await assertRevert(this.contourVerifiers.setRequiredDeposit(ether(300), { from: alice }));
      await this.contourVerifiers.setRequiredDeposit(ether(300), { from: coreTeam });

      assert.equal(await this.contourVerifiers.requiredDeposit(), ether(300));
    });
  });

  describe('operator', async function() {
    it('should allow setting operator', async function() {
      await this.contourVerifiers.setOperator(bob, { from: alice });

      const res = await this.contourVerifiers.verifiers(alice);
      assert.equal(res.operator, bob);
    });
  });

  describe('verifier validity check', async function() {
    beforeEach(async function() {
      await this.contourVerifiers.setOperator(bob, { from: alice });
    });

    it('should return false when a deposit is lower than the required', async function() {
      await this.galtToken.approve(this.contourVerifiers.address, ether(300), { from: alice });
      await this.contourVerifiers.deposit(ether(150), { from: alice });

      assert.equal(await this.contourVerifiers.isVerifierValid(alice, bob), false);
    });

    it('should return true when a deposit is equal to the required', async function() {
      await this.galtToken.approve(this.contourVerifiers.address, ether(300), { from: alice });
      await this.contourVerifiers.deposit(ether(200), { from: alice });

      assert.equal(await this.contourVerifiers.isVerifierValid(alice, bob), true);
    });

    it('should return true when a deposit is greater than the required', async function() {
      await this.galtToken.approve(this.contourVerifiers.address, ether(300), { from: alice });
      await this.contourVerifiers.deposit(ether(300), { from: alice });

      assert.equal(await this.contourVerifiers.isVerifierValid(alice, bob), true);
    });

    it('should return false when a checkin a wrong oeprator address', async function() {
      await this.galtToken.approve(this.contourVerifiers.address, ether(300), { from: alice });
      await this.contourVerifiers.deposit(ether(300), { from: alice });

      assert.equal(await this.contourVerifiers.isVerifierValid(alice, charlie), true);
    });
  });

  describe('deposit', async function() {
    it('should use the default deposit value from initializer', async function() {
      assert.equal(await this.contourVerifiers.requiredDeposit(), ether(200));
    });

    it('should allow depositing more than required deposit ', async function() {
      await this.galtToken.approve(this.contourVerifiers.address, ether(300), { from: alice });
      await this.contourVerifiers.deposit(ether(300), { from: alice });

      const res = await this.contourVerifiers.verifiers(alice);
      assert.equal(res.deposit, ether(300));
    });

    it('should allow depositing more if currentDeposit > requiredDeposit', async function() {
      await this.galtToken.approve(this.contourVerifiers.address, ether(500), { from: alice });
      await this.contourVerifiers.deposit(ether(300), { from: alice });
      await this.contourVerifiers.deposit(ether(200), { from: alice });

      const res = await this.contourVerifiers.verifiers(alice);
      assert.equal(res.deposit, ether(500));
    });

    it('should allow depositing more if currentDeposit < requiredDeposit', async function() {
      await this.galtToken.approve(this.contourVerifiers.address, ether(500), { from: alice });
      await this.contourVerifiers.deposit(ether(100), { from: alice });
      await this.contourVerifiers.deposit(ether(400), { from: alice });

      const res = await this.contourVerifiers.verifiers(alice);
      assert.equal(res.deposit, ether(500));
    });

    it('should allow depositing more if currentDeposit == requiredDeposit', async function() {
      await this.galtToken.approve(this.contourVerifiers.address, ether(500), { from: alice });
      await this.contourVerifiers.deposit(ether(100), { from: alice });
      await this.contourVerifiers.deposit(ether(400), { from: alice });

      const res = await this.contourVerifiers.verifiers(alice);
      assert.equal(res.deposit, ether(500));
    });
  });

  describe('withdrawal', async function() {
    it('should allow withdrawing', async function() {
      await this.galtToken.approve(this.contourVerifiers.address, ether(500), { from: alice });
      await this.contourVerifiers.deposit(ether(300), { from: alice });
      assert.equal(await this.galtToken.balanceOf(this.contourVerifiers.address), ether(300));

      await this.contourVerifiers.withdraw(ether(50), { from: alice });

      let res = await this.contourVerifiers.verifiers(alice);
      assert.equal(res.deposit, ether(250));

      await this.contourVerifiers.withdraw(ether(150), { from: alice });

      res = await this.contourVerifiers.verifiers(alice);
      assert.equal(res.deposit, ether(100));
    });
  });
});
