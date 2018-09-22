const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltDex = artifacts.require('./GaltDex.sol');
const SpaceDex = artifacts.require('./SpaceDex.sol');
const PlotValuation = artifacts.require('./PlotValuation.sol');
const Validators = artifacts.require('./Validators.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const galt = require('@galtproject/utils');

const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, ether, szabo } = require('../helpers');

const web3 = new Web3(GaltToken.web3.currentProvider);
initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SpaceDex', ([coreTeam, alice, bob, dan, eve]) => {
  const fee = 15;
  const baseExchangeRate = 1;

  beforeEach(async function() {
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.galtDex = await GaltDex.new({ from: coreTeam });
    this.splitMerge = await SplitMerge.new({ from: coreTeam });
    this.validators = await Validators.new({ from: coreTeam });
    this.spaceDex = await SpaceDex.new({ from: coreTeam });
    this.plotValuation = await PlotValuation.new({ from: coreTeam });

    await this.plotValuation.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.validators.address,
      this.galtToken.address,
      coreTeam,
      {
        from: coreTeam
      }
    );

    await this.validators.addRoleTo(coreTeam, await this.validators.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(coreTeam, await this.validators.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });

    const PV_APPRAISER_ROLE = await this.plotValuation.PV_APPRAISER_ROLE.call();
    const PV_APPRAISER2_ROLE = await this.plotValuation.PV_APPRAISER2_ROLE.call();
    const PV_AUDITOR_ROLE = await this.plotValuation.PV_AUDITOR_ROLE.call();

    await this.validators.setApplicationTypeRoles(
      await this.plotValuation.APPLICATION_TYPE(),
      [PV_APPRAISER_ROLE, PV_APPRAISER2_ROLE, PV_AUDITOR_ROLE],
      [50, 25, 25],
      ['', '', ''],
      { from: coreTeam }
    );

    await this.validators.addValidator(bob, 'Bob', 'MN', [], [PV_APPRAISER_ROLE], { from: coreTeam });
    await this.validators.addValidator(dan, 'Dan', 'MN', [], [PV_APPRAISER2_ROLE], { from: coreTeam });
    await this.validators.addValidator(eve, 'Eve', 'MN', [], [PV_AUDITOR_ROLE], { from: coreTeam });

    this.galtDex.initialize(szabo(baseExchangeRate), szabo(fee), szabo(fee), this.galtToken.address, {
      from: coreTeam
    });

    this.spaceDex.initialize(this.galtToken.address, this.spaceToken.address, this.plotValuation.address, {
      from: coreTeam
    });

    await this.spaceToken.addRoleTo(coreTeam, 'minter');

    await this.galtToken.mint(this.galtDex.address, ether(100));
    await this.galtToken.mint(this.spaceDex.address, ether(1000000));

    this.valuatePlot = async (tokenId, price) => {
      const res = await this.plotValuation.submitApplication(tokenId, [''], 0, {
        from: alice,
        value: ether(1)
      });
      const aId = res.logs[0].args.id;
      await this.plotValuation.lockApplication(aId, PV_APPRAISER_ROLE, { from: bob });
      await this.plotValuation.lockApplication(aId, PV_APPRAISER2_ROLE, { from: dan });
      await this.plotValuation.valuatePlot(aId, price, { from: bob });
      await this.plotValuation.valuatePlot2(aId, price, { from: dan });

      await this.plotValuation.lockApplication(aId, PV_AUDITOR_ROLE, { from: eve });
      await this.plotValuation.approveValuation(aId, { from: eve });
    };
  });

  describe('#exchangeSpaceToGalt()', async () => {
    it('should successfully sell spaceToken', async function() {
      const geohash5 = galt.geohashToGeohash5('sezu05');
      await this.spaceToken.mintGeohash(alice, geohash5, {
        from: coreTeam
      });

      const geohashTokenId = galt.geohashToTokenId('sezu05');

      await this.valuatePlot(geohashTokenId, ether(5));

      await this.spaceToken.approve(this.spaceDex.address, geohashTokenId, {
        from: alice
      });

      const geohashPrice = await this.spaceDex.getSpaceTokenPrice(geohashTokenId);
      await this.spaceDex.exchangeSpaceToGalt(geohashTokenId, {
        from: alice
      });

      const aliceGaltBalance = await this.galtToken.balanceOf(alice);
      assert.equal(aliceGaltBalance.toString(10), geohashPrice.toString(10));
    });
  });

  describe('#exchangeGaltToSpace()', async () => {
    it('should successfully buy spaceToken', async function() {
      const geohash5 = galt.geohashToGeohash5('sezu05');
      await this.spaceToken.mintGeohash(alice, geohash5, {
        from: coreTeam
      });

      const geohashTokenId = galt.geohashToTokenId('sezu05');

      await this.valuatePlot(geohashTokenId, ether(5));

      await this.spaceToken.transferFrom(alice, this.spaceDex.address, geohashTokenId, {
        from: alice
      });

      const geohashPrice = await this.spaceDex.getSpaceTokenPrice(geohashTokenId);

      await this.galtToken.mint(alice, geohashPrice);
      await this.galtToken.approve(this.spaceDex.address, geohashPrice, { from: alice });

      await this.spaceDex.exchangeGaltToSpace(geohashTokenId, {
        from: alice
      });

      const ownerOfGeohashToken = await this.spaceToken.ownerOf(geohashTokenId);
      assert.equal(ownerOfGeohashToken, alice);
    });
  });
});
