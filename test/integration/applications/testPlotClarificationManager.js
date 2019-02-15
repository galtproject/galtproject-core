const PlotManager = artifacts.require('./PlotManager.sol');
const PlotManagerLib = artifacts.require('./PlotManagerLib.sol');
const PlotClarificationManager = artifacts.require('./PlotClarificationManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const Web3 = require('web3');
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  initHelperArtifacts,
  ether,
  assertEthBalanceChanged,
  assertEqualBN,
  assertRevert,
  zeroAddress,
  deploySplitMerge,
  clearLibCache
} = require('../../helpers');

const web3 = new Web3(PlotClarificationManager.web3.currentProvider);
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const bytes32 = utf8ToHex;
const NEW_APPLICATION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const CLARIFICATION_APPLICATION = '0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7';
// const PUSHER_ROLE = 'clarification pusher';

const FOO = bytes32('foo');
const BAR = bytes32('bar');
const BUZZ = bytes32('buzz');
// eslint-disable-next-line no-underscore-dangle
const _ES = bytes32('');
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');
const EVE = bytes32('Eve');
const DOG = bytes32('dog');
const CAT = bytes32('cat');
const HUMAN = bytes32('human');

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
  before(clearLibCache);
  const [
    coreTeam,
    galtSpaceOrg,
    multiSigX,
    feeManager,
    stakesNotifier,
    applicationTypeManager,
    oracleManager,
    alice,
    bob,
    charlie,
    dan,
    eve
  ] = accounts;

  beforeEach(async function() {
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

    this.plotManagerLib = await PlotManagerLib.new({ from: coreTeam });
    PlotManager.link('PlotManagerLib', this.plotManagerLib.address);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.plotClarificationManager = await PlotClarificationManager.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });

    this.splitMerge = await deploySplitMerge(this.spaceToken.address);

    await this.plotManager.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.oracles.address,
      this.galtToken.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.plotClarificationManager.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.oracles.address,
      this.galtToken.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.splitMerge.initialize(this.spaceToken.address, {
      from: coreTeam
    });

    await this.plotManager.addRoleTo(feeManager, await this.plotManager.ROLE_FEE_MANAGER(), {
      from: coreTeam
    });
    await this.plotClarificationManager.addRoleTo(feeManager, await this.plotClarificationManager.ROLE_FEE_MANAGER(), {
      from: coreTeam
    });
    await this.plotClarificationManager.addRoleTo(galtSpaceOrg, await this.plotClarificationManager.ROLE_GALT_SPACE(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(applicationTypeManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_STAKES_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(stakesNotifier, await this.oracles.ROLE_ORACLE_STAKES_NOTIFIER(), {
      from: coreTeam
    });

    await this.plotManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotManager.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.plotClarificationManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotClarificationManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotClarificationManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotClarificationManager.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.splitMerge.addRoleTo(this.plotManager.address, await this.splitMerge.GEO_DATA_MANAGER());
    await this.splitMerge.addRoleTo(this.plotClarificationManager.address, await this.splitMerge.GEO_DATA_MANAGER());

    await this.spaceToken.addRoleTo(this.plotManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.plotClarificationManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.oracles.addRoleTo(coreTeam, 'oracle_manager');
    await this.oracles.addRoleTo(coreTeam, 'application_type_manager');

    await this.oracles.setOracleTypeMinimalDeposit(FOO, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(BAR, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(BUZZ, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(HUMAN, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(DOG, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(CAT, ether(30), { from: applicationTypeManager });

    await this.galtToken.mint(alice, ether(100000000), { from: coreTeam });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.plotClarificationManagerWeb3 = new web3.eth.Contract(
      this.plotClarificationManager.abi,
      this.plotClarificationManager.address
    );
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
    this.galtTokenWeb3 = new web3.eth.Contract(this.galtToken.abi, this.galtToken.address);
  });

  it('should be initialized successfully', async function() {
    assert.equal(await this.plotClarificationManagerWeb3.methods.minimalApplicationFeeInEth().call(), ether(6));
  });

  describe('contract config modifiers', () => {
    describe('#setGaltSpaceRewardsAddress()', () => {
      it('should allow an  galt space oracle type set rewards address', async function() {
        await this.plotClarificationManager.setGaltSpaceRewardsAddress(bob, { from: galtSpaceOrg });
        // const res = await web3.eth.getStorageAt(this.plotClarificationManager.address, 5);
        // assert.equal(res, bob);
      });

      it('should deny non- galt space oracle type set rewards address', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceRewardsAddress(bob, { from: alice }));
      });
    });

    describe('#setPaymentMethod()', () => {
      it('should allow an owner set a payment method', async function() {
        await this.plotClarificationManager.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: feeManager });
        const res = await this.plotClarificationManager.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_ONLY);
      });

      it('should deny non-owner set a payment method', async function() {
        await assertRevert(this.plotClarificationManager.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: alice }));
        const res = await this.plotClarificationManager.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_AND_GALT);
      });
    });

    describe('#setApplicationFeeInEth()', () => {
      it('should allow an owner set a new minimum fee in ETH', async function() {
        await this.plotClarificationManager.setMinimalApplicationFeeInEth(ether(0.05), { from: feeManager });
        const res = await this.plotClarificationManager.minimalApplicationFeeInEth();
        assert.equal(res, ether(0.05));
      });

      it('should deny any other than owner person set fee in ETH', async function() {
        await assertRevert(this.plotClarificationManager.setMinimalApplicationFeeInEth(ether(0.05), { from: alice }));
      });
    });

    describe('#setApplicationFeeInGalt()', () => {
      it('should allow an owner set a new minimum fee in GALT', async function() {
        await this.plotClarificationManager.setMinimalApplicationFeeInGalt(ether(0.15), { from: feeManager });
        const res = await this.plotClarificationManager.minimalApplicationFeeInGalt();
        assert.equal(res, ether(0.15));
      });

      it('should deny any other than owner person set fee in GALT', async function() {
        await assertRevert(this.plotClarificationManager.setMinimalApplicationFeeInGalt(ether(0.15), { from: alice }));
      });
    });

    describe('#setGaltSpaceEthShare()', () => {
      it('should allow an owner set galtSpace ETH share in percents', async function() {
        await this.plotClarificationManager.setGaltSpaceEthShare('42', { from: feeManager });
        const res = await this.plotClarificationManager.galtSpaceEthShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space EHT share grater than 100 percents', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceEthShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceEthShare('20', { from: alice }));
      });
    });

    describe('#setGaltSpaceGaltShare()', () => {
      it('should allow an owner set galtSpace Galt share in percents', async function() {
        await this.plotClarificationManager.setGaltSpaceGaltShare('42', { from: feeManager });
        const res = await this.plotClarificationManager.galtSpaceGaltShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space Galt share grater than 100 percents', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceGaltShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceGaltShare('20', { from: alice }));
      });
    });
  });

  describe('application pipeline for GALT', () => {
    beforeEach(async function() {
      this.resNewAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        [FOO, BAR, BUZZ],
        [50, 25, 25],
        [_ES, _ES, _ES],
        { from: applicationTypeManager }
      );

      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        CLARIFICATION_APPLICATION,
        [HUMAN, DOG, CAT],
        [50, 25, 25],
        [_ES, _ES, _ES],
        { from: applicationTypeManager }
      );

      await this.oracles.addOracle(multiSigX, bob, BOB, MN, [], [HUMAN, FOO], { from: oracleManager });
      await this.oracles.addOracle(multiSigX, charlie, CHARLIE, MN, [], [BAR, HUMAN], { from: oracleManager });
      await this.oracles.addOracle(multiSigX, dan, DAN, MN, [], [CAT, BUZZ], { from: oracleManager });
      await this.oracles.addOracle(multiSigX, eve, EVE, MN, [], [DOG], { from: oracleManager });

      await this.oracles.onOracleStakeChanged(bob, HUMAN, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(bob, FOO, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(charlie, BAR, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(charlie, HUMAN, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(dan, CAT, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(dan, BUZZ, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(eve, DOG, ether(30), { from: stakesNotifier });

      const galts = await this.plotManager.getSubmissionFee(Currency.GALT, this.contour);
      await this.galtToken.approve(this.plotManager.address, galts, { from: alice });

      // Alice obtains a package token
      let res = await this.plotManager.submitApplication(
        this.contour,
        this.heights,
        0,
        this.credentials,
        this.ledgerIdentifier,
        galts,
        {
          from: alice
        }
      );
      this.aId = res.logs[0].args.id;

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.spaceTokenId = res.spaceTokenId;

      await this.plotManager.lockApplicationForReview(this.aId, FOO, { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, BAR, { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, BUZZ, { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      await this.plotManager.claimSpaceToken(this.aId, { from: alice });
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);

      await this.spaceToken.approve(this.plotClarificationManager.address, this.spaceTokenId, { from: alice });
    });

    describe('#submitApplication()', () => {
      it('should allow an applicant pay commission and gas deposit in Galt', async function() {
        await this.galtToken.approve(this.plotClarificationManager.address, ether(45), { from: alice });
        let res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.newContour,
          this.newHeights,
          this.newLevel,
          ether(45),
          {
            from: alice
          }
        );

        this.aId = res.logs[0].args.id;

        res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications with payment less than required', async function() {
          await this.galtToken.approve(this.plotClarificationManager.address, ether(42), { from: alice });
          await assertRevert(
            this.plotClarificationManager.submitApplication(
              this.spaceTokenId,
              this.ledgerIdentifier,
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
            this.spaceTokenId,
            this.ledgerIdentifier,
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

          res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.oraclesReward, '40890000000000000000');
          assert.equal(res.galtSpaceReward, '6110000000000000000');
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          const { aId } = this;
          await this.galtToken.approve(this.plotClarificationManager.address, ether(47), { from: alice });
          let res = await this.plotClarificationManager.submitApplication(
            this.spaceTokenId,
            this.ledgerIdentifier,
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

          res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(res.assignedOracleTypes.map(hexToUtf8), [CAT, DOG, HUMAN].map(hexToUtf8));

          res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(aId, CAT).call();
          assert.equal(res.reward.toString(), '10222500000000000000');

          res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(aId, DOG).call();
          assert.equal(res.reward.toString(), '10222500000000000000');

          res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(aId, HUMAN).call();
          assert.equal(res.reward.toString(), '20445000000000000000');
        });
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.plotClarificationManager.address, ether(57), { from: alice });
        const res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.newContour,
          this.newHeights,
          this.newLevel,
          ether(57),
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotClarificationManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, DOG, { from: eve });
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

            let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

            assert.equal(res.status, ApplicationStatus.APPROVED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
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

            const res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
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

          it('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          it('should revert on applicant claim attempt', async function() {
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

            let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

            assert.equal(res.status, ApplicationStatus.REVERTED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
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

            const res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
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

          it('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          it('should revert on applicant claim attempt', async function() {
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
      this.resNewAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        NEW_APPLICATION,
        [FOO, BAR, BUZZ],
        [50, 25, 25],
        [_ES, _ES, _ES],
        { from: applicationTypeManager }
      );

      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        CLARIFICATION_APPLICATION,
        [HUMAN, DOG, CAT],
        [50, 25, 25],
        [_ES, _ES, _ES],
        { from: applicationTypeManager }
      );

      await this.oracles.addOracle(multiSigX, bob, BOB, MN, [], [HUMAN, FOO], { from: oracleManager });
      await this.oracles.addOracle(multiSigX, charlie, CHARLIE, MN, [], [BAR], { from: oracleManager });
      await this.oracles.addOracle(multiSigX, dan, DAN, MN, [], [CAT, BUZZ], { from: oracleManager });
      await this.oracles.addOracle(multiSigX, eve, EVE, MN, [], [DOG], { from: oracleManager });

      await this.oracles.onOracleStakeChanged(bob, HUMAN, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(bob, FOO, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(charlie, BAR, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(dan, CAT, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(dan, BUZZ, ether(30), { from: stakesNotifier });
      await this.oracles.onOracleStakeChanged(eve, DOG, ether(30), { from: stakesNotifier });

      const eths = await this.plotManager.getSubmissionFee(Currency.ETH, this.contour);

      // Alice obtains a package token
      let res = await this.plotManager.submitApplication(
        this.contour,
        this.heights,
        0,
        this.credentials,
        this.ledgerIdentifier,
        0,
        {
          from: alice,
          value: eths
        }
      );
      this.aId = res.logs[0].args.id;

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.spaceTokenId = res.spaceTokenId;

      await this.plotManager.lockApplicationForReview(this.aId, FOO, { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, BAR, { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, BUZZ, { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      await this.plotManager.claimSpaceToken(this.aId, { from: alice });
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);

      await this.spaceToken.approve(this.plotClarificationManager.address, this.spaceTokenId, { from: alice });
    });

    describe('#submitApplication()', () => {
      it('should create a new application', async function() {
        let res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
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

        res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        const res2 = await this.plotClarificationManagerWeb3.methods.getApplicationPayloadById(this.aId).call();
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
              this.spaceTokenId,
              this.ledgerIdentifier,
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
            this.spaceTokenId,
            this.ledgerIdentifier,
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
            this.spaceTokenId,
            this.ledgerIdentifier,
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

          res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.galtSpaceReward, '2310000000000000000');
          assert.equal(res.oraclesReward, '4690000000000000000');
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          let res = await this.plotClarificationManager.submitApplication(
            this.spaceTokenId,
            this.ledgerIdentifier,
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

          res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(res.assignedOracleTypes.map(hexToUtf8), [CAT, DOG, HUMAN].map(hexToUtf8));

          res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
          assert.equal(res.reward.toString(), '2177500000000000000');

          res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
          assert.equal(res.reward.toString(), '2177500000000000000');

          res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
          assert.equal(res.reward.toString(), '4355000000000000000');
        });
      });
    });

    describe('#lockApplicationForReview()', () => {
      beforeEach(async function() {
        const res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
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
        await this.plotClarificationManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, CAT, { from: dan });

        let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
        assert.equal(res.oracle, zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      // eslint-disable-next-line
      it('should deny a oracle with the same role to lock an application which is already on consideration', async function() {
        await this.plotClarificationManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await assertRevert(this.plotClarificationManager.lockApplicationForReview(this.aId, HUMAN, { from: charlie }));
      });

      it('should deny non-oracle lock application', async function() {
        await assertRevert(this.plotClarificationManager.lockApplicationForReview(this.aId, HUMAN, { from: coreTeam }));
      });
    });

    describe('#approveApplication', () => {
      beforeEach(async function() {
        let res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
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

        res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotClarificationManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, DOG, { from: eve });
      });

      it('should allow a oracle approve application', async function() {
        await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
        await this.plotClarificationManager.approveApplication(this.aId, { from: dan });

        let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotClarificationManager.approveApplication(this.aId, { from: eve });

        res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      it('should deny non-oracle approve application', async function() {
        await assertRevert(this.plotClarificationManager.approveApplication(this.aId, { from: coreTeam }));
        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
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
          this.spaceTokenId,
          this.ledgerIdentifier,
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
        res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('completely locked application', () => {
        beforeEach(async function() {
          await this.plotClarificationManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
          await this.plotClarificationManager.lockApplicationForReview(this.aId, CAT, { from: dan });
          await this.plotClarificationManager.lockApplicationForReview(this.aId, DOG, { from: eve });
        });

        it('should allow a oracle revert application', async function() {
          await this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob });

          let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.REVERTED);

          res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
          assert.equal(res.status, ValidationStatus.REVERTED);

          res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
          assert.equal(res.status, ValidationStatus.LOCKED);

          res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
          assert.equal(res.status, ValidationStatus.LOCKED);
        });

        it('should deny non-oracle revert application', async function() {
          await assertRevert(this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: coreTeam }));
          const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
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
        await this.plotClarificationManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await assertRevert(this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob }));
      });
    });

    describe('#resubmitApplication', () => {
      beforeEach(async function() {
        let res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
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
        await this.plotClarificationManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, DOG, { from: eve });
        await this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob });

        res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should allow an applicant resubmit application', async function() {
        await this.plotClarificationManager.resubmitApplication(this.aId, { from: alice });

        let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
        assert.equal(res.status, ValidationStatus.LOCKED);
      });

      it('should deny non-applicant resubmit application', async function() {
        await assertRevert(this.plotClarificationManager.resubmitApplication(this.aId, { from: bob }));

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });
    });

    describe('#withdrawPackageToken()', () => {
      beforeEach(async function() {
        const res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
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
        await this.plotClarificationManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, DOG, { from: eve });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, CAT, { from: dan });

        await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
        await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
        await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
      });

      it('should change status tokenWithdrawn flag to true', async function() {
        await this.plotClarificationManager.withdrawPackageToken(this.aId, { from: alice });

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);
        assert.equal(res.tokenWithdrawn, true);
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        const res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
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
        await this.plotClarificationManager.lockApplicationForReview(this.aId, HUMAN, { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, CAT, { from: dan });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, DOG, { from: eve });
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

            let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

            assert.equal(res.status, ApplicationStatus.APPROVED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
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

            const res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
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

          it('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          it('should revert on applicant claim attempt', async function() {
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

            let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

            assert.equal(res.status, ApplicationStatus.REVERTED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, CAT).call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, DOG).call();
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

            const res = await this.plotClarificationManagerWeb3.methods.getApplicationOracle(this.aId, HUMAN).call();
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

          it('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotClarificationManager.claimOracleReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          it('should revert on applicant claim attempt', async function() {
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
