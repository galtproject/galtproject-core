const PlotManager = artifacts.require('./PlotManager.sol');
const PlotManagerLib = artifacts.require('./PlotManagerLib.sol');
const LandUtils = artifacts.require('./LandUtils.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Validators = artifacts.require('./Validators.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const { ether, gwei, assertEqualBN, assertRevert, zeroAddress } = require('../helpers');

const web3 = new Web3(PlotManager.web3.currentProvider);
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const NEW_APPLICATION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const ANOTHER_APPLICATION = '0x2baf79c183ad5c683c3f4ffdffdd719a123a402f9474acde6ca3060ac1e46095';

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
  SUBMITTED: 2,
  APPROVED: 3,
  REJECTED: 4,
  REVERTED: 5,
  DISASSEMBLED_BY_APPLICANT: 6,
  DISASSEMBLED_BY_VALIDATOR: 7,
  REVOKED: 8
};

const ValidationStatus = {
  NOT_EXISTS: 0,
  PENDING: 1,
  LOCKED: 2,
  APPROVED: 3,
  REJECTED: 4,
  REVERTED: 5
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

/**
 * Alice is an applicant
 * Bob is a validator
 */
contract('PlotManager', ([coreTeam, galtSpaceOrg, feeManager, alice, bob, charlie, dan, eve, frank]) => {
  beforeEach(async function() {
    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.landUtils = await LandUtils.new({ from: coreTeam });
    PlotManagerLib.link('LandUtils', this.landUtils.address);

    this.plotManagerLib = await PlotManagerLib.new({ from: coreTeam });
    PlotManager.link('PlotManagerLib', this.plotManagerLib.address);

    let promises = [];
    promises.push(
      GaltToken.new({ from: coreTeam }).then(galtToken => {
        this.galtToken = galtToken;
      })
    );
    promises.push(
      Validators.new({ from: coreTeam }).then(validators => {
        this.validators = validators;
      })
    );
    promises.push(
      PlotManager.new({ from: coreTeam }).then(plotManager => {
        this.plotManager = plotManager;
      })
    );
    promises.push(
      SpaceToken.new('Space Token', 'SPACE', { from: coreTeam }).then(spaceToken => {
        this.spaceToken = spaceToken;
      })
    );
    promises.push(
      SplitMerge.new({ from: coreTeam }).then(splitMerge => {
        this.splitMerge = splitMerge;
      })
    );

    await Promise.all(promises);

    promises = [];

    promises.push(this.spaceToken.initialize('SpaceToken', 'SPACE', { from: coreTeam }));
    promises.push(
      this.plotManager.initialize(
        this.spaceToken.address,
        this.splitMerge.address,
        this.validators.address,
        this.galtToken.address,
        galtSpaceOrg,
        {
          from: coreTeam
        }
      )
    );
    promises.push(this.splitMerge.initialize(this.spaceToken.address, this.plotManager.address, { from: coreTeam }));
    promises.push(this.plotManager.setFeeManager(feeManager, true, { from: coreTeam }));

    promises.push(this.plotManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager }));
    promises.push(this.plotManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager }));
    promises.push(this.plotManager.setGaltSpaceEthShare(33, { from: feeManager }));
    promises.push(this.plotManager.setGaltSpaceGaltShare(13, { from: feeManager }));
    promises.push(this.plotManager.setGasPriceForDeposits(gwei(4), { from: feeManager }));

    promises.push(this.spaceToken.addRoleTo(this.plotManager.address, 'minter'));
    promises.push(this.spaceToken.addRoleTo(this.splitMerge.address, 'minter'));
    promises.push(this.spaceToken.addRoleTo(this.splitMerge.address, 'operator'));

    promises.push(
      this.validators.addRoleTo(coreTeam, await this.validators.ROLE_APPLICATION_TYPE_MANAGER(), {
        from: coreTeam
      })
    );
    promises.push(
      this.validators.addRoleTo(coreTeam, await this.validators.ROLE_VALIDATOR_MANAGER(), {
        from: coreTeam
      })
    );

    promises.push(this.galtToken.mint(alice, ether(10000000000), { from: coreTeam }));
    await Promise.all(promises);

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
    this.galtTokenWeb3 = new web3.eth.Contract(this.galtToken.abi, this.galtToken.address);
  });

  it('should be initialized successfully', async function() {
    (await this.plotManager.minimalApplicationFeeInEth()).toString(10).should.be.a.bignumber.eq(ether(6));
  });

  describe('contract config modifiers', () => {
    describe('#setGaltSpaceRewardsAddress()', () => {
      it('should allow an owner set rewards address', async function() {
        await this.plotManager.setGaltSpaceRewardsAddress(bob, { from: coreTeam });
        // const res = await web3.eth.getStorageAt(this.plotManager.address, 5);
        // assert.equal(res, bob);
      });

      it('should deny any other than a fee manager account set rewards address', async function() {
        await assertRevert(this.plotManager.setGaltSpaceRewardsAddress(bob, { from: alice }));
      });
    });

    describe('#setPaymentMethod()', () => {
      it('should allow a fee manager set a payment method', async function() {
        await this.plotManager.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: feeManager });
        const res = await this.plotManager.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_ONLY);
      });

      it('should deny any other than a fee manager account set a payment method', async function() {
        await assertRevert(this.plotManager.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: coreTeam }));
        const res = await this.plotManager.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_AND_GALT);
      });
    });

    describe('#setMinimalApplicationFeeInEth()', () => {
      it('should allow a fee manager set a new minimum fee in ETH', async function() {
        await this.plotManager.setMinimalApplicationFeeInEth(ether(0.05), { from: feeManager });
        const res = await this.plotManager.minimalApplicationFeeInEth();
        assert.equal(res, ether(0.05));
      });

      it('should deny any other than a fee manager account set fee in ETH', async function() {
        await assertRevert(this.plotManager.setMinimalApplicationFeeInEth(ether(0.05), { from: coreTeam }));
      });
    });

    describe('#setMinimalApplicationFeeInGalt()', () => {
      it('should allow a fee manager set a new minimum fee in GALT', async function() {
        await this.plotManager.setMinimalApplicationFeeInGalt(ether(0.15), { from: feeManager });
        const res = await this.plotManager.minimalApplicationFeeInGalt();
        assert.equal(res, ether(0.15));
      });

      it('should deny any other than a fee manager account set fee in GALT', async function() {
        await assertRevert(this.plotManager.setMinimalApplicationFeeInGalt(ether(0.15), { from: coreTeam }));
      });
    });

    describe('#setSubmissionFeeRate()', () => {
      it('should allow a fee manager set a submission fee rate in ETH and GALT', async function() {
        await this.plotManager.setSubmissionFeeRate(ether(0.02), ether(0.1), { from: feeManager });
        let res = await this.plotManagerWeb3.methods.submissionFeeRateEth().call();
        assert.equal(res, ether(0.02));
        res = await this.plotManagerWeb3.methods.submissionFeeRateGalt().call();
        assert.equal(res, ether(0.1));
      });

      it('should deny any other than a fee manager account set fee in ETH', async function() {
        await assertRevert(
          this.plotManager.setSubmissionFeeRate(ether(0.05), ether(0.05), {
            from: coreTeam
          })
        );
      });
    });

    describe('#setGaltSpaceEthShare()', () => {
      it('should allow fee manager set galtSpace ETH share in percents', async function() {
        await this.plotManager.setGaltSpaceEthShare('42', { from: feeManager });
        const res = await this.plotManager.galtSpaceEthShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny fee manager set Galt Space EHT share less than 1 percent', async function() {
        await assertRevert(this.plotManager.setGaltSpaceEthShare('0.5', { from: feeManager }));
      });

      it('should deny fee manager set Galt Space EHT share grater than 100 percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceEthShare('101', { from: feeManager }));
      });

      it('should deny any other than a fee manager account set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceEthShare('20', { from: coreTeam }));
      });
    });

    describe('#setGaltSpaceGaltShare()', () => {
      it('should allow a fee manager set galtSpace Galt share in percents', async function() {
        await this.plotManager.setGaltSpaceGaltShare('42', { from: feeManager });
        const res = await this.plotManager.galtSpaceGaltShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny a fee manager set Galt Space Galt share less than 1 percent', async function() {
        await assertRevert(this.plotManager.setGaltSpaceGaltShare('0.5', { from: feeManager }));
      });

      it('should deny a fee manager set Galt Space Galt share grater than 100 percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceGaltShare('101', { from: feeManager }));
      });

      it('should deny any other than a fee manager account set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceGaltShare('20', { from: coreTeam }));
      });
    });
  });

  describe('application modifiers', () => {
    beforeEach(async function() {
      this.resAddRoles = await this.validators.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['🦄', '🦆', '🦋'],
        [25, 30, 45],
        ['', '', ''],
        { from: coreTeam }
      );

      assert(await this.validators.isApplicationTypeReady(NEW_APPLICATION));

      const res = await this.plotManager.applyForPlotOwnership(
        this.contour,
        galt.geohashToGeohash5('sezu06'),
        this.credentials,
        this.ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        7,
        { from: alice }
      );

      this.aId = res.logs[0].args.id;

      await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
      this.payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();
    });

    it('should allow change application fields to the owner when status is NEW', async function() {
      const hash = web3.utils.keccak256('AnotherPerson');
      const ledgedIdentifier = 'foo-123';
      const country = 'SG';
      const precision = 9;

      await this.plotManager.changeApplicationDetails(this.aId, hash, ledgedIdentifier, precision, country, {
        from: alice
      });

      const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();

      assert.equal(res.credentialsHash, hash);
      assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), ledgedIdentifier);
      assert.equal(web3.utils.hexToAscii(res.country), 'SG');
      assert.equal(res.precision, 9);
    });

    it('should allow change application fields to an assigned operator when status is NEW', async function() {
      const hash = web3.utils.keccak256('AnotherPerson');
      const ledgedIdentifier = 'foo-123';
      const country = 'SG';
      const precision = 9;

      await this.plotManager.approveOperator(this.aId, frank, { from: alice });
      await this.plotManager.changeApplicationDetails(this.aId, hash, ledgedIdentifier, precision, country, {
        from: frank
      });

      const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();

      assert.equal(res.credentialsHash, hash);
      assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), ledgedIdentifier);
      assert.equal(web3.utils.hexToAscii(res.country), 'SG');
      assert.equal(res.precision, 9);
    });

    it('should allow application details hash to the owner when status is REVERTED', async function() {
      await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: this.payment });
      await this.validators.addValidator(bob, 'Bob', 'MN', [], ['🦄'], { from: coreTeam });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], ['🦆'], { from: coreTeam });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], ['🦋'], { from: coreTeam });
      await this.plotManager.lockApplicationForReview(this.aId, '🦄', { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, '🦆', { from: dan });
      await this.plotManager.lockApplicationForReview(this.aId, '🦋', { from: eve });
      await this.plotManager.revertApplication(this.aId, 'dont like it', { from: bob });

      let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      assert.equal(res.credentialsHash, this.credentials);
      assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));
      assert.equal(web3.utils.hexToAscii(res.country), 'MN');
      assert.equal(res.precision, 7);

      const hash = web3.utils.keccak256('AnotherPerson');
      const ledgedIdentifier = 'foo-123';
      const country = 'SG';
      const precision = 9;

      await this.plotManager.changeApplicationDetails(this.aId, hash, ledgedIdentifier, precision, country, {
        from: alice
      });

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      assert.equal(res.credentialsHash, hash);
      assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), ledgedIdentifier);
      assert.equal(web3.utils.hexToAscii(res.country), 'SG');
      assert.equal(res.precision, 9);
    });

    it('should deny hash change to another person', async function() {
      await assertRevert(
        this.plotManager.changeApplicationDetails(this.aId, web3.utils.keccak256('AnotherPerson'), 'foo-bar', 9, 'SG', {
          from: coreTeam
        })
      );

      const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      assert.equal(res.credentialsHash, this.credentials);
      assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));
      assert.equal(web3.utils.hexToAscii(res.country), 'MN');
      assert.equal(res.precision, 7);
    });

    it('should deny hash change if applicaiton is submitted', async function() {
      await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: this.payment });
      await assertRevert(
        this.plotManager.changeApplicationDetails(this.aId, web3.utils.keccak256('AnotherPerson'), 'foo-bar', 9, 'SG', {
          from: alice
        })
      );

      const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      assert.equal(res.credentialsHash, this.credentials);
      assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));
      assert.equal(web3.utils.hexToAscii(res.country), 'MN');
      assert.equal(res.precision, 7);
    });

    it('should assign 3rd party key to manage the application multiple times', async function() {
      await this.plotManager.approveOperator(this.aId, frank, { from: alice });
      let operator = await this.plotManager.getApplicationOperator(this.aId);
      assert.equal(operator, frank);

      await this.plotManager.approveOperator(this.aId, dan, { from: alice });
      operator = await this.plotManager.getApplicationOperator(this.aId);
      assert.equal(operator, dan);
    });
  });

  describe('application pipeline for GALT payment method', () => {
    beforeEach(async function() {
      this.resAddRoles = await this.validators.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['🦄', '🦆', '🦋'],
        [25, 30, 45],
        ['', '', ''],
        { from: coreTeam }
      );
      const res = await this.plotManager.applyForPlotOwnership(
        this.contour,
        galt.geohashToGeohash5('sezu06'),
        this.credentials,
        this.ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        7,
        { from: alice }
      );

      this.aId = res.logs[0].args.id;
    });

    describe('#applyForPlotOwnership() Galt', () => {
      it('should provide methods to create and read an application', async function() {
        const res2 = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        const res3 = await this.splitMerge.getPackageContour(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );

        // assertions
        for (let i = 0; i < res3.length; i++) {
          galt.numberToGeohash(res3[i].toString(10)).should.be.equal(this.initContour[i]);
        }

        assert.equal(res2.status, 1);
        assert.equal(res2.precision, 7);
        assert.equal(res2.applicant.toLowerCase(), alice);
        assert.equal(web3.utils.hexToAscii(res2.country), 'MN');
        assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
      });

      // eslint-disable-next-line
      it('should mint a pack, geohash, swap the geohash into the pack and keep it at PlotManager address', async function() {
        let res = await this.spaceToken.totalSupply();
        assert.equal(res.toString(), 2);
        res = await this.spaceToken.balanceOf(this.plotManager.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.balanceOf(this.splitMerge.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.ownerOf('0x0100000000000000000000000000000000000000000000000000000030dfe806');
        assert.equal(res, this.splitMerge.address);
        res = await this.spaceToken.ownerOf('0x0200000000000000000000000000000000000000000000000000000000000000');
        assert.equal(res, this.plotManager.address);
        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert(res, 1);
      });
    });

    describe('#submitApplication()', () => {
      beforeEach(async function() {
        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
        this.fee = await this.plotManagerWeb3.methods.getSubmissionFee(this.aId, Currency.GALT).call();

        this.deposit = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.GALT).call();
        await this.galtToken.approve(this.plotManager.address, this.fee, { from: alice });
      });

      it('should submit applications in galt', async function() {
        await this.plotManager.submitApplication(this.aId, this.fee, { from: alice, value: this.deposit });
      });

      describe('payable', () => {
        it('should split fee between GaltSpace and Validator', async function() {
          await this.plotManager.submitApplication(this.aId, this.fee, { from: alice, value: this.deposit });
          const res4 = await this.plotManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
          assert.equal(res4.currency, Currency.GALT);
          assert.equal(res4.validatorsReward, '9341553868800000000000');
          assert.equal(res4.galtSpaceReward, '1395864371200000000000');
        });

        it('should reject fees not equal returned from getter', async function() {
          await assertRevert(
            this.plotManager.submitApplication(this.aId, '123123123123', { from: alice, value: this.deposit })
          );
        });

        it('should calculate validator rewards according to their roles share', async function() {
          await this.validators.deleteApplicationType(NEW_APPLICATION, { from: coreTeam });
          this.resAddRoles = await this.validators.setApplicationTypeRoles(
            NEW_APPLICATION,
            ['cat', 'dog', 'human'],
            [52, 47, 1],
            ['', '', ''],
            { from: coreTeam }
          );

          let res = await this.plotManager.applyForPlotOwnership(
            this.contour,
            galt.geohashToGeohash5('sezu07'),
            this.credentials,
            this.ledgerIdentifier,
            web3.utils.asciiToHex('MN'),
            7,
            { from: alice }
          );
          const aId = res.logs[0].args.id;

          await this.plotManager.addGeohashesToApplication(aId, [], [], [], { from: alice });
          const fee = await this.plotManagerWeb3.methods.getSubmissionFee(aId, Currency.GALT).call();
          const deposit = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(aId, Currency.GALT).call();
          await this.galtToken.approve(this.plotManager.address, fee, { from: alice });
          await this.plotManager.submitApplication(aId, fee, { from: alice, value: deposit });

          res = await this.plotManagerWeb3.methods.getApplicationFinanceById(aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
          assert.equal(res.currency, Currency.GALT);
          res.validatorsReward.should.be.a.bignumber.eq(new BN('9341553868800000000000'));
          res.galtSpaceReward.should.be.a.bignumber.eq(new BN('1395864371200000000000'));

          res = await this.plotManagerWeb3.methods.getApplicationById(aId).call();
          assert.sameMembers(res.assignedValidatorRoles.map(hexToUtf8), ['cat', 'dog', 'human']);

          res = await this.plotManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('cat')).call();
          assert.equal(res.reward.toString(), '4857608011776000000000');

          res = await this.plotManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('dog')).call();
          assert.equal(res.reward.toString(), '4390530318336000000000');

          res = await this.plotManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('human')).call();
          assert.equal(res.reward.toString(), '93415538688000000000');
        });
      });
    });

    describe('#revokeApplication', () => {
      beforeEach(async function() {
        this.geohashToRemove = [galt.geohashToGeohash5('sezu06')];
        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
      });

      describe('with status REVERTED', () => {
        beforeEach(async function() {
          await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['🦄'], { from: coreTeam });
          await this.validators.addValidator(dan, 'Dan', 'MN', [], ['🦆'], { from: coreTeam });
          await this.validators.addValidator(eve, 'Eve', 'MN', [], ['🦋'], { from: coreTeam });

          const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();
          await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });
          await this.plotManager.lockApplicationForReview(this.aId, '🦄', { from: charlie });
          await this.plotManager.lockApplicationForReview(this.aId, '🦆', { from: dan });
          await this.plotManager.lockApplicationForReview(this.aId, '🦋', { from: eve });
          await this.plotManager.revertApplication(this.aId, 'dont like it', { from: charlie });
        });

        it('should change status to REVOKED and give refund', async function() {
          await this.plotManager.removeGeohashesFromApplication(this.aId, this.geohashToRemove, [], [], {
            from: alice
          });

          const aliceInitialBalance = new BN((await this.galtToken.balanceOf(alice)).toString(10));
          await this.plotManager.revokeApplication(this.aId, { from: alice });
          const aliceFinalBalance = new BN((await this.galtToken.balanceOf(alice)).toString(10));

          let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.REVOKED);

          res = await this.plotManagerWeb3.methods.getSubmissionFee(this.aId, Currency.GALT).call();

          assertEqualBN(aliceFinalBalance, aliceInitialBalance.add(new BN(res.toString())));
        });

        it('should deny any validator disassemble REVERTed application', async function() {
          await assertRevert(
            this.plotManager.removeGeohashesFromApplication(this.aId, this.geohashToRemove, [], [], {
              from: charlie
            })
          );
        });
      });
    });

    describe('#resubmitApplication()', () => {
      beforeEach(async function() {
        await this.validators.deleteApplicationType(NEW_APPLICATION, { from: coreTeam });
        this.resAddRoles = await this.validators.setApplicationTypeRoles(
          NEW_APPLICATION,
          ['cat', 'dog', 'human'],
          [52, 47, 1],
          ['', '', ''],
          { from: coreTeam }
        );
        await this.validators.addValidator(bob, 'Bob', 'MN', [], ['human'], { from: coreTeam });
        await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['human'], { from: coreTeam });

        await this.validators.addValidator(dan, 'Dan', 'MN', [], ['cat'], { from: coreTeam });
        await this.validators.addValidator(eve, 'Eve', 'MN', [], ['dog'], { from: coreTeam });
        const geohashes = ['sezu1100', 'sezu1110'].map(galt.geohashToGeohash5);
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });

        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.NEW);

        const galts = await this.plotManagerWeb3.methods.getSubmissionFee(this.aId, Currency.GALT).call();
        const eths = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.GALT).call();

        await this.galtToken.approve(this.plotManager.address, galts, { from: alice });
        await this.plotManager.submitApplication(this.aId, galts, { from: alice, value: eths });

        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });
        await this.plotManager.revertApplication(this.aId, 'blah', { from: bob });
      });

      describe('when new geohashes were added', () => {
        beforeEach(async function() {
          const geohashes = ['sezu112c', 'sezu113b1'].map(galt.geohashToGeohash5);
          await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], {
            from: alice
          });
          this.galts = await this.plotManagerWeb3.methods.getResubmissionFee(this.aId).call();
          assert(this.galts > 0);
        });

        it('should require another payment', async function() {
          await this.plotManager.resubmitApplication(this.aId, this.galts, { from: alice });

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
        });

        it('should reject on unexpected fee in GALT', async function() {
          await assertRevert(this.plotManager.resubmitApplication(this.aId, 123, { from: alice }));

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.REVERTED);
        });

        it('should reject on payment both in ETH and GALT', async function() {
          await assertRevert(
            this.plotManager.resubmitApplication(this.aId, this.galts, {
              from: alice,
              value: '123'
            })
          );

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.REVERTED);
        });
      });

      describe('when geohashes were removed', () => {
        beforeEach(async function() {
          const geohashes = ['sezu1110'].map(galt.geohashToGeohash5);
          await this.plotManager.removeGeohashesFromApplication(this.aId, geohashes, [], [], {
            from: alice
          });
          this.fee = await this.plotManagerWeb3.methods.getResubmissionFee(this.aId).call();
          assert(this.fee < 0);
        });

        it('should not require another payment', async function() {
          await this.plotManager.resubmitApplication(this.aId, 0, { from: alice });

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
        });
      });
    });

    describe('#withdrawSubmissionFee()', () => {
      beforeEach(async function() {
        await this.validators.deleteApplicationType(NEW_APPLICATION, { from: coreTeam });
        this.resAddRoles = await this.validators.setApplicationTypeRoles(
          NEW_APPLICATION,
          ['cat', 'dog', 'human'],
          [52, 47, 1],
          ['', '', ''],
          { from: coreTeam }
        );
        await this.validators.addValidator(bob, 'Bob', 'MN', [], ['human'], { from: coreTeam });
        await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['human'], { from: coreTeam });

        await this.validators.addValidator(dan, 'Dan', 'MN', [], ['cat'], { from: coreTeam });
        await this.validators.addValidator(eve, 'Eve', 'MN', [], ['dog'], { from: coreTeam });

        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
        let geohashes = ['sezu1100', 'sezu1110', 'sezu2200'].map(galt.geohashToGeohash5);
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });

        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.NEW);

        const galts = await this.plotManagerWeb3.methods.getSubmissionFee(this.aId, Currency.GALT).call();
        const eths = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.GALT).call();
        await this.galtToken.approve(this.plotManager.address, galts, { from: alice });

        await this.plotManager.submitApplication(this.aId, galts, { from: alice, value: eths });

        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });
        await this.plotManager.revertApplication(this.aId, 'blah', { from: bob });
        geohashes = ['sezu1100', 'sezu1110'].map(galt.geohashToGeohash5);
        await this.plotManager.removeGeohashesFromApplication(this.aId, geohashes, [], [], {
          from: alice
        });
      });

      it('should allow withdraw unused fee after resubmission', async function() {
        let finance = await this.plotManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
        assert.equal(finance.feeRefundAvailable, 0);

        this.fee = await this.plotManagerWeb3.methods.getResubmissionFee(this.aId).call();

        await this.plotManager.resubmitApplication(this.aId, 0, { from: alice });

        finance = await this.plotManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
        assert.equal(finance.feeRefundAvailable, '20971520000000000000');

        const aliceInitialBalance = new BN((await this.galtToken.balanceOf(alice)).toString(10));
        await this.plotManager.withdrawSubmissionFee(this.aId, { from: alice });
        const aliceFinalBalance = new BN((await this.galtToken.balanceOf(alice)).toString(10));

        assertEqualBN(aliceFinalBalance, aliceInitialBalance.add(new BN('20971520000000000000')));
      });

      it('should reject fee withdrawals before resubmission', async function() {
        await assertRevert(this.plotManager.withdrawSubmissionFee(this.aId, { from: alice }));
      });

      it('should reject on double-refund', async function() {
        await this.plotManager.resubmitApplication(this.aId, 0, { from: alice });
        await this.plotManager.withdrawSubmissionFee(this.aId, { from: alice });
        await assertRevert(this.plotManager.withdrawSubmissionFee(this.aId, { from: alice }));
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.validators.deleteApplicationType(NEW_APPLICATION);
        this.resAddRoles = await this.validators.setApplicationTypeRoles(
          NEW_APPLICATION,
          ['human', 'dog', 'cat'],
          [50, 25, 25],
          ['', '', ''],
          { from: coreTeam }
        );

        let res = await this.plotManager.applyForPlotOwnership(
          this.contour,
          galt.geohashToGeohash5('sezu07'),
          this.credentials,
          this.ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: alice }
        );

        this.aId = res.logs[0].args.id;

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.NEW);

        await this.validators.addValidator(bob, 'Bob', 'MN', [], ['human'], { from: coreTeam });
        await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['human'], { from: coreTeam });

        await this.validators.addValidator(dan, 'Dan', 'MN', [], ['cat'], { from: coreTeam });
        await this.validators.addValidator(eve, 'Eve', 'MN', [], ['dog'], { from: coreTeam });

        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });

        const fee = await this.plotManagerWeb3.methods.getSubmissionFee(this.aId, Currency.GALT).call();
        const deposit = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.GALT).call();
        await this.galtToken.approve(this.plotManager.address, fee, { from: alice });
        await this.plotManager.submitApplication(this.aId, fee, { from: alice, value: deposit });

        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
      });

      describe('on approve', () => {
        beforeEach(async function() {
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString(10));
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString(10));

          await this.plotManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotManager.claimValidatorReward(this.aId, { from: dan });
          await this.plotManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString(10));
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString(10));

          const res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
          assert.equal(res.reward.toString(), '4670776934400000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('4670776934400000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('2335388467200000000000')));
          assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('2335388467200000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('1395864371200000000000')));
        });
      });

      describe('on reject', () => {
        it('should allow validators claim reward after reject', async function() {
          await this.plotManager.rejectApplication(this.aId, this.credentials, { from: bob });

          let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          const { packageTokenId } = res;

          const packageGeohashes = await this.splitMerge.getPackageGeohashes(packageTokenId);
          const geohashesToRemove = packageGeohashes
            .map(tokenId => galt.tokenIdToGeohash(tokenId.toString(10)))
            .map(galt.geohashToGeohash5);

          await this.plotManager.removeGeohashesFromApplication(this.aId, geohashesToRemove, [], [], {
            from: bob
          });

          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString(10));
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

          await this.plotManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotManager.claimValidatorReward(this.aId, { from: dan });
          await this.plotManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString(10));
          const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString(10));
          const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString(10));
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString(10));

          res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
          assert.equal(res.reward.toString(), '4670776934400000000000');

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('4670776934400000000000')));
          assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('2335388467200000000000')));
          assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('2335388467200000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('1395864371200000000000')));
        });
      });
    });
  });

  describe('application pipeline for ETH', () => {
    beforeEach(async function() {
      this.resAddRoles = await this.validators.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['human', 'dog', 'cat'],
        [50, 25, 25],
        ['', '', ''],
        { from: coreTeam }
      );

      let res = await this.plotManager.applyForPlotOwnership(
        this.contour,
        galt.geohashToGeohash5('sezu06'),
        this.credentials,
        this.ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        7,
        { from: alice }
      );

      this.aId = res.logs[0].args.id;

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.packageTokenId = res.packageTokenId;
      assert.equal(res.status, ApplicationStatus.NEW);

      await this.validators.addValidator(bob, 'Bob', 'MN', [], ['human'], { from: coreTeam });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['human'], { from: coreTeam });

      await this.validators.addValidator(dan, 'Dan', 'MN', [], ['cat'], { from: coreTeam });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], ['dog'], { from: coreTeam });
    });

    describe('#applyForPlotOwnership() ETH', () => {
      it('should provide methods to create and read an application', async function() {
        const res2 = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        const res3 = await this.splitMerge.getPackageContour(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );

        // assertions
        for (let i = 0; i < res3.length; i++) {
          galt.numberToGeohash(res3[i].toString(10)).should.be.equal(this.initContour[i]);
        }

        assert.equal(res2.status, 1);
        assert.equal(res2.precision, 7);
        assert.equal(res2.applicant.toLowerCase(), alice);
        assert.equal(web3.utils.hexToAscii(res2.country), 'MN');
        assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
      });

      // eslint-disable-next-line
      it('should mint a pack, geohash, swap the geohash into the pack and keep it at PlotManager address', async function() {
        let res = await this.spaceToken.totalSupply();
        assert.equal(res.toString(), 2);
        res = await this.spaceToken.balanceOf(this.plotManager.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.balanceOf(this.splitMerge.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.ownerOf('0x0100000000000000000000000000000000000000000000000000000030dfe806');
        assert.equal(res, this.splitMerge.address);
        res = await this.spaceToken.ownerOf('0x0200000000000000000000000000000000000000000000000000000000000000');
        assert.equal(res, this.plotManager.address);
        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert(res, 1);
      });
    });

    describe('#addGeohashesToApplication', () => {
      it('should add a list of geohashes', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes += ` gbsuv7zq gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });
      });

      it('should allow the operator to add goehashes', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes += ` gbsuv7zq gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.approveOperator(this.aId, frank, { from: alice });
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: frank });
      });

      it('should allow the operator to add geohashes', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes += ` gbsuv7zq gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.approveOperator(this.aId, frank, { from: alice });
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: frank });

        const res = await this.plotManager.getSubmissionFee(this.aId, Currency.ETH);
        assert.equal(res.toString(10), ether(1083.441152));
      });

      it('should add a list of geohashes', async function() {
        let geohashes1 = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        let geohashes2 = `gbsuv7zq gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
        geohashes1 = geohashes1.split(' ').map(galt.geohashToGeohash5);
        geohashes2 = geohashes2.split(' ').map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes1, [], [], { from: alice });
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        const firstAddGas = res.gasDepositEstimation;

        await this.plotManager.addGeohashesToApplication(this.aId, geohashes2, [], [], { from: alice });
        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert(res.gasDepositEstimation > firstAddGas);
      });

      it('should re-use geohash space tokens if they belong to PlotManager', async function() {
        const tokenId = galt.geohashToNumber('sezu05');
        let res = await this.spaceToken.mintGeohash(this.plotManager.address, tokenId.toString(10), {
          from: coreTeam
        });

        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);
        geohashes.push(tokenId.toString());
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });

        res = await this.spaceToken.ownerOf(tokenId.xor(GEOHASH_MASK).toString());
        assert.equal(res, this.splitMerge.address);
      });

      it('should reject if already minted token doesnt belong to PlotManager', async function() {
        const tokenId = galt.geohashToNumber('sezu05');
        let res = await this.spaceToken.mintGeohash(bob, tokenId.toString(10), {
          from: coreTeam
        });

        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);
        geohashes.push(tokenId.toString());
        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice }));

        res = await this.spaceToken.ownerOf(tokenId.xor(GEOHASH_MASK).toString());
        assert.equal(res, bob);
      });

      it('should add a list of geohashes if an application status is reverted', async function() {
        let geohashes1 = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes1 = geohashes1.split(' ').map(galt.geohashToGeohash5);
        const geohashes2 = ['sezu01', 'sezu02'].map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes1, [], [], { from: alice });

        assert.equal(await this.spaceToken.ownerOf(galt.geohash5ToTokenId(geohashes1[0])), this.splitMerge.address);
        assert.equal(await this.spaceToken.ownerOf(galt.geohash5ToTokenId(geohashes1[1])), this.splitMerge.address);

        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });
        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        await this.plotManager.revertApplication(this.aId, 'blah', { from: bob });

        let res = await this.splitMerge.getPackageGeohashesCount(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );
        assert.equal(res, 9);

        await this.plotManager.addGeohashesToApplication(this.aId, geohashes2, [], [], { from: alice });
        res = await this.splitMerge.getPackageGeohashesCount(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );
        assert.equal(res, 11);
      });

      it('should throw if already existing geohashes are passed in', async function() {
        let geohashes1 = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes1 = geohashes1.split(' ').map(galt.geohashToGeohash5);
        const geohashes2 = ['sezu01', 'gbsuv7ztm'].map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes1, [], [], { from: alice });

        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes2, [], [], { from: alice }));
      });

      it('should reject push from non-owner', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: coreTeam }));
      });

      it('should reject push when status is not new or rejected', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });

        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();
        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });

        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice }));
      });

      // TODO: add check for non allowed symbols on geohash token minting
      it.skip('should reject push if geohash array contains an empty element', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);
        geohashes.push('');

        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice }));
      });
    });

    describe('#revokeApplication()', () => {
      describe('for applications paid by ETH', () => {
        beforeEach(async function() {
          this.geohashToRemove = [galt.geohashToGeohash5('sezu06')];
        });

        describe('with status REVERTED', () => {
          it('should change status to REVOKED and give refund', async function() {
            await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
            const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

            await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });
            await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
            await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
            await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
            await this.plotManager.revertApplication(this.aId, 'dont like it', { from: bob });

            let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
            assert.equal(res.status, ApplicationStatus.REVERTED);

            await this.plotManager.removeGeohashesFromApplication(this.aId, this.geohashToRemove, [], [], {
              from: alice
            });

            const aliceInitialBalance = new BN(await web3.eth.getBalance(alice));
            await this.plotManager.revokeApplication(this.aId, { from: alice });
            const aliceFinalBalance = new BN(await web3.eth.getBalance(alice));

            res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
            assert.equal(res.status, ApplicationStatus.REVOKED);

            const max = new BN('10000000000000000'); // <- 0.01 ether
            const min = new BN('0');

            const diff = aliceFinalBalance
              .sub(new BN('719407022080000000000')) // <- validatorsReward
              .sub(new BN('354334801920000000000')) // <- galtSpaceReward
              .sub(aliceInitialBalance)
              .add(new BN('10000000000000000')); // <- 0.01 ether

            assert(
              diff.gt(min), // diff > 0
              `Expected ${web3.utils.fromWei(diff.toString(10))} to be greater than 0`
            );

            assert(
              diff.lt(max), // diff < 0.01 ether
              `Expected ${web3.utils.fromWei(diff.toString(10))} to be less than 0.01 ether`
            );
          });
        });
      });
    });

    describe('#submitApplication()', () => {
      beforeEach(async function() {
        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
      });

      it('should change status of an application from from new to submitted', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.NEW);

        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should reject if status is not new or rejected', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.NEW);

        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });
        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });

        await assertRevert(this.plotManager.submitApplication(this.aId, 0, { from: alice, payment }));

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should reject if another person tries to submit the application', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.NEW);

        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

        await assertRevert(this.plotManager.submitApplication(this.aId, 0, { from: bob, value: payment }));

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.NEW);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(this.plotManager.submitApplication(this.aId, 0, { from: alice, value: 0 }));
        });

        it('should reject applications with payment not equal required', async function() {
          await assertRevert(this.plotManager.submitApplication(this.aId, 0, { from: alice, value: ether(3) }));
        });

        it('should calculate corresponding validator and coreTeam rewards in Eth', async function() {
          const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();
          await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });

          const res = await this.plotManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);

          res.validatorsReward.should.be.a.bignumber.eq(new BN('719407022080000000000'));
          res.galtSpaceReward.should.be.a.bignumber.eq(new BN('354334801920000000000'));

          const fee = await this.plotManagerWeb3.methods.getSubmissionFee(this.aId, Currency.ETH).call();
          fee.should.be.a.bignumber.eq(new BN('719407022080000000000').add(new BN('354334801920000000000')));
        });

        it('should calculate validator rewards according to their roles share', async function() {
          const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

          // TODO: submission required
          await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });

          let res = await this.plotManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
          assert.equal(res.currency, Currency.ETH);
          res.validatorsReward.should.be.a.bignumber.eq(new BN('719407022080000000000'));

          res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(res.assignedValidatorRoles.map(hexToUtf8), ['cat', 'dog', 'human']);

          // 50%
          res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
          assert.equal(res.reward.toString(), '359703511040000000000');

          // 25%
          res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('cat')).call();
          assert.equal(res.reward.toString(), '179851755520000000000');

          // 25%
          res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('dog')).call();
          assert.equal(res.reward.toString(), '179851755520000000000');
        });
      });
    });

    describe('#resubmitApplication()', () => {
      beforeEach(async function() {
        const geohashes = ['sezu1100', 'sezu1110'].map(galt.geohashToGeohash5);
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });

        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.NEW);

        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();
        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });
        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });
        await this.plotManager.revertApplication(this.aId, 'blah', { from: bob });
      });

      describe('when new geohashes were not changed', () => {
        it('should allow submit reverted application to the same validator who reverted it', async function() {
          await this.plotManager.resubmitApplication(this.aId, 0, { from: alice });

          let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);

          res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
          assert.equal(res.validator.toLowerCase(), bob);
          assert.equal(res.status, ValidationStatus.LOCKED);

          res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('cat')).call();
          assert.equal(res.validator.toLowerCase(), dan);
          assert.equal(res.status, ValidationStatus.LOCKED);

          res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('dog')).call();
          assert.equal(res.validator.toLowerCase(), eve);
          assert.equal(res.status, ValidationStatus.LOCKED);
        });
      });

      describe('when new geohashes were added', () => {
        beforeEach(async function() {
          const geohashes = ['sezu112c', 'sezu113b1'].map(galt.geohashToGeohash5);
          await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], {
            from: alice
          });
          this.fee = await this.plotManagerWeb3.methods.getResubmissionFee(this.aId).call();
          assert(this.fee > 0);
        });

        it('should require another payment', async function() {
          await this.plotManager.resubmitApplication(this.aId, 0, { from: alice, value: this.fee });

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
        });

        it('should reject on unexpected fee in ETH', async function() {
          await assertRevert(this.plotManager.resubmitApplication(this.aId, 0, { from: alice, value: 123 }));

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.REVERTED);
        });

        it('should reject on payment both in ETH and GALT', async function() {
          await assertRevert(this.plotManager.resubmitApplication(this.aId, 123, { from: alice, value: this.fee }));

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.REVERTED);
        });
      });

      describe('when geohashes were removed', () => {
        beforeEach(async function() {
          const geohashes = ['sezu1110'].map(galt.geohashToGeohash5);
          await this.plotManager.removeGeohashesFromApplication(this.aId, geohashes, [], [], {
            from: alice
          });
          this.fee = await this.plotManagerWeb3.methods.getResubmissionFee(this.aId).call();
          assert(this.fee < 0);
        });

        it('should not require another payment', async function() {
          await this.plotManager.resubmitApplication(this.aId, 0, { from: alice });

          const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
        });
      });
    });

    describe('#withdrawSubmissionFee()', () => {
      beforeEach(async function() {
        let geohashes = ['sezu1100', 'sezu1110', 'sezu2200'].map(galt.geohashToGeohash5);
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });

        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.NEW);

        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();
        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });
        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });
        await this.plotManager.revertApplication(this.aId, 'blah', { from: bob });
        geohashes = ['sezu1100', 'sezu1110'].map(galt.geohashToGeohash5);
        await this.plotManager.removeGeohashesFromApplication(this.aId, geohashes, [], [], {
          from: alice
        });
        // TODO: remove one and get refund
      });

      it('should reject fee withdrawals before resubmission', async function() {
        await assertRevert(this.plotManager.withdrawSubmissionFee(this.aId, { from: alice }));
      });

      it('should reject on double-refund', async function() {
        await this.plotManager.resubmitApplication(this.aId, 0, { from: alice });
        await this.plotManager.withdrawSubmissionFee(this.aId, { from: alice });
        await assertRevert(this.plotManager.withdrawSubmissionFee(this.aId, { from: alice }));
      });

      it('should allow withdraw unused fee after resubmission', async function() {
        let finance = await this.plotManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
        assert.equal(finance.feeRefundAvailable, 0);

        this.fee = await this.plotManagerWeb3.methods.getResubmissionFee(this.aId).call();

        await this.plotManager.resubmitApplication(this.aId, 0, { from: alice });

        finance = await this.plotManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
        assert.equal(finance.feeRefundAvailable, '2097152000000000000');

        const aliceInitialBalance = new BN(await web3.eth.getBalance(alice));
        await this.plotManager.withdrawSubmissionFee(this.aId, { from: alice });
        const aliceFinalBalance = new BN(await web3.eth.getBalance(alice));
        // TODO: check balances

        const diffAlice = aliceFinalBalance
          .sub(new BN('2097152000000000000')) // <- the diff
          .sub(aliceInitialBalance)
          .add(new BN('10000000000000000')); // <- 0.01 ether

        const max = new BN('10000000000000000'); // <- 0.01 ether
        const min = new BN('0');

        assert(
          diffAlice.lt(max), // diff < 0.01 ether
          `Expected ${web3.utils.fromWei(diffAlice.toString(10))} to be less than 0.01 ether`
        );

        // gt
        assert(
          diffAlice.gt(min), // diff > 0
          `Expected ${web3.utils.fromWei(diffAlice.toString(10))} to be greater than 0`
        );
      });
    });

    describe('#lockApplicationForReview()', () => {
      beforeEach(async function() {
        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
        this.payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: this.payment });

        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should allow multiple validators of different roles to lock a submitted application', async function() {
        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
        assert.equal(res.validator.toLowerCase(), bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('cat')).call();
        assert.equal(res.validator.toLowerCase(), dan);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('dog')).call();
        assert.equal(res.validator.toLowerCase(), zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      // eslint-disable-next-line
      it('should deny a validator with the same role to lock an application which is already on consideration', async function() {
        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await assertRevert(this.plotManager.lockApplicationForReview(this.aId, 'human', { from: charlie }));
      });

      it('shot uld push an application id to the validators list for caching', async function() {
        // submit first
        let res = await this.plotManager.applyForPlotOwnership(
          this.contour,
          galt.geohashToGeohash5('sezu19'),
          this.credentials,
          this.ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: charlie }
        );
        const a1Id = res.logs[0].args.id;
        await this.plotManager.addGeohashesToApplication(a1Id, [], [], [], { from: charlie });
        let payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(a1Id, Currency.ETH).call();
        await this.plotManager.submitApplication(a1Id, 0, { from: charlie, value: payment });

        // lock first
        await this.plotManager.lockApplicationForReview(a1Id, 'human', { from: bob });

        // submit second
        res = await this.plotManager.applyForPlotOwnership(
          this.contour,
          galt.geohashToGeohash5('sezu09'),
          this.credentials,
          this.ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: alice }
        );
        const a2Id = res.logs[0].args.id;
        await this.plotManager.addGeohashesToApplication(a2Id, [], [], [], { from: alice });
        payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(a2Id, Currency.ETH).call();

        await this.plotManager.submitApplication(a2Id, 0, { from: alice, value: payment });

        // lock second
        await this.plotManager.lockApplicationForReview(a2Id, 'human', { from: bob });

        res = await this.plotManager.getApplicationsByValidator(bob);
        assert.equal(res.length, 2);
        assert.equal(res[0], a1Id);
        assert.equal(res[1], a2Id);
      });

      it('should deny validator to lock an application which is new', async function() {
        let res = await this.plotManager.applyForPlotOwnership(
          this.contour,
          galt.geohashToGeohash5('sezu05'),
          this.credentials,
          this.ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: alice }
        );
        const a2Id = res.logs[0].args.id;
        await assertRevert(this.plotManager.lockApplicationForReview(a2Id, 'human', { from: charlie }));
        res = await this.plotManagerWeb3.methods.getApplicationById(a2Id).call();
        assert.equal(res.status, ApplicationStatus.NEW);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
        assert.equal(res.validator.toLowerCase(), zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      it('should deny non-validator to lock an application', async function() {
        await assertRevert(this.plotManager.lockApplicationForReview(this.aId, 'human', { from: coreTeam }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 2);
      });
    });

    describe('#resetApplicationRole()', () => {
      beforeEach(async function() {
        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });

        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
      });

      it('should should allow a contract owner to unlock an application under consideration', async function() {
        await this.plotManager.resetApplicationRole(this.aId, 'human', { from: coreTeam });

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
        assert.equal(res.validator.toLowerCase(), zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      it('should deny non-owner to unlock an application under consideration', async function() {
        await assertRevert(this.plotManager.resetApplicationRole(this.aId, 'human', { from: charlie }));

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
        assert.equal(res.validator.toLowerCase(), bob);
        assert.equal(res.status, ValidationStatus.LOCKED);
      });
    });

    describe('#approveApplication', () => {
      beforeEach(async function() {
        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });

        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
      });

      it('should allow a validator approve application', async function() {
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      it('should transfer package to an applicant', async function() {
        const packId = '0x0200000000000000000000000000000000000000000000000000000000000000';
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });

        let res = await this.spaceToken.ownerOf(packId);
        assert.equal(res, this.plotManager.address);

        await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });

        res = await this.spaceToken.ownerOf(packId);
        assert.equal(res, alice);
      });

      it('should deny a validator approve application if hash doesnt match', async function() {
        await assertRevert(this.plotManager.approveApplication(this.aId, `${this.credentials}_foo`, { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny non-validator approve application', async function() {
        await assertRevert(this.plotManager.approveApplication(this.aId, this.credentials, { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      // eslint-disable-next-line
      it('should deny validator whose role doesnt present in application type to approve application', async function() {
        await this.validators.setApplicationTypeRoles(
          ANOTHER_APPLICATION,
          ['foo', 'bar', 'buzz'],
          [50, 25, 25],
          ['', '', ''],
          { from: coreTeam }
        );

        await this.validators.addValidator(frank, 'Frank', 'MN', [], ['foo'], { from: coreTeam });
        await assertRevert(this.plotManager.approveApplication(this.aId, this.credentials, { from: frank }));
      });

      // eslint-disable-next-line
      it('should deny validator approve application with other than consideration or partially locked status', async function() {
        let res = await this.plotManager.applyForPlotOwnership(
          this.contour,
          galt.geohashToGeohash5('sezu36'),
          this.credentials,
          this.ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: alice }
        );

        const aId = res.logs[0].args.id;
        await assertRevert(this.plotManager.approveApplication(aId, this.credentials, { from: bob }));
        res = await this.plotManagerWeb3.methods.getApplicationById(aId).call();
        assert.equal(res.status, ApplicationStatus.NEW);
      });
    });

    describe('#revertApplication()', () => {
      beforeEach(async function() {
        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });

        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
      });

      it('should allow a validator revert application', async function() {
        await this.plotManager.revertApplication(this.aId, 'it looks suspicious', { from: bob });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      // eslint-disable-next-line
      it('should deny another assigned validator revert application after it was already reverted', async function() {
        await this.plotManager.revertApplication(this.aId, 'it looks suspicious', { from: bob });
        await assertRevert(this.plotManager.revertApplication(this.aId, 'blah', { from: dan }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should not reset validation statuses of another validators', async function() {
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
        await this.plotManager.revertApplication(this.aId, 'it looks suspicious', { from: eve });

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
        assert.equal(res.validator.toLowerCase(), bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('cat')).call();
        assert.equal(res.validator.toLowerCase(), dan);
        assert.equal(res.status, ValidationStatus.APPROVED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('dog')).call();
        assert.equal(res.validator.toLowerCase(), eve);
        assert.equal(res.status, ValidationStatus.REVERTED);
      });

      it('should deny non-validator revert application', async function() {
        await assertRevert(this.plotManager.revertApplication(this.aId, 'blah', { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny validator revert an application with non-consideration status', async function() {
        let res = await this.plotManager.applyForPlotOwnership(
          this.contour,
          galt.geohashToGeohash5('sezu96'),
          this.credentials,
          this.ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: alice }
        );
        const aId = res.logs[0].args.id;
        await this.plotManager.addGeohashesToApplication(aId, [], [], [], { from: alice });
        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

        await this.plotManager.submitApplication(aId, 0, { from: alice, value: payment });

        await assertRevert(this.plotManager.revertApplication(aId, 'blah', { from: bob }));
        res = await this.plotManagerWeb3.methods.getApplicationById(aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });
    });

    describe('#rejectApplication()', () => {
      beforeEach(async function() {
        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });

        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
      });

      it('should allow a validator reject application', async function() {
        await this.plotManager.rejectApplication(this.aId, 'my reason', { from: bob });
        // TODO: check the message

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REJECTED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
        assert.equal(res.validator.toLowerCase(), bob);
        assert.equal(res.status, ValidationStatus.REJECTED);
        assert.equal(res.message, 'my reason');

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('cat')).call();
        assert.equal(res.validator.toLowerCase(), dan);
        assert.equal(res.status, ValidationStatus.LOCKED);
        assert.equal(res.message, '');
      });

      it('should deny non-validator reject application', async function() {
        await assertRevert(this.plotManager.rejectApplication(this.aId, 'hey', { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny validator revert an application with non-submitted status', async function() {
        await this.plotManager.revertApplication(this.aId, 'some reason', { from: bob });
        await assertRevert(this.plotManager.rejectApplication(this.aId, 'another reason', { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });
    });

    describe('#removeGeohashFromApplication()', () => {
      beforeEach(async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes += ` gbsuv7zq gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
        this.geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        await this.plotManager.addGeohashesToApplication(this.aId, this.geohashes, [], [], { from: alice });
        this.payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();
      });

      describe('new application', () => {
        it('should allow owner partially remove geohashes from an application', async function() {
          const geohashesToRemove = this.geohashes.slice(0, 2);
          let res = await this.spaceToken.ownerOf(galt.geohash5ToTokenId(geohashesToRemove[0]));
          assert.equal(res, this.splitMerge.address);
          res = await this.spaceToken.ownerOf(galt.geohash5ToTokenId(geohashesToRemove[1]));
          assert.equal(res, this.splitMerge.address);

          res = await this.splitMerge.getPackageGeohashesCount(
            '0x0200000000000000000000000000000000000000000000000000000000000000'
          );
          assert.equal(res, 18);

          await this.plotManager.removeGeohashesFromApplication(this.aId, geohashesToRemove, [], [], {
            from: alice
          });

          res = await this.spaceToken.ownerOf(galt.geohash5ToTokenId(geohashesToRemove[0]));
          assert.equal(res, this.plotManager.address);
          res = await this.spaceToken.ownerOf(galt.geohash5ToTokenId(geohashesToRemove[1]));
          assert.equal(res, this.plotManager.address);

          res = await this.splitMerge.getPackageGeohashesCount(
            '0x0200000000000000000000000000000000000000000000000000000000000000'
          );
          assert.equal(res, 16);
        });

        it('should set DISASSEMBLED on all geohases remove', async function() {
          let res;

          res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();

          const packageGeohashes = await this.splitMerge.getPackageGeohashes(res.packageTokenId);
          const geohashesToRemove = packageGeohashes
            .map(tokenId => galt.tokenIdToGeohash(tokenId.toString(10)))
            .map(galt.geohashToGeohash5);

          res = await this.splitMerge.getPackageGeohashesCount(res.packageTokenId);
          assert.equal(res, 18);

          await this.plotManager.removeGeohashesFromApplication(this.aId, geohashesToRemove, [], [], {
            from: alice
          });

          res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.DISASSEMBLED_BY_APPLICANT);

          res = await this.splitMerge.getPackageGeohashesCount(res.packageTokenId);
          assert.equal(res, 0);
        });
      });

      describe('reverted application', () => {
        beforeEach(async function() {
          await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: this.payment });
          await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
          await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
          await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
          await this.plotManager.revertApplication(this.aId, 'some reason', { from: bob });

          let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();

          const packageGeohashes = await this.splitMerge.getPackageGeohashes(res.packageTokenId);
          this.geohashesToRemove = packageGeohashes
            .map(tokenId => galt.tokenIdToGeohash(tokenId.toString(10)))
            .map(galt.geohashToGeohash5);

          this.packageTokenId = res.packageTokenId;
          res = await this.splitMerge.getPackageGeohashesCount(this.packageTokenId);
          assert.equal(res, 18);
        });

        it('cant be disassembled by any validator role', async function() {
          await assertRevert(
            this.plotManager.removeGeohashesFromApplication(this.aId, this.geohashesToRemove, [], [], {
              from: dan
            })
          );
        });

        it('can be disassembled by an applicant', async function() {
          let res;

          await this.plotManager.removeGeohashesFromApplication(this.aId, this.geohashesToRemove, [], [], {
            from: alice
          });

          res = await this.splitMerge.getPackageGeohashesCount(this.packageTokenId);
          assert.equal(res, 0);

          res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.DISASSEMBLED_BY_APPLICANT);
        });

        it('should revert when accessed by inactive account', async function() {
          await this.validators.removeValidator(bob, { from: coreTeam });
          await assertRevert(
            this.plotManager.removeGeohashesFromApplication(this.aId, this.geohashesToRemove, [], [], {
              from: bob
            })
          );
        });

        it('should revert when accessed by unknown account', async function() {
          await assertRevert(
            this.plotManager.removeGeohashesFromApplication(this.aId, this.geohashesToRemove, [], [], {
              from: frank
            })
          );
        });
      });

      describe('rejected application', () => {
        beforeEach(async function() {
          await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: this.payment });
          await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
          await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
          await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
          await this.plotManager.rejectApplication(this.aId, 'some reason', { from: bob });

          let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();

          const packageGeohashes = await this.splitMerge.getPackageGeohashes(res.packageTokenId);
          this.geohashesToRemove = packageGeohashes
            .map(tokenId => galt.tokenIdToGeohash(tokenId.toString(10)))
            .map(galt.geohashToGeohash5);

          this.packageTokenId = res.packageTokenId;
          res = await this.splitMerge.getPackageGeohashesCount(this.packageTokenId);
          assert.equal(res, 18);
        });

        it('can be disassembled by any validator role', async function() {
          let res;

          await this.plotManager.removeGeohashesFromApplication(this.aId, this.geohashesToRemove, [], [], {
            from: dan
          });

          res = await this.splitMerge.getPackageGeohashesCount(this.packageTokenId);
          assert.equal(res, 0);

          res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.DISASSEMBLED_BY_VALIDATOR);
        });

        it('cant be disassembled by an applicant', async function() {
          let res;

          await this.plotManager.removeGeohashesFromApplication(this.aId, this.geohashesToRemove, [], [], {
            from: alice
          });

          res = await this.splitMerge.getPackageGeohashesCount(this.packageTokenId);
          assert.equal(res, 0);

          res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.DISASSEMBLED_BY_APPLICANT);
        });
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.plotManager.addGeohashesToApplication(this.aId, [], [], [], { from: alice });
        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();

        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });

        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.plotManager.lockApplicationForReview(this.aId, 'human', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'cat', { from: dan });
        await this.plotManager.lockApplicationForReview(this.aId, 'dog', { from: eve });
      });

      describe('on approve', () => {
        beforeEach(async function() {
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
          await this.plotManager.approveApplication(this.aId, this.credentials, { from: eve });
        });

        it('should allow shareholders claim reward', async function() {
          const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
          const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
          const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          await this.plotManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotManager.claimValidatorReward(this.aId, { from: dan });
          await this.plotManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
          const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
          const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          let res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
          assert.equal(res.reward.toString(), '359703511040000000000');
          res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('cat')).call();
          assert.equal(res.reward.toString(), '179851755520000000000');
          res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('dog')).call();
          assert.equal(res.reward.toString(), '179851755520000000000');

          const diffBob = bobsFinalBalance
            .sub(new BN('359703511040000000000')) // <- the diff
            .sub(bobsInitialBalance)
            .add(new BN('10000000000000000')); // <- 0.01 ether

          const diffDan = dansFinalBalance
            .sub(new BN('179851755520000000000')) // <- the diff
            .sub(dansInitialBalance)
            .add(new BN('10000000000000000')); // <- 0.01 ether

          const diffEve = evesFinalBalance
            .sub(new BN('179851755520000000000')) // <- the diff
            .sub(evesInitialBalance)
            .add(new BN('10000000000000000')); // <- 0.01 ether

          const diffOrg = orgsFinalBalance
            .sub(new BN('354334801920000000000')) // <- the diff
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
      });

      describe('on reject', () => {
        it('should allow validators claim reward after reject', async function() {
          await this.plotManager.rejectApplication(this.aId, this.credentials, { from: bob });

          let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
          const { packageTokenId } = res;

          const packageGeohashes = await this.splitMerge.getPackageGeohashes(packageTokenId);
          const geohashesToRemove = packageGeohashes
            .map(tokenId => galt.tokenIdToGeohash(tokenId.toString(10)))
            .map(galt.geohashToGeohash5);

          await this.plotManager.removeGeohashesFromApplication(this.aId, geohashesToRemove, [], [], {
            from: bob
          });

          const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));
          const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
          await this.plotManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
          const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
          assert.equal(res.reward.toString(), '359703511040000000000');

          // eves fee is around (100 - 33) / 100 * 6 ether * 50%  = 1005000000000000000 wei
          // assume that the commission paid by bob isn't greater than 0.1 ether

          const diffOrg = orgsFinalBalance
            .sub(new BN('354334801920000000000')) // <- the diff
            .sub(orgsInitialBalance)
            .add(new BN('10000000000000000')); // <- 0.01 ether

          const diff = bobsFinalBalance
            .sub(new BN('359703511040000000000')) // <- the diff
            .sub(bobsInitialBalance)
            .add(new BN('10000000000000000')); // <- 0.01 ether

          const max = new BN('10000000000000000'); // <- 0.01 ether
          const min = new BN('0');

          assert(
            diff.lt(max), // diff < 0.01 ether
            `Expected ${web3.utils.fromWei(diff.toString(10))} to be less than 0.01 ether`
          );

          assert(
            diff.gt(min), // diff > 0
            `Expected ${web3.utils.fromWei(diff.toString(10))} to be greater than 0`
          );

          assert(
            diffOrg.lt(max), // diff < 0.01 ether
            `Expected ${web3.utils.fromWei(diffOrg.toString(10))} to be less than 0.01 ether`
          );

          assert(
            diffOrg.gt(min), // diff > 0
            `Expected ${web3.utils.fromWei(diffOrg.toString(10))} to be greater than 0`
          );
        });
      });
    });
  });
});
