const PlotManager = artifacts.require('./PlotManager.sol');
const PlotClarificationManager = artifacts.require('./PlotClarificationManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Validators = artifacts.require('./Validators.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const { ether, assertEqualBN, assertRevert, zeroAddress } = require('../helpers');

const web3 = new Web3(PlotClarificationManager.web3.currentProvider);
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const NEW_APPLICATION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const CLARIFICATION_APPLICATION = '0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7';
const PUSHER_ROLE = 'clarification pusher';

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

const ApplicationStatus = {
  NOT_EXISTS: 0,
  NEW: 1,
  VALUATION_REQUIRED: 2,
  VALUATION: 3,
  PAYMENT_REQUIRED: 4,
  SUBMITTED: 5,
  APPROVED: 6,
  REVERTED: 7,
  PACKED: 8
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
contract('PlotClarificationManager', ([coreTeam, galtSpaceOrg, feeManager, alice, bob, charlie, dan, eve]) => {
  beforeEach(async function() {
    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.validators = await Validators.new({ from: coreTeam });
    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.plotClarificationManager = await PlotClarificationManager.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.splitMerge = await SplitMerge.new({ from: coreTeam });

    await this.spaceToken.initialize('SpaceToken', 'SPACE', { from: coreTeam });
    await this.plotManager.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.validators.address,
      this.galtToken.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.plotClarificationManager.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.validators.address,
      this.galtToken.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.splitMerge.initialize(this.spaceToken.address, this.plotManager.address, {
      from: coreTeam
    });
    await this.plotManager.setFeeManager(feeManager, true, { from: coreTeam });

    await this.plotManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotManager.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.plotClarificationManager.setMinimalApplicationFeeInEth(ether(6));
    await this.plotClarificationManager.setMinimalApplicationFeeInGalt(ether(45));
    await this.plotClarificationManager.setGaltSpaceEthShare(33);
    await this.plotClarificationManager.setGaltSpaceGaltShare(13);

    await this.spaceToken.addRoleTo(this.plotManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.plotClarificationManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.galtToken.mint(alice, ether(10000), { from: coreTeam });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.plotClarificationManagerWeb3 = new web3.eth.Contract(
      this.plotClarificationManager.abi,
      this.plotClarificationManager.address
    );
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
    this.galtTokenWeb3 = new web3.eth.Contract(this.galtToken.abi, this.galtToken.address);
  });

  it('should be initialized successfully', async function() {
    (await this.plotClarificationManager.minimalApplicationFeeInEth()).toString(10).should.be.a.bignumber.eq(ether(6));
  });

  describe('contract config modifiers', () => {
    describe('#setGaltSpaceRewardsAddress()', () => {
      it('should allow an owner set rewards address', async function() {
        await this.plotClarificationManager.setGaltSpaceRewardsAddress(bob, { from: coreTeam });
        // const res = await web3.eth.getStorageAt(this.plotClarificationManager.address, 5);
        // assert.equal(res, bob);
      });

      it('should deny non-owner set rewards address', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceRewardsAddress(bob, { from: alice }));
      });
    });

    describe('#setPaymentMethod()', () => {
      it('should allow an owner set a payment method', async function() {
        await this.plotClarificationManager.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: coreTeam });
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
        await this.plotClarificationManager.setMinimalApplicationFeeInEth(ether(0.05), { from: coreTeam });
        const res = await this.plotClarificationManager.minimalApplicationFeeInEth();
        assert.equal(res, ether(0.05));
      });

      it('should deny any other than owner person set fee in ETH', async function() {
        await assertRevert(this.plotClarificationManager.setMinimalApplicationFeeInEth(ether(0.05), { from: alice }));
      });
    });

    describe('#setApplicationFeeInGalt()', () => {
      it('should allow an owner set a new minimum fee in GALT', async function() {
        await this.plotClarificationManager.setMinimalApplicationFeeInGalt(ether(0.15), { from: coreTeam });
        const res = await this.plotClarificationManager.minimalApplicationFeeInGalt();
        assert.equal(res, ether(0.15));
      });

      it('should deny any other than owner person set fee in GALT', async function() {
        await assertRevert(this.plotClarificationManager.setMinimalApplicationFeeInGalt(ether(0.15), { from: alice }));
      });
    });

    describe('#setGaltSpaceEthShare()', () => {
      it('should allow an owner set galtSpace ETH share in percents', async function() {
        await this.plotClarificationManager.setGaltSpaceEthShare('42', { from: coreTeam });
        const res = await this.plotClarificationManager.galtSpaceEthShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space EHT share less than 1 percent', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceEthShare('0.5', { from: coreTeam }));
      });

      it('should deny owner set Galt Space EHT share grater than 100 percents', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceEthShare('101', { from: coreTeam }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceEthShare('20', { from: alice }));
      });
    });

    describe('#setGaltSpaceGaltShare()', () => {
      it('should allow an owner set galtSpace Galt share in percents', async function() {
        await this.plotClarificationManager.setGaltSpaceGaltShare('42', { from: coreTeam });
        const res = await this.plotClarificationManager.galtSpaceGaltShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space Galt share less than 1 percent', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceGaltShare('0.5', { from: coreTeam }));
      });

      it('should deny owner set Galt Space Galt share grater than 100 percents', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceGaltShare('101', { from: coreTeam }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceGaltShare('20', { from: alice }));
      });
    });
  });

  describe('application pipeline for GALT', () => {
    beforeEach(async function() {
      this.resNewAddRoles = await this.validators.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['foo', 'bar', 'buzz'],
        [50, 25, 25],
        ['', '', ''],
        { from: coreTeam }
      );

      this.resClarificationAddRoles = await this.validators.setApplicationTypeRoles(
        CLARIFICATION_APPLICATION,
        ['human', 'dog', PUSHER_ROLE],
        [50, 25, 25],
        ['', '', ''],
        { from: coreTeam }
      );
      // Alice obtains a package token
      let res = await this.plotManager.applyForPlotOwnership(
        this.contour,
        galt.geohashToGeohash5('sezu06'),
        this.credentials,
        this.ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        7,
        0,
        { from: alice, value: ether(6) }
      );
      this.aId = res.logs[0].args.id;

      await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.packageTokenId = res.packageTokenId;
      const gasPrice = await this.plotManagerWeb3.methods.gasPriceForDeposits().call();
      this.deposit = new BN(res.gasDepositEstimation.toString()).mul(new BN(gasPrice.toString())).toString(10);

      await this.validators.addValidator(bob, 'Bob', 'MN', [], ['human', 'foo'], { from: coreTeam });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['bar', 'human'], { from: coreTeam });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], [PUSHER_ROLE, 'buzz'], { from: coreTeam });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], ['dog'], { from: coreTeam });

      await this.plotManager.submitApplication(this.aId, { from: alice, value: this.deposit });
      await this.plotManager.lockApplicationForReview(this.aId, 'foo', { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, 'bar', { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, 'buzz', { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      res = await this.spaceToken.ownerOf(this.packageTokenId);
      assert.equal(res, alice);

      await this.spaceToken.approve(this.plotClarificationManager.address, this.packageTokenId, { from: alice });
      res = await this.plotClarificationManager.applyForPlotClarification(
        this.packageTokenId,
        this.ledgerIdentifier,
        8,
        { from: alice }
      );
      this.aId = res.logs[0].args.id;
    });

    describe('#submitApplicationForReview()', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
      });

      it('should allow an applicant pay commission and gas deposit in Galt', async function() {
        await this.galtToken.approve(this.plotClarificationManager.address, ether(45), { from: alice });
        await this.plotClarificationManager.submitApplicationForReview(this.aId, ether(45), {
          from: alice,
          value: ether(7)
        });

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.gasDeposit, ether(7));
      });

      describe('payable', () => {
        it('should reject applications without neither payment nor gas deposit', async function() {
          await this.galtToken.approve(this.plotClarificationManager.address, ether(45), { from: alice });
          await assertRevert(
            this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
              from: alice
            })
          );
        });

        it('should reject applications with gas deposit which less than required', async function() {
          await this.galtToken.approve(this.plotClarificationManager.address, ether(45), { from: alice });
          await assertRevert(
            this.plotClarificationManager.submitApplicationForReview(this.aId, ether(45), {
              from: alice,
              value: ether(6)
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await this.galtToken.approve(this.plotClarificationManager.address, ether(45), { from: alice });
          await assertRevert(
            this.plotClarificationManager.submitApplicationForReview(this.aId, ether(43), {
              from: alice,
              value: ether(7)
            })
          );
        });

        it('should reject applications with gas deposit greater than required', async function() {
          await this.galtToken.approve(this.plotClarificationManager.address, ether(47), { from: alice });
          await assertRevert(
            this.plotClarificationManager.submitApplicationForReview(this.aId, ether(47), {
              from: alice,
              value: ether(8)
            })
          );
        });

        it('should calculate corresponding validator and galtspace rewards', async function() {
          await this.galtToken.approve(this.plotClarificationManager.address, ether(47), { from: alice });
          await this.plotClarificationManager.submitApplicationForReview(this.aId, ether(47), {
            from: alice,
            value: ether(7)
          });

          // validator share - 87%
          // galtspace share - 13%

          const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.validatorsReward, '40890000000000000000');
          assert.equal(res.galtSpaceReward, '6110000000000000000');
        });

        it('should calculate validator rewards according to their roles share', async function() {
          const { aId } = this;
          await this.galtToken.approve(this.plotClarificationManager.address, ether(47), { from: alice });
          await this.plotClarificationManager.submitApplicationForReview(this.aId, ether(47), {
            from: alice,
            value: ether(7)
          });

          // validator share - 87% (50%/25%/25%)
          // galtspace share - 13%

          let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(res.assignedValidatorRoles.map(hexToUtf8), ['clarification pusher', 'dog', 'human']);

          res = await this.plotClarificationManagerWeb3.methods
            .getApplicationValidator(aId, utf8ToHex('clarification pusher'))
            .call();
          assert.equal(res.reward.toString(), '10222500000000000000');

          res = await this.plotClarificationManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('dog')).call();
          assert.equal(res.reward.toString(), '10222500000000000000');

          res = await this.plotClarificationManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('human')).call();
          assert.equal(res.reward.toString(), '20445000000000000000');
        });
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
        await this.galtToken.approve(this.plotClarificationManager.address, ether(57), { from: alice });
        await this.plotClarificationManager.submitApplicationForReview(this.aId, ether(57), {
          from: alice,
          value: ether(7)
        });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
      });

      describe('for approved applications', () => {
        beforeEach(async function() {
          await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
          await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
          await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
          await this.plotClarificationManager.applicationPackingCompleted(this.aId, { from: dan });
        });

        describe('after package token was withdrawn by user', () => {
          beforeEach(async function() {
            await this.plotClarificationManager.withdrawPackageToken(this.aId, { from: alice });
          });

          it('should be allowed', async function() {
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

            assert.equal(res.status, ApplicationStatus.PACKED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('human'))
              .call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex(PUSHER_ROLE))
              .call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('dog'))
              .call();
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

            const res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('human'))
              .call();
            assert.equal(res.reward.toString(), '24795000000000000000');

            // bobs fee is (100 - 13) / 100 * 57 ether * 50%  = 24795000000000000000 wei

            assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('24795000000000000000')));
            assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('7410000000000000000')));
          });

          it('should revert on double claim', async function() {
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob }));
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan }));
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
          });

          it('should revert on non-validator claim', async function() {
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          it('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
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
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

            assert.equal(res.status, ApplicationStatus.REVERTED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('human'))
              .call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex(PUSHER_ROLE))
              .call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('dog'))
              .call();
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

            const res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('human'))
              .call();
            assert.equal(res.reward.toString(), '24795000000000000000');

            // bobs fee is (100 - 13) / 100 * 57 ether * 50%  = 24795000000000000000 wei

            assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('24795000000000000000')));
            assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('7410000000000000000')));
          });

          it('should revert on double claim', async function() {
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob }));
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan }));
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
          });

          it('should revert on non-validator claim', async function() {
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          it('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
          await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });
      });
    });
  });

  describe('application pipeline for ETH', () => {
    beforeEach(async function() {
      this.resNewAddRoles = await this.validators.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['foo', 'bar', 'buzz'],
        [50, 25, 25],
        ['', '', ''],
        { from: coreTeam }
      );

      this.resClarificationAddRoles = await this.validators.setApplicationTypeRoles(
        CLARIFICATION_APPLICATION,
        ['human', 'dog', PUSHER_ROLE],
        [50, 25, 25],
        ['', '', ''],
        { from: coreTeam }
      );
      // Alice obtains a package token
      let res = await this.plotManager.applyForPlotOwnership(
        this.contour,
        galt.geohashToGeohash5('sezu06'),
        this.credentials,
        this.ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        7,
        0,
        { from: alice, value: ether(6) }
      );
      this.aId = res.logs[0].args.id;

      await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.packageTokenId = res.packageTokenId;
      const gasPrice = await this.plotManagerWeb3.methods.gasPriceForDeposits().call();
      this.deposit = new BN(res.gasDepositEstimation.toString()).mul(new BN(gasPrice.toString())).toString(10);

      await this.validators.addValidator(bob, 'Bob', 'MN', [], ['human', 'foo'], { from: coreTeam });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['bar'], { from: coreTeam });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], [PUSHER_ROLE, 'buzz'], { from: coreTeam });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], ['dog'], { from: coreTeam });

      await this.plotManager.submitApplication(this.aId, { from: alice, value: this.deposit });
      await this.plotManager.lockApplicationForReview(this.aId, 'foo', { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, 'bar', { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, 'buzz', { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      res = await this.spaceToken.ownerOf(this.packageTokenId);
      assert.equal(res, alice);

      await this.spaceToken.approve(this.plotClarificationManager.address, this.packageTokenId, { from: alice });
      res = await this.plotClarificationManager.applyForPlotClarification(
        this.packageTokenId,
        this.ledgerIdentifier,
        8,
        { from: alice }
      );
      this.aId = res.logs[0].args.id;
    });

    describe('#applyForPlotClarification()', () => {
      it('should create a new application', async function() {
        let res = await this.spaceToken.ownerOf(this.packageTokenId);
        assert.equal(res, this.plotClarificationManager.address);

        res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        const res2 = await this.plotClarificationManagerWeb3.methods.getApplicationPayloadById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.NEW);
        assert.equal(res.packageTokenId, this.packageTokenId);
        assert.equal(res.applicant.toLowerCase(), alice);
        assert.equal(res.currency, Currency.ETH);
        assert.equal(res2.precision, 8);
        assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
      });
    });

    describe('#submitApplicationForValudation()', () => {
      it('should allow an applicant to submit application for valuation', async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.VALUATION_REQUIRED);
      });

      it('should deny other account to submit application for valuation', async function() {
        await assertRevert(this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: coreTeam }));
      });

      it('should deny submition for already submitted applications ', async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await assertRevert(this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice }));
      });
    });

    describe('#lockApplicationForValuation()', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
      });

      it('should allow validator with role clarification pusher to lock an application', async function() {
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.VALUATION);
      });

      it('should deny other account lock an application', async function() {
        await assertRevert(this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: alice }));
      });

      it('should deny locking for already locked applications ', async function() {
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await assertRevert(this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan }));
      });
    });

    describe('#valuateGasDeposit()', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
      });

      it('should allow validator with role clarification pusher to valuate an application', async function() {
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(42), { from: dan });

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.PAYMENT_REQUIRED);
        assert.equal(res.gasDeposit, ether(42));
      });

      it('should deny other account valuate an application', async function() {
        await assertRevert(this.plotClarificationManager.valuateGasDeposit(this.aId, ether(42), { from: alice }));
      });

      it('should deny valudation for already valued applications ', async function() {
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(42), { from: dan });
        await assertRevert(this.plotClarificationManager.valuateGasDeposit(this.aId, ether(42), { from: dan }));
      });
    });

    describe('#submitApplicationForReview()', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
      });

      it('should allow an applicant pay commission and gas deposit in ETH', async function() {
        await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
          from: alice,
          value: ether(6 + 7)
        });

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.gasDeposit, ether(7));
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(
            this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await assertRevert(
            this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
              from: alice,
              value: 10
            })
          );
        });
        it('should allow pplications with payment greater than required', async function() {
          await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
            from: alice,
            value: ether(23)
          });
        });

        it('should calculate corresponding validator and galtspace rewards', async function() {
          await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
            from: alice,
            value: ether(14)
          });
          // validator share - 67%
          // galtspace share - 33%

          const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.galtSpaceReward, '2310000000000000000');
          assert.equal(res.validatorsReward, '4690000000000000000');
        });

        it('should calculate validator rewards according to their roles share', async function() {
          const { aId } = this;
          await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
            from: alice,
            value: ether(13)
          });
          // validator share - 67%
          // galtspace share - 33% (50%/25%/25%);

          let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(res.assignedValidatorRoles.map(hexToUtf8), ['clarification pusher', 'dog', 'human']);

          res = await this.plotClarificationManagerWeb3.methods
            .getApplicationValidator(aId, utf8ToHex('clarification pusher'))
            .call();
          assert.equal(res.reward.toString(), '1005000000000000000');

          res = await this.plotClarificationManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('dog')).call();
          assert.equal(res.reward.toString(), '1005000000000000000');

          res = await this.plotClarificationManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('human')).call();
          assert.equal(res.reward.toString(), '2010000000000000000');
        });
      });
    });

    describe('#lockApplicationForReview()', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
        await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
          from: alice,
          value: ether(6 + 7)
        });
      });

      it('should allow multiple validators of different roles to lock a submitted application', async function() {
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });

        let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotClarificationManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex('human'))
          .call();
        assert.equal(res.validator.toLowerCase(), bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex(PUSHER_ROLE))
          .call();
        assert.equal(res.validator.toLowerCase(), dan);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex('dog'))
          .call();
        assert.equal(res.validator.toLowerCase(), zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      // eslint-disable-next-line
      it('should deny a validator with the same role to lock an application which is already on consideration', async function() {
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await assertRevert(
          this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: charlie })
        );
      });

      it('should deny non-validator lock application', async function() {
        await assertRevert(
          this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: coreTeam })
        );
      });
    });

    describe('#approveApplication', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
        await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
          from: alice,
          value: ether(6 + 7)
        });

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
      });

      it('should allow a validator approve application', async function() {
        await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
        await this.plotClarificationManager.approveApplication(this.aId, { from: dan });

        let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotClarificationManager.approveApplication(this.aId, { from: eve });

        res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      it('should deny non-validator approve application', async function() {
        await assertRevert(this.plotClarificationManager.approveApplication(this.aId, { from: coreTeam }));
        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      // eslint-disable-next-line
      it('should deny validator whose role doesnt present in application type to approve application', async function() {
        await assertRevert(this.plotClarificationManager.approveApplication(this.aId, { from: charlie }));
      });

      // eslint-disable-next-line
      it('should deny validator approve application with other than submitted', async function() {
        await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
        await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
        await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
        await assertRevert(this.plotClarificationManager.approveApplication(this.aId, { from: bob }));
      });
    });

    describe('#revertApplication', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
        await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
          from: alice,
          value: ether(6 + 7)
        });

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('completely locked application', () => {
        beforeEach(async function() {
          await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
          await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        });

        it('should allow a validator revert application', async function() {
          await this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob });

          let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.REVERTED);

          res = await this.plotClarificationManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex('human'))
            .call();
          assert.equal(res.status, ValidationStatus.REVERTED);

          res = await this.plotClarificationManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PUSHER_ROLE))
            .call();
          assert.equal(res.status, ValidationStatus.LOCKED);

          res = await this.plotClarificationManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex('dog'))
            .call();
          assert.equal(res.status, ValidationStatus.LOCKED);
        });

        it('should deny non-validator revert application', async function() {
          await assertRevert(this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: coreTeam }));
          const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
        });

        // eslint-disable-next-line
        it('should deny validator whose role doesnt present in application type to revret application', async function() {
          await assertRevert(this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: charlie }));
        });

        // eslint-disable-next-line
        it('should deny validator reverted application with other than submitted', async function() {
          await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
          await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
          await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
          await assertRevert(this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob }));
        });
      });

      it('should deny revert partially locked application', async function() {
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await assertRevert(this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob }));
      });
    });

    describe('#resubmitApplication', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
        await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
          from: alice,
          value: ether(6 + 7)
        });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        await this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob });

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should allow an applicant resubmit application', async function() {
        await this.plotClarificationManager.resubmitApplication(this.aId, { from: alice });

        let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotClarificationManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex('human'))
          .call();
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex(PUSHER_ROLE))
          .call();
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex('dog'))
          .call();
        assert.equal(res.status, ValidationStatus.LOCKED);
      });

      it('should deny non-applicant resubmit application', async function() {
        await assertRevert(this.plotClarificationManager.resubmitApplication(this.aId, { from: bob }));

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });
    });

    describe('#addGeohashesToApplication()', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
        await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
          from: alice,
          value: ether(6 + 7)
        });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
        await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
        await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes += ` gbsuv7zq gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
        this.geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);
      });

      it('should allow pusher role add geohashes to package', async function() {
        let res = await this.plotClarificationManager.addGeohashesToApplication(this.aId, this.geohashes, [], [], {
          from: dan
        });
        res = await this.splitMerge.getPackageGeohashesCount(this.packageTokenId);
        assert.equal(res.toString(10), '18');
      });

      it('should deny non-pusher add geohashes to package', async function() {
        await assertRevert(
          this.plotClarificationManager.addGeohashesToApplication(this.aId, this.geohashes, [], [], {
            from: eve
          })
        );
      });
    });

    describe('#applicationPackingCompleted()', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
        await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
          from: alice,
          value: ether(6 + 7)
        });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
        await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
        await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
      });

      it('should allow pusher notify the applicant that packing process completed', async function() {
        await this.plotClarificationManager.applicationPackingCompleted(this.aId, { from: dan });

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.PACKED);
      });

      it('should deny non pusher invoke this method', async function() {
        await assertRevert(this.plotClarificationManager.applicationPackingCompleted(this.aId, { from: eve }));
      });

      it('should deny locking for already locked applications ', async function() {
        await this.plotClarificationManager.applicationPackingCompleted(this.aId, { from: dan });
        await assertRevert(this.plotClarificationManager.applicationPackingCompleted(this.aId, { from: dan }));
      });
    });

    describe('#withdrawPackageToken()', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
        await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
          from: alice,
          value: ether(6 + 7)
        });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
        await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
        await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
        await this.plotClarificationManager.applicationPackingCompleted(this.aId, { from: dan });
      });

      it('should change status tokenWithdrawn flag to true', async function() {
        await this.plotClarificationManager.withdrawPackageToken(this.aId, { from: alice });

        const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.PACKED);
        assert.equal(res.tokenWithdrawn, true);
      });
    });

    describe('claim gas deposit', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
        await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
          from: alice,
          value: ether(6 + 7)
        });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
      });

      describe('for approved applications', () => {
        beforeEach(async function() {
          await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
          await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
          await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
          await this.plotClarificationManager.applicationPackingCompleted(this.aId, { from: dan });
          await this.plotClarificationManager.withdrawPackageToken(this.aId, { from: alice });
        });

        it('should be allowed to claim after token been withdrawn', async function() {
          await this.plotClarificationManager.claimGasDepositAsValidator(this.aId, { from: dan });

          const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.PACKED);
          assert.equal(res.tokenWithdrawn, true);
          assert.equal(res.gasDepositWithdrawn, true);
        });

        it('should revert on double claim', async function() {
          await this.plotClarificationManager.claimGasDepositAsValidator(this.aId, { from: dan });
          await assertRevert(this.plotClarificationManager.claimGasDepositAsValidator(this.aId, { from: dan }));
        });

        it('should revert on non-validator claim', async function() {
          await assertRevert(this.plotClarificationManager.claimGasDepositAsValidator(this.aId, { from: alice }));
        });

        it('should revert on non-pusher claim attempt', async function() {
          await assertRevert(this.plotClarificationManager.claimGasDepositAsValidator(this.aId, { from: eve }));
        });

        it('should revert on applicant claim attempt', async function() {
          await assertRevert(this.plotClarificationManager.claimGasDepositAsApplicant(this.aId, { from: alice }));
        });
      });

      describe('for reverted applications', () => {
        beforeEach(async function() {
          await this.plotClarificationManager.revertApplication(this.aId, 'some reason', { from: bob });
          await this.plotClarificationManager.withdrawPackageToken(this.aId, { from: alice });
        });

        it('should be allowed to claim after token been withdrawn', async function() {
          await this.plotClarificationManager.claimGasDepositAsApplicant(this.aId, { from: alice });

          const res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.REVERTED);
          assert.equal(res.tokenWithdrawn, true);
          assert.equal(res.gasDepositWithdrawn, true);
        });

        it('should deny double claim', async function() {
          await this.plotClarificationManager.claimGasDepositAsApplicant(this.aId, { from: alice });
          await assertRevert(this.plotClarificationManager.claimGasDepositAsApplicant(this.aId, { from: alice }));
        });

        it('should deny non-applicant claim gas deposit', async function() {
          await assertRevert(this.plotClarificationManager.claimGasDepositAsApplicant(this.aId, { from: bob }));
        });
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.plotClarificationManager.submitApplicationForValuation(this.aId, { from: alice });
        await this.plotClarificationManager.lockApplicationForValuation(this.aId, { from: dan });
        await this.plotClarificationManager.valuateGasDeposit(this.aId, ether(7), { from: dan });
        await this.plotClarificationManager.submitApplicationForReview(this.aId, 0, {
          from: alice,
          value: ether(6 + 7)
        });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
      });

      describe('for approved applications', () => {
        beforeEach(async function() {
          await this.plotClarificationManager.approveApplication(this.aId, { from: bob });
          await this.plotClarificationManager.approveApplication(this.aId, { from: dan });
          await this.plotClarificationManager.approveApplication(this.aId, { from: eve });
          await this.plotClarificationManager.applicationPackingCompleted(this.aId, { from: dan });
        });

        describe('after package token was withdrawn by user', () => {
          beforeEach(async function() {
            await this.plotClarificationManager.withdrawPackageToken(this.aId, { from: alice });
          });

          it('should be allowed', async function() {
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

            assert.equal(res.status, ApplicationStatus.PACKED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('human'))
              .call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex(PUSHER_ROLE))
              .call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('dog'))
              .call();
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
            const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
            const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
            const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
            const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
            const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
            const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            const res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('human'))
              .call();
            assert.equal(res.reward.toString(), '2010000000000000000');

            // eves fee is around (100 - 33) / 100 * 6 ether * 50%  = 1005000000000000000 wei
            // assume that the commission paid by bob isn't greater than 0.1 ether

            const diffBob = bobsFinalBalance
              .sub(new BN('2010000000000000000')) // <- the diff
              .sub(bobsInitialBalance)
              .add(new BN('10000000000000000')); // <- 0.01 ether

            const diffDan = dansFinalBalance
              .sub(new BN('1005000000000000000')) // <- the diff
              .sub(dansInitialBalance)
              .add(new BN('10000000000000000')); // <- 0.01 ether

            const diffEve = evesFinalBalance
              .sub(new BN('1005000000000000000')) // <- the diff
              .sub(evesInitialBalance)
              .add(new BN('10000000000000000')); // <- 0.01 ether

            const diffOrg = orgsFinalBalance
              .sub(new BN('1980000000000000000')) // <- the diff
              .sub(orgsInitialBalance)
              .add(new BN('10000000000000000')); // <- 0.01 ether

            const max = new BN('10000000000000000'); // <- 0.01 ether
            const min = new BN('0');

            // lt
            assert(
              diffBob.lt(max), // diff < 0.01 ether
              `Expected ${web3.utils.fromWei(diffBob.toString(10))} to be less than 0.01 ether`
            );

            assert(
              diffDan.lt(max), // diff < 0.01 ether
              `Expected ${web3.utils.fromWei(diffDan.toString(10))} to be less than 0.01 ether`
            );

            assert(
              diffEve.lt(max), // diff < 0.01 ether
              `Expected ${web3.utils.fromWei(diffEve.toString(10))} to be less than 0.01 ether`
            );

            assert(
              diffOrg.lt(max), // diff < 0.01 ether
              `Expected ${web3.utils.fromWei(diffOrg.toString(10))} to be less than 0.01 ether`
            );

            // gt
            assert(
              diffBob.gt(min), // diff > 0
              `Expected ${web3.utils.fromWei(diffBob.toString(10))} to be greater than 0`
            );

            assert(
              diffDan.gt(min), // diff > 0
              `Expected ${web3.utils.fromWei(diffDan.toString(10))} to be greater than 0`
            );

            assert(
              diffEve.gt(min), // diff > 0
              `Expected ${web3.utils.fromWei(diffEve.toString(10))} to be greater than 0`
            );

            assert(
              diffOrg.gt(min), // diff > 0
              `Expected ${web3.utils.fromWei(diffOrg.toString(10))} to be greater than 0`
            );
          });

          it('should revert on double claim', async function() {
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob }));
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan }));
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
          });

          it('should revert on non-validator claim', async function() {
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          it('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
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
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

            assert.equal(res.status, ApplicationStatus.REVERTED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('human'))
              .call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex(PUSHER_ROLE))
              .call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('dog'))
              .call();
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
            const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
            const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
            const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
            const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
            const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
            const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

            const res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('human'))
              .call();
            assert.equal(res.reward.toString(), '2010000000000000000');

            // eves fee is around (100 - 33) / 100 * 6 ether * 50%  = 1005000000000000000 wei
            // assume that the commission paid by bob isn't greater than 0.1 ether

            const diffBob = bobsFinalBalance
              .sub(new BN('2010000000000000000')) // <- the diff
              .sub(bobsInitialBalance)
              .add(new BN('10000000000000000')); // <- 0.01 ether

            const diffDan = dansFinalBalance
              .sub(new BN('1005000000000000000')) // <- the diff
              .sub(dansInitialBalance)
              .add(new BN('10000000000000000')); // <- 0.01 ether

            const diffEve = evesFinalBalance
              .sub(new BN('1005000000000000000')) // <- the diff
              .sub(evesInitialBalance)
              .add(new BN('10000000000000000')); // <- 0.01 ether

            const diffOrg = orgsFinalBalance
              .sub(new BN('1980000000000000000')) // <- the diff
              .sub(orgsInitialBalance)
              .add(new BN('10000000000000000')); // <- 0.01 ether

            const max = new BN('10000000000000000'); // <- 0.01 ether
            const min = new BN('0');

            // lt
            assert(
              diffBob.lt(max), // diff < 0.01 ether
              `Expected ${web3.utils.fromWei(diffBob.toString(10))} to be less than 0.01 ether`
            );

            assert(
              diffDan.lt(max), // diff < 0.01 ether
              `Expected ${web3.utils.fromWei(diffDan.toString(10))} to be less than 0.01 ether`
            );

            assert(
              diffEve.lt(max), // diff < 0.01 ether
              `Expected ${web3.utils.fromWei(diffEve.toString(10))} to be less than 0.01 ether`
            );

            assert(
              diffOrg.lt(max), // diff < 0.01 ether
              `Expected ${web3.utils.fromWei(diffOrg.toString(10))} to be less than 0.01 ether`
            );

            // gt
            assert(
              diffBob.gt(min), // diff > 0
              `Expected ${web3.utils.fromWei(diffBob.toString(10))} to be greater than 0`
            );

            assert(
              diffDan.gt(min), // diff > 0
              `Expected ${web3.utils.fromWei(diffDan.toString(10))} to be greater than 0`
            );

            assert(
              diffEve.gt(min), // diff > 0
              `Expected ${web3.utils.fromWei(diffEve.toString(10))} to be greater than 0`
            );

            assert(
              diffOrg.gt(min), // diff > 0
              `Expected ${web3.utils.fromWei(diffOrg.toString(10))} to be greater than 0`
            );
          });

          it('should revert on double claim', async function() {
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob }));
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan }));
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
          });

          it('should revert on non-validator claim', async function() {
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: bob }));
          });

          it('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
            await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.plotClarificationManager.claimValidatorReward(this.aId, { from: alice }));
          await assertRevert(this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });
      });
    });
  });
});
