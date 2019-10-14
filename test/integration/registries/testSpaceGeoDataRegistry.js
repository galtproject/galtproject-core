const ACL = artifacts.require('./ACL.sol');
const SpaceGeoDataRegistry = artifacts.require('./SpaceGeoDataRegistry.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');

const galtUtils = require('@galtproject/utils');

const { addElevationToContour } = require('../../galtHelpers');
const { assertRevert } = require('../../helpers');

const { web3 } = ACL;
const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

SpaceGeoDataRegistry.numberFormat = 'String';

contract('SpaceGeoDataRegistry', accounts => {
  const [coreTeam, geoDataManager, spaceMinter, alice] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });

    this.registry = await SpaceGeoDataRegistry.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new(this.ggr.address, 'Foo', 'Bar', { from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.registry.initialize(this.ggr.address);

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), geoDataManager, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_MINTER'), spaceMinter, true, { from: coreTeam });
  });

  describe('contour', async function() {
    // Parity client supports up to 350 with 8000000 gas, but here we use Ganache
    it('should be able set 300 vertex length contour', async function() {
      const rawContour = [];
      for (let i = 0; i < 300; i++) {
        rawContour.push('qwerqwerqwer');
      }

      let contour = rawContour.map(galtUtils.geohashToNumber).map(a => a.toString(10));

      contour = addElevationToContour(123123, contour);

      await this.registry.setSpaceTokenContour(1, contour, { from: geoDataManager });
    });
  });

  describe('deletion', async function() {
    it('should allow deleting contour', async function() {
      const res = await this.spaceToken.mint(alice, { from: spaceMinter });
      const tokenId = res.logs[0].args.tokenId;

      const contour = ['qwerqwerqwer', 'rewqqwerqwer', 'wwrrqwerqwer']
        .map(galtUtils.geohashToNumber)
        .map(a => a.toString(10));
      await this.registry.setSpaceTokenContour(tokenId, contour, { from: geoDataManager });
      await this.registry.setSpaceTokenArea(tokenId, 123, 0, { from: geoDataManager });

      await assertRevert(this.registry.deleteSpaceTokenGeoData(tokenId, { from: alice }), 'Token exists');

      // burn token
      await this.spaceToken.burn(tokenId, { from: alice });

      // data still active
      assert.sameMembers(await this.registry.getSpaceTokenContour(tokenId), contour);
      assert.equal(await this.registry.getSpaceTokenArea(tokenId), 123);
      assert.equal(await this.registry.getSpaceTokenAreaSource(tokenId), 0);

      await this.registry.deleteSpaceTokenGeoData(tokenId, { from: alice });

      assert.sameMembers(await this.registry.getSpaceTokenContour(tokenId), []);
      assert.equal(await this.registry.getSpaceTokenArea(tokenId), 0);
      assert.equal(await this.registry.getSpaceTokenAreaSource(tokenId), 0);
      assert.equal(await this.registry.getSpaceTokenType(tokenId), 0);
    });
  });
});
