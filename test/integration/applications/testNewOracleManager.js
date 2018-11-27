const GaltToken = artifacts.require('./GaltToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');
const NewOracleManager = artifacts.require('./NewOracleManager.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const { initHelperWeb3, ether, assertEqualBN, assertRevert } = require('../../helpers');

const web3 = new Web3(GaltToken.web3.currentProvider);
const { BN, utf8ToHex } = Web3.utils;
const CUSTODIAN_APPLICATION = '0xe2ce825e66d1e2b4efe1252bf2f9dc4f1d7274c343ac8a9f28b6776eb58188a6';

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

Object.freeze(ApplicationStatus);
Object.freeze(ValidationStatus);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

const PC_AUDITOR_ORACLE_TYPE = 'PC_AUDITOR_ORACLE_TYPE';
const PC_CUSTODIAN_ORACLE_TYPE = 'PC_CUSTODIAN_ORACLE_TYPE';

// eslint-disable-next-line
contract('NewOracleManager', (accounts) => {
  const [
    coreTeam,
    galtSpaceOrg,
    feeManager,
    multiSigWallet,
    applicationTypeManager,
    oracleManager,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank,
    george,
    henrey,
    ivan
  ] = accounts;

  beforeEach(async function() {
    this.attachedDocuments = [
      'QmYNQJoKGNHTpPxCBPh9KkDpaExgd2duMa3aF6ytMpHdao',
      'QmeveuwF5wWBSgUXLG6p1oxF3GKkgjEnhA6AAwHUoVsx6E',
      'QmSrPmbaUKA3ZodhzPWZnpFgcPMFWF4QsxXbkWfEptTBJd'
    ];
    this.attachedDocumentsBytes32 = this.attachedDocuments.map(galt.ipfsHashToBytes32);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.oracleStakeAccounting = await OracleStakesAccounting.new({ from: coreTeam });
    this.newOracle = await NewOracleManager.new({ from: coreTeam });
    this.abMultiSig = await ArbitratorsMultiSig.new([bob, charlie, dan, frank, george, henrey, ivan], 3, {
      from: coreTeam
    });

    await this.newOracle.initialize(
      this.oracles.address,
      this.galtToken.address,
      this.abMultiSig.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );

    await this.oracleStakeAccounting.initialize(this.oracles.address, this.galtToken.address, multiSigWallet, {
      from: coreTeam
    });

    await this.oracles.addRoleTo(applicationTypeManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(this.newOracle.address, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_STAKES_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(this.oracleStakeAccounting.address, await this.oracles.ROLE_ORACLE_STAKES_NOTIFIER(), {
      from: coreTeam
    });

    await this.newOracle.addRoleTo(feeManager, await this.newOracle.ROLE_FEE_MANAGER(), {
      from: coreTeam
    });
    await this.newOracle.addRoleTo(galtSpaceOrg, await this.newOracle.ROLE_GALT_SPACE(), {
      from: coreTeam
    });

    await this.oracles.setOracleTypeMinimalDeposit(PC_AUDITOR_ORACLE_TYPE, ether(30), {
      from: applicationTypeManager
    });
    await this.oracles.setOracleTypeMinimalDeposit(PC_CUSTODIAN_ORACLE_TYPE, ether(30), {
      from: applicationTypeManager
    });

    await this.newOracle.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.newOracle.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.newOracle.setGaltSpaceEthShare(33, { from: feeManager });
    await this.newOracle.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    this.newOracleWeb3 = new web3.eth.Contract(this.newOracle.abi, this.newOracle.address);
  });

  it('should be initialized successfully', async function() {
    (await this.newOracle.minimalApplicationFeeInEth()).toString(10).should.be.a.bignumber.eq(ether(6));
  });

  describe('contract config modifiers', () => {
    describe('#setGaltSpaceRewardsAddress()', () => {
      it('should allow an owner set rewards address', async function() {
        await this.newOracle.setGaltSpaceRewardsAddress(bob, { from: galtSpaceOrg });
      });

      it('should deny non-owner set rewards address', async function() {
        await assertRevert(this.newOracle.setGaltSpaceRewardsAddress(bob, { from: alice }));
      });
    });

    describe('#setPaymentMethod()', () => {
      it('should allow an owner set a payment method', async function() {
        await this.newOracle.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: feeManager });
        const res = await this.newOracle.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_ONLY);
      });

      it('should deny non-owner set a payment method', async function() {
        await assertRevert(this.newOracle.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: alice }));
        const res = await this.newOracle.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_AND_GALT);
      });
    });

    describe('#setApplicationFeeInEth()', () => {
      it('should allow an owner set a new minimum fee in ETH', async function() {
        await this.newOracle.setMinimalApplicationFeeInEth(ether(0.05), { from: feeManager });
        const res = await this.newOracle.minimalApplicationFeeInEth();
        assert.equal(res, ether(0.05));
      });

      it('should deny any other than owner person set fee in ETH', async function() {
        await assertRevert(this.newOracle.setMinimalApplicationFeeInEth(ether(0.05), { from: alice }));
      });
    });

    describe('#setApplicationFeeInGalt()', () => {
      it('should allow an owner set a new minimum fee in GALT', async function() {
        await this.newOracle.setMinimalApplicationFeeInGalt(ether(0.15), { from: feeManager });
        const res = await this.newOracle.minimalApplicationFeeInGalt();
        assert.equal(res, ether(0.15));
      });

      it('should deny any other than owner person set fee in GALT', async function() {
        await assertRevert(this.newOracle.setMinimalApplicationFeeInGalt(ether(0.15), { from: alice }));
      });
    });

    describe('#setGaltSpaceEthShare()', () => {
      it('should allow an owner set galtSpace ETH share in percents', async function() {
        await this.newOracle.setGaltSpaceEthShare('42', { from: feeManager });
        const res = await this.newOracle.galtSpaceEthShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space EHT share less than 1 percent', async function() {
        await assertRevert(this.newOracle.setGaltSpaceEthShare('0.5', { from: feeManager }));
      });

      it('should deny owner set Galt Space EHT share grater than 100 percents', async function() {
        await assertRevert(this.newOracle.setGaltSpaceEthShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.newOracle.setGaltSpaceEthShare('20', { from: alice }));
      });
    });

    describe('#setGaltSpaceGaltShare()', () => {
      it('should allow an owner set galtSpace Galt share in percents', async function() {
        await this.newOracle.setGaltSpaceGaltShare('42', { from: feeManager });
        const res = await this.newOracle.galtSpaceGaltShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space Galt share less than 1 percent', async function() {
        await assertRevert(this.newOracle.setGaltSpaceGaltShare('0.5', { from: feeManager }));
      });

      it('should deny owner set Galt Space Galt share grater than 100 percents', async function() {
        await assertRevert(this.newOracle.setGaltSpaceGaltShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.newOracle.setGaltSpaceGaltShare('20', { from: alice }));
      });
    });
  });

  describe('#submit()', () => {
    beforeEach(async function() {
      await this.newOracle.setMofN(3, 5, { from: galtSpaceOrg });

      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        CUSTODIAN_APPLICATION,
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
        [60, 40],
        ['', ''],
        { from: applicationTypeManager }
      );
    });

    describe('with GALT payment', () => {
      it('should allow an applicant pay commission in Galt', async function() {
        await this.galtToken.approve(this.newOracle.address, ether(45), { from: alice });
        let res = await this.newOracle.submit(
          bob,
          'Bob',
          'MN',
          this.attachedDocumentsBytes32,
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
          ether(45),
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.applicationId;
        res = await this.newOracleWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await this.galtToken.approve(this.newOracle.address, ether(45), { from: alice });
          await assertRevert(
            this.newOracle.submit(
              bob,
              'Bob',
              'MN',
              this.attachedDocumentsBytes32,
              [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
              0,
              {
                from: alice
              }
            )
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await this.galtToken.approve(this.newOracle.address, ether(45), { from: alice });
          await assertRevert(
            this.newOracle.submit(
              bob,
              'Bob',
              'MN',
              this.attachedDocumentsBytes32,
              [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
              ether(10),
              {
                from: alice
              }
            )
          );
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          await this.galtToken.approve(this.newOracle.address, ether(53), { from: alice });
          let res = await this.newOracle.submit(
            bob,
            'Bob',
            'MN',
            this.attachedDocumentsBytes32,
            [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
            ether(53),
            {
              from: alice
            }
          );
          this.aId = res.logs[0].args.applicationId;

          // oracle share - 87%
          // galtspace share - 13%

          res = await this.newOracleWeb3.methods.getApplicationFees(this.aId).call();
          assert.equal(res.arbitratorsReward, ether('46.11'));
          assert.equal(res.galtSpaceReward, ether('6.89'));
          assert.equal(res.currency, Currency.GALT);
          assert.equal(res.galtSpaceRewardPaidOut, false);
        });
      });
    });

    describe('with ETH payment', () => {
      it('should allow an applicant pay commission in ETH', async function() {
        let res = await this.newOracle.submit(
          bob,
          'Bob',
          'MN',
          this.attachedDocumentsBytes32,
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
          0,
          {
            from: alice,
            value: ether(7)
          }
        );
        this.aId = res.logs[0].args.applicationId;

        res = await this.newOracleWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.applicant.toLowerCase(), alice);
        assert.sameMembers(res.arbitrators, []);
        assert.equal(res.m, 3);
        assert.equal(res.n, 5);
        assert.equal(res.ayeCount, 0);
        assert.equal(res.nayCount, 0);

        res = await this.newOracleWeb3.methods.getApplicationOracle(this.aId).call();
        assert.equal(res.addr.toLowerCase(), bob);
        assert.equal(res.name, 'Bob');
        assert.sameMembers(res.descriptionHashes.map(galt.bytes32ToIpfsHash), this.attachedDocuments);
        assert.sameMembers(res.oracleTypes.map(web3.utils.hexToUtf8), [
          PC_AUDITOR_ORACLE_TYPE,
          PC_CUSTODIAN_ORACLE_TYPE
        ]);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(
            this.newOracle.submit(
              bob,
              'Bob',
              'MN',
              this.attachedDocumentsBytes32,
              [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
              0,
              {
                from: alice
              }
            )
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await assertRevert(
            this.newOracle.submit(
              bob,
              'Bob',
              'MN',
              this.attachedDocumentsBytes32,
              [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
              0,
              {
                from: alice,
                value: 2
              }
            )
          );
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          await this.galtToken.approve(this.newOracle.address, ether(53), { from: alice });
          let res = await this.newOracle.submit(
            bob,
            'Bob',
            'MN',
            this.attachedDocumentsBytes32,
            [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
            0,
            {
              from: alice,
              value: ether(13)
            }
          );
          this.aId = res.logs[0].args.applicationId;

          // oracle share - 87%
          // galtspace share - 13%

          res = await this.newOracleWeb3.methods.getApplicationFees(this.aId).call();
          assert.equal(res.arbitratorsReward, ether('8.71'));
          assert.equal(res.galtSpaceReward, ether('4.29'));
          assert.equal(res.currency, Currency.ETH);
          assert.equal(res.galtSpaceRewardPaidOut, false);
        });
      });
    });
  });

  describe('pipeline', () => {
    beforeEach(async function() {
      await this.newOracle.setMofN(3, 5, { from: galtSpaceOrg });

      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        CUSTODIAN_APPLICATION,
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
        [60, 40],
        ['', ''],
        { from: applicationTypeManager }
      );

      const res = await this.newOracle.submit(
        eve,
        'Eve',
        'MN',
        this.attachedDocumentsBytes32,
        [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
        0,
        {
          from: alice,
          value: ether(13)
        }
      );

      this.aId = res.logs[0].args.applicationId;
    });

    describe.only('#lock()', () => {
      it('should allow a valid arbitrator locking an application', async function() {
        await this.newOracle.lock(this.aId, { from: bob });

        const res = await this.newOracleWeb3.methods.getApplicationById(this.aId).call();
        assert.sameMembers(res.arbitrators.map(a => a.toLowerCase()), [bob]);
      });

      it('should deny locking more slots than n', async function() {
        await this.newOracle.lock(this.aId, { from: bob });
        await this.newOracle.lock(this.aId, { from: charlie });
        await this.newOracle.lock(this.aId, { from: dan });
        await this.newOracle.lock(this.aId, { from: frank });
        await this.newOracle.lock(this.aId, { from: george });
        await assertRevert(this.newOracle.lock(this.aId, { from: henrey }));

        const res = await this.newOracleWeb3.methods.getApplicationById(this.aId).call();
        assert.sameMembers(res.arbitrators.map(a => a.toLowerCase()), [bob, charlie, dan, frank, george]);
      });

      it('should deny non-arbitrator locking an application', async function() {
        await assertRevert(this.newOracle.lock(this.aId, { from: alice }));
      });
    });
  });
});
