const ACL = artifacts.require('./ACL.sol');
const SpaceGeoDataRegistry = artifacts.require('./SpaceGeoDataRegistry.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const galtUtils = require('@galtproject/utils');

const { addElevationToContour } = require('../../galtHelpers');

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

contract('SpaceGeoDataRegistry', accounts => {
  const [coreTeam] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });

    this.registry = await SpaceGeoDataRegistry.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.registry.initialize(this.ggr.address);

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), coreTeam, true, { from: coreTeam });
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

      await this.registry.setSpaceTokenContour(1, contour, { from: coreTeam });
    });
  });
});
