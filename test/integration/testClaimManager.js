const ClaimManager = artifacts.require('./ClaimManager.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Validators = artifacts.require('./Validators.sol');
const ValidatorStakes = artifacts.require('./ValidatorStakes.sol');
const ValidatorStakesMultiSig = artifacts.require('./ValidatorStakesMultiSig.sol');
const Auditors = artifacts.require('./Auditors.sol');

const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  ether,
  zeroAddress,
  assertGaltBalanceChanged,
  assertEthBalanceChanged,
  assertRevert
} = require('../helpers');

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

initHelperWeb3(web3);
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
    auditorManager,
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
    this.oracles = await Validators.new({ from: coreTeam });
    this.claimManager = await ClaimManager.new({ from: coreTeam });
    this.oracleStakeAccounting = await ValidatorStakes.new({ from: coreTeam });
    // auditors should be explicitly reassigned in order to synchronize MultiSig, Auditors and Validators contract
    this.abMultiSig = await ValidatorStakesMultiSig.new(coreTeam, [bob, charlie, dan], 2, { from: coreTeam });
    this.auditors = await Auditors.new(coreTeam, this.abMultiSig.address, this.oracles.address, { from: coreTeam });

    await this.claimManager.initialize(
      this.oracles.address,
      this.galtToken.address,
      this.oracleStakeAccounting.address,
      this.abMultiSig.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.oracleStakeAccounting.initialize(this.oracles.address, this.galtToken.address, this.abMultiSig.address, {
      from: coreTeam
    });

    await this.claimManager.setFeeManager(feeManager, true, { from: coreTeam });

    await this.auditors.addRoleTo(coreTeam, await this.auditors.ROLE_MANAGER(), {
      from: coreTeam
    });
    await this.auditors.addRoleTo(auditorManager, await this.auditors.ROLE_AUDITOR_MANAGER(), {
      from: coreTeam
    });
    await this.abMultiSig.addRoleTo(this.auditors.address, await this.abMultiSig.ROLE_AUDITORS_MANAGER(), {
      from: coreTeam
    });
    await this.abMultiSig.addRoleTo(this.claimManager.address, await this.abMultiSig.ROLE_PROPOSER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(applicationTypeManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(validatorManager, await this.oracles.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(this.oracleStakeAccounting.address, await this.oracles.ROLE_VALIDATOR_STAKES(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(this.auditors.address, await this.oracles.ROLE_AUDITOR_MANAGER(), {
      from: coreTeam
    });
    await this.oracleStakeAccounting.addRoleTo(this.claimManager.address, await this.oracleStakeAccounting.ROLE_SLASH_MANAGER(), {
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
    this.validatorStakesWeb3 = new web3.eth.Contract(this.oracleStakeAccounting.abi, this.oracleStakeAccounting.address);
    this.galtTokenWeb3 = new web3.eth.Contract(this.galtToken.abi, this.galtToken.address);
    this.abMultiSigWeb3 = new web3.eth.Contract(this.abMultiSig.abi, this.abMultiSig.address);
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

          res = await this.claimManagerWeb3.methods.getClaimFees(this.aId).call();
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

          res = await this.claimManagerWeb3.methods.getClaimFees(this.aId).call();
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
      await this.oracles.setApplicationTypeRoles(CLAIM_VALIDATORS, [CM_AUDITOR], [100], [''], {
        from: applicationTypeManager
      });
      await this.oracles.setApplicationTypeRoles(
        MY_APPLICATION,
        [PC_AUDITOR_ROLE, PC_CUSTODIAN_ROLE],
        [50, 50],
        ['', ''],
        {
          from: applicationTypeManager
        }
      );

      await this.oracles.setRoleMinimalDeposit(CM_AUDITOR, ether(300), { from: applicationTypeManager });
      await this.oracles.setRoleMinimalDeposit(PC_AUDITOR_ROLE, ether(200), { from: applicationTypeManager });
      await this.oracles.setRoleMinimalDeposit(PC_CUSTODIAN_ROLE, ether(200), { from: applicationTypeManager });

      await this.oracles.addValidator(bob, 'Bob', 'MN', [], [], { from: validatorManager });
      await this.oracles.addValidator(charlie, 'Charlie', 'MN', [], [], { from: validatorManager });
      await this.oracles.addValidator(dan, 'Dan', 'MN', [], [], { from: validatorManager });
      await this.oracles.addValidator(eve, 'Eve', 'MN', [], [], { from: validatorManager });
      await this.oracles.addValidator(frank, 'Frank', 'MN', [], [], { from: validatorManager });

      await this.auditors.setNofM(3, 5, { from: auditorManager });
      await this.auditors.addAuditor(bob, 280, { from: auditorManager });
      await this.auditors.addAuditor(charlie, 560, { from: auditorManager });
      await this.auditors.addAuditor(dan, 120, { from: auditorManager });
      await this.auditors.addAuditor(eve, 700, { from: auditorManager });
      await this.auditors.addAuditor(frank, 300, { from: auditorManager });
      await this.auditors.pushAuditors([eve, charlie, frank, bob, dan], { from: auditorManager });

      await this.galtToken.approve(this.oracleStakeAccounting.address, ether(1500), { from: alice });
      await this.oracleStakeAccounting.stake(bob, CM_AUDITOR, ether(300), { from: alice });
      await this.oracleStakeAccounting.stake(charlie, CM_AUDITOR, ether(300), { from: alice });
      await this.oracleStakeAccounting.stake(dan, CM_AUDITOR, ether(300), { from: alice });
      await this.oracleStakeAccounting.stake(eve, CM_AUDITOR, ether(300), { from: alice });
      await this.oracleStakeAccounting.stake(frank, CM_AUDITOR, ether(300), { from: alice });

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

    describe('#pushMessage()', () => {
      it('should allow any validator push a message into registry', async function() {
        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.pushMessage(this.cId, 'hi!', { from: bob });
      });

      it('should allow a claimer pushing message into registry', async function() {
        await this.claimManager.pushMessage(this.cId, 'hi!', { from: alice });
      });

      it('should deny a stranger pushing message into registry', async function() {
        await assertRevert(this.claimManager.pushMessage(this.cId, 'hi!', { from: bob }));
      });

      it('should deny messaging in non-submitted state', async function() {
        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
        await this.claimManager.lock(this.cId, { from: eve });

        const res = await this.claimManager.proposeReject(this.cId, 'looks bad', { from: bob });
        const pId1 = res.logs[0].args.proposalId;

        await this.claimManager.vote(this.cId, pId1, { from: eve });
        await this.claimManager.vote(this.cId, pId1, { from: dan });
      });

      it('should provide with messages getter', async function() {
        await this.claimManager.lock(this.cId, { from: charlie });
        await this.claimManager.lock(this.cId, { from: bob });

        let res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.messageCount, 0);

        await this.claimManager.pushMessage(this.cId, 'hi', { from: bob });
        await this.claimManager.pushMessage(this.cId, 'hey', { from: bob });
        await this.claimManager.pushMessage(this.cId, 'hello', { from: alice });
        await this.claimManager.pushMessage(this.cId, 'you', { from: charlie });

        res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.messageCount, 4);

        res = await this.claimManagerWeb3.methods.getMessage(this.cId, 0).call();
        assert(res.timestamp > 0);
        assert.equal(res.from.toLowerCase(), bob);
        assert.equal(res.text, 'hi');

        res = await this.claimManagerWeb3.methods.getMessage(this.cId, 1).call();
        assert(res.timestamp > 0);
        assert.equal(res.from.toLowerCase(), bob);
        assert.equal(res.text, 'hey');

        res = await this.claimManagerWeb3.methods.getMessage(this.cId, 2).call();
        assert(res.timestamp > 0);
        assert.equal(res.from.toLowerCase(), alice);
        assert.equal(res.text, 'hello');

        res = await this.claimManagerWeb3.methods.getMessage(this.cId, 3).call();
        assert(res.timestamp > 0);
        assert.equal(res.from.toLowerCase(), charlie);
        assert.equal(res.text, 'you');

        res = await this.claimManagerWeb3.methods.getMessage(this.cId, 4).call();
        assert.equal(res.timestamp, 0);
        assert.equal(res.from.toLowerCase(), zeroAddress);
        assert.equal(res.text, '');
      });
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
        let res = await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(20),
          [dan],
          [CM_AUDITOR],
          [ether(20)],
          {
            from: bob
          }
        );
        const pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          ether(20),
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
        assert.sameMembers(res.oracles.map(a => a.toLowerCase()), [dan]);
        assert.sameMembers(res.roles.map(web3.utils.hexToString), [CM_AUDITOR]);
        assert.sameMembers(res.fines, [ether(20)]);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, pId2).call();
        assert.equal(res.from.toLowerCase(), dan);
        assert.equal(res.message, 'looks good');
        assert.equal(res.action, Action.APPROVE);
        assert.sameMembers(res.oracles.map(a => a.toLowerCase()), [bob, eve]);
        assert.sameMembers(res.roles.map(web3.utils.hexToString), [CM_AUDITOR, CM_AUDITOR]);
        assert.sameMembers(res.fines, [ether(10), ether(20)]);
      });

      it('should deny non-validator proposing a proposal', async function() {
        await assertRevert(
          this.claimManager.proposeApproval(this.cId, 'looks good', ether(10), [], [], [], { from: coreTeam })
        );
      });

      it('should deny validator proposing when claim is not locked', async function() {
        await assertRevert(
          this.claimManager.proposeApproval(this.cId, 'looks good', ether(10), [], [], [], { from: eve })
        );
      });

      it('should allow multiple proposals from the same validator', async function() {
        await this.claimManager.proposeApproval(this.cId, 'good enough', ether(10), [dan], [CM_AUDITOR], [ether(20)], {
          from: bob
        });
        await this.claimManager.proposeApproval(this.cId, 'good enough', ether(10), [dan], [CM_AUDITOR], [ether(30)], {
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

        res = await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(10),
          [dan],
          [CM_AUDITOR],
          [ether(20)],
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          ether(10),
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

      it('should deny oracles with non-locked slots voting', async function() {
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
            ether(10),
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

        await this.oracles.addValidator(bob, 'Bob', 'MN', [], [PC_CUSTODIAN_ROLE], { from: validatorManager });
        await this.oracles.addValidator(eve, 'Eve', 'MN', [], [PC_AUDITOR_ROLE], { from: validatorManager });
        await this.oracles.addValidator(dan, 'Dan', 'MN', [], [PC_AUDITOR_ROLE], { from: validatorManager });

        await this.galtToken.approve(this.oracleStakeAccounting.address, ether(600), { from: alice });

        await this.oracleStakeAccounting.stake(bob, PC_CUSTODIAN_ROLE, ether(200), { from: alice });
        await this.oracleStakeAccounting.stake(eve, PC_AUDITOR_ROLE, ether(200), { from: alice });
        await this.oracleStakeAccounting.stake(dan, PC_AUDITOR_ROLE, ether(200), { from: alice });

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
        await this.claimManager.lock(this.cId, { from: eve });

        res = await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(20),
          [dan],
          [PC_AUDITOR_ROLE],
          [ether(20)],
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          ether(30),
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

        res = await this.oracles.isValidatorActive(bob);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleAssigned(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleActive(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, true);

        res = await this.oracles.isValidatorActive(eve);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleAssigned(eve, PC_AUDITOR_ROLE);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleActive(eve, PC_AUDITOR_ROLE);
        assert.equal(res, true);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId2).call();
        assert.equal(res.votesFor.length, 1);

        await this.claimManager.vote(this.cId, this.pId2, { from: bob });
        await this.claimManager.vote(this.cId, this.pId2, { from: eve });

        res = await this.validatorStakesWeb3.methods.stakeOf(bob, stringToHex(PC_CUSTODIAN_ROLE)).call();
        assert.equal(res, ether(190));
        res = await this.validatorStakesWeb3.methods.stakeOf(eve, stringToHex(PC_AUDITOR_ROLE)).call();
        assert.equal(res, ether(180));
        //
        res = await this.oracles.isValidatorActive(bob);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleAssigned(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleActive(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, false);

        res = await this.oracles.isValidatorActive(eve);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleAssigned(eve, PC_AUDITOR_ROLE);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleActive(eve, PC_AUDITOR_ROLE);
        assert.equal(res, false);

        res = await this.claimManagerWeb3.methods.getProposal(this.cId, this.pId2).call();
        assert.equal(res.votesFor.length, 3);

        res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);

        // staking back
        await this.galtToken.approve(this.oracleStakeAccounting.address, ether(30), { from: alice });
        await this.oracleStakeAccounting.stake(bob, PC_CUSTODIAN_ROLE, ether(10), { from: alice });
        await this.oracleStakeAccounting.stake(eve, PC_AUDITOR_ROLE, ether(20), { from: alice });

        res = await this.oracles.isValidatorActive(bob);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleAssigned(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleActive(bob, PC_CUSTODIAN_ROLE);
        assert.equal(res, true);

        res = await this.oracles.isValidatorActive(eve);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleAssigned(eve, PC_AUDITOR_ROLE);
        assert.equal(res, true);
        res = await this.oracles.isValidatorRoleActive(eve, PC_AUDITOR_ROLE);
        assert.equal(res, true);
      });

      it('should create transfer claim value to a beneficiary', async function() {
        let res = await this.abMultiSigWeb3.methods.getTransactionCount(true, false).call();
        assert.equal(res, 0);
        await this.claimManager.vote(this.cId, this.pId2, { from: bob });
        await this.claimManager.vote(this.cId, this.pId2, { from: eve });

        res = await this.claimManagerWeb3.methods.claim(this.cId).call();
        assert.equal(res.status, ApplicationStatus.APPROVED);

        res = await this.abMultiSigWeb3.methods.getTransactionCount(true, false).call();
        assert.equal(res, 1);

        const txId = '0';
        res = await this.abMultiSigWeb3.methods.transactions(txId).call();
        assert.equal(res.destination.toLowerCase(), this.galtToken.address);
        assert.equal(res.value, 0);
        assert.equal(
          res.data,
          `0xa9059cbb000000000000000000000000${alice
            .toLowerCase()
            .substr(2)}000000000000000000000000000000000000000000000001a055690d9db80000`
        );

        const multiSigBalance = await this.galtTokenWeb3.methods.balanceOf(this.abMultiSig.address).call();
        assert(multiSigBalance > ether(20));
        res = await this.abMultiSigWeb3.methods.required().call();
        assert.equal(res, 3);
        res = await this.abMultiSigWeb3.methods.getConfirmationCount(txId).call();
        assert.equal(res, 0);
        res = await this.abMultiSigWeb3.methods.getOwners().call();
        assert.sameMembers(res.map(a => a.toLowerCase()), [bob, charlie, dan, eve, frank]);

        const aliceInitialBalance = await this.galtTokenWeb3.methods.balanceOf(alice).call();

        await this.abMultiSig.confirmTransaction(txId, { from: bob });
        res = await this.abMultiSig.confirmTransaction(txId, { from: dan });
        await this.abMultiSig.confirmTransaction(txId, { from: frank });

        const aliceFinalBalance = await this.galtTokenWeb3.methods.balanceOf(alice).call();

        assertGaltBalanceChanged(aliceInitialBalance, aliceFinalBalance, ether(30));
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

    describe('claims fee paid by GALT', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.claimManager.address, ether(47), { from: alice });

        let res = await this.claimManager.submit(
          alice,
          ether(350),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          ether(47),
          { from: alice }
        );

        // override default which paid by ETH
        this.cId = res.logs[0].args.id;

        await this.oracles.addValidator(bob, 'Bob', 'MN', [], [], { from: validatorManager });
        await this.oracles.addValidator(charlie, 'Charlie', 'MN', [], [], { from: validatorManager });
        await this.oracles.addValidator(dan, 'Dan', 'MN', [], [], { from: validatorManager });
        await this.oracles.addValidator(eve, 'Eve', 'MN', [], [], { from: validatorManager });
        await this.oracles.addValidator(frank, 'Frank', 'MN', [], [], { from: validatorManager });

        await this.galtToken.approve(this.oracleStakeAccounting.address, ether(1500), { from: alice });
        await this.oracleStakeAccounting.stake(bob, CM_AUDITOR, ether(300), { from: alice });
        await this.oracleStakeAccounting.stake(charlie, CM_AUDITOR, ether(300), { from: alice });
        await this.oracleStakeAccounting.stake(dan, CM_AUDITOR, ether(300), { from: alice });
        await this.oracleStakeAccounting.stake(eve, CM_AUDITOR, ether(300), { from: alice });
        await this.oracleStakeAccounting.stake(frank, CM_AUDITOR, ether(300), { from: alice });

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
        await this.claimManager.lock(this.cId, { from: eve });

        res = await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(10),
          [dan],
          [CM_AUDITOR],
          [ether(20)],
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          ether(30),
          [bob, eve],
          [CM_AUDITOR, CM_AUDITOR],
          [ether(10), ether(20)],
          { from: dan }
        );
        this.pId2 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeReject(this.cId, 'its fake', {
          from: eve
        });
        this.pId3 = res.logs[0].args.proposalId;

        res = await this.claimManagerWeb3.methods.getClaimFees(this.cId).call();
        assert.equal(res.currency, Currency.GALT);

        assert.equal(res.validatorsReward, '40890000000000000000');
        assert.equal(res.galtSpaceReward, '6110000000000000000');
      });

      describe('on success proposal win (APPROVED status)', () => {
        it('should revert auditor claims when status is SUBMITTED', async function() {
          await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: bob }));
        });

        it('should revert galt space claims when status is SUBMITTED', async function() {
          await assertRevert(this.claimManager.claimGaltSpaceReward(this.cId, { from: galtSpaceOrg }));
        });

        describe('with 4 active slots', () => {
          beforeEach(async function() {
            await this.claimManager.lock(this.cId, { from: charlie });
            await this.claimManager.vote(this.cId, this.pId2, { from: bob });
            await this.claimManager.vote(this.cId, this.pId2, { from: eve });
          });

          it('should calculate and assign rewards for auditors and galt space', async function() {
            let res = await this.claimManagerWeb3.methods.getClaimFees(this.cId).call();
            assert.equal(res.validatorReward, '10222500000000000000');

            res = await this.claimManagerWeb3.methods.claim(this.cId).call();
            assert.equal(res.slotsTaken, '4');
            assert.equal(res.totalSlots, '5');
          });

          it('should allow galt space withdrawal only once', async function() {
            const galtSpaceBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();
            await this.claimManager.claimGaltSpaceReward(this.cId, { from: galtSpaceOrg });
            const galtSpaceBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();

            assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(6.11));
          });

          it('should deny galt space double claim a reward', async function() {
            await this.claimManager.claimGaltSpaceReward(this.cId, { from: galtSpaceOrg });
            await assertRevert(this.claimManager.claimGaltSpaceReward(this.cId, { from: galtSpaceOrg }));
          });

          it('should allow oracles claiming their rewards', async function() {
            const bobBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(bob).call();
            const danBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(dan).call();
            const charlieBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(charlie).call();
            const eveBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(eve).call();

            await this.claimManager.claimValidatorReward(this.cId, { from: bob });
            await this.claimManager.claimValidatorReward(this.cId, { from: dan });
            await this.claimManager.claimValidatorReward(this.cId, { from: charlie });
            await this.claimManager.claimValidatorReward(this.cId, { from: eve });

            const bobBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(bob).call();
            const danBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(dan).call();
            const charlieBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(charlie).call();
            const eveBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(eve).call();

            assertGaltBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(10.2225));
            assertGaltBalanceChanged(danBalanceBefore, danBalanceAfter, ether(10.2225));
            assertGaltBalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(10.2225));
            assertGaltBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(10.2225));
          });

          it('should deny oracles claiming their rewards twice', async function() {
            await this.claimManager.claimValidatorReward(this.cId, { from: bob });
            await this.claimManager.claimValidatorReward(this.cId, { from: dan });
            await this.claimManager.claimValidatorReward(this.cId, { from: charlie });
            await this.claimManager.claimValidatorReward(this.cId, { from: eve });

            await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: bob }));
            await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: dan }));
            await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: charlie }));
            await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: eve }));
          });
        });

        describe('with 3 active slots', () => {
          beforeEach(async function() {
            await this.claimManager.vote(this.cId, this.pId2, { from: bob });
            await this.claimManager.vote(this.cId, this.pId2, { from: eve });
          });

          it('should calculate and assign rewards for auditors and galt space', async function() {
            let res = await this.claimManagerWeb3.methods.getClaimFees(this.cId).call();
            assert.equal(res.validatorReward, '13630000000000000000');

            res = await this.claimManagerWeb3.methods.claim(this.cId).call();
            assert.equal(res.slotsTaken, '3');
            assert.equal(res.totalSlots, '5');
          });

          it('should allow oracles claiming their rewards', async function() {
            const bobBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(bob).call();
            const danBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(dan).call();
            const eveBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(eve).call();

            await this.claimManager.claimValidatorReward(this.cId, { from: bob });
            await this.claimManager.claimValidatorReward(this.cId, { from: dan });
            await this.claimManager.claimValidatorReward(this.cId, { from: eve });

            const bobBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(bob).call();
            const danBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(dan).call();
            const eveBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(eve).call();

            assertGaltBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(13.63));
            assertGaltBalanceChanged(danBalanceBefore, danBalanceAfter, ether(13.63));
            assertGaltBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(13.63));
          });

          it('should deny oracles claiming their rewards twice', async function() {
            await this.claimManager.claimValidatorReward(this.cId, { from: bob });
            await this.claimManager.claimValidatorReward(this.cId, { from: dan });
            await this.claimManager.claimValidatorReward(this.cId, { from: eve });

            await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: bob }));
            await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: dan }));
            await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: eve }));
          });

          it('should deny oracles who dont locked application claiming revards', async function() {
            await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: charlie }));
          });
        });
      });

      describe('on reject proposal win (REJECTED status) with 3 active slots', () => {
        beforeEach(async function() {
          await this.claimManager.vote(this.cId, this.pId3, { from: dan });
          await this.claimManager.vote(this.cId, this.pId3, { from: bob });
        });

        it('should calculate and assign rewards for auditors and galt space', async function() {
          let res = await this.claimManagerWeb3.methods.getClaimFees(this.cId).call();
          assert.equal(res.validatorReward, '13630000000000000000');

          res = await this.claimManagerWeb3.methods.claim(this.cId).call();
          assert.equal(res.status, ApplicationStatus.REJECTED);
          assert.equal(res.slotsTaken, '3');
          assert.equal(res.totalSlots, '5');
        });

        it('should allow oracles claiming their rewards', async function() {
          const bobBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(bob).call();
          const danBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(dan).call();
          const eveBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(eve).call();

          await this.claimManager.claimValidatorReward(this.cId, { from: bob });
          await this.claimManager.claimValidatorReward(this.cId, { from: dan });
          await this.claimManager.claimValidatorReward(this.cId, { from: eve });

          const bobBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(bob).call();
          const danBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(dan).call();
          const eveBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(eve).call();

          assertGaltBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(13.63));
          assertGaltBalanceChanged(danBalanceBefore, danBalanceAfter, ether(13.63));
          assertGaltBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(13.63));
        });

        it('should deny oracles claiming their rewards twice', async function() {
          await this.claimManager.claimValidatorReward(this.cId, { from: bob });
          await this.claimManager.claimValidatorReward(this.cId, { from: dan });
          await this.claimManager.claimValidatorReward(this.cId, { from: eve });

          await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: bob }));
          await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: dan }));
          await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: eve }));
        });

        it('should deny oracles who dont locked application claiming revards', async function() {
          await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: charlie }));
        });
      });
    });

    describe('claims fee paid by ETH', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.claimManager.address, ether(47), { from: alice });

        let res = await this.claimManager.submit(
          alice,
          ether(350),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          0,
          { from: alice, value: ether(9) }
        );

        // override default which paid by ETH
        this.cId = res.logs[0].args.id;

        await this.oracles.addValidator(bob, 'Bob', 'MN', [], [], { from: validatorManager });
        await this.oracles.addValidator(charlie, 'Charlie', 'MN', [], [], { from: validatorManager });
        await this.oracles.addValidator(dan, 'Dan', 'MN', [], [], { from: validatorManager });
        await this.oracles.addValidator(eve, 'Eve', 'MN', [], [], { from: validatorManager });
        await this.oracles.addValidator(frank, 'Frank', 'MN', [], [], { from: validatorManager });

        await this.galtToken.approve(this.oracleStakeAccounting.address, ether(1500), { from: alice });
        await this.oracleStakeAccounting.stake(bob, CM_AUDITOR, ether(300), { from: alice });
        await this.oracleStakeAccounting.stake(charlie, CM_AUDITOR, ether(300), { from: alice });
        await this.oracleStakeAccounting.stake(dan, CM_AUDITOR, ether(300), { from: alice });
        await this.oracleStakeAccounting.stake(eve, CM_AUDITOR, ether(300), { from: alice });
        await this.oracleStakeAccounting.stake(frank, CM_AUDITOR, ether(300), { from: alice });

        await this.claimManager.lock(this.cId, { from: bob });
        await this.claimManager.lock(this.cId, { from: dan });
        await this.claimManager.lock(this.cId, { from: eve });

        res = await this.claimManager.proposeApproval(
          this.cId,
          'good enough',
          ether(10),
          [dan],
          [CM_AUDITOR],
          [ether(20)],
          {
            from: bob
          }
        );
        this.pId1 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeApproval(
          this.cId,
          'looks good',
          ether(10),
          [bob, eve],
          [CM_AUDITOR, CM_AUDITOR],
          [ether(10), ether(20)],
          { from: dan }
        );
        this.pId2 = res.logs[0].args.proposalId;

        res = await this.claimManager.proposeReject(this.cId, 'its fake', {
          from: eve
        });
        this.pId3 = res.logs[0].args.proposalId;
      });

      describe('on approve proposal win (APPROVED status) with 5 active slots', () => {
        beforeEach(async function() {
          await this.claimManager.lock(this.cId, { from: charlie });
          await this.claimManager.lock(this.cId, { from: frank });
          await this.claimManager.vote(this.cId, this.pId2, { from: eve });
          await this.claimManager.vote(this.cId, this.pId3, { from: charlie });
          await this.claimManager.vote(this.cId, this.pId2, { from: bob });
        });

        it('should calculate and assign rewards for auditors and galt space', async function() {
          let res = await this.claimManagerWeb3.methods.getClaimFees(this.cId).call();
          assert.equal(res.currency, Currency.ETH);

          assert.equal(res.validatorsReward, '6030000000000000000');
          assert.equal(res.galtSpaceReward, '2970000000000000000');

          res = await this.claimManagerWeb3.methods.claim(this.cId).call();
          assert.equal(res.status, ApplicationStatus.APPROVED);
          assert.equal(res.slotsTaken, '5');
          assert.equal(res.totalSlots, '5');
        });

        it('should allow oracles claiming their rewards', async function() {
          const bobBalanceBefore = await web3.eth.getBalance(bob);
          const danBalanceBefore = await web3.eth.getBalance(dan);
          const eveBalanceBefore = await web3.eth.getBalance(eve);
          const charlieBalanceBefore = await web3.eth.getBalance(charlie);
          const frankBalanceBefore = await web3.eth.getBalance(frank);

          await this.claimManager.claimValidatorReward(this.cId, { from: bob });
          await this.claimManager.claimValidatorReward(this.cId, { from: charlie });
          await this.claimManager.claimValidatorReward(this.cId, { from: dan });
          await this.claimManager.claimValidatorReward(this.cId, { from: eve });
          await this.claimManager.claimValidatorReward(this.cId, { from: frank });

          const bobBalanceAfter = await web3.eth.getBalance(bob);
          const charlieBalanceAfter = await web3.eth.getBalance(charlie);
          const danBalanceAfter = await web3.eth.getBalance(dan);
          const eveBalanceAfter = await web3.eth.getBalance(eve);
          const frankBalanceAfter = await web3.eth.getBalance(frank);

          assertEthBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(1.206));
          assertEthBalanceChanged(danBalanceBefore, danBalanceAfter, ether(1.206));
          assertEthBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(1.206));
          assertEthBalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(1.206));
          assertEthBalanceChanged(frankBalanceBefore, frankBalanceAfter, ether(1.206));
        });

        it('should allow galt space claiming reward', async function() {
          const galtSpaceBalanceBefore = await web3.eth.getBalance(galtSpaceOrg);
          await this.claimManager.claimGaltSpaceReward(this.cId, { from: galtSpaceOrg });
          const galtSpaceBalanceAfter = await web3.eth.getBalance(galtSpaceOrg);

          assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(2.97));
        });

        it('should deny oracles claiming their rewards twice', async function() {
          await this.claimManager.claimValidatorReward(this.cId, { from: bob });
          await this.claimManager.claimValidatorReward(this.cId, { from: dan });
          await this.claimManager.claimValidatorReward(this.cId, { from: eve });

          await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: bob }));
          await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: dan }));
          await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: eve }));
        });
      });

      describe('on reject proposal win (REJECTED status) with 3 active slots', () => {
        beforeEach(async function() {
          await this.claimManager.vote(this.cId, this.pId3, { from: dan });
          await this.claimManager.vote(this.cId, this.pId3, { from: bob });
        });

        it('should calculate and assign rewards for auditors and galt space', async function() {
          let res = await this.claimManagerWeb3.methods.getClaimFees(this.cId).call();
          assert.equal(res.currency, Currency.ETH);

          assert.equal(res.validatorsReward, '6030000000000000000');
          assert.equal(res.galtSpaceReward, '2970000000000000000');

          res = await this.claimManagerWeb3.methods.claim(this.cId).call();
          assert.equal(res.status, ApplicationStatus.REJECTED);
          assert.equal(res.slotsTaken, '3');
          assert.equal(res.totalSlots, '5');
        });

        it('should allow oracles claiming their rewards', async function() {
          const bobBalanceBefore = await web3.eth.getBalance(bob);
          const danBalanceBefore = await web3.eth.getBalance(dan);
          const eveBalanceBefore = await web3.eth.getBalance(eve);

          await this.claimManager.claimValidatorReward(this.cId, { from: bob });
          await this.claimManager.claimValidatorReward(this.cId, { from: dan });
          await this.claimManager.claimValidatorReward(this.cId, { from: eve });

          const bobBalanceAfter = await web3.eth.getBalance(bob);
          const danBalanceAfter = await web3.eth.getBalance(dan);
          const eveBalanceAfter = await web3.eth.getBalance(eve);

          assertEthBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(2.01));
          assertEthBalanceChanged(danBalanceBefore, danBalanceAfter, ether(2.01));
          assertEthBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(2.01));
        });

        it('should allow galt space claiming reward', async function() {
          const galtSpaceBalanceBefore = await web3.eth.getBalance(galtSpaceOrg);
          await this.claimManager.claimGaltSpaceReward(this.cId, { from: galtSpaceOrg });
          const galtSpaceBalanceAfter = await web3.eth.getBalance(galtSpaceOrg);

          assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(2.97));
        });

        it('should deny oracles claiming their rewards twice', async function() {
          await this.claimManager.claimValidatorReward(this.cId, { from: bob });
          await this.claimManager.claimValidatorReward(this.cId, { from: dan });
          await this.claimManager.claimValidatorReward(this.cId, { from: eve });

          await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: bob }));
          await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: dan }));
          await assertRevert(this.claimManager.claimValidatorReward(this.cId, { from: eve }));
        });
      });
    });
  });
});
