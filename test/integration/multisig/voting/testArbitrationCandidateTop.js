/* eslint-disable prefer-arrow-callback */
// const ArbitratorVoting = artifacts.require('./ArbitratorVoting.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
// const ArbitrationConfig = artifacts.require('./ArbitrationConfig.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const {
  ether,
  assertRevert,
  initHelperWeb3,
  initHelperArtifacts,
  deploySplitMergeMock,
  evmMineBlock
} = require('../../../helpers');

const web3 = new Web3(GaltGlobalRegistry.web3.currentProvider);
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

// NOTICE: we don't wrap MockToken with a proxy on production
contract('ArbitrationCandidateTop', accounts => {
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
    minter,
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

  describe('recalculation & sorting', () => {
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
      this.candidateTopF = this.abF.candidateTop;
      this.delegateSpaceVotingF = this.abF.delegateSpaceVoting;
    });

    describe('0 weight', () => {
      describe('not in list', () => {
        it('should not affect on the list', async function() {
          await this.candidateTopF.recalculate(alice);
          let res = await this.candidateTopF.getCandidates();
          assert.sameMembers(res, []);
          res = await this.candidateTopF.getSize();
          assert.equal(res, 0);
        });
      });

      describe('in list', () => {
        beforeEach(async function() {
          // await this.candidateTopF.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });
          const p = [
            this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA }),
            this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA }),
            this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA })
          ];

          await Promise.all(p);
        });

        describe('1-element list', () => {
          // The first element is always HEAD
          it('should clear the list if this element is the only element of the list', async function() {
            await this.candidateTopF.recalculate(candidateA);

            let res = await this.candidateTopF.getCandidates();
            assert.sameMembers(res, [candidateA]);
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 1);

            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 0, { from: fakeSRA });

            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 0);

            await this.candidateTopF.recalculate(candidateA);

            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, false);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 0);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidates();
            assert.sameMembers(res, []);
          });
        });

        describe('2-element list', () => {
          // The 1st element is HEAD and the second is TAIL
          beforeEach(async function() {
            const p = [this.candidateTopF.recalculate(candidateA), this.candidateTopF.recalculate(candidateB)];

            await Promise.all(p);
          });

          it('should move tail to head if the element is the HEAD', async function() {
            // CHECK LIST
            let res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 3500);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 2);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 800);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // ACTION
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 0, { from: fakeSRA });

            // CHECK LIST
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2300);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 2);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 800);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);

            await this.candidateTopF.recalculate(candidateB);

            // CHECK LIST
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2300);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 1);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 800);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, false);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 0);
          });

          it('should remove tail if the element is the TAIL', async function() {
            // CHECK LIST
            let res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 3500);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 2);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 800);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // ACTION
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 0, { from: fakeSRA });

            // CHECK LIST
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2700);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 2);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);

            await this.candidateTopF.recalculate(candidateA);

            // CHECK LIST
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateB]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2700);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 1);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, false);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 0);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);
          });
        });

        describe('3-element list', () => {
          // The 1st element is HEAD and the second is TAIL
          beforeEach(async function() {
            const p = [
              this.candidateTopF.recalculate(candidateA),
              this.candidateTopF.recalculate(candidateB),
              this.candidateTopF.recalculate(candidateC)
            ];

            await Promise.all(p);
          });

          it('should move head down if the element is the HEAD', async function() {
            // CHECK LIST
            let res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 3500);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 3);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 800);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getCandidateWeight(candidateC);
            assert.equal(res, 171428);

            // ACTION
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 0, { from: fakeSRA });

            // CHECK LIST
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2000);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 3);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 800);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateC);
            assert.equal(res, 171428);

            await this.candidateTopF.recalculate(candidateC);

            // CHECK LIST
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2000);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 2);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 800);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, false);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateC);
            assert.equal(res, 0);
          });

          // 114285 - 91428
          // 171428 - 137142
          // 214285 - 171428
          it('should move link elements correctly if the element is the middle', async function() {
            // CHECK LIST
            let res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 3500);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 3);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 800);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getCandidateWeight(candidateC);
            assert.equal(res, 171428);

            // ACTION
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 0, { from: fakeSRA });

            // CHECK LIST
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2300);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 3);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 800);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getCandidateWeight(candidateC);
            assert.equal(res, 171428);

            await this.candidateTopF.recalculate(candidateB);

            // CHECK LIST
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateC, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2300);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 2);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 800);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, false);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 0);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getCandidateWeight(candidateC);
            assert.equal(res, 171428);
          });

          it('should move tail up if the element is the TAIL', async function() {
            // CHECK LIST
            let res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 3500);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 3);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 800);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getCandidateWeight(candidateC);
            assert.equal(res, 171428);

            // ACTION
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 0, { from: fakeSRA });

            // CHECK LIST
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2700);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 3);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getCandidateWeight(candidateC);
            assert.equal(res, 171428);

            // UNEXPECTED ACTION
            await this.candidateTopF.recalculate(candidateB);

            // CHECK LIST
            res = await this.candidateTopF.getSize();
            assert.equal(res, 3);
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2700);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 177777);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getCandidateWeight(candidateC);
            assert.equal(res, 171428);

            // ACTION
            await this.candidateTopF.recalculate(candidateA);

            // CHECK LIST
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateB, candidateC]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2700);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 2);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, false);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 0);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 177777);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getCandidateWeight(candidateC);
            assert.equal(res, 171428);

            // ACTION
            await this.candidateTopF.recalculate(candidateC);

            // CHECK LIST
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateC, candidateB]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 2700);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 2);

            // CHECK A
            res = await this.candidateTopF.isCandidateInList(candidateA);
            assert.equal(res, false);
            res = await this.delegateSpaceVotingF.balanceOf(candidateA);
            assert.equal(res, 0);
            res = await this.candidateTopF.getCandidateWeight(candidateA);
            assert.equal(res, 0);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getCandidateWeight(candidateB);
            assert.equal(res, 177777);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getCandidateWeight(candidateC);
            assert.equal(res, 222222);
          });
        });
      });
    });

    describe('> 0 weight', () => {
      describe('into', () => {
        describe('1-element list', () => {
          it('should not affect the list if this element is the HEAD element of the list ', async function() {
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });
            await this.candidateTopF.recalculate(candidateA);

            let res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 800);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 1);

            // CHANGE
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 700, { from: fakeSRA });

            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 700);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 1);

            // RECALCULATE
            await this.candidateTopF.recalculate(candidateA);
            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 700);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 1);
          });

          describe('and the element isnt the first element', () => {
            beforeEach(async function() {
              await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
              await this.candidateTopF.recalculate(candidateA);
              await this.candidateTopF.recalculate(candidateB);
            });

            describe('recalculate older one first', () => {
              it('should insert element to the HEAD if its weight >= the HEAD and move HEAD to TAIL', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2700);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 1);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 400000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 0);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2700);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 1);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 0);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2700);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 222222);
              });

              it('should insert element to the TAIL if its weight < the HEAD', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 1);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 800);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 400000);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 1);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 800);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 240000);

                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 800);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 160000);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 240000);
              });
            });

            describe('recalculate new one first', () => {
              it('should insert element to the HEAD if its weight >= the HEAD and move HEAD to TAIL', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2700);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 1);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 400000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 0);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2700);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 400000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 222222);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2700);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 222222);
              });

              it('should insert element to the TAIL if its weight < the HEAD', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 1);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 800);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 400000);

                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 800);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 160000);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 400000);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 800);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 160000);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 240000);
              });
            });
          });
        });

        describe('2-element list', () => {
          beforeEach(async function() {
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });

            await this.candidateTopF.recalculate(candidateB);
            await this.candidateTopF.recalculate(candidateC);
          });

          describe('and the element is HEAD', () => {
            describe('and its new weight E >= HEAD', () => {
              it('should keep array as is when recalculates changed one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3200);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 222222);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3200);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 250000);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3200);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 150000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 250000);
              });

              it('should keep array as is when recalculates old one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3200);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 222222);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3200);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 150000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 222222);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3200);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 150000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 250000);
              });
            });

            describe('and its new weight TAIL < E < HEAD', async function() {
              it('should keep array as is when recalculates changed one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1201, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2401);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2401);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2401);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);
              });

              it('should keep array as is when recalculates new one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1201, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2401);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2401);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2401);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);
              });
            });

            describe('and its new weight E < TAIL', async function() {
              it('should reverse array as is when recalculates changed one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1199, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2399);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2399);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1199);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 199916);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2399);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 200083);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1199);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 199916);
              });

              it('should reverse array as is when recalculates new one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1199, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2399);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2399);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 200083);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1199);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 222222);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2399);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 200083);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1199);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 199916);
              });
            });
          });

          describe('and the element is TAIL', () => {
            describe('and its new weight E >= HEAD', () => {
              it('should reverse array as is when recalculates changed one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1501, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3001);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);
                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3001);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);
              });

              it('should reverse array as is when recalculates not changed one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1501, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3001);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3001);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);
              });
            });

            describe('and its new weight TAIL < E < HEAD', () => {
              it('should keep array as is when recalculates changed one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1201, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2701);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);
                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2701);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);
              });

              it('should keep array as is when recalculates not changed one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1201, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2701);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2701);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);
              });
            });

            describe('and its new weight E < TAIL', () => {
              it('should keep array as is when recalculates changed one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1199, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2699);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);
                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2699);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);
              });

              it('should keep array as is when recalculates not changed one first', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1199, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2699);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2699);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);
              });
            });
          });

          describe('and the element is a new one', () => {
            describe('recalculate order A => B => C', () => {
              it('should push it as HEAD', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 1501, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4201);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 1501);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 222222);

                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4201);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 1501);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 222222);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateA, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4201);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 1501);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 114258);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 222222);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateA, candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4201);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 1501);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 114258);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 142822);
              });

              it('should push into the middle', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 1201, { from: fakeSRA });

                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);
                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateA, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3901);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);
              });

              it('should push as tail', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 1199, { from: fakeSRA });

                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);
                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3899);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);
              });
            });

            describe('recalculate order C => A => B', () => {
              it('should push it as HEAD', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 1501, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4201);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 1501);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 222222);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateC]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4201);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 1501);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 142822);

                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateA, candidateC]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4201);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 1501);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 142822);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateA, candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4201);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 1501);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 114258);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 142822);
              });

              it('should push into the middle', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 1201, { from: fakeSRA });

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);
                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);
                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateA, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3901);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);
              });

              it('should push as tail', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 1199, { from: fakeSRA });

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);
                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);
                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3899);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);
              });
            });

            describe('recalculate order B => C => A', () => {
              it('should push it as HEAD', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 1501, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4201);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 2);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);
                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateA, candidateC, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4201);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 1501);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 114258);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 142822);
              });

              it('should push into the middle', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 1201, { from: fakeSRA });

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);
                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateA, candidateB]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3901);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);
              });

              it('should push as tail', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 1199, { from: fakeSRA });

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);
                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3899);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);
              });
            });
          });
        });

        describe('3-element list', () => {
          beforeEach(async function() {
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });

            await this.candidateTopF.recalculate(candidateB);
            await this.candidateTopF.recalculate(candidateC);
            await this.candidateTopF.recalculate(candidateA);
          });

          describe('and the element is HEAD', () => {
            describe('and its new weight E >= HEAD', () => {
              it('should keep array after C => B => A recalculation', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);
                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 800);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 80000);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 120000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 200000);
              });

              it('should keep array after A => B => C recalculation', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);
                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);
              });

              it('should keep array after B => A => C recalculation', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 2000, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 4000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);
              });
            });

            describe('and its new weight E >= (HEAD - 1)', () => {
              it('should keep array after uncommon case', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 802, { from: fakeSRA });
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 801, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2403);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2403);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 800);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 91428);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 801);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 137142);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 802);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 133499);

                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2403);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 800);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 133166);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 801);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 137142);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 802);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 133499);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 2403);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // CHECK A
                res = await this.candidateTopF.isCandidateInList(candidateA);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateA);
                assert.equal(res, 800);
                res = await this.candidateTopF.getCandidateWeight(candidateA);
                assert.equal(res, 133166);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 801);
                res = await this.candidateTopF.getCandidateWeight(candidateB);
                assert.equal(res, 133333);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 802);
                res = await this.candidateTopF.getCandidateWeight(candidateC);
                assert.equal(res, 133499);
              });
            });

            describe('and its new weight TAIL < E < HEAD', async function() {
              it('should keep array after C => B => A recalculation', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1000, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);
                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);
              });

              it('should keep array after A => B => C recalculation', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1000, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);
                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);
              });

              it('should keep array after B => A => C recalculation', async function() {
                await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1000, { from: fakeSRA });

                let res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);

                // RECALCULATE B
                await this.candidateTopF.recalculate(candidateB);
                // RECALCULATE A
                await this.candidateTopF.recalculate(candidateA);
                // RECALCULATE C
                await this.candidateTopF.recalculate(candidateC);

                res = await this.candidateTopF.getCandidates();
                assert.sameOrderedMembers(res, [candidateB, candidateC, candidateA]);
                res = await this.delegateSpaceVotingF.totalSupply();
                assert.equal(res, 3000);
                res = await this.candidateTopF.getSize();
                assert.equal(res, 3);
              });
            });
          });
        });

        describe('when limit is reached', () => {
          beforeEach(async function() {
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });

            await this.candidateTopF.recalculate(candidateB);
            await this.candidateTopF.recalculate(candidateC);
            await this.candidateTopF.recalculate(candidateA);
          });

          it('should remove last element when E > HEAD was pushed', async function() {
            let res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 3500);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 3);

            await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateD, 2000, { from: fakeSRA });

            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateC, candidateB, candidateA]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 5500);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 3);

            await this.candidateTopF.recalculate(candidateD);

            res = await this.candidateTopF.getCandidates();
            assert.sameOrderedMembers(res, [candidateC, candidateD, candidateB]);
            res = await this.delegateSpaceVotingF.totalSupply();
            assert.equal(res, 5500);
            res = await this.candidateTopF.getSize();
            assert.equal(res, 3);
          });
        });
      });
    });

    it('should sort basic case', async function() {
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateD, 300, { from: fakeSRA });
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateE, 600, { from: fakeSRA });

      let res = await this.delegateSpaceVotingF.balanceOf(candidateA);
      assert.equal(res, 800);
      res = await this.delegateSpaceVotingF.balanceOf(candidateB);
      assert.equal(res, 1200);
      res = await this.candidateTopF.getCandidates();
      assert.sameMembers(res, []);

      await this.candidateTopF.recalculate(alice);
      await this.candidateTopF.recalculate(candidateA);

      res = await this.candidateTopF.getCandidates();
      assert.sameMembers(res, [candidateA]);

      await this.candidateTopF.recalculate(candidateB);
      res = await this.candidateTopF.getCandidates();
      assert.sameOrderedMembers(res, [candidateB, candidateA]);
      // assert.fail('');
      // TODO: fetch list
    });
  });

  describe('#pushArbitrators()', () => {
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
      this.delegateSpaceVotingF = this.abF.delegateSpaceVoting;
      this.candidateTopF = this.abF.candidateTop;

      // voting = this.abVotingF;
      // multiSig = this.abMultiSigF;

      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 800, { from: fakeSRA });
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 1200, { from: fakeSRA });
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 1500, { from: fakeSRA });
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateD, 300, { from: fakeSRA });
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateE, 600, { from: fakeSRA });
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateF, 900, { from: fakeSRA });

      await this.candidateTopF.recalculate(candidateA);
      await this.candidateTopF.recalculate(candidateB);
      await this.candidateTopF.recalculate(candidateC);
      await this.candidateTopF.recalculate(candidateD);
      await this.candidateTopF.recalculate(candidateE);
      await this.candidateTopF.recalculate(candidateF);

      let res = await this.delegateSpaceVotingF.balanceOf(candidateA);
      assert.equal(res, 800);
      res = await this.delegateSpaceVotingF.balanceOf(candidateB);
      assert.equal(res, 1200);
      res = await this.delegateSpaceVotingF.balanceOf(candidateC);
      assert.equal(res, 1500);
      res = await this.delegateSpaceVotingF.balanceOf(candidateD);
      assert.equal(res, 300);
      res = await this.delegateSpaceVotingF.balanceOf(candidateE);
      assert.equal(res, 600);
      res = await this.delegateSpaceVotingF.balanceOf(candidateF);
      assert.equal(res, 900);

      res = await this.candidateTopF.getCandidates();
      assert.sameOrderedMembers(res, [candidateC, candidateB, candidateF, candidateA, candidateE]);
      res = await this.candidateTopF.getSize();
      assert.equal(res, 5);
      res = await this.delegateSpaceVotingF.totalSupply();
      assert.equal(res, 5300);
    });

    it('should push arbitrators', async function() {
      let res = await this.abMultiSigF.getArbitrators();
      assert.sameMembers(res, [a1, a2, a3]);

      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(5000), { from: alice });

      await this.arbitratorStakeAccountingX.stake(candidateC, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateB, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateF, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateA, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateE, ether(1000), { from: alice });

      await this.candidateTopF.pushArbitrators();

      res = await this.abMultiSigF.getArbitrators();
      assert.equal(res.length, 5);
      assert.equal(res[0], candidateC);
      assert.equal(res[1], candidateB);
      assert.equal(res[2], candidateF);
      assert.equal(res[3], candidateA);
      assert.equal(res[4], candidateE);
    });

    it('should deny pushing list with < 3 elements', async function() {
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateA, 0, { from: fakeSRA });
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateB, 0, { from: fakeSRA });
      await this.delegateSpaceVotingF.onDelegateReputationChanged(candidateC, 0, { from: fakeSRA });

      await this.candidateTopF.recalculate(candidateA);
      await this.candidateTopF.recalculate(candidateB);
      await this.candidateTopF.recalculate(candidateC);

      const res = await this.candidateTopF.getCandidates();
      assert.sameOrderedMembers(res, [candidateF, candidateE]);
      await assertRevert(this.candidateTopF.pushArbitrators());
    });
  });
});