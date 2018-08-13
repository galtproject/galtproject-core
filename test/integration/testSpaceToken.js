const SpaceToken = artifacts.require('./SpaceToken.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { ether, assertRevert } = require('../helpers');

const web3 = new Web3(SpaceToken.web3.currentProvider);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SpaceToken', ([coreTeam, alice, bob]) => {
  beforeEach(async function() {
    this.spaceToken = await SpaceToken.new('Name', 'Symbol', { from: coreTeam });
    this.spaceToken.initialize('Name', 'Symbol', { from: coreTeam });
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  describe.only('#mint()', () => {
    it('should allow owner mint some tokens if called by owner', async function() {
      await this.spaceToken.mint(alice, 123, { from: coreTeam });
      const res = await this.spaceToken.ownerOf(123);
      assert.equal(res, alice);
    });

    it('should allow mint some tokens to the users in the minters role list', async function() {
      await this.spaceToken.addRoleTo(bob, 'minter', { from: coreTeam });
      await this.spaceToken.mint(alice, 123, { from: bob });
      const res = await this.spaceToken.ownerOf(123);
      assert.equal(res, alice);
    });

    it('should deny mint some tokens to users not in the minter role list', async function() {
      await this.spaceToken.addRoleTo(bob, 'burner', { from: coreTeam });
      await assertRevert(this.spaceToken.mint(alice, 123, { from: bob }));
    });

    it('should deny mint some tokens to users without any role', async function() {
      await assertRevert(this.spaceToken.mint(alice, 123, { from: bob }));
    });
  });
});
