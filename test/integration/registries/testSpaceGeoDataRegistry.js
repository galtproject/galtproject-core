const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const ClaimManager = artifacts.require('./ClaimManager.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const SpaceGeoDataRegistry = artifacts.require('./SpaceGeoDataRegistry.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const { initHelperWeb3, assertRevert, ether } = require('../../helpers');
const { addElevationToContour, addElevationToGeohash5 } = require('../../galtHelpers');
const galtUtils = require('@galtproject/utils');

const web3 = new Web3(ClaimManager.web3.currentProvider);

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);

// eslint-disable-next-line
contract("PGGRegistry", (accounts) => {
  const [coreTeam] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });

    this.registry = await SpaceGeoDataRegistry.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.registry.initialize(this.ggr.address);

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
  });

  describe('register-unregister process', async function() {
    it('should allow registering again after unregistration', async function() {
      const rawContour = [];
      for (let i = 0; i < 350; i++) {
        rawContour.push('qwerqwerqwer');
      }

      let contour = rawContour.map(galtUtils.geohashToNumber).map(a => a.toString(10));

      contour = addElevationToContour(123123, contour);

      await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), coreTeam, true, { from: coreTeam });
      let res = await this.registry.setSpaceTokenContour(1, contour, { from: coreTeam });
      console.log('res >>>', res);
    });
  });
});
