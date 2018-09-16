const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltDex = artifacts.require('./GaltDex.sol');
const SpaceDex = artifacts.require('./SpaceDex.sol');

const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, ether, szabo } = require('../helpers');
const galt = require('@galtproject/utils');

const web3 = new Web3(GaltToken.web3.currentProvider);
initHelperWeb3(web3);
const { BN } = Web3.utils;

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

/**
 * Alice is an applicant
 * Bob is a validator
 */
contract.only('SpaceDex', ([coreTeam, alice]) => {
  const fee = 15;
  const baseExchangeRate = 1;

  beforeEach(async function() {
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.galtDex = await GaltDex.new({ from: coreTeam });
    this.spaceDex = await SpaceDex.new({ from: coreTeam });

    this.galtDex.initialize(szabo(baseExchangeRate), szabo(fee), szabo(fee), this.galtToken.address, {
      from: coreTeam
    });

    this.spaceDex.initialize(this.galtToken.address, this.spaceToken.address, {
      from: coreTeam
    });

    await this.spaceToken.addRoleTo(coreTeam, 'minter');

    await this.galtToken.mint(this.galtDex.address, ether(100));
    await this.galtToken.mint(this.spaceDex.address, ether(1000000));
  });

  describe('#exchangeSpaceToGalt()', async () => {
    it('should successfully sell spaceToken', async function() {
      const geohash5 = galt.geohashToGeohash5('sezu05');
      await this.spaceToken.mintGeohash(alice, geohash5, {
        from: coreTeam
      });

      const geohashTokenId = galt.geohashToTokenId('sezu05');

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
});
