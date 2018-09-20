const PlotManager = artifacts.require('./PlotManager.sol');
const PlotValuation = artifacts.require('./PlotValuation.sol');
const PlotCustodianManager = artifacts.require('./PlotCustodianManager.sol');
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

const web3 = new Web3(PlotValuation.web3.currentProvider);
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const NEW_APPLICATION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const VALUATION_APPLICATION = '0x619647f9036acf2e8ad4ea6c06ae7256e68496af59818a2b63e51b27a46624e9';
const CUSTODIAN_APPLICATION = '0xe2ce825e66d1e2b4efe1252bf2f9dc4f1d7274c343ac8a9f28b6776eb58188a6';

const PV_APPRAISER_ROLE = 'PV_APPRAISER_ROLE';
const PV_APPRAISER2_ROLE = 'PV_APPRAISER2_ROLE';
const PV_AUDITOR_ROLE = 'PV_AUDITOR_ROLE';
const PC_CUSTODIAN_ROLE = 'PC_CUSTODIAN_ROLE';
const PC_AUDITOR_ROLE = 'PC_AUDITOR_ROLE';

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

const ApplicationStatus = {
  NOT_EXISTS: 0,
  SUBMITTED: 1,
  REVERTED: 2,
  LOCKED: 3,
  REVIEW: 4,
  APPROVED: 5,
  COMPLETED: 6,
  REJECTED: 7,
  CLOSED: 8
};

const ValidationStatus = {
  NOT_EXISTS: 0,
  PENDING: 1,
  LOCKED: 2
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

const Action = {
  ATTACH: 0,
  DETACH: 1
};

Object.freeze(ApplicationStatus);
Object.freeze(ValidationStatus);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

// eslint-disable-next-line
contract('PlotCustodianManager', (accounts) => {
  const [
    coreTeam,
    galtSpaceOrg,
    feeManager,
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
    this.initLedgerIdentifier = 'шц50023中222ائِيل';
    this.attachedDocuments = [
      'a80470dba00d5faf620fd6c51a1ca94668e13cd66fffaee3702f5497a8549053',
      'e96a061ac2a6eeb4a87eecdba4624500b6eae61e18c64ff0672434d3ae137825',
      '9850d829b57b233101525397603baedc32d20288a866514dd5441abe286f4d2e'
    ];

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.validators = await Validators.new({ from: coreTeam });
    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.plotValuation = await PlotValuation.new({ from: coreTeam });
    this.plotCustodianManager = await PlotCustodianManager.new({ from: coreTeam });
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
    await this.plotValuation.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.validators.address,
      this.galtToken.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.plotCustodianManager.initialize(
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
    await this.plotValuation.setFeeManager(feeManager, true, { from: coreTeam });
    await this.plotCustodianManager.setFeeManager(feeManager, true, { from: coreTeam });

    await this.validators.addRoleTo(applicationTypeManager, await this.validators.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(validatorManager, await this.validators.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });

    await this.plotManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotManager.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.plotValuation.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotValuation.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotValuation.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotValuation.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.plotCustodianManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotCustodianManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotCustodianManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotCustodianManager.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.spaceToken.addRoleTo(this.plotManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.galtToken.mint(alice, ether(10000), { from: coreTeam });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.plotValuationWeb3 = new web3.eth.Contract(this.plotValuation.abi, this.plotValuation.address);
    this.plotCustodianManagerWeb3 = new web3.eth.Contract(
      this.plotCustodianManager.abi,
      this.plotCustodianManager.address
    );
  });

  it('should be initialized successfully', async function() {
    (await this.plotValuation.minimalApplicationFeeInEth()).toString(10).should.be.a.bignumber.eq(ether(6));
  });

  describe('contract config modifiers', () => {
    describe('#setGaltSpaceRewardsAddress()', () => {
      it('should allow an owner set rewards address', async function() {
        await this.plotValuation.setGaltSpaceRewardsAddress(bob, { from: coreTeam });
        // const res = await web3.eth.getStorageAt(this.plotValuation.address, 5);
        // assert.equal(res, bob);
      });

      it('should deny non-owner set rewards address', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceRewardsAddress(bob, { from: alice }));
      });
    });

    describe('#setPaymentMethod()', () => {
      it('should allow an owner set a payment method', async function() {
        await this.plotValuation.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: feeManager });
        const res = await this.plotValuation.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_ONLY);
      });

      it('should deny non-owner set a payment method', async function() {
        await assertRevert(this.plotValuation.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: alice }));
        const res = await this.plotValuation.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_AND_GALT);
      });
    });

    describe('#setApplicationFeeInEth()', () => {
      it('should allow an owner set a new minimum fee in ETH', async function() {
        await this.plotValuation.setMinimalApplicationFeeInEth(ether(0.05), { from: feeManager });
        const res = await this.plotValuation.minimalApplicationFeeInEth();
        assert.equal(res, ether(0.05));
      });

      it('should deny any other than owner person set fee in ETH', async function() {
        await assertRevert(this.plotValuation.setMinimalApplicationFeeInEth(ether(0.05), { from: alice }));
      });
    });

    describe('#setApplicationFeeInGalt()', () => {
      it('should allow an owner set a new minimum fee in GALT', async function() {
        await this.plotValuation.setMinimalApplicationFeeInGalt(ether(0.15), { from: feeManager });
        const res = await this.plotValuation.minimalApplicationFeeInGalt();
        assert.equal(res, ether(0.15));
      });

      it('should deny any other than owner person set fee in GALT', async function() {
        await assertRevert(this.plotValuation.setMinimalApplicationFeeInGalt(ether(0.15), { from: alice }));
      });
    });

    describe('#setGaltSpaceEthShare()', () => {
      it('should allow an owner set galtSpace ETH share in percents', async function() {
        await this.plotValuation.setGaltSpaceEthShare('42', { from: feeManager });
        const res = await this.plotValuation.galtSpaceEthShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space EHT share less than 1 percent', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceEthShare('0.5', { from: feeManager }));
      });

      it('should deny owner set Galt Space EHT share grater than 100 percents', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceEthShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceEthShare('20', { from: alice }));
      });
    });

    describe('#setGaltSpaceGaltShare()', () => {
      it('should allow an owner set galtSpace Galt share in percents', async function() {
        await this.plotValuation.setGaltSpaceGaltShare('42', { from: feeManager });
        const res = await this.plotValuation.galtSpaceGaltShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space Galt share less than 1 percent', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceGaltShare('0.5', { from: feeManager }));
      });

      it('should deny owner set Galt Space Galt share grater than 100 percents', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceGaltShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotValuation.setGaltSpaceGaltShare('20', { from: alice }));
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
        VALUATION_APPLICATION,
        [PV_APPRAISER_ROLE, PV_APPRAISER2_ROLE, PV_AUDITOR_ROLE],
        [50, 25, 25],
        ['', '', ''],
        { from: applicationTypeManager }
      );
      this.resClarificationAddRoles = await this.validators.setApplicationTypeRoles(
        CUSTODIAN_APPLICATION,
        [PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE],
        [60, 40],
        ['', ''],
        { from: applicationTypeManager }
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

      await this.validators.addValidator(bob, 'Bob', 'MN', [], [PV_APPRAISER_ROLE, PC_CUSTODIAN_ROLE, 'foo'], {
        from: validatorManager
      });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['bar'], { from: validatorManager });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], [PV_APPRAISER2_ROLE, 'buzz'], {
        from: validatorManager
      });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], [PV_AUDITOR_ROLE], { from: validatorManager });

      await this.plotManager.submitApplication(this.aId, { from: alice, value: this.deposit });
      await this.plotManager.lockApplicationForReview(this.aId, 'foo', { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, 'bar', { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, 'buzz', { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      res = await this.spaceToken.ownerOf(this.packageTokenId);
      assert.equal(res, alice);
      await this.galtToken.approve(this.plotValuation.address, ether(45), { from: alice });
      res = await this.plotValuation.submitApplication(this.packageTokenId, this.attachedDocuments, ether(45), {
        from: alice
      });
      this.aId = res.logs[0].args.id;
      await this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ROLE, { from: bob });
      await this.plotValuation.lockApplication(this.aId, PV_APPRAISER2_ROLE, { from: dan });
      await this.plotValuation.lockApplication(this.aId, PV_AUDITOR_ROLE, { from: eve });
      await this.plotValuation.valuatePlot(this.aId, ether(4500), { from: bob });
      await this.plotValuation.valuatePlot2(this.aId, ether(4500), { from: dan });
      await this.plotValuation.approveValuation(this.aId, { from: eve });
      // TODO: valuate application
    });

    describe('#submitApplication()', () => {
      beforeEach(async () => {});

      it('should allow an applicant pay commission in Galt', async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
        let res = await this.plotCustodianManager.submitApplication(this.packageTokenId, Action.ATTACH, ether(45), {
          from: alice
        });
        this.aId = res.logs[0].args.id;
        res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications without neither payment', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
          await assertRevert(
            this.plotCustodianManager.submitApplication(this.packageTokenId, Action.ATTACH, 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
          await assertRevert(
            this.plotCustodianManager.submitApplication(this.packageTokenId, Action.DETACH, ether(43), {
              from: alice
            })
          );
        });

        it('should calculate corresponding validator and galtspace rewards', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(47), { from: alice });
          let res = await this.plotCustodianManager.submitApplication(this.packageTokenId, Action.ATTACH, ether(47), {
            from: alice
          });
          this.aId = res.logs[0].args.id;

          // validator share - 87%
          // galtspace share - 13%

          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.validatorsReward, '40890000000000000000');
          assert.equal(res.galtSpaceReward, '6110000000000000000');
        });

        it('should calculate validator rewards according to their roles share', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(47), { from: alice });
          let res = await this.plotCustodianManager.submitApplication(this.packageTokenId, Action.DETACH, ether(47), {
            from: alice
          });
          this.aId = res.logs[0].args.id;

          // validator share - 87% (60%/40%)
          // galtspace share - 13%

          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(res.assignedValidatorRoles.map(hexToUtf8), [PC_AUDITOR_ROLE, PC_CUSTODIAN_ROLE]);

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_AUDITOR_ROLE))
            .call();
          assert.equal(res.reward.toString(), '16356000000000000000');

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
            .call();
          assert.equal(res.reward.toString(), '24534000000000000000');
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
        VALUATION_APPLICATION,
        [PV_APPRAISER_ROLE, PV_APPRAISER2_ROLE, PV_AUDITOR_ROLE],
        [50, 25, 25],
        ['', '', ''],
        { from: applicationTypeManager }
      );
      this.resClarificationAddRoles = await this.validators.setApplicationTypeRoles(
        CUSTODIAN_APPLICATION,
        [PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE],
        [60, 40],
        ['', ''],
        { from: applicationTypeManager }
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

      await this.validators.addValidator(bob, 'Bob', 'MN', [], [PV_APPRAISER_ROLE, PC_CUSTODIAN_ROLE, 'foo'], {
        from: validatorManager
      });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['bar', PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE], {
        from: validatorManager
      });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], [PV_APPRAISER2_ROLE, 'buzz'], {
        from: validatorManager
      });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], [PV_AUDITOR_ROLE, PC_AUDITOR_ROLE], {
        from: validatorManager
      });

      await this.plotManager.submitApplication(this.aId, { from: alice, value: this.deposit });
      await this.plotManager.lockApplicationForReview(this.aId, 'foo', { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, 'bar', { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, 'buzz', { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      res = await this.spaceToken.ownerOf(this.packageTokenId);
      assert.equal(res, alice);
    });

    describe('#submitApplication()', () => {
      it('should allow an applicant pay commission in ETH', async function() {
        let res = await this.plotCustodianManager.submitApplication(this.packageTokenId, Action.ATTACH, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(
            this.plotCustodianManager.submitApplication(this.packageTokenId, Action.ATTACH, 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await assertRevert(
            this.plotCustodianManager.submitApplication(this.packageTokenId, Action.DETACH, 0, {
              from: alice,
              value: 10
            })
          );
        });

        it('should allow applications with payment greater than required', async function() {
          await this.plotCustodianManager.submitApplication(this.packageTokenId, Action.DETACH, 0, {
            from: alice,
            value: ether(23)
          });
        });

        it('should calculate corresponding validator and galtspace rewards', async function() {
          let res = await this.plotCustodianManager.submitApplication(this.packageTokenId, Action.DETACH, 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          // validator share - 67%
          // galtspace share - 33%

          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.galtSpaceReward, '2310000000000000000');
          assert.equal(res.validatorsReward, '4690000000000000000');
        });

        it('should calculate validator rewards according to their roles share', async function() {
          let res = await this.plotCustodianManager.submitApplication(this.packageTokenId, Action.DETACH, 0, {
            from: alice,
            value: ether(13)
          });
          this.aId = res.logs[0].args.id;
          // validator share - 67% (60%/40%);
          // galtspace share - 33%;

          res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.sameMembers(res.assignedValidatorRoles.map(hexToUtf8), [PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE]);

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_AUDITOR_ROLE))
            .call();
          assert.equal(res.reward.toString(), '3484000000000000000');

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
            .call();
          assert.equal(res.reward.toString(), '5226000000000000000');
        });
      });
    });

    describe('#acceptApplication() by a custodian', () => {
      beforeEach(async function() {
        const res = await this.plotCustodianManager.submitApplication(this.packageTokenId, Action.ATTACH, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
      });

      it('should allow custodian accepting a submitted application', async function() {
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });

        let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotCustodianManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
          .call();
        assert.equal(res.validator.toLowerCase(), bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotCustodianManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex(PC_AUDITOR_ROLE))
          .call();
        assert.equal(res.validator.toLowerCase(), zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      // eslint-disable-next-line
      it('should deny a custodian with the same role accepting an already accepted application', async function() {
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
        await assertRevert(this.plotCustodianManager.acceptApplication(this.aId, { from: charlie }));
      });

      it('should deny non-custodian accepting an application', async function() {
        await assertRevert(this.plotCustodianManager.lockApplication(this.aId, { from: bob }));
      });

      // eslint-disable-next-line
      it('should change status to LOCKED if the accepting application is already locked by an auditor', async function() {
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });

        const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.LOCKED);
      });
    });

    describe('#lockApplication() by an auditor', () => {
      beforeEach(async function() {
        const res = await this.plotCustodianManager.submitApplication(this.packageTokenId, Action.ATTACH, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
      });

      it('should allow auditor locking a submitted application', async function() {
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });

        let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.plotCustodianManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex(PC_AUDITOR_ROLE))
          .call();
        assert.equal(res.validator.toLowerCase(), eve);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotCustodianManagerWeb3.methods
          .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
          .call();
        assert.equal(res.validator.toLowerCase(), zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      // eslint-disable-next-line
      it('should deny an auditor with the same role locking an already locked application', async function() {
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await assertRevert(this.plotCustodianManager.lockApplication(this.aId, { from: charlie }));
      });

      it('should deny non-auditor lock an application', async function() {
        await assertRevert(this.plotCustodianManager.lockApplication(this.aId, { from: bob }));
      });

      // eslint-disable-next-line
      it('should change status to LOCKED if the locking application is already accepted by a custodian', async function() {
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });

        const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.LOCKED);
      });
    });
  });
});
