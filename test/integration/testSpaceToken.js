const SpaceToken = artifacts.require('./SpaceToken.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { assertRevert } = require('../helpers');

const web3 = new Web3(SpaceToken.web3.currentProvider);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SpaceToken', ([coreTeam, alice, bob, charlie]) => {
  beforeEach(async function() {
    this.spaceToken = await SpaceToken.new('Name', 'Symbol', { from: coreTeam });
    this.spaceToken.initialize('Name', 'Symbol', { from: coreTeam });
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  describe('#mint()', () => {
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

  describe('#burn()', () => {
    beforeEach(async function() {
      await this.spaceToken.mint(alice, 123, { from: coreTeam });
      let res = await this.spaceToken.ownerOf(123);
      assert.equal(res, alice);
      res = await this.spaceToken.totalSupply();
      assert.equal(res, 1);
    });

    it('should allow owner burn tokens', async function() {
      await this.spaceToken.burn(123, { from: coreTeam });
      let res = await this.spaceToken.ownerOf(123);
      assert.equal(res, 0x0);
      res = await this.spaceToken.totalSupply();
      assert.equal(res, 0);
    });

    it('should allow burn tokens to the users in the burners role list', async function() {
      await this.spaceToken.addRoleTo(bob, 'burner', { from: coreTeam });
      await this.spaceToken.burn(123, { from: bob });
      const res = await this.spaceToken.ownerOf(123);
      assert.equal(res, 0x0);
    });

    it('should deny burn some tokens to users not in the burner role list', async function() {
      await this.spaceToken.addRoleTo(bob, 'minter', { from: coreTeam });
      await assertRevert(this.spaceToken.burn(123, { from: bob }));
    });

    it('should deny burn a token to users without any role', async function() {
      await assertRevert(this.spaceToken.burn(123, { from: bob }));
    });

    it('should deny burn a token to an owner of the token', async function() {
      await assertRevert(this.spaceToken.burn(123, { from: alice }));
    });
  });

  describe('#setTokenURI()', () => {
    beforeEach(async function() {
      await this.spaceToken.mint(alice, 123, { from: coreTeam });
      let res = await this.spaceToken.ownerOf(123);
      assert.equal(res, alice);
      res = await this.spaceToken.totalSupply();
      assert.equal(res, 1);
    });

    it('should deny the contract owner to change token uri', async function() {
      await assertRevert(this.spaceToken.setTokenURI(123, 'foobar', { from: coreTeam }));
    });

    it('should allow token owner to set token uri', async function() {
      await this.spaceToken.setTokenURI(123, 'foobar', { from: alice });
      const res = await this.spaceToken.tokenURI(123);
      assert.equal(res, 'foobar');
    });

    it('should deny non-owner set token uri', async function() {
      await assertRevert(this.spaceToken.setTokenURI(123, 'foobar', { from: bob }));
    });
  });

  describe('canTransfer modifier', () => {
    beforeEach(async function() {
      await this.spaceToken.mint(alice, 123, { from: coreTeam });
      let res = await this.spaceToken.ownerOf(123);
      assert.equal(res, alice);
      res = await this.spaceToken.totalSupply();
      assert.equal(res, 1);
    });

    it('should allow token owner to thransfer the token', async function() {
      await this.spaceToken.transferFrom(alice, charlie, 123, { from: alice });
      const res = await this.spaceToken.ownerOf(123);
      assert.equal(res, charlie);
    });

    it('should allow contract owner to thransfer the token', async function() {
      await this.spaceToken.transferFrom(alice, charlie, 123, { from: coreTeam });
      const res = await this.spaceToken.ownerOf(123);
      assert.equal(res, charlie);
    });

    it('should allow address with ROLE_OPERATOR transfer the token', async function() {
      await this.spaceToken.addRoleTo(bob, 'operator', { from: coreTeam });
      await this.spaceToken.transferFrom(alice, charlie, 123, { from: bob });
      const res = await this.spaceToken.ownerOf(123);
      assert.equal(res, charlie);
    });

    it('should deny 3rd party transfer the token', async function() {
      await assertRevert(this.spaceToken.transferFrom(alice, charlie, 123, { from: bob }));
      const res = await this.spaceToken.ownerOf(123);
      assert.equal(res, alice);
    });
  });
});
