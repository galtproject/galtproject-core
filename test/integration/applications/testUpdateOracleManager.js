const GaltToken = artifacts.require('./GaltToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');
const NewOracleManager = artifacts.require('./NewOracleManager.sol');
const UpdateOracleManager = artifacts.require('./UpdateOracleManager.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const { initHelperWeb3, ether, assertRevert } = require('../../helpers');
const { deployMultiSigFactory } = require('../../deploymentHelpers');

const web3 = new Web3(GaltToken.web3.currentProvider);
const { hexToUtf8 } = Web3.utils;
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
  APPROVED: 2,
  REJECTED: 3,
  REVERTED: 4
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
const PC_ANOTHER_ORACLE_TYPE = 'PC_ANOTHER_ORACLE_TYPE';

// eslint-disable-next-line
contract('UpdateOracleManager', (accounts) => {
  const [
    coreTeam,
    galtSpaceOrg,
    feeManager,
    applicationTypeManager,
    claimManager,
    spaceReputationAccounting,
    oracleManager,
    alice,
    bob,
    charlie,
    dan,
    frank,
    george,
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
    this.newOracle = await NewOracleManager.new({ from: coreTeam });
    this.updateOracle = await UpdateOracleManager.new({ from: coreTeam });

    [this.multiSigFactory, this.multiSigRegistry] = await deployMultiSigFactory(
      this.galtToken.address,
      this.oracles,
      claimManager,
      spaceReputationAccounting,
      coreTeam
    );

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.approve(this.multiSigFactory.address, ether(20), { from: alice });

    const res = await this.multiSigFactory.build([bob, charlie, dan, frank, george], 3, { from: alice });
    this.abMultiSigX = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);
    this.abVotingX = res.logs[0].args.arbitratorVoting;
    this.oracleStakesAccountingX = OracleStakesAccounting.at(res.logs[0].args.oracleStakesAccounting);
    this.mX = this.abMultiSigX.address;

    await this.newOracle.initialize(
      this.oracles.address,
      this.galtToken.address,
      this.multiSigRegistry.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );

    await this.updateOracle.initialize(
      this.oracles.address,
      this.galtToken.address,
      this.multiSigRegistry.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );

    await this.oracles.addRoleTo(applicationTypeManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(this.newOracle.address, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(this.updateOracle.address, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_STAKES_MANAGER(), {
      from: coreTeam
    });

    await this.newOracle.addRoleTo(feeManager, await this.newOracle.ROLE_FEE_MANAGER(), {
      from: coreTeam
    });
    await this.newOracle.addRoleTo(galtSpaceOrg, await this.newOracle.ROLE_GALT_SPACE(), {
      from: coreTeam
    });

    await this.updateOracle.addRoleTo(feeManager, await this.updateOracle.ROLE_FEE_MANAGER(), {
      from: coreTeam
    });
    await this.updateOracle.addRoleTo(galtSpaceOrg, await this.updateOracle.ROLE_GALT_SPACE(), {
      from: coreTeam
    });

    await this.oracles.setOracleTypeMinimalDeposit(PC_AUDITOR_ORACLE_TYPE, ether(30), {
      from: applicationTypeManager
    });
    await this.oracles.setOracleTypeMinimalDeposit(PC_CUSTODIAN_ORACLE_TYPE, ether(30), {
      from: applicationTypeManager
    });

    await this.updateOracle.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.updateOracle.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.updateOracle.setGaltSpaceEthShare(33, { from: feeManager });
    await this.updateOracle.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.updateOracle.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.updateOracle.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.updateOracle.setGaltSpaceEthShare(33, { from: feeManager });
    await this.updateOracle.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    this.newOracleWeb3 = new web3.eth.Contract(this.newOracle.abi, this.newOracle.address);
    this.updateOracleWeb3 = new web3.eth.Contract(this.updateOracle.abi, this.updateOracle.address);
    this.oraclesWeb3 = new web3.eth.Contract(this.oracles.abi, this.oracles.address);
    this.galtTokenWeb3 = new web3.eth.Contract(this.galtToken.abi, this.galtToken.address);
  });

  it('should be initialized successfully', async function() {
    (await this.updateOracle.minimalApplicationFeeInEth()).toString(10).should.be.a.bignumber.eq(ether(6));
  });

  describe('#submit()', () => {
    beforeEach(async function() {
      await this.newOracle.setMofN(3, 5, { from: galtSpaceOrg });
      await this.updateOracle.setMofN(3, 5, { from: galtSpaceOrg });

      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        CUSTODIAN_APPLICATION,
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
        [60, 40],
        ['', ''],
        { from: applicationTypeManager }
      );

      await this.oracles.addOracle(this.mX, bob, 'Bob', 'MN', [], [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE], {
        from: oracleManager
      });
    });

    describe('with GALT payment', () => {
      it('should allow an applicant pay commission in Galt', async function() {
        await this.galtToken.approve(this.updateOracle.address, ether(45), { from: alice });
        let res = await this.updateOracle.submit(
          this.mX,
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
        res = await this.updateOracleWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny applying for non-validator', async function() {
        await this.galtToken.approve(this.updateOracle.address, ether(45), { from: alice });
        await assertRevert(
          this.updateOracle.submit(
            this.mX,
            galtSpaceOrg,
            'Bob',
            'MN',
            this.attachedDocumentsBytes32,
            [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
            ether(45),
            {
              from: alice
            }
          )
        );
      });
    });

    describe('with ETH payment', () => {
      it('should allow an applicant pay commission in ETH', async function() {
        let res = await this.updateOracle.submit(
          this.mX,
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
        res = await this.updateOracleWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny applying for non-validator', async function() {
        await assertRevert(
          this.updateOracle.submit(
            this.mX,
            galtSpaceOrg,
            'Bob',
            'MN',
            this.attachedDocumentsBytes32,
            [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
            0,
            {
              from: alice,
              value: ether(7)
            }
          )
        );
      });
    });
  });

  describe('update oracle', async () => {
    it('should merge roles on update', async function() {
      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        CUSTODIAN_APPLICATION,
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE, PC_ANOTHER_ORACLE_TYPE],
        [30, 40, 30],
        ['', '', ''],
        { from: applicationTypeManager }
      );

      // NewOracle
      await this.galtToken.approve(this.newOracle.address, ether(47), { from: alice });
      let res = await this.newOracle.submit(
        this.mX,
        bob,
        'Bob',
        'MN',
        this.attachedDocumentsBytes32,
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
        ether(47),
        {
          from: alice
        }
      );
      this.aId = res.logs[0].args.applicationId;

      await this.newOracle.lock(this.aId, { from: bob });
      await this.newOracle.lock(this.aId, { from: charlie });
      await this.newOracle.lock(this.aId, { from: dan });
      await this.newOracle.lock(this.aId, { from: frank });

      await this.newOracle.aye(this.aId, { from: bob });
      await this.newOracle.nay(this.aId, { from: charlie });
      await this.newOracle.aye(this.aId, { from: dan });
      await this.newOracle.aye(this.aId, { from: frank });

      // UpdateOracle
      await this.galtToken.approve(this.updateOracle.address, ether(47), { from: alice });
      res = await this.updateOracle.submit(
        this.mX,
        bob,
        'Bob',
        'MN',
        this.attachedDocumentsBytes32,
        [PC_AUDITOR_ORACLE_TYPE, PC_ANOTHER_ORACLE_TYPE],
        ether(47),
        {
          from: alice
        }
      );
      this.aId = res.logs[0].args.applicationId;

      await this.updateOracle.lock(this.aId, { from: bob });
      await this.updateOracle.lock(this.aId, { from: charlie });
      await this.updateOracle.lock(this.aId, { from: dan });
      await this.updateOracle.lock(this.aId, { from: frank });

      await this.updateOracle.aye(this.aId, { from: bob });
      await this.updateOracle.nay(this.aId, { from: charlie });
      await this.updateOracle.aye(this.aId, { from: dan });
      await this.updateOracle.aye(this.aId, { from: frank });

      res = await this.oraclesWeb3.methods.getOracle(bob).call();
      assert.sameMembers(res.assignedOracleTypes.map(hexToUtf8), [PC_AUDITOR_ORACLE_TYPE, PC_ANOTHER_ORACLE_TYPE]);
    });
  });
});
