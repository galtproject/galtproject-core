/* eslint-disable prefer-arrow-callback */
const SpaceToken = artifacts.require('./SpaceToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const SpaceLocker = artifacts.require('./SpaceLocker.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const { ether, initHelperWeb3, initHelperArtifacts, deploySplitMergeMock } = require('../../../helpers');

const web3 = new Web3(SpaceToken.web3.currentProvider);
const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;
const { deployMultiSigFactory, buildArbitration } = require('../../../deploymentHelpers');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const MY_APPLICATION = '0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7';

const TYPE_A = bytes32('TYPE_A');
const TYPE_B = bytes32('TYPE_B');
const TYPE_C = bytes32('TYPE_C');
// eslint-disable-next-line no-underscore-dangle
const _ES = bytes32('');
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');
const EVE = bytes32('Eve');

// NOTICE: we don't wrap MockToken with a proxy on production
contract.skip('Arbitration Voting From (Space/Galt/Stake) Inputs To Assigned MultiSig Owners', accounts => {
  const [
    coreTeam,
    oracleManager,
    claimManager,
    geoDateManagement,
    zeroOwner,
    alice,
    bob,
    charlie,
    dan,
    eve,
    minter
  ] = accounts;

  before(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    const deployment = await deploySplitMergeMock(this.ggr);
    this.splitMerge = deployment.splitMerge;

    this.spaceLockerRegistry = await LockerRegistry.new({ from: coreTeam });
    this.galtLockerRegistry = await LockerRegistry.new({ from: coreTeam });
    this.spaceLockerFactory = await SpaceLockerFactory.new(this.ggr.address, { from: coreTeam });
    this.galtLockerFactory = await SpaceLockerFactory.new(this.ggr.address, { from: coreTeam });

    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });

    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.spaceToken.addRoleTo(minter, 'minter', {
      from: coreTeam
    });
    await this.splitMerge.addRoleTo(geoDateManagement, 'geo_data_manager', {
      from: coreTeam
    });
    await this.spaceLockerRegistry.addRoleTo(
      this.spaceLockerFactory.address,
      await this.spaceLockerRegistry.ROLE_FACTORY(),
      {
        from: coreTeam
      }
    );
    await this.galtLockerRegistry.addRoleTo(
      this.galtLockerFactory.address,
      await this.galtLockerRegistry.ROLE_FACTORY(),
      {
        from: coreTeam
      }
    );
    this.spaceRA = await SpaceRA.new(this.ggr.address, { from: coreTeam });

    await this.ggr.setContract(await this.ggr.MULTI_SIG_REGISTRY(), this.multiSigRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.ORACLES(), this.oracles.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.CLAIM_MANAGER(), claimManager, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_LOCKER_REGISTRY(), this.spaceLockerRegistry.address, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.GALT_LOCKER_REGISTRY(), this.galtLockerRegistry.address, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.SPACE_RA(), this.spaceRA.address, {
      from: coreTeam
    });

    await this.galtToken.mint(alice, ether(1000000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(1000000000), { from: coreTeam });
    await this.galtToken.mint(charlie, ether(1000000000), { from: coreTeam });
    await this.galtToken.mint(dan, ether(1000000000), { from: coreTeam });

    await this.oracles.setApplicationTypeOracleTypes(
      MY_APPLICATION,
      [TYPE_A, TYPE_B, TYPE_C],
      [50, 25, 25],
      [_ES, _ES, _ES],
      { from: oracleManager }
    );
    this.multiSigFactoryF = await deployMultiSigFactory(this.ggr, coreTeam);
  });

  beforeEach(async function() {
    this.spaceRA = await SpaceRA.new(this.ggr.address, { from: coreTeam });

    await this.ggr.setContract(await this.ggr.SPACE_RA(), this.spaceRA.address, {
      from: coreTeam
    });

    // CREATING WEB3 1.X INSTANCES
    // this.spaceRAWeb3 = new web3.eth.Contract(this.spaceRA.abi, this.spaceRA.address);
    this.multiSigFactory = await deployMultiSigFactory(this.ggr, coreTeam);
    await this.galtToken.approve(this.multiSigFactory.address, ether(10), { from: alice });
    await this.galtToken.approve(this.multiSigFactory.address, ether(10), { from: bob });
    await this.galtToken.approve(this.multiSigFactory.address, ether(10), { from: charlie });

    const applicationConfigX = {};
    // MultiSigX
    this.abX = await buildArbitration(
      this.multiSigFactory,
      [bob, charlie, dan, eve],
      2,
      3,
      4,
      60,
      ether(1000),
      [30, 30, 30, 30, 30, 30],
      applicationConfigX,
      alice
    );
    this.abMultiSigX = this.abX.multiSig;
    this.oracleStakesAccountingX = this.abX.oracleStakeAccounting;
    this.abVotingX = this.abX.voting;
    this.delegateSpaceVotingX = this.abX.delegateSpaceVoting;
    this.delegateGaltVotingX = this.abX.delegateGaltVoting;
    this.oracleStakeVotingX = this.abX.oracleStakeVoting;

    const applicationConfigY = {};
    // MultiSigY
    this.abY = await buildArbitration(
      this.multiSigFactory,
      [bob, charlie, dan, eve],
      2,
      3,
      4,
      60,
      ether(1000),
      [30, 30, 30, 30, 30, 30],
      applicationConfigY,
      bob
    );
    this.abMultiSigY = this.abY.multiSig;
    this.oracleStakesAccountingY = this.abY.oracleStakeAccounting;
    this.candidateTopY = this.abY.candidateTop;
    this.delegateSpaceVotingY = this.abY.delegateSpaceVoting;
    this.delegateGaltVotingY = this.abY.delegateGaltVoting;
    this.oracleStakeVotingY = this.abY.oracleStakeVoting;

    const applicationConfigZ = {};
    // MultiSigZ
    this.abZ = await buildArbitration(
      this.multiSigFactory,
      [bob, charlie, dan, eve],
      2,
      3,
      4,
      60,
      ether(1000),
      [30, 30, 30, 30, 30, 30],
      applicationConfigZ,
      charlie
    );
    this.abMultiSigZ = this.abZ.multiSig;
    this.abVotingZ = this.abZ.voting;
    this.delegateSpaceVotingZ = this.abZ.delegateSpaceVoting;
    this.delegateGaltVotingZ = this.abZ.delegateGaltVoting;
    this.oracleStakeVotingZ = this.abZ.oracleStakeVoting;

    // CONFIGURING
    await this.oracles.setOracleTypeMinimalDeposit(TYPE_A, 200, { from: oracleManager });
    await this.oracles.setOracleTypeMinimalDeposit(TYPE_B, 200, { from: oracleManager });
    await this.oracles.setOracleTypeMinimalDeposit(TYPE_C, 200, { from: oracleManager });

    await this.oracles.addOracle(this.abMultiSigX.address, bob, BOB, MN, '', [], [TYPE_A], {
      from: oracleManager
    });
    await this.oracles.addOracle(this.abMultiSigX.address, charlie, CHARLIE, MN, '', [], [TYPE_B, TYPE_C], {
      from: oracleManager
    });
    await this.oracles.addOracle(this.abMultiSigX.address, dan, DAN, MN, '', [], [TYPE_A, TYPE_B, TYPE_C], {
      from: oracleManager
    });
    await this.oracles.addOracle(this.abMultiSigY.address, eve, EVE, MN, '', [], [TYPE_A, TYPE_B, TYPE_C], {
      from: oracleManager
    });

    this.X = this.abMultiSigX.address;
    this.Y = this.abMultiSigY.address;
    this.Z = this.abMultiSigZ.address;
    // this.abVotingXWeb3 = new web3.eth.Contract(this.abVotingX.abi, this.abVotingX.address);
    // this.abVotingYWeb3 = new web3.eth.Contract(this.abVotingY.abi, this.abVotingY.address);
    // this.abVotingZWeb3 = new web3.eth.Contract(this.abVotingZ.abi, this.abVotingZ.address);
  });

  it('Scenario #4 - Mixed. 3 space owners / 3 galt owners / 3 oracles', async function() {
    // space owners - alice/bob/charlie
    // galt owners - bob/charlie/dan
    // oracles - george/frank

    // MINT SPACE TOKENS
    await this.spaceToken.mint(zeroOwner, { from: minter });
    let res = await this.spaceToken.mint(alice, { from: minter });
    const x1 = res.logs[0].args.tokenId;
    res = await this.spaceToken.mint(bob, { from: minter });
    const x2 = res.logs[0].args.tokenId;
    res = await this.spaceToken.mint(charlie, { from: minter });
    const x3 = res.logs[0].args.tokenId;

    // SET AREAS
    let p = [
      this.splitMerge.setTokenArea(x1, '300', '0', { from: geoDateManagement }),
      this.splitMerge.setTokenArea(x2, '500', '0', { from: geoDateManagement }),
      this.splitMerge.setTokenArea(x3, '400', '0', { from: geoDateManagement })
    ];

    await Promise.all(p);

    await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: alice });
    await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: bob });
    await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: charlie });

    // BUILD LOCKER CONTRACTS
    res = await this.spaceLockerFactory.build({ from: alice });
    const lockerAddress1 = res.logs[0].args.locker;
    res = await this.spaceLockerFactory.build({ from: bob });
    const lockerAddress2 = res.logs[0].args.locker;
    res = await this.spaceLockerFactory.build({ from: charlie });
    const lockerAddress3 = res.logs[0].args.locker;

    const locker1 = await SpaceLocker.at(lockerAddress1);
    const locker2 = await SpaceLocker.at(lockerAddress2);
    const locker3 = await SpaceLocker.at(lockerAddress3);

    // APPROVE SPACE TOKENS
    await this.spaceToken.approve(lockerAddress1, x1, { from: alice });
    await this.spaceToken.approve(lockerAddress2, x2, { from: bob });
    await this.spaceToken.approve(lockerAddress3, x3, { from: charlie });

    // DEPOSIT SPACE TOKENS
    await locker1.deposit(x1, { from: alice });
    await locker2.deposit(x2, { from: bob });
    await locker3.deposit(x3, { from: charlie });

    // APPROVE REPUTATION MINT AT ASRA
    p = [
      locker1.approveMint(this.spaceRA.address, { from: alice }),
      locker2.approveMint(this.spaceRA.address, { from: bob }),
      locker3.approveMint(this.spaceRA.address, { from: charlie })
    ];

    await Promise.all(p);

    // MINT REPUTATION TOKENS AT ASRA
    p = [
      this.spaceRA.mint(lockerAddress1, { from: alice }),
      this.spaceRA.mint(lockerAddress2, { from: bob }),
      this.spaceRA.mint(lockerAddress3, { from: charlie })
    ];

    await Promise.all(p);

    res = await this.spaceRA.balanceOf(alice);
    assert.equal(res, 300);

    res = await this.spaceRA.balanceOf(bob);
    assert.equal(res, 500);

    res = await this.spaceRA.balanceOf(charlie);
    assert.equal(res, 400);

    p = [
      this.spaceRA.lockReputation(this.Y, '300', { from: alice }),
      this.spaceRA.lockReputation(this.X, '500', { from: bob }),
      this.spaceRA.lockReputation(this.Y, '400', { from: bob }),
      this.spaceRA.lockReputation(this.Z, '400', { from: bob }),
      this.spaceRA.lockReputation(this.Y, '400', { from: charlie }),
      this.spaceRA.lockReputation(this.Z, '150', { from: charlie }),
      this.spaceRA.lockReputation(this.X, '700', { from: dan })
    ];

    await Promise.all(p);
  });
});
