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
const ANOTHER_APPLICATION = '0x2baf79c183ad5c683c3f4ffdffdd719a123a402f9474acde6ca3060ac1e46095';
const PUSHER_ROLE = 'clarification pusher';

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

const GEOHASH_MASK = new BN('0100000000000000000000000000000000000000000000000000000000000000', 16);
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

contract('PlotClarificationManager', ([coreTeam, galtSpaceOrg, alice, bob, charlie, dan, eve, frank]) => {
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

    await this.plotManager.setApplicationFeeInEth(ether(6));
    await this.plotManager.setApplicationFeeInGalt(ether(45));
    await this.plotManager.setGaltSpaceEthShare(33);
    await this.plotManager.setGaltSpaceGaltShare(13);

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
        { from: alice, value: ether(6) }
      );
      this.aId = res.logs[0].args.id;

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.packageTokenId = res.packageTokenId;

      await this.validators.addValidator(bob, 'Bob', 'MN', [], ['human', 'foo'], { from: coreTeam });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['bar'], { from: coreTeam });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], [PUSHER_ROLE, 'buzz'], { from: coreTeam });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], ['dog'], { from: coreTeam });

      await this.plotManager.submitApplication(this.aId, { from: alice });
      await this.plotManager.lockApplicationForReview(this.aId, 'foo', { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, 'bar', { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, 'buzz', { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      res = await this.spaceToken.ownerOf(this.packageTokenId);
      assert.equal(res, alice);

      await this.spaceToken.approve(this.plotClarificationManager.address, this.packageTokenId, { from: alice });
      res = await this.plotClarificationManager.applyForPlotOwnership(
        this.packageTokenId,
        this.credentials,
        this.ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        8,
        { from: alice }
      );
      this.aId = res.logs[0].args.id;
    });

    describe('#applyForPlotOwnership()', () => {
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
        assert.equal(res2.country, web3.utils.asciiToHex('MN'));
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
        await this.plotClarificationManager.submitApplicationForReview(this.aId, {
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
            this.plotClarificationManager.submitApplicationForReview(this.aId, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await assertRevert(
            this.plotClarificationManager.submitApplicationForReview(this.aId, {
              from: alice,
              value: 10
            })
          );
        });
        it('should allow pplications with payment greater than required', async function() {
          await this.plotClarificationManager.submitApplicationForReview(this.aId, {
            from: alice,
            value: ether(23)
          });
        });

        it('should calculate corresponding validator and galtspace rewards', async function() {
          await this.plotClarificationManager.submitApplicationForReview(this.aId, {
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
          await this.plotClarificationManager.submitApplicationForReview(this.aId, {
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
  });
});
