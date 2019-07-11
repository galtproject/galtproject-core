const SpaceToken = artifacts.require('./SpaceToken.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const StakeTracker = artifacts.require('./StakeTracker.sol');

const Web3 = require('web3');
const {
  ether,
  assertRevert,
  initHelperWeb3,
  initHelperArtifacts,
  deploySpaceGeoDataMock,
  numberToEvmWord,
  paymentMethods
} = require('../../../helpers');

const web3 = new Web3(SpaceToken.web3.currentProvider);
const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;
const { deployPGGFactory, buildPGG } = require('../../../deploymentHelpers');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const TYPE_A = bytes32('TYPE_A');
const TYPE_B = bytes32('TYPE_B');
const TYPE_C = bytes32('TYPE_C');
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');

// NOTICE: we don't wrap MockToken with a proxy on production
contract('PGGOracleStakeVoting', accounts => {
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
    candidateA,
    candidateB,
    candidateC
  ] = accounts;

  before(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new(this.ggr.address, 'Space Token', 'SPACE', { from: coreTeam });
    const deployment = await deploySpaceGeoDataMock(this.ggr);
    this.spaceGeoData = deployment.spaceGeoData;

    this.spaceLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('SPACE_LOCKER_REGISTRAR'), {
      from: coreTeam
    });
    this.galtLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('GALT_LOCKER_REGISTRAR'), {
      from: coreTeam
    });
    this.spaceLockerFactory = await SpaceLockerFactory.new(this.ggr.address, { from: coreTeam });
    this.galtLockerFactory = await SpaceLockerFactory.new(this.ggr.address, { from: coreTeam });

    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.pggRegistry = await PGGRegistry.new({ from: coreTeam });
    this.stakeTracker = await StakeTracker.new({ from: coreTeam });

    this.spaceRA = await SpaceRA.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.feeRegistry.initialize();
    await this.pggRegistry.initialize(this.ggr.address);
    await this.stakeTracker.initialize(this.ggr.address);
    await this.spaceRA.initialize(this.ggr.address);

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.STAKE_TRACKER(), this.stakeTracker.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
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

    this.pggFactory = await deployPGGFactory(this.ggr, coreTeam);
    await this.feeRegistry.setGaltFee(await this.pggFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.pggFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.pggFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), this.spaceRA.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ORACLE_STAKE_SLASHER'), claimManager, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_LOCKER_REGISTRAR'), this.spaceLockerFactory.address, true, {
      from: coreTeam
    });
    await this.acl.setRole(bytes32('GALT_LOCKER_REGISTRAR'), this.galtLockerFactory.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), geoDateManagement, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ORACLE_MODIFIER'), oracleManager, true, { from: coreTeam });
  });

  beforeEach(async function() {
    this.pggFactory = await deployPGGFactory(this.ggr, coreTeam);
    await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactory.address, true, { from: coreTeam });

    await this.galtToken.approve(this.pggFactory.address, ether(10), { from: alice });

    const applicationConfigX = {};
    applicationConfigX[TYPE_A] = numberToEvmWord(ether(200));
    applicationConfigX[TYPE_B] = numberToEvmWord(ether(200));
    applicationConfigX[TYPE_C] = numberToEvmWord(ether(200));

    // PGG_X
    this.pggX = await buildPGG(
      this.pggFactory,
      [bob, charlie, dan, eve],
      2,
      3,
      4,
      60,
      ether(1000),
      300000,
      {},
      applicationConfigX,
      alice
    );
    this.pggMultiSigX = this.pggX.multiSig;
    this.oracleStakesAccountingX = this.pggX.oracleStakeAccounting;
    this.oracleStakeVotingX = this.pggX.oracleStakeVoting;
    this.oraclesX = this.pggX.oracles;

    // CONFIGURING
    await this.oraclesX.addOracle(bob, BOB, MN, '', [], [TYPE_A], {
      from: oracleManager
    });
    await this.oraclesX.addOracle(charlie, CHARLIE, MN, '', [], [TYPE_B, TYPE_C], {
      from: oracleManager
    });
    await this.oraclesX.addOracle(dan, DAN, MN, '', [], [TYPE_A, TYPE_B, TYPE_C], {
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

    let res = await this.oracleStakeVotingX.totalSupply();
    assert.equal(res, ether(1300));

    await this.oracleStakeVotingX.vote(candidateA, { from: bob });

    res = await this.oracleStakeVotingX.candidateBalanceOf(candidateA);
    assert.equal(res, ether(200));
    res = await this.oracleStakeVotingX.totalSupply();
    assert.equal(res, ether(1300));

    // oracle 2 votes for candidate B
    await this.oracleStakeVotingX.vote(candidateB, { from: charlie });

    res = await this.oracleStakeVotingX.candidateBalanceOf(candidateA);
    assert.equal(res, ether(200));

    res = await this.oracleStakeVotingX.candidateBalanceOf(candidateB);
    assert.equal(res, ether(400));

    res = await this.oracleStakeVotingX.totalSupply();
    assert.equal(res, ether(1300));

    // oracle 2 change decision and votes for the candidates A
    await this.oracleStakeVotingX.vote(candidateA, { from: charlie });

    res = await this.oracleStakeVotingX.candidateBalanceOf(candidateA);
    assert.equal(res, ether(600));

    res = await this.oracleStakeVotingX.candidateBalanceOf(candidateB);
    assert.equal(res, ether(0));

    res = await this.oracleStakeVotingX.totalSupply();
    assert.equal(res, ether(1300));

    // oracle 3 change decision and votes for the candidates C
    await this.oracleStakeVotingX.vote(candidateC, { from: dan });

    res = await this.oracleStakeVotingX.candidateBalanceOf(candidateC);
    assert.equal(res, ether(700));

    res = await this.oracleStakeVotingX.totalSupply();
    assert.equal(res, ether(1300));

    // oracle 3 stake is slashed due some misbehaviour
    await this.oracleStakesAccountingX.slashMultiple([dan, dan], [TYPE_B, TYPE_C], [ether(150), ether(200)], {
      from: claimManager
    });

    res = await this.oracleStakeVotingX.candidateBalanceOf(candidateA);
    assert.equal(res, ether(600));

    res = await this.oracleStakeVotingX.candidateBalanceOf(candidateB);
    assert.equal(res, ether(0));

    res = await this.oracleStakeVotingX.candidateBalanceOf(candidateC);
    assert.equal(res, ether(350));

    res = await this.oracleStakeVotingX.totalSupply();
    assert.equal(res, ether(950));
  });
});
