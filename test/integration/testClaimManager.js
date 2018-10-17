const ClaimManager = artifacts.require('./ClaimManager.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Validators = artifacts.require('./Validators.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const { assertEthBalanceChanged, assertGaltBalanceChanged, ether, assertRevert, zeroAddress } = require('../helpers');

const web3 = new Web3(ClaimManager.web3.currentProvider);

const CLAIM_VALIDATORS = '0x6cdf6ab5991983536f64f626597a53b1a46773aa1473467b6d9d9a305b0a03ef';

const CM_JUROR = 'CM_JUROR';

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
  REJECTED: 3,
  REVERTED: 4
};

const ValidationStatus = {
  NOT_EXISTS: 0,
  PENDING: 1,
  LOCKED: 2,
  APPROVED: 3,
  REJECTED: 4
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
contract.only("ClaimManager", (accounts) => {
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
    eve,
    frank,
    george
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
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.validators = await Validators.new({ from: coreTeam });
    this.claimManager = await ClaimManager.new({ from: coreTeam });

    await this.claimManager.initialize(this.validators.address, this.galtToken.address, galtSpaceOrg, {
      from: coreTeam
    });
    await this.claimManager.setFeeManager(feeManager, true, { from: coreTeam });

    await this.validators.addRoleTo(applicationTypeManager, await this.validators.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(validatorManager, await this.validators.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });

    await this.claimManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.claimManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.claimManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.claimManager.setGaltSpaceGaltShare(13, { from: feeManager });
    await this.claimManager.setNofM(2, 3, { from: coreTeam });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });

    this.claimManagerWeb3 = new web3.eth.Contract(this.claimManager.abi, this.claimManager.address);
    this.galtTokenWeb3 = new web3.eth.Contract(this.galtToken.abi, this.galtToken.address);
  });

  it('should be initialized successfully', async function() {
    (await this.claimManager.minimalApplicationFeeInEth()).toString(10).should.be.a.bignumber.eq(ether(6));
  });

  describe('contract config modifiers', () => {
    describe('#setGaltSpaceRewardsAddress()', () => {
      it('should allow an owner set rewards address', async function() {
        await this.claimManager.setGaltSpaceRewardsAddress(bob, { from: coreTeam });
      });

      it('should deny non-owner set rewards address', async function() {
        await assertRevert(this.claimManager.setGaltSpaceRewardsAddress(bob, { from: alice }));
      });
    });

    describe('#setPaymentMethod()', () => {
      it('should allow an owner set a payment method', async function() {
        await this.claimManager.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: feeManager });
        const res = await this.claimManager.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_ONLY);
      });

      it('should deny non-owner set a payment method', async function() {
        await assertRevert(this.claimManager.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: alice }));
        const res = await this.claimManager.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_AND_GALT);
      });
    });

    describe('#setApplicationFeeInEth()', () => {
      it('should allow an owner set a new minimum fee in ETH', async function() {
        await this.claimManager.setMinimalApplicationFeeInEth(ether(0.05), { from: feeManager });
        const res = await this.claimManager.minimalApplicationFeeInEth();
        assert.equal(res, ether(0.05));
      });

      it('should deny any other than owner person set fee in ETH', async function() {
        await assertRevert(this.claimManager.setMinimalApplicationFeeInEth(ether(0.05), { from: alice }));
      });
    });

    describe('#setApplicationFeeInGalt()', () => {
      it('should allow an owner set a new minimum fee in GALT', async function() {
        await this.claimManager.setMinimalApplicationFeeInGalt(ether(0.15), { from: feeManager });
        const res = await this.claimManager.minimalApplicationFeeInGalt();
        assert.equal(res, ether(0.15));
      });

      it('should deny any other than owner person set fee in GALT', async function() {
        await assertRevert(this.claimManager.setMinimalApplicationFeeInGalt(ether(0.15), { from: alice }));
      });
    });

    describe('#setGaltSpaceEthShare()', () => {
      it('should allow an owner set galtSpace ETH share in percents', async function() {
        await this.claimManager.setGaltSpaceEthShare('42', { from: feeManager });
        const res = await this.claimManager.galtSpaceEthShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space EHT share less than 1 percent', async function() {
        await assertRevert(this.claimManager.setGaltSpaceEthShare('0.5', { from: feeManager }));
      });

      it('should deny owner set Galt Space EHT share grater than 100 percents', async function() {
        await assertRevert(this.claimManager.setGaltSpaceEthShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.claimManager.setGaltSpaceEthShare('20', { from: alice }));
      });
    });

    describe('#setGaltSpaceGaltShare()', () => {
      it('should allow an owner set galtSpace Galt share in percents', async function() {
        await this.claimManager.setGaltSpaceGaltShare('42', { from: feeManager });
        const res = await this.claimManager.galtSpaceGaltShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space Galt share less than 1 percent', async function() {
        await assertRevert(this.claimManager.setGaltSpaceGaltShare('0.5', { from: feeManager }));
      });

      it('should deny owner set Galt Space Galt share grater than 100 percents', async function() {
        await assertRevert(this.claimManager.setGaltSpaceGaltShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.claimManager.setGaltSpaceGaltShare('20', { from: alice }));
      });
    });

    describe('#setNofM()', () => {
      it('should allow an owner set N of M', async function() {
        await this.claimManager.setNofM(2, 3, { from: coreTeam });

        let res = await this.claimManager.n();
        assert.equal(res.toString(10), '2');

        res = await this.claimManager.m();
        assert.equal(res.toString(10), '3');
      });

      it('should deny owner set M less than N', async function() {
        await assertRevert(this.claimManager.setNofM(3, 2, { from: coreTeam }));
      });

      it('should deny owner set N less than 1', async function() {
        await assertRevert(this.claimManager.setNofM(0, 2, { from: coreTeam }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.claimManager.setNofM(2, 3, { from: alice }));
      });
    });
  });

  describe('#claim()', () => {
    describe('with GALT payments', () => {
      it('should create a new application with SUBMITTED status', async function() {
        await this.galtToken.approve(this.claimManager.address, ether(45), { from: alice });
        let res = await this.claimManager.submit(
          alice,
          ether(35),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          ether(45),
          { from: alice }
        );

        this.aId = res.logs[0].args.id;

        res = await this.claimManagerWeb3.methods.claim(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await this.galtToken.approve(this.claimManager.address, ether(45), { from: alice });
          await assertRevert(
            this.claimManager.submit(alice, ether(35), this.attachedDocuments.map(galt.ipfsHashToBytes32), 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await this.galtToken.approve(this.claimManager.address, ether(45), { from: alice });
          await assertRevert(
            this.claimManager.submit(alice, ether(35), this.attachedDocuments.map(galt.ipfsHashToBytes32), ether(20), {
              from: alice
            })
          );
        });

        it('should reject applications with both ETH and GALT payments', async function() {
          await this.galtToken.approve(this.claimManager.address, ether(45), { from: alice });
          await assertRevert(
            this.claimManager.submit(alice, ether(35), this.attachedDocuments.map(galt.ipfsHashToBytes32), ether(45), {
              from: alice,
              value: ether(10)
            })
          );
        });

        it('should calculate corresponding validator and galtspace rewards', async function() {
          await this.galtToken.approve(this.claimManager.address, ether(53), { from: alice });
          let res = await this.claimManager.submit(
            alice,
            ether(35),
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            ether(53),
            { from: alice }
          );

          this.aId = res.logs[0].args.id;

          res = await this.claimManagerWeb3.methods.claim(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);

          res = await this.claimManagerWeb3.methods.claimFees(this.aId).call();
          assert.equal(res.currency, Currency.GALT);

          assert.equal(res.validatorsReward, ether('46.11'));
          assert.equal(res.galtSpaceReward, ether('6.89'));
        });
      });
    });

    describe('with ETH payments', () => {
      it('should create a new application with SUBMITTED status', async function() {
        let res = await this.claimManager.submit(
          alice,
          ether(35),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          0,
          { from: alice, value: ether(7) }
        );

        this.aId = res.logs[0].args.id;

        res = await this.claimManagerWeb3.methods.claim(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(
            this.claimManager.submit(alice, ether(35), this.attachedDocuments.map(galt.ipfsHashToBytes32), 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await assertRevert(
            this.claimManager.submit(alice, ether(35), this.attachedDocuments.map(galt.ipfsHashToBytes32), 0, {
              from: alice,
              value: ether(4)
            })
          );
        });

        it('should calculate corresponding validator and galtspace rewards', async function() {
          let res = await this.claimManager.submit(
            alice,
            ether(35),
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            0,
            { from: alice, value: ether(13) }
          );

          this.aId = res.logs[0].args.id;

          res = await this.claimManagerWeb3.methods.claim(this.aId).call();
          assert.equal(res.status, ApplicationStatus.SUBMITTED);

          res = await this.claimManagerWeb3.methods.claimFees(this.aId).call();
          assert.equal(res.currency, Currency.ETH);

          assert.equal(res.validatorsReward, ether('8.71'));
          assert.equal(res.galtSpaceReward, ether('4.29'));
        });
      });
    });
  });

  describe('pipeline', () => {
    beforeEach(async function() {
      await this.claimManager.setNofM(3, 5, { from: coreTeam });
      await this.validators.setApplicationTypeRoles(CLAIM_VALIDATORS, [CM_JUROR], [100], [''], {
        from: applicationTypeManager
      });
      await this.validators.addValidator(bob, 'Bob', 'MN', [], [CM_JUROR], { from: validatorManager });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], [CM_JUROR], { from: validatorManager });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], [CM_JUROR], { from: validatorManager });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], [CM_JUROR], { from: validatorManager });
      await this.validators.addValidator(frank, 'Frank', 'MN', [], [CM_JUROR], { from: validatorManager });

      const res = await this.claimManager.submit(
        alice,
        ether(35),
        this.attachedDocuments.map(galt.ipfsHashToBytes32),
        0,
        { from: alice, value: ether(7) }
      );

      this.cId = res.logs[0].args.id;
    });

    describe('#lock()', () => {
      it('should allow any super-validator lock <=m slots', async function() {
        let res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.claimManager.lock(this.cId, { from: bob });
        await assertRevert(this.claimManager.lock(this.cId, { from: bob }));
        await this.claimManager.lock(this.cId, { from: charlie });
        await this.claimManager.lock(this.cId, { from: dan });
        await this.claimManager.lock(this.cId, { from: eve });
        await this.claimManager.lock(this.cId, { from: frank });
        await assertRevert(this.claimManager.lock(this.cId, { from: george }));

        res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 5);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);
      });
    });
  });
});
