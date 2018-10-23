const PlotManager = artifacts.require('./PlotManager.sol');
const PlotManagerLib = artifacts.require('./PlotManagerLib.sol');
const PlotClarificationManager = artifacts.require('./PlotClarificationManager.sol');
const ArrayUtils = artifacts.require('./utils/ArrayUtils.sol');
const LandUtils = artifacts.require('./utils/LandUtils.sol');
const PolygonUtils = artifacts.require('./utils/PolygonUtils.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Validators = artifacts.require('./Validators.sol');
const ValidatorStakes = artifacts.require('./ValidatorStakes.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const { ether, assertEthBalanceChanged, assertEqualBN, assertRevert, zeroAddress } = require('../helpers');

const web3 = new Web3(PlotClarificationManager.web3.currentProvider);
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const NEW_APPLICATION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const CLARIFICATION_APPLICATION = '0x6f7c49efa4ebd19424a5018830e177875fd96b20c1ae22bc5eb7be4ac691e7b7';
// const PUSHER_ROLE = 'clarification pusher';

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

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
    multiSigWallet,
    applicationTypeManager,
    validatorManager,
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
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.arrayUtils = await ArrayUtils.new({ from: coreTeam });

    this.landUtils = await LandUtils.new({ from: coreTeam });
    PlotManagerLib.link('LandUtils', this.landUtils.address);

    this.plotManagerLib = await PlotManagerLib.new({ from: coreTeam });
    PlotManager.link('PlotManagerLib', this.plotManagerLib.address);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.validators = await Validators.new({ from: coreTeam });
    this.validatorStakes = await ValidatorStakes.new({ from: coreTeam });
    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.plotClarificationManager = await PlotClarificationManager.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });

    PolygonUtils.link('LandUtils', this.landUtils.address);
    SplitMerge.link('LandUtils', this.landUtils.address);
    SplitMerge.link('ArrayUtils', this.arrayUtils.address);

    this.polygonUtils = await PolygonUtils.new({ from: coreTeam });
    SplitMerge.link('PolygonUtils', this.polygonUtils.address);
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
    await this.validatorStakes.initialize(this.validators.address, this.galtToken.address, multiSigWallet, {
      from: coreTeam
    });
    await this.plotManager.setFeeManager(feeManager, true, { from: coreTeam });
    await this.plotClarificationManager.setFeeManager(feeManager, true, { from: coreTeam });

    await this.validators.addRoleTo(applicationTypeManager, await this.validators.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(validatorManager, await this.validators.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(this.validatorStakes.address, await this.validators.ROLE_VALIDATOR_STAKES(), {
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

    await this.spaceToken.addRoleTo(this.plotManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.plotClarificationManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.validators.addRoleTo(coreTeam, 'validator_manager');
    await this.validators.addRoleTo(coreTeam, 'application_type_manager');

    await this.validators.setRoleMinimalDeposit('foo', ether(30), { from: applicationTypeManager });
    await this.validators.setRoleMinimalDeposit('bar', ether(30), { from: applicationTypeManager });
    await this.validators.setRoleMinimalDeposit('buzz', ether(30), { from: applicationTypeManager });
    await this.validators.setRoleMinimalDeposit('human', ether(30), { from: applicationTypeManager });
    await this.validators.setRoleMinimalDeposit('dog', ether(30), { from: applicationTypeManager });
    await this.validators.setRoleMinimalDeposit('cat', ether(30), { from: applicationTypeManager });

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

      it('should deny owner set Galt Space EHT share less than 1 percent', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceEthShare('0.5', { from: feeManager }));
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

      it('should deny owner set Galt Space Galt share less than 1 percent', async function() {
        await assertRevert(this.plotClarificationManager.setGaltSpaceGaltShare('0.5', { from: feeManager }));
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
      this.resNewAddRoles = await this.validators.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['foo', 'bar', 'buzz'],
        [50, 25, 25],
        ['', '', ''],
        { from: applicationTypeManager }
      );

      this.resClarificationAddRoles = await this.validators.setApplicationTypeRoles(
        CLARIFICATION_APPLICATION,
        ['human', 'dog', 'cat'],
        [50, 25, 25],
        ['', '', ''],
        { from: applicationTypeManager }
      );
      // Alice obtains a package token
      let res = await this.plotManager.applyForPlotOwnership(
        this.contour,
        this.contour,
        0,
        this.credentials,
        this.ledgerIdentifier,
        {
          from: alice
        }
      );
      this.aId = res.logs[0].args.id;

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.spaceTokenId = res.spaceTokenId;

      await this.validators.addValidator(bob, 'Bob', 'MN', [], ['human', 'foo'], { from: validatorManager });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['bar', 'human'], { from: validatorManager });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], ['cat', 'buzz'], { from: validatorManager });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], ['dog'], { from: validatorManager });

      await this.galtToken.approve(this.validatorStakes.address, ether(1500), { from: alice });
      await this.validatorStakes.stake(bob, 'human', ether(30), { from: alice });
      await this.validatorStakes.stake(bob, 'foo', ether(30), { from: alice });
      await this.validatorStakes.stake(charlie, 'bar', ether(30), { from: alice });
      await this.validatorStakes.stake(charlie, 'human', ether(30), { from: alice });
      await this.validatorStakes.stake(dan, 'cat', ether(30), { from: alice });
      await this.validatorStakes.stake(dan, 'buzz', ether(30), { from: alice });
      await this.validatorStakes.stake(eve, 'dog', ether(30), { from: alice });

      const galts = await this.plotManagerWeb3.methods.getSubmissionFee(this.aId, Currency.GALT).call();
      const eths = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.GALT).call();
      await this.galtToken.approve(this.plotManager.address, galts, { from: alice });
      await this.plotManager.submitApplication(this.aId, galts.toString(), { from: alice, value: eths });

      await this.plotManager.lockApplicationForReview(this.aId, 'foo', { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, 'bar', { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, 'buzz', { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
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
              ether(42),
              {
                from: alice
              }
            )
          );
        });

        it('should calculate corresponding validator and galtspace rewards', async function() {
          await this.galtToken.approve(this.plotClarificationManager.address, ether(47), { from: alice });
          let res = await this.plotClarificationManager.submitApplication(
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.newContour,
            ether(47),
            {
              from: alice
            }
          );
          this.aId = res.logs[0].args.id;

          // validator share - 87%
          // galtspace share - 13%

          res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.validatorsReward, '40890000000000000000');
          assert.equal(res.galtSpaceReward, '6110000000000000000');
        });

        it('should calculate validator rewards according to their roles share', async function() {
          const { aId } = this;
          await this.galtToken.approve(this.plotClarificationManager.address, ether(47), { from: alice });
          let res = await this.plotClarificationManager.submitApplication(
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.newContour,
            ether(47),
            {
              from: alice
            }
          );
          this.aId = res.logs[0].args.id;

          // validator share - 87% (50%/25%/25%)
          // galtspace share - 13%

          res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(res.assignedValidatorRoles.map(hexToUtf8), ['cat', 'dog', 'human']);

          res = await this.plotClarificationManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('cat')).call();
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
        await this.galtToken.approve(this.plotClarificationManager.address, ether(57), { from: alice });
        const res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.newContour,
          ether(57),
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
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
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

            assert.equal(res.status, ApplicationStatus.APPROVED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('human'))
              .call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('cat'))
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
              .getApplicationValidator(this.aId, utf8ToHex('cat'))
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
        { from: applicationTypeManager }
      );

      this.resClarificationAddRoles = await this.validators.setApplicationTypeRoles(
        CLARIFICATION_APPLICATION,
        ['human', 'dog', 'cat'],
        [50, 25, 25],
        ['', '', ''],
        { from: applicationTypeManager }
      );
      // Alice obtains a package token
      let res = await this.plotManager.applyForPlotOwnership(
        this.contour,
        this.contour,
        0,
        this.credentials,
        this.ledgerIdentifier,
        {
          from: alice
        }
      );
      this.aId = res.logs[0].args.id;

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.spaceTokenId = res.spaceTokenId;

      await this.validators.addValidator(bob, 'Bob', 'MN', [], ['human', 'foo'], { from: validatorManager });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['bar'], { from: validatorManager });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], ['cat', 'buzz'], { from: validatorManager });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], ['dog'], { from: validatorManager });

      await this.galtToken.approve(this.validatorStakes.address, ether(1500), { from: alice });
      await this.validatorStakes.stake(bob, 'human', ether(30), { from: alice });
      await this.validatorStakes.stake(bob, 'foo', ether(30), { from: alice });
      await this.validatorStakes.stake(charlie, 'bar', ether(30), { from: alice });
      await this.validatorStakes.stake(dan, 'cat', ether(30), { from: alice });
      await this.validatorStakes.stake(dan, 'buzz', ether(30), { from: alice });
      await this.validatorStakes.stake(eve, 'dog', ether(30), { from: alice });

      const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();
      await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });
      await this.plotManager.lockApplicationForReview(this.aId, 'foo', { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, 'bar', { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, 'buzz', { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
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
        assert.equal(res.applicant.toLowerCase(), alice);
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
            0,
            {
              from: alice,
              value: ether(23)
            }
          );
        });

        it('should calculate corresponding validator and galtspace rewards', async function() {
          let res = await this.plotClarificationManager.submitApplication(
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.newContour,
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          // validator share - 67%
          // galtspace share - 33%

          res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.galtSpaceReward, '2310000000000000000');
          assert.equal(res.validatorsReward, '4690000000000000000');
        });

        it('should calculate validator rewards according to their roles share', async function() {
          let res = await this.plotClarificationManager.submitApplication(
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.newContour,
            0,
            {
              from: alice,
              value: ether(13)
            }
          );
          this.aId = res.logs[0].args.id;
          // validator share - 67% (50%/25%/25%)
          // galtspace share - 33%

          res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(res.assignedValidatorRoles.map(hexToUtf8), ['cat', 'dog', 'human']);

          res = await this.plotClarificationManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex('cat'))
            .call();
          assert.equal(res.reward.toString(), '2177500000000000000');

          res = await this.plotClarificationManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex('dog'))
            .call();
          assert.equal(res.reward.toString(), '2177500000000000000');

          res = await this.plotClarificationManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex('human'))
            .call();
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
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;
      });

      it('should allow multiple validators of different roles to lock a submitted application', async function() {
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'cat', { from: dan });

        let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotClarificationManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex('human'))
          .call();
        assert.equal(res.validator.toLowerCase(), bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotClarificationManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex('cat'))
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
        let res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.newContour,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;

        res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
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
        let res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.newContour,
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
          await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
          await this.plotClarificationManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
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
            .getApplicationValidator(this.aId, utf8ToHex('cat'))
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
        let res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.newContour,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        await this.plotClarificationManager.revertApplication(this.aId, 'msg', { from: bob });

        res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();
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
          .getApplicationValidator(this.aId, utf8ToHex('cat'))
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

    describe('#withdrawPackageToken()', () => {
      beforeEach(async function() {
        const res = await this.plotClarificationManager.submitApplication(
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.newContour,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'cat', { from: dan });

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
          0,
          {
            from: alice,
            value: ether(6)
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotClarificationManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
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
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: bob });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: dan });
            await this.plotClarificationManager.claimValidatorReward(this.aId, { from: eve });
            await this.plotClarificationManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

            let res = await this.plotClarificationManagerWeb3.methods.getApplicationById(this.aId).call();

            assert.equal(res.status, ApplicationStatus.APPROVED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtSpaceRewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('human'))
              .call();
            assert.equal(res.rewardPaidOut, true);

            res = await this.plotClarificationManagerWeb3.methods
              .getApplicationValidator(this.aId, utf8ToHex('cat'))
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

            assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(2.01));
            assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(1.005));
            assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(1.005));
            assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(1.98));
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
              .getApplicationValidator(this.aId, utf8ToHex('cat'))
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

            assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(2.01));
            assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(1.005));
            assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(1.005));
            assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(1.98));
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
