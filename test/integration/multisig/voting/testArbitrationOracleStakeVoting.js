const SpaceToken = artifacts.require('./SpaceToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const { ether, assertRevert, initHelperWeb3, initHelperArtifacts, deploySplitMergeMock } = require('../../../helpers');

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

// NOTICE: we don't wrap MockToken with a proxy on production
contract('ArbitrationOracleStakeVoting', accounts => {
  const [
    coreTeam,
    oracleManager,
    claimManager,
    geoDateManagement,
    alice,
    bob,
    charlie,
    dan,
    eve,
    minter,
    candidateA,
    candidateB,
    candidateC
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

    this.multiSigFactory = await deployMultiSigFactory(this.ggr, coreTeam);

    await this.galtToken.approve(this.multiSigFactory.address, ether(10), { from: alice });

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
    this.oracleStakeVotingX = this.abX.oracleStakeVoting;

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
  });

  it('OracleStakeVoting Scenario', async function() {
    await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(2000), { from: alice });

    await this.oracleStakesAccountingX.stake(charlie, TYPE_B, ether(200), { from: alice });
    await this.oracleStakesAccountingX.stake(charlie, TYPE_C, ether(200), { from: alice });
    await this.oracleStakesAccountingX.stake(dan, TYPE_A, ether(200), { from: alice });
    await this.oracleStakesAccountingX.stake(dan, TYPE_B, ether(200), { from: alice });
    await this.oracleStakesAccountingX.stake(dan, TYPE_C, ether(300), { from: alice });

    await assertRevert(this.oracleStakeVotingX.vote(candidateA, { from: bob }));

    await this.oracleStakesAccountingX.stake(bob, TYPE_A, ether(200), { from: alice });

    await this.oracleStakeVotingX.vote(candidateA, { from: bob });
    // TODO: check candidates

    let res = await this.oracleStakeVotingX.balanceOf(candidateA);
    assert.equal(res, ether(200));

    // oracle 2 votes for candidate B
    await this.oracleStakeVotingX.vote(candidateB, { from: charlie });

    res = await this.oracleStakeVotingX.balanceOf(candidateA);
    assert.equal(res, ether(200));

    res = await this.oracleStakeVotingX.balanceOf(candidateB);
    assert.equal(res, ether(400));

    // oracle 2 change decision and votes for the candidates A
    await this.oracleStakeVotingX.vote(candidateA, { from: charlie });

    res = await this.oracleStakeVotingX.balanceOf(candidateA);
    assert.equal(res, ether(600));

    res = await this.oracleStakeVotingX.balanceOf(candidateB);
    assert.equal(res, ether(0));

    // oracle 3 change decision and votes for the candidates C
    await this.oracleStakeVotingX.vote(candidateC, { from: dan });

    res = await this.oracleStakeVotingX.balanceOf(candidateC);
    assert.equal(res, ether(700));

    // oracle 3 stake is slashed due some misbehaviour
    await this.oracleStakesAccountingX.slashMultiple([dan, dan], [TYPE_B, TYPE_C], [ether(150), ether(200)], {
      from: claimManager
    });

    res = await this.oracleStakeVotingX.balanceOf(candidateA);
    assert.equal(res, ether(600));

    res = await this.oracleStakeVotingX.balanceOf(candidateB);
    assert.equal(res, ether(0));

    res = await this.oracleStakeVotingX.balanceOf(candidateC);
    assert.equal(res, ether(350));
  });
});
