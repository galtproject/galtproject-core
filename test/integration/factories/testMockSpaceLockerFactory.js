const ACL = artifacts.require('./ACL.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const MockSpaceLockerFactory = artifacts.require('./MockSpaceLockerFactory.sol');
const MockSpaceLocker = artifacts.require('./MockSpaceLocker.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const MockSpaceRA = artifacts.require('./MockSpaceRA.sol');
const MockSpaceGeoData = artifacts.require('./MockSpaceGeoData.sol');

MockSpaceLockerFactory.numberFormat = 'String';
SpaceToken.numberFormat = 'String';

const Web3 = require('web3');
const { initHelperWeb3, initHelperArtifacts } = require('../../helpers');

const web3 = new Web3(MockSpaceLockerFactory.web3.currentProvider);

const { utf8ToHex, toWei } = Web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

contract('MockSpaceLockerFactory', accounts => {
  const [coreTeam, alice] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new();
    this.acl = await ACL.new();
    this.spaceToken = await SpaceToken.new(this.ggr.address, 'SPACE', 'SPACE');
    this.mockSpaceGeoDataRegistry = await MockSpaceGeoData.new();

    this.mockSpaceRA = await MockSpaceRA.new(this.ggr.address);

    this.spaceLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('SPACE_LOCKER_REGISTRAR'));
    this.spaceLockerFactory = await MockSpaceLockerFactory.new(this.ggr.address);

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address);
    await this.ggr.setContract(await this.ggr.SPACE_LOCKER_REGISTRY(), this.spaceLockerRegistry.address);
    await this.ggr.setContract(await this.ggr.SPACE_RA(), this.mockSpaceRA.address);
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address);
    await this.ggr.setContract(await this.ggr.SPACE_GEO_DATA_REGISTRY(), this.mockSpaceGeoDataRegistry.address);

    await this.acl.setRole(bytes32('SPACE_MINTER'), coreTeam, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_BURNER'), coreTeam, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_LOCKER_REGISTRAR'), this.spaceLockerFactory.address, true);
  });

  describe('build', () => {
    it('should allow build for owner by coreTeam', async function() {
      let res = await this.spaceToken.mint(coreTeam, { from: coreTeam });
      const spaceTokenId = res.logs[0].args.tokenId;
      await this.mockSpaceGeoDataRegistry.setSpaceTokenArea(spaceTokenId, toWei('200', 'ether'));
      res = await this.spaceLockerFactory.buildMock(alice, { from: coreTeam });
      const mockSpaceLocker = await MockSpaceLocker.at(res.logs[0].args.locker);

      assert.deepEqual(await this.spaceLockerRegistry.getLockersListByOwner(alice), [mockSpaceLocker.address]);

      await mockSpaceLocker.hackDeposit(spaceTokenId, { from: coreTeam });
      await this.spaceToken.transferFrom(coreTeam, mockSpaceLocker.address, spaceTokenId, { from: coreTeam });
      await mockSpaceLocker.hackApproveMint(this.mockSpaceRA.address, { from: coreTeam });
      await this.mockSpaceRA.mintHack(alice, toWei('200', 'ether'), spaceTokenId, { from: coreTeam });

      assert.equal(await this.mockSpaceRA.isMember(alice), true);
      assert.equal(await this.mockSpaceRA.ownerHasSpaceToken(alice, spaceTokenId), true);
      assert.deepEqual(await this.mockSpaceRA.spaceTokenOwners(), [alice]);
    });
  });
});
