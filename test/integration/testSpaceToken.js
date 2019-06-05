const SpaceToken = artifacts.require('./SpaceToken.sol');
const Web3 = require('web3');
const { assertRevert } = require('../helpers');

const ACL = artifacts.require('./ACL.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

contract('SpaceToken', ([coreTeam, minter, burner, alice, bob]) => {
  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });
    await this.ggr.initialize();
    await this.acl.initialize();
    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_MINTER'), minter, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_BURNER'), burner, true, { from: coreTeam });

    this.spaceToken = await SpaceToken.new(this.ggr.address, 'Name', 'Symbol', { from: coreTeam });
  });

  describe('#mint()', () => {
    it('should allow minter mint some tokens if called by owner', async function() {
      await this.spaceToken.mint(alice, { from: minter });
      const res = await this.spaceToken.ownerOf('0x0000000000000000000000000000000000000000000000000000000000000000');
      assert.equal(res, alice);

      const tokensOfOwner = await this.spaceToken.tokensOfOwner(alice);
      assert.deepEqual(tokensOfOwner.map(tokenId => tokenId.toString(10)), ['0']);
    });

    it('should allow mint some tokens to the users in the minters role list', async function() {
      await this.acl.setRole(bytes32('SPACE_MINTER'), bob, true, { from: coreTeam });
      await this.spaceToken.mint(alice, { from: bob });
      const res = await this.spaceToken.ownerOf('0x0000000000000000000000000000000000000000000000000000000000000000');
      assert.equal(res, alice);
    });

    it('should deny mint some tokens to users not in the minter role list', async function() {
      await this.acl.setRole(bytes32('SPACE_BURNER'), bob, true, { from: coreTeam });
      await assertRevert(this.spaceToken.mint(alice, { from: bob }));
    });

    it('should deny mint some tokens to users without any role', async function() {
      await assertRevert(this.spaceToken.mint(alice, { from: bob }));
    });
  });

  describe('#burn()', () => {
    beforeEach(async function() {
      await this.spaceToken.mint(alice, { from: minter });
      let res = await this.spaceToken.ownerOf('0x0000000000000000000000000000000000000000000000000000000000000000');
      assert.equal(res, alice);
      res = await this.spaceToken.totalSupply();
      assert.equal(res, 1);
    });

    it('should allow burner role burn tokens', async function() {
      await this.spaceToken.burn('0x0000000000000000000000000000000000000000000000000000000000000000', {
        from: burner
      });
      let res = await this.spaceToken.exists('0x0000000000000000000000000000000000000000000000000000000000000000');
      assert.equal(false, res);
      res = await this.spaceToken.totalSupply();
      assert.equal(res, 0);
    });

    it('should allow burn tokens to the users in the burners role list', async function() {
      await this.acl.setRole(bytes32('SPACE_BURNER'), bob, true, { from: coreTeam });
      await this.spaceToken.burn('0x0000000000000000000000000000000000000000000000000000000000000000', { from: bob });
      const res = await this.spaceToken.exists('0x0000000000000000000000000000000000000000000000000000000000000000');
      assert.equal(false, res);
    });

    it('should deny burn some tokens to users not in the burner role list', async function() {
      await this.acl.setRole(bytes32('SPACE_MINTER'), bob, true, { from: coreTeam });
      await assertRevert(
        this.spaceToken.burn('0x0000000000000000000000000000000000000000000000000000000000000000', {
          from: bob
        })
      );
    });

    it('should deny burn a token to users without any role', async function() {
      await assertRevert(
        this.spaceToken.burn('0x0000000000000000000000000000000000000000000000000000000000000000', {
          from: bob
        })
      );
    });

    it('should allow burn a token to an owner of the token', async function() {
      this.spaceToken.burn('0x0000000000000000000000000000000000000000000000000000000000000000', {
        from: alice
      });
    });
  });

  describe('#setTokenURI()', () => {
    beforeEach(async function() {
      this.tokenId = '0x0000000000000000000000000000000000000000000000000000000000000000';
      await this.spaceToken.mint(alice, {
        from: minter
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
});
