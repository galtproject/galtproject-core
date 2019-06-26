const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const ClaimManager = artifacts.require('./ClaimManager.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const { initHelperWeb3, assertRevert, ether } = require('../../helpers');

const web3 = new Web3(ClaimManager.web3.currentProvider);

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);

// eslint-disable-next-line
contract("PGGRegistry", (accounts) => {
  const [coreTeam, alice, a1, a2, registrar, unregistrar] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });
    this.claimManager = await ClaimManager.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });

    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.pggRegistry = await PGGRegistry.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.feeRegistry.initialize();
    await this.pggRegistry.initialize(this.ggr.address);

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, {
      from: coreTeam
    });

    await this.galtToken.mint(alice, ether(100000), { from: coreTeam });
  });

  describe('register-unregister process', async function() {
    it('should allow registering again after unregistration', async function() {
      await this.acl.setRole(bytes32('PGG_REGISTRAR'), registrar, true, { from: coreTeam });
      await this.acl.setRole(bytes32('PGG_UNREGISTRAR'), unregistrar, true, { from: coreTeam });

      await assertRevert(this.pggRegistry.addPgg(a1, { from: unregistrar }));
      await this.pggRegistry.addPgg(a1, { from: registrar });
      await assertRevert(this.pggRegistry.addPgg(a1, { from: registrar }));
      await this.pggRegistry.addPgg(a2, { from: registrar });

      let res = await this.pggRegistry.getPggList();
      assert.sameMembers(res, [a1, a2]);
      res = await this.pggRegistry.getPggCount();
      assert.equal(res, 2);

      await assertRevert(this.pggRegistry.removePgg(a1, { from: registrar }));
      await this.pggRegistry.removePgg(a1, { from: unregistrar });

      res = await this.pggRegistry.getPggList();
      assert.sameMembers(res, [a2]);
      res = await this.pggRegistry.getPggCount();
      assert.equal(res, 1);

      await this.pggRegistry.addPgg(a1, { from: registrar });

      res = await this.pggRegistry.getPggList();
      assert.sameMembers(res, [a1, a2]);
      res = await this.pggRegistry.getPggCount();
      assert.equal(res, 2);
    });
  });
});
