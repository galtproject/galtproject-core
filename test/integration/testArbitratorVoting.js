/* eslint-disable prefer-arrow-callback */
const ArbitratorVoting = artifacts.require('./ArbitratorVoting.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const ArbitrationConfig = artifacts.require('./ArbitrationConfig.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const {
  ether,
  assertRevert,
  initHelperWeb3,
  initHelperArtifacts,
  deploySplitMergeMock,
  evmMineBlock
} = require('../helpers');

const web3 = new Web3(ArbitratorVoting.web3.currentProvider);
const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;
const { deployMultiSigFactory, buildArbitration } = require('../deploymentHelpers');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const MY_APPLICATION = '0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7';

const TYPE_A = bytes32('TYPE_A');
const TYPE_B = bytes32('TYPE_B');
const TYPE_C = bytes32('TYPE_C');
// eslint-disable-next-line no-underscore-dangle
const _ES = bytes32('');

// NOTICE: we don't wrap MockToken with a proxy on production
contract('ArbitratorVoting', accounts => {
  const [
    coreTeam,
    oracleManager,
    claimManager,
    geoDateManagement,
    fakeSRA,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank,
    george,
    minter,
    notifier,
    candidateA,
    candidateB,
    candidateC,
    candidateD,
    candidateE,
    candidateF,
    a1,
    a2,
    a3
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
  });

  describe('#getShare', () => {
    it('should return total shares both for oracles and delegates', async function() {
      const config = await ArbitrationConfig.new(this.ggr.address, 2, 3, ether(1000), [30, 30, 30, 30, 30, 30], {
        from: coreTeam
      });
      const voting = await ArbitratorVoting.new(config.address, { from: coreTeam });

      await voting.addRoleTo(notifier, await voting.ORACLE_STAKES_NOTIFIER(), { from: coreTeam });
      await voting.addRoleTo(notifier, await voting.SPACE_REPUTATION_NOTIFIER(), { from: coreTeam });

      await voting.onSpaceReputationChanged(alice, 1000, { from: notifier });
      await voting.onSpaceReputationChanged(bob, 500, { from: notifier });
      await voting.onSpaceReputationChanged(charlie, 1500, { from: notifier });
      await voting.onSpaceReputationChanged(dan, 2000, { from: notifier });

      await voting.onOracleStakeChanged(eve, 1500, { from: notifier });
      await voting.onOracleStakeChanged(frank, 1500, { from: notifier });
      await voting.onOracleStakeChanged(george, 1500, { from: notifier });

      let res = await voting.getDelegateShare(alice);
      assert.equal(res, 20);
      res = await voting.getDelegateShare(bob);
      assert.equal(res, 10);
      res = await voting.getDelegateShare(charlie);
      assert.equal(res, 30);
      res = await voting.getDelegateShare(dan);
      assert.equal(res, 40);

      res = await voting.totalOracleStakes();
      assert.equal(res, 4500);

      // (20 + 10) / 2
      res = await voting.getShare([alice, bob]);
      assert.equal(res, 15);
      res = await voting.getShare([alice, bob, charlie]);
      assert.equal(res, 30);
      res = await voting.getShare([alice, bob, charlie, dan]);
      assert.equal(res, 50);
      res = await voting.getShare([alice, bob, charlie, dan, eve, frank, george]);
      assert.equal(res, 50);

      // TODO: fix this
      // res = await voting.getOracleStakes(eve);
      // assert.equal(res, 1500);
      // res = await voting.getOracleShare(eve);
      // assert.equal(res, 33);
      // res = await voting.getOracleShare(frank);
      // assert.equal(res, 33);
      // res = await voting.getOracleShare(george);
      // assert.equal(res, 33);
    });
  });

  describe('recalculation & sorting', () => {
    let voting;
    let votingWeb3;

    before(async function() {
      await this.ggr.setContract(await this.ggr.SPACE_RA(), fakeSRA, { from: coreTeam });
    });

    beforeEach(async function() {
      await evmMineBlock();
      await this.galtToken.approve(this.multiSigFactoryF.address, ether(10), { from: alice });
      // MultiSigF
      this.abF = await buildArbitration(
        this.multiSigFactoryF,
        [bob, charlie, dan, eve],
        2,
        2,
        3,
        60,
        ether(1000),
        [30, 30, 30, 30, 30, 30],
        {},
        alice
      );
      this.abMultiSigF = this.abF.multiSig;
      this.abVotingF = this.abF.voting;
      this.abVotingFWeb3 = new web3.eth.Contract(this.abVotingF.abi, this.abVotingF.address);
      voting = this.abVotingF;
      votingWeb3 = this.abVotingFWeb3;
    });

    describe('0 weight', () => {
      describe('not in list', () => {
        it('should not affect on the list', async () => {
          await voting.recalculate(alice);
          let res = await votingWeb3.methods.getCandidates().call();
          assert.sameMembers(res, []);
          res = await votingWeb3.methods.getSize().call();
          assert.equal(res, 0);
        });
      });

      describe('in list', () => {
        beforeEach(async () => {
          // await voting.onSpaceReputationChanged(candidateA, 800, { from: fakeSRA });
          const p = [
            voting.onSpaceReputationChanged(candidateA, 800, { from: fakeSRA }),
            voting.onSpaceReputationChanged(candidateB, 1200, { from: fakeSRA }),
            voting.onSpaceReputationChanged(candidateC, 1500, { from: fakeSRA })
          ];

          await Promise.all(p);
        });

        describe('1-element list', () => {
          // The first element is always HEAD
          it('should clear the list if this element is the only element of the list', async function() {
            await voting.recalculate(candidateA);

            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameMembers(res, [candidateA]);
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);

            await voting.onSpaceReputationChanged(candidateA, 0, { from: fakeSRA });

            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);

            await voting.recalculate(candidateA);

            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameMembers(res, []);
          });
        });

        describe('2-element list', () => {
          // The 1st element is HEAD and the second is TAIL
          beforeEach(async () => {
            const p = [voting.recalculate(candidateA), voting.recalculate(candidateB)];

            await Promise.all(p);
          });

          it('should move tail to head if the element is the HEAD', async () => {
            // CHECK LIST
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // ACTION
            await voting.onSpaceReputationChanged(candidateB, 0, { from: fakeSRA });

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2300);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            await voting.recalculate(candidateB);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2300);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 0);
          });

          it('should remove tail if the element is the TAIL', async function() {
            // CHECK LIST
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // ACTION
            await voting.onSpaceReputationChanged(candidateA, 0, { from: fakeSRA });

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            await voting.recalculate(candidateA);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateB]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 0);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);
          });
        });

        describe('3-element list', () => {
          // The 1st element is HEAD and the second is TAIL
          beforeEach(async () => {
            const p = [voting.recalculate(candidateA), voting.recalculate(candidateB), voting.recalculate(candidateC)];

            await Promise.all(p);
          });

          it('should move head down if the element is the HEAD', async function() {
            // CHECK LIST
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // ACTION
            await voting.onSpaceReputationChanged(candidateC, 0, { from: fakeSRA });

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2000);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            await voting.recalculate(candidateC);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2000);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 0);
          });

          it('should move link elements correctly if the element is the middle', async function() {
            // CHECK LIST
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // ACTION
            await voting.onSpaceReputationChanged(candidateB, 0, { from: fakeSRA });

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2300);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            await voting.recalculate(candidateB);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateC, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2300);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 0);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);
          });

          it('should move tail up if the element is the TAIL', async function() {
            // CHECK LIST
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // ACTION
            await voting.onSpaceReputationChanged(candidateA, 0, { from: fakeSRA });

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 171428);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // UNEXPECTED ACTION
            await voting.recalculate(candidateB);

            // CHECK LIST
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 114285);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 222222);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // ACTION
            await voting.recalculate(candidateA);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateB, candidateC]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 0);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 222222);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 214285);

            // ACTION
            await voting.recalculate(candidateC);

            // CHECK LIST
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateC, candidateB]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 2700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 2);

            // CHECK A
            res = await votingWeb3.methods.isCandidateInList(candidateA).call();
            assert.equal(res, false);
            res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
            assert.equal(res, 0);
            res = await votingWeb3.methods.getWeight(candidateA).call();
            assert.equal(res, 0);

            // CHECK B
            res = await votingWeb3.methods.isCandidateInList(candidateB).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
            assert.equal(res, 1200);
            res = await votingWeb3.methods.getWeight(candidateB).call();
            assert.equal(res, 222222);

            // CHECK C
            res = await votingWeb3.methods.isCandidateInList(candidateC).call();
            assert.equal(res, true);
            res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
            assert.equal(res, 1500);
            res = await votingWeb3.methods.getWeight(candidateC).call();
            assert.equal(res, 277777);
          });
        });
      });
    });

    describe('> 0 weight', () => {
      describe('into', () => {
        describe('1-element list', () => {
          it('should not affect the list if this element is the HEAD element of the list ', async function() {
            await voting.onSpaceReputationChanged(candidateA, 800, { from: fakeSRA });
            await voting.recalculate(candidateA);

            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 800);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);

            // CHANGE
            await voting.onSpaceReputationChanged(candidateA, 700, { from: fakeSRA });

            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);

            // RECALCULATE
            await voting.recalculate(candidateA);
            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 700);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 1);
          });

          describe('and the element isnt the first element', () => {
            beforeEach(async function() {
              await voting.onSpaceReputationChanged(candidateB, 1200, { from: fakeSRA });
              await voting.recalculate(candidateA);
              await voting.recalculate(candidateB);
            });

            describe('recalculate older one first', () => {
              it('should insert element to the HEAD if its weight >= the HEAD and move HEAD to TAIL', async function() {
                await voting.onSpaceReputationChanged(candidateC, 1500, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 0);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 0);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);
              });

              it('should insert element to the TAIL if its weight < the HEAD', async function() {
                await voting.onSpaceReputationChanged(candidateA, 800, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 300000);

                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 200000);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 300000);
              });
            });

            describe('recalculate new one first', () => {
              it('should insert element to the HEAD if its weight >= the HEAD and move HEAD to TAIL', async function() {
                await voting.onSpaceReputationChanged(candidateC, 1500, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 0);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2700);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);
              });

              it('should insert element to the TAIL if its weight < the HEAD', async function() {
                await voting.onSpaceReputationChanged(candidateA, 800, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 1);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 200000);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 500000);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 200000);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 300000);
              });
            });
          });
        });

        describe('2-element list', () => {
          beforeEach(async function() {
            await voting.onSpaceReputationChanged(candidateB, 1200, { from: fakeSRA });
            await voting.onSpaceReputationChanged(candidateC, 1500, { from: fakeSRA });

            await voting.recalculate(candidateB);
            await voting.recalculate(candidateC);
          });

          describe('and the element is HEAD', () => {
            describe('and its new weight E >= HEAD', () => {
              it('should keep array as is when recalculates changed one first', async function() {
                await voting.onSpaceReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 312500);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 187500);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 312500);
              });

              it('should keep array as is when recalculates old one first', async function() {
                await voting.onSpaceReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 187500);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3200);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 187500);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 312500);
              });
            });

            describe('and its new weight TAIL < E < HEAD', async function() {
              it('should keep array as is when recalculates changed one first', async function() {
                await voting.onSpaceReputationChanged(candidateC, 1201, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });

              it('should keep array as is when recalculates new one first', async function() {
                await voting.onSpaceReputationChanged(candidateC, 1201, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2401);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });
            });
            describe('and its new weight E < TAIL', async function() {
              it('should reverse array as is when recalculates changed one first', async function() {
                await voting.onSpaceReputationChanged(candidateC, 1199, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1199);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 249895);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 250104);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1199);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 249895);
              });

              it('should reverse array as is when recalculates new one first', async function() {
                await voting.onSpaceReputationChanged(candidateC, 1199, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 250104);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1199);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2399);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 250104);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1199);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 249895);
              });
            });
          });

          describe('and the element is TAIL', () => {
            describe('and its new weight E >= HEAD', () => {
              it('should reverse array as is when recalculates changed one first', async function() {
                await voting.onSpaceReputationChanged(candidateB, 1501, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3001);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3001);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });

              it('should reverse array as is when recalculates not changed one first', async function() {
                await voting.onSpaceReputationChanged(candidateB, 1501, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3001);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3001);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });
            });

            describe('and its new weight TAIL < E < HEAD', () => {
              it('should keep array as is when recalculates changed one first', async function() {
                await voting.onSpaceReputationChanged(candidateB, 1201, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2701);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2701);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });

              it('should keep array as is when recalculates not changed one first', async function() {
                await voting.onSpaceReputationChanged(candidateB, 1201, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2701);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2701);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });
            });

            describe('and its new weight E < TAIL', () => {
              it('should keep array as is when recalculates changed one first', async function() {
                await voting.onSpaceReputationChanged(candidateB, 1199, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2699);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2699);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });

              it('should keep array as is when recalculates not changed one first', async function() {
                await voting.onSpaceReputationChanged(candidateB, 1199, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2699);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2699);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);
              });
            });
          });

          describe('and the element is a new one', () => {
            describe('recalculate order A => B => C', () => {
              it('should push it as HEAD', async function() {
                await voting.onSpaceReputationChanged(candidateA, 1501, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateA, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 142823);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateA, candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 142823);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 178528);
              });

              it('should push into the middle', async function() {
                await voting.onSpaceReputationChanged(candidateA, 1201, { from: fakeSRA });

                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateA, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3901);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should push as tail', async function() {
                await voting.onSpaceReputationChanged(candidateA, 1199, { from: fakeSRA });

                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3899);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });
            });

            describe('recalculate order C => A => B', () => {
              it('should push it as HEAD', async function() {
                await voting.onSpaceReputationChanged(candidateA, 1501, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 277777);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, false);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 0);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 178528);

                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateA, candidateC]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 222222);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 178528);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateA, candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 142823);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 178528);
              });

              it('should push into the middle', async function() {
                await voting.onSpaceReputationChanged(candidateA, 1201, { from: fakeSRA });

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateA, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3901);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should push as tail', async function() {
                await voting.onSpaceReputationChanged(candidateA, 1199, { from: fakeSRA });

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3899);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });
            });

            describe('recalculate order B => C => A', () => {
              it('should push it as HEAD', async function() {
                await voting.onSpaceReputationChanged(candidateA, 1501, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 2);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateA, candidateC, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4201);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 1501);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 178647);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 142823);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 1500);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 178528);
              });

              it('should push into the middle', async function() {
                await voting.onSpaceReputationChanged(candidateA, 1201, { from: fakeSRA });

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE A
                await voting.recalculate(candidateA);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateA, candidateB]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3901);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should push as tail', async function() {
                await voting.onSpaceReputationChanged(candidateA, 1199, { from: fakeSRA });

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE A
                await voting.recalculate(candidateA);

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3899);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });
            });
          });
        });

        describe('3-element list', () => {
          beforeEach(async function() {
            await voting.onSpaceReputationChanged(candidateA, 800, { from: fakeSRA });
            await voting.onSpaceReputationChanged(candidateB, 1200, { from: fakeSRA });
            await voting.onSpaceReputationChanged(candidateC, 1500, { from: fakeSRA });

            await voting.recalculate(candidateB);
            await voting.recalculate(candidateC);
            await voting.recalculate(candidateA);
          });

          describe('and the element is HEAD', () => {
            describe('and its new weight E >= HEAD', () => {
              it('should keep array after C => B => A recalculation', async function() {
                await voting.onSpaceReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE a
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 100000);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 1200);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 150000);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 2000);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 250000);
              });

              it('should keep array after A => B => C recalculation', async function() {
                await voting.onSpaceReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should keep array after B => A => C recalculation', async function() {
                await voting.onSpaceReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 4000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });
            });
            describe('and its new weight E >= (HEAD - 1)', () => {
              it('should keep array after uncommon case', async function() {
                await voting.onSpaceReputationChanged(candidateC, 802, { from: fakeSRA });
                await voting.onSpaceReputationChanged(candidateB, 801, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2403);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2403);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 114285);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 801);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 171428);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 802);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 166874);

                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2403);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 166458);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 801);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 171428);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 802);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 166874);

                // RECALCULATE B
                await voting.recalculate(candidateB);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 2403);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // CHECK A
                res = await votingWeb3.methods.isCandidateInList(candidateA).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
                assert.equal(res, 800);
                res = await votingWeb3.methods.getWeight(candidateA).call();
                assert.equal(res, 166458);

                // CHECK B
                res = await votingWeb3.methods.isCandidateInList(candidateB).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
                assert.equal(res, 801);
                res = await votingWeb3.methods.getWeight(candidateB).call();
                assert.equal(res, 166666);

                // CHECK C
                res = await votingWeb3.methods.isCandidateInList(candidateC).call();
                assert.equal(res, true);
                res = await votingWeb3.methods.getSpaceReputation(candidateC).call();
                assert.equal(res, 802);
                res = await votingWeb3.methods.getWeight(candidateC).call();
                assert.equal(res, 166874);
              });
            });

            describe('and its new weight TAIL < E < HEAD', async function() {
              it('should keep array after C => B => A recalculation', async function() {
                await voting.onSpaceReputationChanged(candidateC, 1000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE C
                await voting.recalculate(candidateC);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE A
                await voting.recalculate(candidateA);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should keep array after A => B => C recalculation', async function() {
                await voting.onSpaceReputationChanged(candidateC, 1000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });

              it('should keep array after B => A => C recalculation', async function() {
                await voting.onSpaceReputationChanged(candidateC, 1000, { from: fakeSRA });

                let res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);

                // RECALCULATE B
                await voting.recalculate(candidateB);
                // RECALCULATE A
                await voting.recalculate(candidateA);
                // RECALCULATE C
                await voting.recalculate(candidateC);

                res = await votingWeb3.methods.getCandidates().call();
                assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
                res = await votingWeb3.methods.totalSpaceReputation().call();
                assert.equal(res, 3000);
                res = await votingWeb3.methods.getSize().call();
                assert.equal(res, 3);
              });
            });
          });
        });

        describe('when limit is reached', () => {
          beforeEach(async function() {
            await voting.onSpaceReputationChanged(candidateA, 800, { from: fakeSRA });
            await voting.onSpaceReputationChanged(candidateB, 1200, { from: fakeSRA });
            await voting.onSpaceReputationChanged(candidateC, 1500, { from: fakeSRA });

            await voting.recalculate(candidateB);
            await voting.recalculate(candidateC);
            await voting.recalculate(candidateA);
          });

          it('should remove last element when E > HEAD was pushed', async function() {
            let res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 3500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            await voting.onSpaceReputationChanged(candidateD, 2000, { from: fakeSRA });

            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 5500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);

            await voting.recalculate(candidateD);

            res = await votingWeb3.methods.getCandidates().call();
            assert.sameOrderedMembers(res, [candidateC, candidateD, candidateB]);
            res = await votingWeb3.methods.totalSpaceReputation().call();
            assert.equal(res, 5500);
            res = await votingWeb3.methods.getSize().call();
            assert.equal(res, 3);
          });
        });
      });
    });

    it('should sort basic case', async () => {
      await voting.onSpaceReputationChanged(candidateA, 800, { from: fakeSRA });
      await voting.onSpaceReputationChanged(candidateB, 1200, { from: fakeSRA });
      await voting.onSpaceReputationChanged(candidateC, 1500, { from: fakeSRA });
      await voting.onSpaceReputationChanged(candidateD, 300, { from: fakeSRA });
      await voting.onSpaceReputationChanged(candidateE, 600, { from: fakeSRA });

      let res = await votingWeb3.methods.getSpaceReputation(candidateA).call();
      assert.equal(res, 800);
      res = await votingWeb3.methods.getSpaceReputation(candidateB).call();
      assert.equal(res, 1200);
      res = await votingWeb3.methods.getCandidates().call();
      assert.sameMembers(res, []);

      await voting.recalculate(alice);
      await voting.recalculate(candidateA);

      res = await votingWeb3.methods.getCandidates().call();
      assert.sameMembers(res, [candidateA]);

      await voting.recalculate(candidateB);
      res = await votingWeb3.methods.getCandidates().call();
      assert.sameOrderedMembers(res, [candidateB, candidateA]);
      // assert.fail('');
      // TODO: fetch list
    });
  });

  describe('#onReputationChanged()', () => {
    beforeEach(async function() {
      this.multiSigFactoryF = await deployMultiSigFactory(this.ggr, coreTeam);
      await this.galtToken.approve(this.multiSigFactoryF.address, ether(10), { from: alice });
      // MultiSigF
      this.abF = await buildArbitration(
        this.multiSigFactoryF,
        [bob, charlie, dan, eve],
        2,
        2,
        3,
        60,
        ether(1000),
        [30, 30, 30, 30, 30, 30],
        {},
        alice
      );
      this.abMultiSigF = this.abF.multiSig;
      this.abVotingF = this.abF.voting;
      this.abVotingFWeb3 = new web3.eth.Contract(this.abVotingF.abi, this.abVotingF.address);
    });

    describe('full reputation revoke', () => {
      it('should revoke reputation from multiple candidates', async function() {
        await this.abVotingF.onSpaceReputationChanged(alice, 800, { from: fakeSRA });
        await this.abVotingF.grantReputation(candidateA, 200, { from: alice });
        await this.abVotingF.grantReputation(candidateB, 300, { from: alice });
        await this.abVotingF.grantReputation(candidateC, 100, { from: alice });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateB).call();
        assert.equal(res, 300);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateC).call();
        assert.equal(res, 100);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onSpaceReputationChanged(alice, 0, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateB).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateC).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 0);
      });

      it('should revoke reputation from single candidate', async function() {
        await this.abVotingF.onSpaceReputationChanged(alice, 800, { from: fakeSRA });
        await this.abVotingF.grantReputation(candidateA, 200, { from: alice });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 600);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onSpaceReputationChanged(alice, 0, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 0);
      });

      it('should revoke reputation only from candidate', async function() {
        await this.abVotingF.onSpaceReputationChanged(alice, 800, { from: fakeSRA });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 800);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onSpaceReputationChanged(alice, 0, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 0);
      });
    });

    describe('partial reputation revoke', () => {
      it('should revoke reputation from multiple candidates', async function() {
        await this.abVotingF.onSpaceReputationChanged(alice, 800, { from: fakeSRA });
        await this.abVotingF.grantReputation(candidateA, 200, { from: alice });
        await this.abVotingF.grantReputation(candidateB, 300, { from: alice });
        await this.abVotingF.grantReputation(candidateC, 100, { from: alice });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateB).call();
        assert.equal(res, 300);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateC).call();
        assert.equal(res, 100);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onSpaceReputationChanged(alice, 200, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateB).call();
        assert.equal(res, 100);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateC).call();
        assert.equal(res, 100);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 200);
      });

      it('should revoke reputation from single candidate', async function() {
        await this.abVotingF.onSpaceReputationChanged(alice, 800, { from: fakeSRA });
        await this.abVotingF.grantReputation(candidateA, 200, { from: alice });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 600);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 200);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onSpaceReputationChanged(alice, 100, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 0);
        res = await this.abVotingFWeb3.methods.getSpaceReputation(candidateA).call();
        assert.equal(res, 100);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 100);
      });

      it('should revoke reputation only from candidate', async function() {
        await this.abVotingF.onSpaceReputationChanged(alice, 800, { from: fakeSRA });

        let res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 800);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 800);

        // REVOKE
        await this.abVotingF.onSpaceReputationChanged(alice, 300, { from: fakeSRA });

        res = await this.abVotingFWeb3.methods.getSpaceReputation(alice).call();
        assert.equal(res, 300);
        res = await this.abVotingFWeb3.methods.totalSpaceReputation().call();
        assert.equal(res, 300);
      });
    });
  });

  describe('#pushArbitrators()', () => {
    let voting;
    let multiSig;

    beforeEach(async function() {
      this.multiSigFactoryF = await deployMultiSigFactory(this.ggr, coreTeam);
      await this.galtToken.approve(this.multiSigFactoryF.address, ether(10), { from: bob });
      this.abF = await buildArbitration(
        this.multiSigFactoryF,
        [a1, a2, a3],
        2,
        3,
        5,
        60,
        ether(1000),
        [30, 30, 30, 30, 30, 30],
        {},
        bob
      );
      this.abMultiSigF = this.abF.multiSig;
      this.abVotingF = this.abF.voting;
      this.arbitratorStakeAccountingX = this.abF.arbitratorStakeAccounting;

      voting = this.abVotingF;
      multiSig = this.abMultiSigF;

      await voting.onSpaceReputationChanged(candidateA, 800, { from: fakeSRA });
      await voting.onSpaceReputationChanged(candidateB, 1200, { from: fakeSRA });
      await voting.onSpaceReputationChanged(candidateC, 1500, { from: fakeSRA });
      await voting.onSpaceReputationChanged(candidateD, 300, { from: fakeSRA });
      await voting.onSpaceReputationChanged(candidateE, 600, { from: fakeSRA });
      await voting.onSpaceReputationChanged(candidateF, 900, { from: fakeSRA });

      await voting.recalculate(candidateA);
      await voting.recalculate(candidateB);
      await voting.recalculate(candidateC);
      await voting.recalculate(candidateD);
      await voting.recalculate(candidateE);
      await voting.recalculate(candidateF);

      let res = await voting.getSpaceReputation(candidateA);
      assert.equal(res, 800);
      res = await voting.getSpaceReputation(candidateB);
      assert.equal(res, 1200);
      res = await voting.getSpaceReputation(candidateC);
      assert.equal(res, 1500);
      res = await voting.getSpaceReputation(candidateD);
      assert.equal(res, 300);
      res = await voting.getSpaceReputation(candidateE);
      assert.equal(res, 600);
      res = await voting.getSpaceReputation(candidateF);
      assert.equal(res, 900);

      res = await voting.getCandidates();
      assert.sameOrderedMembers(res, [candidateC, candidateB, candidateF, candidateA, candidateE]);
      res = await voting.totalSpaceReputation();
      assert.equal(res, 5300);
      res = await voting.getSize();
      assert.equal(res, 5);
    });

    it('should push arbitrators', async function() {
      let res = await multiSig.getArbitrators();
      assert.sameMembers(res, [a1, a2, a3]);

      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(5000), { from: alice });

      await this.arbitratorStakeAccountingX.stake(candidateC, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateB, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateF, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateA, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateE, ether(1000), { from: alice });

      await voting.pushArbitrators();

      res = await multiSig.getArbitrators();
      assert.equal(res.length, 5);
      assert.equal(res[0], candidateC);
      assert.equal(res[1], candidateB);
      assert.equal(res[2], candidateF);
      assert.equal(res[3], candidateA);
      assert.equal(res[4], candidateE);
    });

    it('should deny pushing list with < 3 elements', async function() {
      await voting.onSpaceReputationChanged(candidateA, 0, { from: fakeSRA });
      await voting.onSpaceReputationChanged(candidateB, 0, { from: fakeSRA });
      await voting.onSpaceReputationChanged(candidateC, 0, { from: fakeSRA });

      await voting.recalculate(candidateA);
      await voting.recalculate(candidateB);
      await voting.recalculate(candidateC);

      const res = await voting.getCandidates();
      assert.sameOrderedMembers(res, [candidateF, candidateE]);
      await assertRevert(voting.pushArbitrators());
    });
  });
});
