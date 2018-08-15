const SpaceToken = artifacts.require('./SpaceToken.sol');
const ExposedSpaceToken = artifacts.require('./mocks/ExposedSpaceToken.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { assertRevert } = require('../helpers');

const { BN } = Web3.utils;

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

  describe('#generatePackTokenId()', () => {
    it('should generate number with Package mask', async () => {
      const spaceToken = await ExposedSpaceToken.new('Name', 'Symbol', { from: coreTeam });
      spaceToken.initialize('Name', 'Symbol', { from: coreTeam });

      const expectedId = new BN('0x0200000000000000000000000000000000000000000000000000000000000000');
      for (let i = 0; i < 10; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await spaceToken.exposedGeneratePackTokenId();
        const { id } = res.logs[0].args;

        id.should.be.a.bignumber.eq(expectedId);
        expectedId.iadd(new BN('1'));
      }
    });
  });

  describe('#isPack()', () => {
    it('should return true for the numbers starting with 0x02', async function() {
      assert(await this.spaceToken.isPack('0x0200000000000000000000000000000000000000000000000000000000000001'));
    });

    it('should return false for the numbers not starting with 0x02', async function() {
      assert(!(await this.spaceToken.isPack('0x0100000000000000000000000000000000000000000000000000000000000001')));
      assert(!(await this.spaceToken.isPack('0x0000000000000000000000000000000000000000000000000000000000000001')));
    });
  });

  describe('#isGeohash()', () => {
    it('should return true for the numbers starting with 0x01', async function() {
      assert(await this.spaceToken.isGeohash('0x0100000000000000000000000000000000000000000000000000000000000001'));
    });

    it('should return false for the numbers not starting with 0x01', async function() {
      assert(!(await this.spaceToken.isGeohash('0x0200000000000000000000000000000000000000000000000000000000000001')));
      assert(!(await this.spaceToken.isGeohash('0x0000000000000000000000000000000000000000000000000000000000000001')));
    });
  });

  describe('#geohashToTokenId()', () => {
    it('should add 0x01 to the bytes32 representation of number', async function() {
      const res = await this.spaceToken.geohashToTokenId(123);
      assert.equal(res.toString(16), '10000000000000000000000000000000000000000000000000000000000007b');
    });

    it('should cut out 0x01 from the start of bytes32 representation', async function() {
      const res = await this.spaceToken.tokenIdToGeohash(
        '0x010000000000000000000000000000000000000000000000000000000000007b'
      );
      assert.equal(res, 123);
    });
  });

  describe('#mintPack()', () => {
    it('should allow owner mint some tokens if called by owner', async function() {
      let res = await this.spaceToken.mintPack(alice, { from: coreTeam });
      res = await this.spaceToken.ownerOf('0x0200000000000000000000000000000000000000000000000000000000000000');
      assert.equal(res, alice);
    });

    it('should allow mint some tokens to the users in the minters role list', async function() {
      await this.spaceToken.addRoleTo(bob, 'minter', { from: coreTeam });
      await this.spaceToken.mintPack(alice, { from: bob });
      const res = await this.spaceToken.ownerOf('0x0200000000000000000000000000000000000000000000000000000000000000');
      assert.equal(res, alice);
    });

    it('should deny mint some tokens to users not in the minter role list', async function() {
      await this.spaceToken.addRoleTo(bob, 'burner', { from: coreTeam });
      await assertRevert(this.spaceToken.mintPack(alice, { from: bob }));
    });

    it('should deny mint some tokens to users without any role', async function() {
      await assertRevert(this.spaceToken.mintPack(alice, { from: bob }));
    });
  });

  describe('#mintGeohash()', () => {
    it('should allow owner mint some tokens if called by owner', async function() {
      let res = await this.spaceToken.mintGeohash(alice, 123, { from: coreTeam });
      res = await this.spaceToken.ownerOf('0x010000000000000000000000000000000000000000000000000000000000007b');
      assert.equal(res, alice);
    });

    it('should allow mint some tokens to the users in the minters role list', async function() {
      await this.spaceToken.addRoleTo(bob, 'minter', { from: coreTeam });
      await this.spaceToken.mintGeohash(alice, 123, { from: bob });
      const res = await this.spaceToken.ownerOf('0x010000000000000000000000000000000000000000000000000000000000007b');
      assert.equal(res, alice);
    });

    it('should deny mint some tokens to users not in the minter role list', async function() {
      await this.spaceToken.addRoleTo(bob, 'burner', { from: coreTeam });
      await assertRevert(this.spaceToken.mintGeohash(alice, 123, { from: bob }));
    });

    it('should deny mint some tokens to users without any role', async function() {
      await assertRevert(this.spaceToken.mintGeohash(alice, 123, { from: bob }));
    });
  });

  describe('#burn()', () => {
    beforeEach(async function() {
      await this.spaceToken.mintGeohash(alice, 123, { from: coreTeam });
      let res = await this.spaceToken.ownerOf('0x010000000000000000000000000000000000000000000000000000000000007b');
      assert.equal(res, alice);
      res = await this.spaceToken.totalSupply();
      assert.equal(res, 1);
    });

    it('should allow owner burn tokens', async function() {
      await this.spaceToken.burn('0x010000000000000000000000000000000000000000000000000000000000007b', {
        from: coreTeam
      });
      let res = await this.spaceToken.ownerOf('0x010000000000000000000000000000000000000000000000000000000000007b');
      assert.equal(res, 0x0);
      res = await this.spaceToken.totalSupply();
      assert.equal(res, 0);
    });

    it('should allow burn tokens to the users in the burners role list', async function() {
      await this.spaceToken.addRoleTo(bob, 'burner', { from: coreTeam });
      await this.spaceToken.burn('0x010000000000000000000000000000000000000000000000000000000000007b', { from: bob });
      const res = await this.spaceToken.ownerOf('0x010000000000000000000000000000000000000000000000000000000000007b');
      assert.equal(res, 0x0);
    });

    it('should deny burn some tokens to users not in the burner role list', async function() {
      await this.spaceToken.addRoleTo(bob, 'minter', { from: coreTeam });
      await assertRevert(
        this.spaceToken.burn('0x010000000000000000000000000000000000000000000000000000000000007b', {
          from: bob
        })
      );
    });

    it('should deny burn a token to users without any role', async function() {
      await assertRevert(
        this.spaceToken.burn('0x010000000000000000000000000000000000000000000000000000000000007b', {
          from: bob
        })
      );
    });

    it('should deny burn a token to an owner of the token', async function() {
      await assertRevert(
        this.spaceToken.burn('0x010000000000000000000000000000000000000000000000000000000000007b', {
          from: alice
        })
      );
    });
  });

  describe('#setTokenURI()', () => {
    beforeEach(async function() {
      this.tokenId = '0x010000000000000000000000000000000000000000000000000000000000007b';
      await this.spaceToken.mintGeohash(alice, 123, {
        from: coreTeam
      });
      let res = await this.spaceToken.ownerOf(this.tokenId);
      assert.equal(res, alice);
      res = await this.spaceToken.totalSupply();
      assert.equal(res, 1);
    });

    it('should deny the contract owner to change token uri', async function() {
      await assertRevert(this.spaceToken.setTokenURI(this.tokenId, 'foobar', { from: coreTeam }));
    });

    it('should allow token owner to set token uri', async function() {
      await this.spaceToken.setTokenURI(this.tokenId, 'foobar', { from: alice });
      const res = await this.spaceToken.tokenURI(this.tokenId);
      assert.equal(res, 'foobar');
    });

    it('should deny non-owner set token uri', async function() {
      await assertRevert(this.spaceToken.setTokenURI(this.tokenId, 'foobar', { from: bob }));
    });
  });

  describe('canTransfer modifier', () => {
    beforeEach(async function() {
      this.tokenId = '0x010000000000000000000000000000000000000000000000000000000000007b';
      await this.spaceToken.mintGeohash(alice, 123, { from: coreTeam });
      let res = await this.spaceToken.ownerOf(this.tokenId);
      assert.equal(res, alice);
      res = await this.spaceToken.totalSupply();
      assert.equal(res, 1);
    });

    it('should allow token owner to thransfer the token', async function() {
      await this.spaceToken.transferFrom(alice, charlie, this.tokenId, { from: alice });
      const res = await this.spaceToken.ownerOf(this.tokenId);
      assert.equal(res, charlie);
    });

    it('should allow contract owner to thransfer the token', async function() {
      await this.spaceToken.transferFrom(alice, charlie, this.tokenId, { from: coreTeam });
      const res = await this.spaceToken.ownerOf(this.tokenId);
      assert.equal(res, charlie);
    });

    it('should allow address with ROLE_OPERATOR transfer the token', async function() {
      await this.spaceToken.addRoleTo(bob, 'operator', { from: coreTeam });
      await this.spaceToken.transferFrom(alice, charlie, this.tokenId, { from: bob });
      const res = await this.spaceToken.ownerOf(this.tokenId);
      assert.equal(res, charlie);
    });

    it('should deny 3rd party transfer the token', async function() {
      await assertRevert(this.spaceToken.transferFrom(alice, charlie, this.tokenId, { from: bob }));
      const res = await this.spaceToken.ownerOf(this.tokenId);
      assert.equal(res, alice);
    });
  });
});
