const PlotManager = artifacts.require('./PlotManager.sol');
const PlotManagerLib = artifacts.require('./PlotManagerLib.sol');
const PlotValuation = artifacts.require('./PlotValuation.sol');
const PlotCustodianManager = artifacts.require('./PlotCustodianManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Validators = artifacts.require('./Validators.sol');
const ValidatorStakes = artifacts.require('./ValidatorStakes.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  initHelperArtifacts,
  ether,
  assertEqualBN,
  assertRevert,
  zeroAddress,
  deploySplitMerge
} = require('../helpers');

const web3 = new Web3(PlotValuation.web3.currentProvider);
const { BN, utf8ToHex } = Web3.utils;
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

initHelperWeb3(web3);
initHelperArtifacts(artifacts);
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
    this.initLedgerIdentifier = 'шц50023中222ائِيل';
    this.attachedDocuments = [
      'QmYNQJoKGNHTpPxCBPh9KkDpaExgd2duMa3aF6ytMpHdao',
      'QmeveuwF5wWBSgUXLG6p1oxF3GKkgjEnhA6AAwHUoVsx6E',
      'QmSrPmbaUKA3ZodhzPWZnpFgcPMFWF4QsxXbkWfEptTBJd'
    ];

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.heights = [1, 2, 3];
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.plotManagerLib = await PlotManagerLib.new({ from: coreTeam });
    PlotManager.link('PlotManagerLib', this.plotManagerLib.address);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.validators = await Validators.new({ from: coreTeam });
    this.validatorStakes = await ValidatorStakes.new({ from: coreTeam });
    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.plotValuation = await PlotValuation.new({ from: coreTeam });
    this.plotCustodianManager = await PlotCustodianManager.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });

    this.splitMerge = await deploySplitMerge();

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
      // PlotEscrow integration doesn't required here
      zeroAddress,
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
    await this.plotValuation.setFeeManager(feeManager, true, { from: coreTeam });
    await this.plotCustodianManager.setFeeManager(feeManager, true, { from: coreTeam });

    await this.validators.addRoleTo(applicationTypeManager, await this.validators.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(validatorManager, await this.validators.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(this.validatorStakes.address, await this.validators.ROLE_VALIDATOR_STAKES(), {
      from: coreTeam
    });

    await this.splitMerge.addRoleTo(this.plotManager.address, await this.splitMerge.GEO_DATA_MANAGER(), {
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

    await this.validators.setRoleMinimalDeposit(PV_APPRAISER_ROLE, ether(30), { from: applicationTypeManager });
    await this.validators.setRoleMinimalDeposit(PV_APPRAISER2_ROLE, ether(30), { from: applicationTypeManager });
    await this.validators.setRoleMinimalDeposit(PV_AUDITOR_ROLE, ether(30), { from: applicationTypeManager });
    await this.validators.setRoleMinimalDeposit(PC_CUSTODIAN_ROLE, ether(30), { from: applicationTypeManager });
    await this.validators.setRoleMinimalDeposit(PC_AUDITOR_ROLE, ether(30), { from: applicationTypeManager });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

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

      await this.galtToken.approve(this.validatorStakes.address, ether(1500), { from: alice });
      await this.validatorStakes.stake(bob, PV_APPRAISER_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(bob, PC_CUSTODIAN_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(bob, 'foo', ether(30), { from: alice });
      await this.validatorStakes.stake(charlie, PC_CUSTODIAN_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(charlie, 'bar', ether(30), { from: alice });
      await this.validatorStakes.stake(charlie, PC_AUDITOR_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(dan, PV_APPRAISER2_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(dan, 'buzz', ether(30), { from: alice });
      await this.validatorStakes.stake(eve, PV_AUDITOR_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(eve, PC_AUDITOR_ROLE, ether(30), { from: alice });

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

      await this.plotManager.lockApplicationForReview(this.aId, 'foo', { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, 'bar', { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, 'buzz', { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
      await this.galtToken.approve(this.plotValuation.address, ether(45), { from: alice });
      res = await this.plotValuation.submitApplication(
        this.spaceTokenId,
        this.attachedDocuments.map(galt.ipfsHashToBytes32),
        ether(45),
        {
          from: alice
        }
      );
      this.aId = res.logs[0].args.id;
      await this.plotValuation.lockApplication(this.aId, PV_APPRAISER_ROLE, { from: bob });
      await this.plotValuation.lockApplication(this.aId, PV_APPRAISER2_ROLE, { from: dan });
      await this.plotValuation.lockApplication(this.aId, PV_AUDITOR_ROLE, { from: eve });
      await this.plotValuation.valuatePlot(this.aId, ether(4500), { from: bob });
      await this.plotValuation.valuatePlot2(this.aId, ether(4500), { from: dan });
      await this.plotValuation.approveValuation(this.aId, { from: eve });
    });

    describe('#submitApplication()', () => {
      beforeEach(async () => {});

      it('should allow an applicant pay commission in Galt', async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
        let res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, ether(45), {
          from: alice
        });
        this.aId = res.logs[0].args.id;
        res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
          await assertRevert(
            this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
          await assertRevert(
            this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.DETACH, bob, ether(43), {
              from: alice
            })
          );
        });

        it('should calculate corresponding validator and galtspace rewards', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(47), { from: alice });
          let res = await this.plotCustodianManager.submitApplication(
            this.spaceTokenId,
            Action.ATTACH,
            bob,
            ether(47),
            {
              from: alice
            }
          );
          this.aId = res.logs[0].args.id;

          // validator share - 87%
          // galtspace share - 13%

          res = await this.plotCustodianManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
          assert.equal(res.validatorsReward, '40890000000000000000');
          assert.equal(res.galtSpaceReward, '6110000000000000000');
        });

        it('should calculate validator rewards according to their roles share', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(47), { from: alice });
          let res = await this.plotCustodianManager.submitApplication(
            this.spaceTokenId,
            Action.DETACH,
            bob,
            ether(47),
            {
              from: alice
            }
          );
          this.aId = res.logs[0].args.id;

          // validator share - 87% (60%/40%)
          // galtspace share - 13%

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

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(47), { from: alice });
        const res = await this.plotCustodianManager.submitApplication(
          this.spaceTokenId,
          Action.ATTACH,
          bob,
          ether(47),
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
        await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
        await this.plotCustodianManager.attachToken(this.aId, {
          from: alice
        });
        await this.plotCustodianManager.approveApplication(this.aId, { from: eve });
        await this.plotCustodianManager.approveApplication(this.aId, { from: alice });
      });

      describe('for COMPLETED applications', () => {
        beforeEach(async function() {
          await this.plotCustodianManager.approveApplication(this.aId, { from: bob });
          await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });
        });

        it('should be allowed', async function() {
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationFinanceById(this.aId).call();

          assert.equal(res.status, ApplicationStatus.COMPLETED);
          assert.equal(res.galtSpaceRewardPaidOut, true);

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
            .call();
          assert.equal(res.rewardPaidOut, true);

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_AUDITOR_ROLE))
            .call();
          assert.equal(res.rewardPaidOut, true);
        });

        it('should send funds to claimers', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

          const res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
            .call();
          assert.equal(res.reward.toString(), '24534000000000000000');

          // bobs fee is (100 - 13) / 100 * 47 ether * 60%  = 24534000000000000000 wei

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('24534000000000000000')));
          assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('16356000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('6110000000000000000')));
        });

        it('should revert on double claim', async function() {
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob }));
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });

        it('should revert on non-validator claim', async function() {
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: bob }));
        });

        it('should revert on applicant claim attempt', async function() {
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: alice }));
        });
      });

      describe('for CLOSED applications', () => {
        beforeEach(async function() {
          await this.plotCustodianManager.rejectApplication(this.aId, 'fix it', { from: bob });
          await this.plotCustodianManager.closeApplication(this.aId, { from: alice });
        });

        it('should be allowed', async function() {
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationFinanceById(this.aId).call();

          assert.equal(res.status, ApplicationStatus.CLOSED);
          assert.equal(res.galtSpaceRewardPaidOut, true);

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
            .call();
          assert.equal(res.rewardPaidOut, true);

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_AUDITOR_ROLE))
            .call();
          assert.equal(res.rewardPaidOut, true);
        });

        it('should send funds to claimers', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(galtSpaceOrg)).toString());

          const res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
            .call();
          assert.equal(res.reward.toString(), '24534000000000000000');

          // bobs fee is (100 - 13) / 100 * 47 ether * 60%  = 24534000000000000000 wei

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('24534000000000000000')));
          assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('16356000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('6110000000000000000')));
        });

        it('should revert on double claim', async function() {
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob }));
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });

        it('should revert on non-validator claim', async function() {
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: bob }));
        });

        it('should revert on applicant claim attempt', async function() {
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: alice }));
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
      await this.galtToken.approve(this.validatorStakes.address, ether(1500), { from: alice });
      await this.validatorStakes.stake(bob, PV_APPRAISER_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(bob, PC_CUSTODIAN_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(bob, 'foo', ether(30), { from: alice });
      await this.validatorStakes.stake(charlie, 'bar', ether(30), { from: alice });
      await this.validatorStakes.stake(charlie, PC_CUSTODIAN_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(charlie, PC_AUDITOR_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(dan, PV_APPRAISER2_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(dan, 'buzz', ether(30), { from: alice });
      await this.validatorStakes.stake(eve, PV_AUDITOR_ROLE, ether(30), { from: alice });
      await this.validatorStakes.stake(eve, PC_AUDITOR_ROLE, ether(30), { from: alice });

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

      await this.plotManager.lockApplicationForReview(this.aId, 'foo', { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, 'bar', { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, 'buzz', { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
    });

    describe('#submitApplication() by an applicant', () => {
      it('should allow an applicant pay commission in ETH', async function() {
        let res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should reject applications if chosen custodian is invalid', async function() {
        await assertRevert(
          this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.DETACH, dan, 0, {
            from: alice,
            value: ether(20)
          })
        );
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(
            this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, 0, bob, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await assertRevert(
            this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.DETACH, bob, 0, {
              from: alice,
              value: 10
            })
          );
        });

        it('should allow applications with payment greater than required', async function() {
          await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.DETACH, bob, 0, {
            from: alice,
            value: ether(23)
          });
        });

        it('should calculate corresponding validator and galtspace rewards', async function() {
          let res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.DETACH, bob, 0, {
            from: alice,
            value: ether(7)
          });
          this.aId = res.logs[0].args.id;
          // validator share - 67%
          // galtspace share - 33%

          res = await this.plotCustodianManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
          assert.equal(res.galtSpaceReward, '2310000000000000000');
          assert.equal(res.validatorsReward, '4690000000000000000');
        });

        it('should calculate validator rewards according to their roles share', async function() {
          let res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.DETACH, bob, 0, {
            from: alice,
            value: ether(13)
          });
          this.aId = res.logs[0].args.id;
          // validator share - 67% (60%/40%);
          // galtspace share - 33%;

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
        const res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
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

      it('should deny a non-chosen custodian accepting an  application', async function() {
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
        const res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
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

    describe('#revertApplication() by a custodian', () => {
      beforeEach(async function() {
        const res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
      });

      it('should allow custodian revert application if he wont work on it', async function() {
        await this.plotCustodianManager.revertApplication(this.aId, { from: bob });

        const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should allow custodian revert application even if an auditor already locked it', async function() {
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await this.plotCustodianManager.revertApplication(this.aId, { from: bob });

        const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should deny a non-chosen custodian reverting an  application', async function() {
        await assertRevert(this.plotCustodianManager.revertApplication(this.aId, { from: charlie }));
      });

      it('should deny double revert of the same application', async function() {
        await this.plotCustodianManager.revertApplication(this.aId, { from: bob });
        await assertRevert(this.plotCustodianManager.revertApplication(this.aId, { from: bob }));
      });

      it('should deny non-custodian revert an application', async function() {
        await assertRevert(this.plotCustodianManager.revertApplication(this.aId, { from: eve }));
      });
    });

    describe('#resubmitApplication() by an applicant', () => {
      beforeEach(async function() {
        const res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.revertApplication(this.aId, { from: bob });
      });

      it('should allow an applicant to resubmit an application with the same payload', async function() {
        await this.plotCustodianManager.resubmitApplication(this.aId, this.spaceTokenId, Action.ATTACH, bob, {
          from: alice
        });

        const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should allow an applicant to resubmit an application with different payload', async function() {
        await this.plotCustodianManager.resubmitApplication(this.aId, this.spaceTokenId, Action.DETACH, charlie, {
          from: alice
        });

        const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.action, Action.DETACH);
        assert.equal(res.chosenCustodian.toLowerCase(), charlie);
      });

      it('should deny a non-applicant resubmitting an  application', async function() {
        await assertRevert(
          this.plotCustodianManager.resubmitApplication(this.aId, this.spaceTokenId, Action.DETACH, charlie, {
            from: charlie
          })
        );
      });
    });

    describe('#attachToken() by an applicant', () => {
      beforeEach(async function() {
        const res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
      });

      it('should allow an applicant attaching package token to the application', async function() {
        await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
        await this.plotCustodianManager.attachToken(this.aId, {
          from: alice
        });

        let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVIEW);

        res = await this.spaceToken.ownerOf(this.spaceTokenId);
        assert.equal(res.toLowerCase(), this.plotCustodianManager.address);
      });

      it('should deny a non-validator attaching token to an application', async function() {
        await assertRevert(this.plotCustodianManager.attachToken(this.aId, { from: charlie }));
      });
    });

    describe('#attachDocuments() by a custodian', () => {
      beforeEach(async function() {
        const res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
        await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
        await this.plotCustodianManager.attachToken(this.aId, {
          from: alice
        });
      });

      it('should allow a custodian attaching documents to an application', async function() {
        await this.plotCustodianManager.attachDocuments(this.aId, this.attachedDocuments.map(galt.ipfsHashToBytes32), {
          from: bob
        });

        const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVIEW);
        assert.sameMembers(res.custodianDocuments.map(galt.bytes32ToIpfsHash), this.attachedDocuments);
      });

      it('should deny a non-custodian of the application attaching documents to it', async function() {
        await assertRevert(
          this.plotCustodianManager.attachDocuments(this.aId, this.attachedDocuments.map(galt.ipfsHashToBytes32), {
            from: charlie
          })
        );
      });
    });

    describe('#approveApplication() by 3 of 3 (applicant, custodian and auditor)', () => {
      beforeEach(async function() {
        const res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
        await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
        await this.plotCustodianManager.attachToken(this.aId, {
          from: alice
        });
      });

      it('should change application status to APPROVED if all 3 roles voted', async function() {
        await this.plotCustodianManager.approveApplication(this.aId, { from: eve });
        await this.plotCustodianManager.approveApplication(this.aId, { from: bob });
        await this.plotCustodianManager.approveApplication(this.aId, { from: alice });

        let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.approveConfirmations, 7);
        assert.equal(res.status, ApplicationStatus.APPROVED);

        res = await this.plotCustodianManagerWeb3.methods.assignedCustodians(this.spaceTokenId).call();
        assert.equal(res.toLowerCase(), bob);
      });

      it('should provide an option to remove an already assigned custodian', async function() {
        await this.plotCustodianManager.approveApplication(this.aId, { from: eve });
        await this.plotCustodianManager.approveApplication(this.aId, { from: bob });
        await this.plotCustodianManager.approveApplication(this.aId, { from: alice });

        let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.approveConfirmations, 7);
        assert.equal(res.status, ApplicationStatus.APPROVED);

        res = await this.plotCustodianManagerWeb3.methods.assignedCustodians(this.spaceTokenId).call();
        assert.equal(res.toLowerCase(), bob);
        await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });

        // Detaching
        res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.DETACH, bob, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
        await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
        await this.plotCustodianManager.attachToken(this.aId, {
          from: alice
        });
        await this.plotCustodianManager.approveApplication(this.aId, { from: eve });
        await this.plotCustodianManager.approveApplication(this.aId, { from: bob });
        await this.plotCustodianManager.approveApplication(this.aId, { from: alice });

        res = await this.plotCustodianManagerWeb3.methods.assignedCustodians(this.spaceTokenId).call();
        assert.equal(res, zeroAddress);
      });

      it('should keep application status in REVIEW if not all participants voted yet', async function() {
        await this.plotCustodianManager.approveApplication(this.aId, { from: bob });
        await this.plotCustodianManager.approveApplication(this.aId, { from: alice });

        const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.approveConfirmations, 5);
        assert.equal(res.status, ApplicationStatus.REVIEW);
      });
    });

    describe('#rejectApplication() by custodian', () => {
      beforeEach(async function() {
        const res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
        await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
        await this.plotCustodianManager.attachToken(this.aId, {
          from: alice
        });
      });

      it('should change application status to REJECTED', async function() {
        await this.plotCustodianManager.approveApplication(this.aId, { from: eve });
        await this.plotCustodianManager.approveApplication(this.aId, { from: alice });
        await this.plotCustodianManager.rejectApplication(this.aId, 'fix it', { from: bob });

        const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });

      it('should deny non-custodian perform this action', async function() {
        await assertRevert(this.plotCustodianManager.rejectApplication(this.aId, 'fix it', { from: eve }));

        const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.REVIEW);
      });
    });

    describe('#withdrawToken() by an applicant', () => {
      beforeEach(async function() {
        const res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
        await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
        await this.plotCustodianManager.attachToken(this.aId, {
          from: alice
        });
        await this.plotCustodianManager.approveApplication(this.aId, { from: eve });
        await this.plotCustodianManager.approveApplication(this.aId, { from: bob });
        await this.plotCustodianManager.approveApplication(this.aId, { from: alice });
      });

      it('should allow an applicant withdraw the attached token', async function() {
        await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });

        let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.COMPLETED);

        res = await this.spaceToken.ownerOf(this.spaceTokenId);
        assert.equal(res.toLowerCase(), alice);
      });

      it('should deny non-applicant withdraw the token', async function() {
        await assertRevert(this.plotCustodianManager.withdrawToken(this.aId, { from: eve }));

        let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);

        res = await this.spaceToken.ownerOf(this.spaceTokenId);
        assert.equal(res.toLowerCase(), this.plotCustodianManager.address);
      });
    });

    describe('#closeApplication() by an applicant', () => {
      beforeEach(async function() {
        const res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
      });

      describe('when application status is LOCKED', () => {
        it('should allow an applicant close the application', async function() {
          await this.plotCustodianManager.closeApplication(this.aId, { from: alice });

          const res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.CLOSED);
        });

        it('should deny non-applicant closing the application', async function() {
          await assertRevert(this.plotCustodianManager.closeApplication(this.aId, { from: eve }));
        });
      });

      describe('when application status is REJECTED', () => {
        beforeEach(async function() {
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, {
            from: alice
          });
          await this.plotCustodianManager.approveApplication(this.aId, { from: eve });
          await this.plotCustodianManager.approveApplication(this.aId, { from: alice });
          await this.plotCustodianManager.rejectApplication(this.aId, 'fix it', { from: bob });
        });

        it('should allow an applicant to close the application', async function() {
          await this.plotCustodianManager.closeApplication(this.aId, { from: alice });

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.CLOSED);

          res = await this.spaceToken.ownerOf(this.spaceTokenId);
          assert.equal(res.toLowerCase(), alice);
        });

        it('should deny non-applicant closing the application', async function() {
          await assertRevert(this.plotCustodianManager.closeApplication(this.aId, { from: eve }));
        });
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        const res = await this.plotCustodianManager.submitApplication(this.spaceTokenId, Action.ATTACH, bob, 0, {
          from: alice,
          value: ether(7)
        });
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
        await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
        await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
        await this.plotCustodianManager.attachToken(this.aId, {
          from: alice
        });
        await this.plotCustodianManager.approveApplication(this.aId, { from: eve });
        await this.plotCustodianManager.approveApplication(this.aId, { from: alice });
      });

      describe('for COMPLETED applications', () => {
        beforeEach(async function() {
          await this.plotCustodianManager.approveApplication(this.aId, { from: bob });
          await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });
        });

        it('should be allowed', async function() {
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.COMPLETED);
          assert.equal(res.galtSpaceRewardPaidOut, true);

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
            .call();
          assert.equal(res.rewardPaidOut, true);

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_AUDITOR_ROLE))
            .call();
          assert.equal(res.rewardPaidOut, true);
        });

        it('should send funds to claimers', async function() {
          const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
          const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
          const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          const res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
            .call();
          assert.equal(res.reward.toString(), '2814000000000000000');

          // eves fee is around (100 - 33) / 100 * 7 ether * 40%  = 1876000000000000000 wei
          // assume that the commission paid by bob isn't greater than 0.1 ether

          const diffBob = bobsFinalBalance
            .sub(new BN('2814000000000000000')) // <- the diff
            .sub(bobsInitialBalance)
            .add(new BN('10000000000000000')); // <- 0.01 ether

          const diffEve = evesFinalBalance
            .sub(new BN('1876000000000000000')) // <- the diff
            .sub(evesInitialBalance)
            .add(new BN('10000000000000000')); // <- 0.01 ether

          const diffOrg = orgsFinalBalance
            .sub(new BN('2310000000000000000')) // <- the diff
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
            diffEve.gt(min), // diff > 0
            `Expected ${web3.utils.fromWei(diffEve.toString(10))} to be greater than 0`
          );

          assert(
            diffOrg.gt(min), // diff > 0
            `Expected ${web3.utils.fromWei(diffOrg.toString(10))} to be greater than 0`
          );
        });

        it('should revert on double claim', async function() {
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob }));
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });

        it('should revert on non-validator claim', async function() {
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: bob }));
        });

        it('should revert on applicant claim attempt', async function() {
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: alice }));
        });
      });

      describe('for CLOSED applications', () => {
        beforeEach(async function() {
          await this.plotCustodianManager.rejectApplication(this.aId, 'fix it', { from: bob });
          await this.plotCustodianManager.closeApplication(this.aId, { from: alice });
        });

        it('should be allowed', async function() {
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          let res = await this.plotCustodianManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
          assert.equal(res.status, ApplicationStatus.CLOSED);
          assert.equal(res.galtSpaceRewardPaidOut, true);

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
            .call();
          assert.equal(res.rewardPaidOut, true);

          res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_AUDITOR_ROLE))
            .call();
          assert.equal(res.rewardPaidOut, true);
        });

        it('should send funds to claimers', async function() {
          const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
          const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
          const orgsInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });

          const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
          const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
          const orgsFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));

          const res = await this.plotCustodianManagerWeb3.methods
            .getApplicationValidator(this.aId, utf8ToHex(PC_CUSTODIAN_ROLE))
            .call();
          assert.equal(res.reward.toString(), '2814000000000000000');

          // eves fee is around (100 - 33) / 100 * 7 ether * 40%  = 1876000000000000000 wei
          // assume that the commission paid by bob isn't greater than 0.1 ether

          const diffBob = bobsFinalBalance
            .sub(new BN('2814000000000000000')) // <- the diff
            .sub(bobsInitialBalance)
            .add(new BN('10000000000000000')); // <- 0.01 ether

          const diffEve = evesFinalBalance
            .sub(new BN('1876000000000000000')) // <- the diff
            .sub(evesInitialBalance)
            .add(new BN('10000000000000000')); // <- 0.01 ether

          const diffOrg = orgsFinalBalance
            .sub(new BN('2310000000000000000')) // <- the diff
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
            diffEve.gt(min), // diff > 0
            `Expected ${web3.utils.fromWei(diffEve.toString(10))} to be greater than 0`
          );

          assert(
            diffOrg.gt(min), // diff > 0
            `Expected ${web3.utils.fromWei(diffOrg.toString(10))} to be greater than 0`
          );
        });

        it('should revert on double claim', async function() {
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: bob }));
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: eve }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });

        it('should revert on non-validator claim', async function() {
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: bob }));
        });

        it('should revert on applicant claim attempt', async function() {
          await assertRevert(this.plotCustodianManager.claimValidatorReward(this.aId, { from: alice }));
          await assertRevert(this.plotCustodianManager.claimGaltSpaceReward(this.aId, { from: alice }));
        });
      });
    });
  });
});
