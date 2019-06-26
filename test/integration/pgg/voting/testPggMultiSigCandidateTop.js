/* eslint-disable prefer-arrow-callback */
const ACL = artifacts.require('./ACL.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const SpaceRA = artifacts.require('./SpaceRA.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const LockerRegistry = artifacts.require('./LockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const GaltLockerFactory = artifacts.require('./GaltLockerFactory.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const {
  ether,
  assertRevert,
  initHelperWeb3,
  initHelperArtifacts,
  deploySpaceGeoDataMock,
  paymentMethods,
  evmMineBlock
} = require('../../../helpers');

const web3 = new Web3(GaltGlobalRegistry.web3.currentProvider);
const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;
const { deployPGGFactory, buildPGG } = require('../../../deploymentHelpers');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

// NOTICE: we don't wrap MockToken with a proxy on production
contract('PGGMultiSigCandidateTop', accounts => {
  const [
    coreTeam,
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
    this.acl = await ACL.new({ from: coreTeam });
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new(this.ggr.address, 'Space Token', 'SPACE', { from: coreTeam });
    const deployment = await deploySpaceGeoDataMock(this.ggr);
    this.spaceGeoData = deployment.spaceGeoData;

    this.spaceLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('SPACE_LOCKER_REGISTRAR'), {
      from: coreTeam
    });
    this.galtLockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('GALT_LOCKER_REGISTRAR'), {
      from: coreTeam
    });
    this.pggRegistry = await PGGRegistry.new(this.ggr.address, { from: coreTeam });

    this.spaceLockerFactory = await SpaceLockerFactory.new(this.ggr.address, { from: coreTeam });
    this.galtLockerFactory = await GaltLockerFactory.new(this.ggr.address, { from: coreTeam });

    this.spaceRA = await SpaceRA.new(this.ggr.address, { from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.feeRegistry.initialize();
    await this.pggRegistry.initialize(this.ggr.address);
    await this.spaceRA.initialize(this.ggr.address);

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, { from: coreTeam });
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

    this.pggFactoryF = await deployPGGFactory(this.ggr, coreTeam);
    await this.feeRegistry.setGaltFee(await this.pggFactoryF.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.pggFactoryF.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.pggFactoryF.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });
    await this.feeRegistry.setGaltFee(await this.spaceLockerFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.spaceLockerFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.spaceLockerFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('SPACE_MINTER'), minter, true, { from: coreTeam });
    await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactoryF.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), this.spaceRA.address, true, { from: coreTeam });
  });

  beforeEach(async function() {
    await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), this.spaceRA.address, false, { from: coreTeam });

    this.spaceRA = await SpaceRA.new(this.ggr.address, { from: coreTeam });
    await this.spaceRA.initialize(this.ggr.address);

    await this.ggr.setContract(await this.ggr.SPACE_RA(), this.spaceRA.address, {
      from: coreTeam
    });
    await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), this.spaceRA.address, true, { from: coreTeam });
  });

  describe('recalculation & sorting', () => {
    before(async function() {
      await this.ggr.setContract(await this.ggr.SPACE_RA(), fakeSRA, { from: coreTeam });
      await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), fakeSRA, true, { from: coreTeam });
    });

    beforeEach(async function() {
      await evmMineBlock();
      await this.galtToken.approve(this.pggFactoryF.address, ether(10), { from: alice });
      // pggFactoryF
      this.pggF = await buildPGG(
        this.pggFactoryF,
        [bob, charlie, dan, eve],
        2,
        2,
        3,
        60,
        ether(1000),
        300000,
        {},
        {},
        alice
      );
      this.pggMultiSigF = this.pggF.multiSig;
      this.candidateTopF = this.pggF.candidateTop;
      this.delegateSpaceVotingF = this.pggF.delegateSpaceVoting;
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 0);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, false);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 0);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 0);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 0);
            res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, false);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 0);
            res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 0);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, false);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 0);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
            assert.equal(res, 0);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
            assert.equal(res, 137142);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 91428);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
            assert.equal(res, 177777);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 0);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
            assert.equal(res, 177777);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
            res = await this.candidateTopF.getTopCandidateWeight(candidateA);
            assert.equal(res, 0);

            // CHECK B
            res = await this.candidateTopF.isCandidateInList(candidateB);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateB);
            assert.equal(res, 1200);
            res = await this.candidateTopF.getTopCandidateWeight(candidateB);
            assert.equal(res, 177777);

            // CHECK C
            res = await this.candidateTopF.isCandidateInList(candidateC);
            assert.equal(res, true);
            res = await this.delegateSpaceVotingF.balanceOf(candidateC);
            assert.equal(res, 1500);
            res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 400000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 160000);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 400000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, false);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 400000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 160000);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 160000);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 150000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 150000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 150000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1199);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 200083);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1199);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 200083);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1199);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 200083);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1199);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 114258);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 114258);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 0);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 177777);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 114258);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 142918);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 114258);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 1500);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 80000);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 1200);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 120000);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 2000);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 91428);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 801);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 137142);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 802);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 133166);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 801);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 137142);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 802);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
                res = await this.candidateTopF.getTopCandidateWeight(candidateA);
                assert.equal(res, 133166);

                // CHECK B
                res = await this.candidateTopF.isCandidateInList(candidateB);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateB);
                assert.equal(res, 801);
                res = await this.candidateTopF.getTopCandidateWeight(candidateB);
                assert.equal(res, 133333);

                // CHECK C
                res = await this.candidateTopF.isCandidateInList(candidateC);
                assert.equal(res, true);
                res = await this.delegateSpaceVotingF.balanceOf(candidateC);
                assert.equal(res, 802);
                res = await this.candidateTopF.getTopCandidateWeight(candidateC);
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
      this.pggFactoryF = await deployPGGFactory(this.ggr, coreTeam);
      await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactoryF.address, true, { from: coreTeam });
      await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), this.spaceRA.address, false, { from: coreTeam });
      await this.acl.setRole(bytes32('SPACE_REPUTATION_NOTIFIER'), fakeSRA, true, { from: coreTeam });

      await this.galtToken.approve(this.pggFactoryF.address, ether(10), { from: bob });
      this.pggF = await buildPGG(this.pggFactoryF, [a1, a2, a3], 2, 3, 5, 60, ether(1000), 300000, {}, {}, bob);
      this.pggMultiSigF = this.pggF.multiSig;
      this.arbitratorStakeAccountingX = this.pggF.arbitratorStakeAccounting;
      this.delegateSpaceVotingF = this.pggF.delegateSpaceVoting;
      this.candidateTopF = this.pggF.candidateTop;

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
      let res = await this.pggMultiSigF.getArbitrators();
      assert.sameMembers(res, [a1, a2, a3]);

      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(5000), { from: alice });

      await this.arbitratorStakeAccountingX.stake(candidateC, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateB, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateF, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateA, ether(1000), { from: alice });
      await this.arbitratorStakeAccountingX.stake(candidateE, ether(1000), { from: alice });

      await this.candidateTopF.pushArbitrators();

      res = await this.pggMultiSigF.getArbitrators();
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
