const PlotManager = artifacts.require('./PlotManager.sol');
const PlotManagerLib = artifacts.require('./PlotManagerLib.sol');
const PlotManagerFeeCalculator = artifacts.require('./PlotManagerFeeCalculator.sol');
const PlotClarificationManager = artifacts.require('./PlotClarificationManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');

const Web3 = require('web3');
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  initHelperArtifacts,
  ether,
  assertEthBalanceChanged,
  assertEqualBN,
  assertRevert,
  numberToEvmWord,
  zeroAddress,
  deploySplitMergeMock,
  clearLibCache
} = require('../../helpers');
const { deployMultiSigFactory, buildArbitration } = require('../../deploymentHelpers');

const web3 = new Web3(PlotClarificationManager.web3.currentProvider);
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const bytes32 = utf8ToHex;
const NEW_APPLIPL_LAWYERION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const CLARIFIPL_LAWYERION_APPLIPL_LAWYERION = '0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7';
// const PUSHER_ROLE = 'clarification pusher';

// eslint-disable-next-line no-underscore-dangle
const _ES = bytes32('');
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');
const EVE = bytes32('Eve');

const PM_SURVEYOR = bytes32('PM_SURVEYOR_ORACLE_TYPE');
const PM_LAWYER = bytes32('PM_LAWYER_ORACLE_TYPE');
const PM_AUDITOR = bytes32('PM_AUDITOR_ORACLE_TYPE');
const PL_SURVEYOR = bytes32('PL_SURVEYOR_ORACLE_TYPE');
const PL_LAWYER = bytes32('PL_LAWYER_ORACLE_TYPE');
const PL_AUDITOR = bytes32('PL_AUDITOR_ORACLE_TYPE');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const ApplicationStatus = {
  NOT_EXISTS: 0,
  SUBMITTED: 1,
  APPROVED: 2,
  REVERTED: 3
};

const ValidationStatus = {
  NOT_EXISTS: 0,
  PENDING: 1,
  LOCKED: 2,
  APPROVED: 3,
  REVERTED: 4
};

const PaymentMethods = {
  NONE: 0,
  ETH_ONLY: 1,
  GALT_ONLY: 2,
  ETH_AND_GALT: 3
};

const Currency = {
  ETH: 0,
  GALT: 1
};

Object.freeze(ApplicationStatus);
Object.freeze(ValidationStatus);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

// eslint-disable-next-line
contract('PlotClarificationManager', (accounts) => {
  const [
    coreTeam,
    galtSpaceOrg,
    feeManager,
    feeMixer,
    stakesNotifier,
    minter,
    claimManagerAddress,
    spaceReputationAccountingAddress,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank
  ] = accounts;

  before(async function() {
    clearLibCache();

    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.newContourRaw = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.newContour = this.newContourRaw.map(galt.geohashToNumber);
    this.newHeights = this.newContour.map(() => ether(10));
    this.heights = [1, 2, 3];
    this.newLevel = 1;
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);
    this.description = 'test description';

    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });

    this.plotManagerLib = await PlotManagerLib.new({ from: coreTeam });
    PlotManager.link('PlotManagerLib', this.plotManagerLib.address);

    this.feeCalculator = await PlotManagerFeeCalculator.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.plotClarificationManager = await PlotClarificationManager.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });

    const deployment = await deploySplitMergeMock(this.ggr);
    this.splitMerge = deployment.splitMerge;
    this.geodesic = deployment.geodesic;

    await this.ggr.setContract(await this.ggr.MULTI_SIG_REGISTRY(), this.multiSigRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GEODESIC(), this.geodesic.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.ORACLES(), this.oracles.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.CLAIM_MANAGER(), claimManagerAddress, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_REPUTATION_ACCOUNTING(), spaceReputationAccountingAddress, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPLIT_MERGE(), this.splitMerge.address, { from: coreTeam });

    this.multiSigFactory = await deployMultiSigFactory(this.ggr, coreTeam);

    await this.galtToken.mint(alice, ether(100000000), { from: coreTeam });

    await this.galtToken.approve(this.multiSigFactory.address, ether(20), { from: alice });

    const applicationConfig = {};
    applicationConfig[bytes32('PL_MINIMAL_FEE_ETH')] = numberToEvmWord(ether(6));
    applicationConfig[bytes32('PL_MINIMAL_FEE_GALT')] = numberToEvmWord(ether(45));
    applicationConfig[bytes32('PL_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_AND_GALT);

    // [52, 47, 1],
    applicationConfig[await this.plotClarificationManager.getOracleTypeShareKey(PL_SURVEYOR)] = numberToEvmWord(50);
    applicationConfig[await this.plotClarificationManager.getOracleTypeShareKey(PL_LAWYER)] = numberToEvmWord(25);
    applicationConfig[await this.plotClarificationManager.getOracleTypeShareKey(PL_AUDITOR)] = numberToEvmWord(25);

    this.abX = await buildArbitration(
      this.multiSigFactory,
      [bob, charlie, dan, eve, frank],
      3,
      7,
      10,
      60,
      ether(1000),
      [30, 30, 30, 30, 30, 30],
      applicationConfig,
      alice
    );

    this.mX = this.abX.multiSig.address;
    this.abMultiSigX = this.abX.multiSig;
    this.abConfig = this.abX.config;
    this.oracleStakesAccountingX = this.abX.oracleStakeAccounting;
    this.abVotingX = this.abX.voting;

    await this.plotManager.initialize(this.ggr.address, feeMixer, {
      from: coreTeam
    });

    await this.spaceToken.addRoleTo(minter, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.oracles.addRoleTo(coreTeam, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(coreTeam, await this.oracles.ROLE_ORACLE_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(coreTeam, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(coreTeam, await this.oracles.ROLE_GALT_SHARE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(stakesNotifier, await this.oracles.ROLE_ORACLE_STAKES_NOTIFIER(), {
      from: coreTeam
    });

    await this.plotManager.addRoleTo(feeMixer, await this.plotManager.ROLE_GALT_SPACE(), {
      from: coreTeam
    });

    // TODO: remove after oracle active status check be implemented in multiSig-level
    await this.oracles.setApplicationTypeOracleTypes(
      NEW_APPLIPL_LAWYERION,
      [PM_SURVEYOR, PM_LAWYER, PM_AUDITOR],
      [50, 25, 25],
      [_ES, _ES, _ES],
      { from: coreTeam }
    );

    await this.oracles.setApplicationTypeOracleTypes(
      CLARIFIPL_LAWYERION_APPLIPL_LAWYERION,
      [PL_SURVEYOR, PL_LAWYER, PL_AUDITOR],
      [50, 25, 25],
      [_ES, _ES, _ES],
      { from: coreTeam }
    );

    await this.oracles.addOracle(this.abMultiSigX.address, bob, BOB, MN, '', [], [PM_SURVEYOR, PL_SURVEYOR], {
      from: coreTeam
    });
    await this.oracles.addOracle(this.abMultiSigX.address, charlie, CHARLIE, MN, '', [], [PM_LAWYER, PL_LAWYER], {
      from: coreTeam
    });
    await this.oracles.addOracle(this.abMultiSigX.address, dan, DAN, MN, '', [], [PM_LAWYER, PL_LAWYER], {
      from: coreTeam
    });
    await this.oracles.addOracle(this.abMultiSigX.address, eve, EVE, MN, '', [], [PM_AUDITOR, PL_AUDITOR], {
      from: coreTeam
    });

    await this.oracles.onOracleStakeChanged(bob, PM_SURVEYOR, ether(30), { from: stakesNotifier });
    await this.oracles.onOracleStakeChanged(charlie, PM_LAWYER, ether(30), { from: stakesNotifier });
    await this.oracles.onOracleStakeChanged(dan, PM_LAWYER, ether(30), { from: stakesNotifier });
    await this.oracles.onOracleStakeChanged(eve, PM_AUDITOR, ether(30), { from: stakesNotifier });
    await this.oracles.onOracleStakeChanged(bob, PL_SURVEYOR, ether(30), { from: stakesNotifier });
    await this.oracles.onOracleStakeChanged(charlie, PL_LAWYER, ether(30), { from: stakesNotifier });
    await this.oracles.onOracleStakeChanged(dan, PL_LAWYER, ether(30), { from: stakesNotifier });
    await this.oracles.onOracleStakeChanged(eve, PL_AUDITOR, ether(30), { from: stakesNotifier });
    await this.splitMerge.addRoleTo(this.plotManager.address, await this.splitMerge.GEO_DATA_MANAGER());
    await this.plotManager.addRoleTo(feeManager, await this.plotManager.ROLE_FEE_MANAGER(), {
      from: coreTeam
    });
  });

  beforeEach(async function() {
    this.plotClarificationManager = await PlotClarificationManager.new({ from: coreTeam });

    await this.plotClarificationManager.initialize(this.ggr.address, galtSpaceOrg, {
      from: coreTeam
    });
    await this.plotClarificationManager.addRoleTo(feeManager, await this.plotClarificationManager.ROLE_FEE_MANAGER(), {
      from: coreTeam
    });
    await this.plotClarificationManager.addRoleTo(galtSpaceOrg, await this.plotClarificationManager.ROLE_GALT_SPACE(), {
      from: coreTeam
    });

    await this.splitMerge.addRoleTo(this.plotClarificationManager.address, await this.splitMerge.GEO_DATA_MANAGER());
  });

  it('should be initialized successfully', async function() {
    assert.equal(await this.plotClarificationManager.ggr(), this.ggr.address);
  });

  describe('application pipeline for GALT', () => {
    beforeEach(async function() {
      let res = await this.spaceToken.mint(alice, { from: minter });
      this.spaceTokenId = res.logs[0].args.tokenId.toNumber();
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
      await this.spaceToken.approve(this.plotClarificationManager.address, this.spaceTokenId, { from: alice });
    });

    describe('#submitApplication()', () => {
      it('should allow an applicant pay commission and gas deposit in Galt', async function() {
        console.log('>>> Case 1');
        await this.galtToken.approve(this.plotClarificationManager.address, ether(45), { from: alice });
        let res = await this.plotClarificationManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          ether(45),
          {
            from: alice
          }
        );
        console.log('>>> Case 2');

        this.aId = res.logs[0].args.id;

        res = await this.plotClarificationManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications with payment less than required', async function() {
          await this.galtToken.approve(this.plotClarificationManager.address, ether(42), { from: alice });
          await assertRevert(
            this.plotClarificationManager.submitApplication(
              this.abMultiSigX.address,
              this.spaceTokenId,
              this.ledgerIdentifier,
              this.description,
              this.newContour,
              this.newHeights,
              this.newLevel,
              ether(42),
              {
                from: alice
              }
            )
          );
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          await this.galtToken.approve(this.plotClarificationManager.address, ether(47), { from: alice });
          let res = await this.plotClarificationManager.submitApplication(
            this.abMultiSigX.address,
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.description,
            this.newContour,
            this.newHeights,
            this.newLevel,
            ether(47),
            {
              from: alice
            }
          );
          this.aId = res.logs[0].args.id;

          // oracle share - 87%
          // galtspace share - 13%

          res = await this.plotClarificationManager.getApplicationById(this.aId);
          assert.equal(res.oraclesReward, '40890000000000000000');
          assert.equal(res.galtSpaceReward, '6110000000000000000');
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          await this.galtToken.approve(this.plotClarificationManager.address, ether(47), { from: alice });
          let res = await this.plotClarificationManager.submitApplication(
            this.abMultiSigX.address,
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.description,
            this.newContour,
            this.newHeights,
            this.newLevel,
            ether(47),
            {
              from: alice
            }
          );
          this.aId = res.logs[0].args.id;

          // oracle share - 87% (50%/25%/25%)
          // galtspace share - 13%

          res = await this.plotClarificationManager.getApplicationById(this.aId);
          assert.sameMembers(
            res.assignedOracleTypes.map(hexToUtf8),
            [PL_SURVEYOR, PL_LAWYER, PL_AUDITOR].map(hexToUtf8)
          );

          res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_AUDITOR);
          assert.equal(res.reward.toString(), '10222500000000000000');

          res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.reward.toString(), '10222500000000000000');

          res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.reward.toString(), '20445000000000000000');
        });
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.plotClarificationManager.address, ether(57), { from: alice });
        const res = await this.plotClarificationManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          ether(57),
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
      });

      describe('for approved applications', () => {
        beforeEach(async function() {
          await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
          await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
          await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
        });

        describe('after package token was withdrawn by user', () => {
          beforeEach(async function() {
            await this.plotClarificationManager.withdrawPackageToken(this.aId, { from: alice });
          });

          it('should be allowed', async function() {
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotClarificationManager.getApplicationById(this.aId);

            assert.equal(res.status, ApplicationStatus.APPROVED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_LAWYER);
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_AUDITOR);
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

            const res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.reward.toString(), '24795000000000000000');

            // bobs fee is (100 - 13) / 100 * 57 ether * 50%  = 24795000000000000000 wei

            assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('24795000000000000000')));
            assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('7410000000000000000')));
          });

          it('should revert on double claim', async function() {
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: dan }));
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: eve }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
          });

          // TODO: fix
          it.skip('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          // TODO: fix
          it.skip('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
          await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });
      });

      describe('for reverted applications', () => {
        beforeEach(async function() {
          await this.plotClarificationManager.revertApplication(this.aId, 'some reason', { from: bob });
        });

        describe('after package token was withdrawn by user', () => {
          beforeEach(async function() {
            await this.plotClarificationManager.withdrawPackageToken(this.aId, { from: alice });
          });

          it('should revert on claim without token been withdrawn', async function() {
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotClarificationManager.getApplicationById(this.aId);

            assert.equal(res.status, ApplicationStatus.REVERTED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_LAWYER);
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_AUDITOR);
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

            const res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.reward.toString(), '24795000000000000000');

            // bobs fee is (100 - 13) / 100 * 57 ether * 50%  = 24795000000000000000 wei

            assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('24795000000000000000')));
            assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('7410000000000000000')));
          });

          it('should revert on double claim', async function() {
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: dan }));
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: eve }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
          });

          // TODO: fix
          it.skip('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          // TODO: fix
          it.skip('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
          await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });
      });
    });
  });

  describe('application pipeline for ETH', () => {
    beforeEach(async function() {
      // Alice obtains a package token
      let res = await this.spaceToken.mint(alice, { from: minter });
      this.spaceTokenId = res.logs[0].args.tokenId.toNumber();
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
      await this.spaceToken.approve(this.plotClarificationManager.address, this.spaceTokenId, { from: alice });
    });

    describe('#submitApplication()', () => {
      it('should create a new application', async function() {
        let res = await this.plotClarificationManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(6)
          }
        );
        this.aId = res.logs[0].args.id;

        res = await this.spaceToken.ownerOf(this.spaceTokenId);
        assert.equal(res, this.plotClarificationManager.address);

        res = await this.plotClarificationManager.getApplicationById(this.aId);
        const res2 = await this.plotClarificationManager.getApplicationPayloadById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.spaceTokenId, this.spaceTokenId);
        assert.equal(res.applicant, alice);
        assert.equal(res.currency, Currency.ETH);
        assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
      });

      describe('payable', () => {
        it('should reject applications with payment which less than required', async function() {
          await assertRevert(
            this.plotClarificationManager.submitApplication(
              this.abMultiSigX.address,
              this.spaceTokenId,
              this.ledgerIdentifier,
              this.description,
              this.newContour,
              this.newHeights,
              this.newLevel,
              0,
              {
                from: alice,
                value: ether(1)
              }
            )
          );
        });

        it('should allow applications with payment greater than required', async function() {
          await this.plotClarificationManager.submitApplication(
            this.abMultiSigX.address,
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.description,
            this.newContour,
            this.newHeights,
            this.newLevel,
            0,
            {
              from: alice,
              value: ether(23)
            }
          );
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          let res = await this.plotClarificationManager.submitApplication(
            this.abMultiSigX.address,
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.description,
            this.newContour,
            this.newHeights,
            this.newLevel,
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          // oracle share - 67%
          // galtspace share - 33%

          res = await this.plotClarificationManager.getApplicationById(this.aId);
          assert.equal(res.galtSpaceReward, '2310000000000000000');
          assert.equal(res.oraclesReward, '4690000000000000000');
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          let res = await this.plotClarificationManager.submitApplication(
            this.abMultiSigX.address,
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.description,
            this.newContour,
            this.newHeights,
            this.newLevel,
            0,
            {
              from: alice,
              value: ether(13)
            }
          );
          this.aId = res.logs[0].args.id;
          // oracle share - 67% (50%/25%/25%)
          // galtspace share - 33%

          res = await this.plotClarificationManager.getApplicationById(this.aId);
          assert.sameMembers(
            res.assignedOracleTypes.map(hexToUtf8),
            [PL_LAWYER, PL_AUDITOR, PL_SURVEYOR].map(hexToUtf8)
          );

          res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.reward.toString(), '2177500000000000000');

          res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_AUDITOR);
          assert.equal(res.reward.toString(), '2177500000000000000');

          res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.reward.toString(), '4355000000000000000');
        });
      });
    });

    describe('#lockApplicationForReview()', () => {
      beforeEach(async function() {
        const res = await this.plotClarificationManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;
      });

      it('should allow multiple oracles of different roles to lock a submitted application', async function() {
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });

        let res = await this.plotClarificationManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_LAWYER);
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_AUDITOR);
        assert.equal(res.oracle, zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      // eslint-disable-next-line
      it('should deny a oracle with the same role to lock an application which is already on consideration', async function() {
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await assertRevert(
          this.plotClarificationManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: charlie })
        );
      });

      it('should deny non-oracle lock application', async function() {
        await assertRevert(
          this.plotClarificationManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: coreTeam })
        );
      });
    });

    describe('#approveApplication', () => {
      beforeEach(async function() {
        let res = await this.plotClarificationManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;

        res = await this.plotClarificationManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
      });

      it('should allow a oracle approve application', async function() {
        await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
        await this.plotClarificationManager.approveApplication(this.aId, { from: dan });

        let res = await this.plotClarificationManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotClarificationManager.approveApplication(this.aId, { from: eve });

        res = await this.plotClarificationManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      it('should deny non-oracle approve application', async function() {
        await assertRevert(this.plotClarificationManager.approveApplication(this.aId, { from: coreTeam }));
        const res = await this.plotClarificationManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      // eslint-disable-next-line
      it('should deny oracle whose role doesnt present in application type to approve application', async function() {
        await assertRevert(this.plotClarificationManager.approveApplication(this.aId, { from: charlie }));
      });

      // eslint-disable-next-line
      it('should deny oracle approve application with other than submitted', async function() {
        await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
        await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
        await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
        await assertRevert(this.plotClarificationManager.approveApplication(this.aId, { from: bob }));
      });
    });

    describe('#revertApplication', () => {
      beforeEach(async function() {
        let res = await this.plotClarificationManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;
        res = await this.plotClarificationManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('completely locked application', () => {
        beforeEach(async function() {
          await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
          await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });
          await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
        });

        it('should allow a oracle revert application', async function() {
          await this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob });

          let res = await this.plotClarificationManager.getApplicationById(this.aId);
          assert.equal(res.status, ApplicationStatus.REVERTED);

          res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.status, ValidationStatus.REVERTED);

          res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.status, ValidationStatus.LOCKED);

          res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_AUDITOR);
          assert.equal(res.status, ValidationStatus.LOCKED);
        });

        it('should deny non-oracle revert application', async function() {
          await assertRevert(this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: coreTeam }));
          const res = await this.plotClarificationManager.getApplicationById(this.aId);
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
        });

        // eslint-disable-next-line
        it('should deny oracle whose role doesnt present in application type to revret application', async function() {
          await assertRevert(this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: charlie }));
        });

        // eslint-disable-next-line
        it('should deny oracle reverted application with other than submitted', async function() {
          await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
          await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
          await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
          await assertRevert(this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob }));
        });
      });

      it('should deny revert partially locked application', async function() {
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await assertRevert(this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob }));
      });
    });

    describe('#resubmitApplication', () => {
      beforeEach(async function() {
        let res = await this.plotClarificationManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
        await this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob });

        res = await this.plotClarificationManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should allow an applicant resubmit application', async function() {
        await this.plotClarificationManager.resubmitApplication(this.aId, { from: alice });

        let res = await this.plotClarificationManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_LAWYER);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_AUDITOR);
        assert.equal(res.status, ValidationStatus.LOCKED);
      });

      it('should deny non-applicant resubmit application', async function() {
        await assertRevert(this.plotClarificationManager.resubmitApplication(this.aId, { from: bob }));

        const res = await this.plotClarificationManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });
    });

    describe('#withdrawPackageToken()', () => {
      beforeEach(async function() {
        const res = await this.plotClarificationManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });

        await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
        await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
        await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
      });

      it('should change status tokenWithdrawn flag to true', async function() {
        await this.plotClarificationManager.withdrawPackageToken(this.aId, { from: alice });

        const res = await this.plotClarificationManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
        assert.equal(res.tokenWithdrawn, true);
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        const res = await this.plotClarificationManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(6)
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
      });

      describe('for approved applications', () => {
        beforeEach(async function() {
          await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
          await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
          await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
        });

        describe('after package token was withdrawn by user', () => {
          beforeEach(async function() {
            await this.plotClarificationManager.withdrawPackageToken(this.aId, { from: alice });
          });

          it('should be allowed', async function() {
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotClarificationManager.getApplicationById(this.aId);

            assert.equal(res.status, ApplicationStatus.APPROVED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_LAWYER);
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_AUDITOR);
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
            const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
            const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
            const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
            const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
            const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
            const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            const res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.reward.toString(), '2010000000000000000');

            // eves fee is around (100 - 33) / 100 * 6 ether * 50%  = 1005000000000000000 wei

            assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(2.01));
            assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(1.005));
            assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(1.005));
            assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(1.98));
          });

          it('should revert on double claim', async function() {
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: dan }));
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: eve }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
          });

          // TODO: fix
          it.skip('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          // TODO: fix
          it.skip('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
          await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });
      });

      describe('for reverted applications', () => {
        beforeEach(async function() {
          await this.plotClarificationManager.revertApplication(this.aId, 'some reason', { from: bob });
        });

        describe('after package token was withdrawn by user', () => {
          beforeEach(async function() {
            await this.plotClarificationManager.withdrawPackageToken(this.aId, { from: alice });
          });

          it('should revert on claim without token been withdrawn', async function() {
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotClarificationManager.getApplicationById(this.aId);

            assert.equal(res.status, ApplicationStatus.REVERTED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_LAWYER);
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_AUDITOR);
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
            const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
            const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
            const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
            const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
            const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
            const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            const res = await this.plotClarificationManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.reward.toString(), '2010000000000000000');

            // eves fee is around (100 - 33) / 100 * 6 ether * 50%  = 1005000000000000000 wei
            // assume that the commission paid by bob isn't greater than 0.1 ether

            assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(2.01));
            assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(1.005));
            assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(1.005));
            assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(1.98));
          });

          it('should revert on double claim', async function() {
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimOracleReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: dan }));
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: eve }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
          });

          // TODO: fix
          it.skip('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          // TODO: fix
          it.skip('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
          await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });
      });
    });
  });
});
