const ClaimManager = artifacts.require('./ClaimManager.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Validators = artifacts.require('./Validators.sol');
const ValidatorStakes = artifacts.require('./ValidatorStakes.sol');

const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const { ether, assertRevert } = require('../helpers');

const { stringToHex } = Web3.utils;

const web3 = new Web3(ClaimManager.web3.currentProvider);

const CLAIM_VALIDATORS = '0x6cdf6ab5991983536f64f626597a53b1a46773aa1473467b6d9d9a305b0a03ef';
const MY_APPLICATION = '0x70042f08921e5b7de231736485f834c3bda2cd3587936c6a668d44c1ccdeddf0';

const CM_AUDITOR = 'CM_AUDITOR';
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
  APPROVED: 2,
  REJECTED: 3,
  REVERTED: 4
};

const Action = {
  APPROVE: 0,
  REJECT: 1
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
Object.freeze(Action);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

// eslint-disable-next-line
contract("ClaimManager", (accounts) => {
  const [
    coreTeam,
    galtSpaceOrg,
    feeManager,
    applicationTypeManager,
    validatorManager,
    multiSigWallet,
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
    this.validatorStakes = await ValidatorStakes.new({ from: coreTeam });

    await this.claimManager.initialize(
      this.validators.address,
      this.galtToken.address,
      this.validatorStakes.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.validatorStakes.initialize(this.validators.address, this.galtToken.address, multiSigWallet, {
      from: coreTeam
    });

    await this.claimManager.setFeeManager(feeManager, true, { from: coreTeam });

    await this.validators.addRoleTo(applicationTypeManager, await this.validators.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(validatorManager, await this.validators.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(this.validatorStakes.address, await this.validators.ROLE_VALIDATOR_STAKES(), {
      from: coreTeam
    });
    await this.validatorStakes.addRoleTo(this.claimManager.address, await this.validatorStakes.ROLE_SLASH_MANAGER(), {
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
    this.validatorStakesWeb3 = new web3.eth.Contract(this.validatorStakes.abi, this.validatorStakes.address);
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
      await this.validators.setApplicationTypeRoles(CLAIM_VALIDATORS, [CM_AUDITOR], [100], [''], {
        from: applicationTypeManager
      });
      await this.validators.setApplicationTypeRoles(
        MY_APPLICATION,
        [PC_AUDITOR_ROLE, PC_CUSTODIAN_ROLE],
        [50, 50],
        ['', ''],
        {
          from: applicationTypeManager
        }
      );

      await this.validators.setRoleMinimalDeposit(CM_AUDITOR, ether(300), { from: applicationTypeManager });
      await this.validators.setRoleMinimalDeposit(PC_AUDITOR_ROLE, ether(200), { from: applicationTypeManager });
      await this.validators.setRoleMinimalDeposit(PC_CUSTODIAN_ROLE, ether(200), { from: applicationTypeManager });

      await this.validators.addValidator(bob, 'Bob', 'MN', [], [CM_AUDITOR], { from: validatorManager });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], [CM_AUDITOR], { from: validatorManager });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], [CM_AUDITOR], { from: validatorManager });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], [CM_AUDITOR], { from: validatorManager });
      await this.validators.addValidator(frank, 'Frank', 'MN', [], [CM_AUDITOR], { from: validatorManager });

      await this.galtToken.approve(this.validatorStakes.address, ether(1500), { from: alice });
      await this.validatorStakes.stake(bob, CM_AUDITOR, ether(300), { from: alice });
      await this.validatorStakes.stake(charlie, CM_AUDITOR, ether(300), { from: alice });
      await this.validatorStakes.stake(dan, CM_AUDITOR, ether(300), { from: alice });
      await this.validatorStakes.stake(eve, CM_AUDITOR, ether(300), { from: alice });
      await this.validatorStakes.stake(frank, CM_AUDITOR, ether(300), { from: alice });

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

      it('should deny non-validator locking a claim', async function() {
        await assertRevert(this.claimManager.lock(this.cId, { from: coreTeam }));
      });

      it('should deny proposal when claim is executed');
    });

    describe('#proposeApproval()', () => {
      beforeEach(async function() {
        const res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
      });

      it('should allow new proposals from members who has already locked the application', async function() {
        let res = await this.claimManager.proposeApproval(this.cId, 'good enough', [dan], [CM_AUDITOR], [ether(20)], {
          from: bob
        });
        const pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          [bob, eve],
          [CM_AUDITOR, CM_AUDITOR],
          [ether(10), ether(20)],
          { from: dan }
        );
        const pId2 = res.logs[0].args.proposalId;

        res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.slotsTaken, 2);

        res = await this.claimManagerWeb3.methods.getProposals(this.cId).call();
        assert.sameMembers(res.map(a => a.toLowerCase()), [pId1, pId2]);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, pId1).call();
        assert.equal(res.from.toLowerCase(), bob);
        assert.equal(res.message, 'good enough');
        assert.equal(res.action, Action.APPROVE);
        assert.sameMembers(res.validators.map(a => a.toLowerCase()), [dan]);
        assert.sameMembers(res.roles.map(web3.utils.hexToString), [CM_AUDITOR]);
        assert.sameMembers(res.fines, [ether(20)]);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, pId2).call();
        assert.equal(res.from.toLowerCase(), dan);
        assert.equal(res.message, 'looks good');
        assert.equal(res.action, Action.APPROVE);
        assert.sameMembers(res.validators.map(a => a.toLowerCase()), [bob, eve]);
        assert.sameMembers(res.roles.map(web3.utils.hexToString), [CM_AUDITOR, CM_AUDITOR]);
        assert.sameMembers(res.fines, [ether(10), ether(20)]);
      });

      it('should deny non-validator proposing a proposal', async function() {
        await assertRevert(this.claimManager.proposeApproval(this.cId, 'looks good', [], [], [], { from: coreTeam }));
      });

      it('should deny validator proposing when claim is not locked', async function() {
        await assertRevert(this.claimManager.proposeApproval(this.cId, 'looks good', [], [], [], { from: eve }));
      });

      it('should allow multiple proposals from the same validator', async function() {
        await this.claimManager.proposeApproval(this.cId, 'good enough', [dan], [CM_AUDITOR], [ether(20)], {
          from: bob
        });
        await this.claimManager.proposeApproval(this.cId, 'good enough', [dan], [CM_AUDITOR], [ether(30)], {
          from: bob
        });
        await this.claimManager.proposeReject(this.cId, 'looks bad', { from: bob });
      });

      it('should deny proposal when claim is executed');
      it('should validator votes for proposal');
    });

    describe('#proposeReject()', () => {
      beforeEach(async function() {
        const res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
      });

      it('should allow new proposals from members who has already locked the application', async function() {
        let res = await this.claimManager.proposeReject(this.cId, 'NOT good enough', { from: bob });
        const pId1 = res.logs[0].args.proposalId;
        res = await this.claimManager.proposeReject(this.cId, 'odd', { from: dan });
        const pId2 = res.logs[0].args.proposalId;

        res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.slotsTaken, 2);

        res = await this.claimManagerWeb3.methods.getProposals(this.cId).call();
        assert.sameMembers(res, [pId1, pId2]);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, pId1).call();
        assert.equal(res.from.toLowerCase(), bob);
        assert.equal(res.message, 'NOT good enough');
        assert.equal(res.action, Action.REJECT);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, pId2).call();
        assert.equal(res.from.toLowerCase(), dan);
        assert.equal(res.message, 'odd');
        assert.equal(res.action, Action.REJECT);
      });

      it('should deny non-validator proposing a proposal', async function() {
        await assertRevert(this.claimManager.proposeReject(this.cId, 'looks bad', { from: coreTeam }));
      });

      it('should deny validator proposing when claim is not locked', async function() {
        await assertRevert(this.claimManager.proposeReject(this.cId, 'looks bad', { from: eve }));
      });

      it('should deny proposal when claim is executed');
      it('validator votes for proposal');
    });

    describe('#vote()', () => {
      beforeEach(async function() {
        let res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });

        res = await this.claimManager.proposeApproval(this.cId, 'good enough', [dan], [CM_AUDITOR], [ether(20)], {
          from: bob
        });
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          [bob, eve],
          [CM_AUDITOR, CM_AUDITOR],
          [ether(10), ether(20)],
          { from: dan }
        );
        this.pId2 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeReject(this.cId, 'NOT good enough', { from: bob });
        this.pId3 = res.logs[0].args.proposalId;
      });

      it('should automatically count proposer voice', async function() {
        // empty array since the vote reassigned to pId3
        let res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId1).call();
        assert.sameMembers(res.votesFor.map(a => a.toLowerCase()), []);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId2).call();
        assert.sameMembers(res.votesFor.map(a => a.toLowerCase()), [dan]);
        //
        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId3).call();
        assert.sameMembers(res.votesFor.map(a => a.toLowerCase()), [bob]);
      });

      it('should reassign slots according a last vote', async function() {
        await this.claimManager.vote(this.cId, this.pId1, { from: bob });
        await this.claimManager.vote(this.cId, this.pId1, { from: dan });

        let res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId1).call();
        assert.sameMembers(res.votesFor.map(a => a.toLowerCase()), [bob, dan]);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId2).call();
        assert.sameMembers(res.votesFor, []);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId3).call();
        assert.sameMembers(res.votesFor, []);
      });

      it('should deny validators with non-locked slots voting', async function() {
        await assertRevert(this.claimManager.vote(this.cId, this.pId1, { from: eve }));
      });

      it('should allow re-voting if validator has changed is mind', async function() {
        await this.claimManager.vote(this.cId, this.pId1, { from: bob });
        await this.claimManager.vote(this.cId, this.pId1, { from: dan });

        let res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId1).call();
        assert.sameMembers(res.votesFor.map(a => a.toLowerCase()), [bob, dan]);
        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId2).call();
        assert.sameMembers(res.votesFor.map(a => a.toLowerCase()), []);
        res = await this.claimManagerWeb3.methods.getVotedFor(this.cId, bob).call();
        assert.equal(res, this.pId1);
        res = await this.claimManagerWeb3.methods.getVotedFor(this.cId, dan).call();
        assert.equal(res, this.pId1);

        await this.claimManager.vote(this.cId, this.pId2, { from: bob });

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId1).call();
        assert.sameMembers(res.votesFor.map(a => a.toLowerCase()), [dan]);
        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId2).call();
        assert.sameMembers(res.votesFor.map(a => a.toLowerCase()), [bob]);
        res = await this.claimManagerWeb3.methods.getVotedFor(this.cId, bob).call();
        assert.equal(res, this.pId2);
        res = await this.claimManagerWeb3.methods.getVotedFor(this.cId, dan).call();
        assert.equal(res, this.pId1);
      });

      it('should deny voting if status is not SUBMITTED', async function() {
        await this.claimManager.vote(this.cId, this.pId1, { from: bob });
        await this.claimManager.vote(this.cId, this.pId1, { from: dan });

        await this.claimManager.lock(this.cId, { from: charlie });
        await this.claimManager.lock(this.cId, { from: eve });

        await this.claimManager.vote(this.cId, this.pId1, { from: charlie });

        await assertRevert(this.claimManager.vote(this.cId, this.pId1, { from: eve }));

        let res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);
        assert.equal(res.slotsTaken, 4);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId1).call();
        assert.equal(res.from.toLowerCase(), bob);
        assert.equal(res.action, Action.APPROVE);
        assert.sameMembers(res.votesFor.map(a => a.toLowerCase()), [dan, bob, charlie]);
      });

      it('should new porposals voting if status is not SUBMITTED', async function() {
        await this.claimManager.vote(this.cId, this.pId1, { from: bob });
        await this.claimManager.vote(this.cId, this.pId1, { from: dan });

        await this.claimManager.lock(this.cId, { from: charlie });
        await this.claimManager.lock(this.cId, { from: eve });

        await this.claimManager.vote(this.cId, this.pId1, { from: charlie });

        await assertRevert(
          this.claimManager.proposeApproval(
            this.cId,
            'looks good',
            [bob, eve],
            [CM_AUDITOR, CM_AUDITOR],
            [ether(15), ether(20)],
            { from: dan }
          )
        );
      });
    });

    describe('on threshold reach', () => {
      beforeEach(async function() {
        let res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.slotsTaken, 0);
        assert.equal(res.slotsThreshold, 3);
        assert.equal(res.totalSlots, 5);

        await this.validators.addValidator(bob, 'Bob', 'MN', [], [PC_CUSTODIAN_ROLE], { from: validatorManager });
        await this.validators.addValidator(eve, 'Eve', 'MN', [], [PC_AUDITOR_ROLE], { from: validatorManager });
        await this.validators.addValidator(dan, 'Dan', 'MN', [], [PC_AUDITOR_ROLE], { from: validatorManager });

        await this.galtToken.approve(this.validatorStakes.address, ether(600), { from: alice });

        await this.validatorStakes.stake(bob, PC_CUSTODIAN_ROLE, ether(200), { from: alice });
        await this.validatorStakes.stake(eve, PC_AUDITOR_ROLE, ether(200), { from: alice });
        await this.validatorStakes.stake(dan, PC_AUDITOR_ROLE, ether(200), { from: alice });

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
        await this.claimManager.lock(this.cId, { from: eve });

        res = await this.claimManager.proposeApproval(this.cId, 'good enough', [dan], [PC_AUDITOR_ROLE], [ether(20)], {
          from: bob
        });
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          [bob, eve],
          [PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE],
          [ether(10), ether(20)],
          { from: dan }
        );
        this.pId2 = res.logs[0].args.proposalId;
      });

      it('should apply proposed slashes', async function() {
        let res = await this.validatorStakesWeb3.methods.stakeOf(bob, stringToHex(PC_CUSTODIAN_ROLE)).call();
        assert.equal(res, ether(200));
        res = await this.validatorStakesWeb3.methods.stakeOf(eve, stringToHex(PC_AUDITOR_ROLE)).call();
        assert.equal(res, ether(200));

        res = await this.validators.isValidatorActive(bob);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleAssigned(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleActive(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, true);

        res = await this.validators.isValidatorActive(eve);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleAssigned(eve, PC_AUDITOR_ROLE);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleActive(eve, PC_AUDITOR_ROLE);
        assert.equal(res, true);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId2).call();
        assert.equal(res.votesFor.length, 1);

        await this.claimManager.vote(this.cId, this.pId2, { from: bob });
        await this.claimManager.vote(this.cId, this.pId2, { from: eve });

        res = await this.validatorStakesWeb3.methods.stakeOf(bob, stringToHex(PC_CUSTODIAN_ROLE)).call();
        assert.equal(res, ether(190));
        res = await this.validatorStakesWeb3.methods.stakeOf(eve, stringToHex(PC_AUDITOR_ROLE)).call();
        assert.equal(res, ether(180));

        res = await this.validators.isValidatorActive(bob);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleAssigned(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleActive(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, false);

        res = await this.validators.isValidatorActive(eve);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleAssigned(eve, PC_AUDITOR_ROLE);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleActive(eve, PC_AUDITOR_ROLE);
        assert.equal(res, false);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId2).call();
        assert.equal(res.votesFor.length, 3);

        res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);

        // staking back
        await this.galtToken.approve(this.validatorStakes.address, ether(30), { from: alice });
        await this.validatorStakes.stake(bob, PC_CUSTODIAN_ROLE, ether(10), { from: alice });
        await this.validatorStakes.stake(eve, PC_AUDITOR_ROLE, ether(20), { from: alice });

        res = await this.validators.isValidatorActive(bob);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleAssigned(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleActive(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, true);

        res = await this.validators.isValidatorActive(eve);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleAssigned(eve, PC_AUDITOR_ROLE);
        assert.equal(res, true);
        res = await this.validators.isValidatorRoleActive(eve, PC_AUDITOR_ROLE);
        assert.equal(res, true);
      });

      it('should reject when REJECT propose reached threshold', async function() {
        let res = await this.claimManager.proposeReject(this.cId, 'blah', { from: dan });
        this.pId3 = res.logs[0].args.proposalId;
        await this.claimManager.vote(this.cId, this.pId3, { from: bob });
        await this.claimManager.vote(this.cId, this.pId3, { from: eve });

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId3).call();
        assert.equal(res.votesFor.length, 3);
        res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.REJECTED);
      });
    });
  });
});
