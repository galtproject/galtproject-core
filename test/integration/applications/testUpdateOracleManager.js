const GaltToken = artifacts.require('./GaltToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const NewOracleManager = artifacts.require('./NewOracleManager.sol');
const UpdateOracleManager = artifacts.require('./UpdateOracleManager.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');

const Web3 = require('web3');
const galt = require('@galtproject/utils');
const { initHelperWeb3, ether, assertRevert, numberToEvmWord } = require('../../helpers');
const { deployMultiSigFactory, buildArbitration } = require('../../deploymentHelpers');

const web3 = new Web3(GaltToken.web3.currentProvider);
const { hexToUtf8, utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

GaltToken.numberFormat = "String";

const CUSTODIAN_APPLICATION = '0xe2ce825e66d1e2b4efe1252bf2f9dc4f1d7274c343ac8a9f28b6776eb58188a6';
const ANOTHER_APPLICATION = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';

const ES = bytes32('');
const MN = bytes32('MN');
const BOB = bytes32('BOB');

initHelperWeb3(web3);

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

const PC_AUDITOR_ORACLE_TYPE = bytes32('PC_AUDITOR_ORACLE_TYPE');
const PC_CUSTODIAN_ORACLE_TYPE = bytes32('PC_CUSTODIAN_ORACLE_TYPE');
const PC_ANOTHER_ORACLE_TYPE = bytes32('PC_ANOTHER_ORACLE_TYPE');

// eslint-disable-next-line
contract('UpdateOracleManager', (accounts) => {
  const [
    coreTeam,
    galtSpaceOrg,
    feeManager,
    applicationTypeManager,
    claimManagerAddress,
    spaceReputationAccounting,
    oracleManager,
    alice,
    bob,
    charlie,
    dan,
    frank,
    george
  ] = accounts;

  before(async function() {
    this.attachedDocuments = [
      'QmYNQJoKGNHTpPxCBPh9KkDpaExgd2duMa3aF6ytMpHdao',
      'QmeveuwF5wWBSgUXLG6p1oxF3GKkgjEnhA6AAwHUoVsx6E',
      'QmSrPmbaUKA3ZodhzPWZnpFgcPMFWF4QsxXbkWfEptTBJd'
    ];
    this.attachedDocumentsBytes32 = this.attachedDocuments.map(galt.ipfsHashToBytes32);
    this.description = '';

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.newOracle = await NewOracleManager.new({ from: coreTeam });
    this.updateOracle = await UpdateOracleManager.new({ from: coreTeam });

    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });

    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    await this.ggr.setContract(await this.ggr.MULTI_SIG_REGISTRY(), this.multiSigRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    // await this.ggr.setContract(await this.ggr.GEODESIC(), this.geodesic.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.ORACLES(), this.oracles.address, { from: coreTeam });
    // await this.ggr.setContract(await this.ggr.SPACE_CUSTODIAN_REGISTRY(), this.spaceCustodianRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.CLAIM_MANAGER(), claimManagerAddress, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_REPUTATION_ACCOUNTING(), spaceReputationAccounting, { from: coreTeam });

    this.multiSigFactory = await deployMultiSigFactory(
      this.ggr,
      coreTeam
    );

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    const applicationConfig = {};
    applicationConfig[bytes32('NO_MINIMAL_FEE_ETH')] = numberToEvmWord(ether(6));
    applicationConfig[bytes32('NO_MINIMAL_FEE_GALT')] = numberToEvmWord(ether(45));
    applicationConfig[bytes32('NO_M')] = numberToEvmWord(3);
    applicationConfig[bytes32('NO_N')] = numberToEvmWord(5);
    applicationConfig[bytes32('NO_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_AND_GALT);
    applicationConfig[bytes32('UO_MINIMAL_FEE_ETH')] = numberToEvmWord(ether(6));
    applicationConfig[bytes32('UO_MINIMAL_FEE_GALT')] = numberToEvmWord(ether(45));
    applicationConfig[bytes32('UO_M')] = numberToEvmWord(3);
    applicationConfig[bytes32('UO_N')] = numberToEvmWord(5);
    applicationConfig[bytes32('UO_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_AND_GALT);

    await this.galtToken.approve(this.multiSigFactory.address, ether(20), { from: alice });

    this.abX = await buildArbitration(
      this.multiSigFactory,
      [bob, charlie, dan, frank, george],
      3,
      7,
      10,
      60,
      ether(1000),
      [30, 30, 30, 30, 30, 30],
      applicationConfig,
      alice
    );

    this.mX = this.abX.multiSig.address;
    this.abMultiSigX = this.abX.multiSig;
    this.oracleStakesAccountingX = this.abX.oracleStakeAccounting;
    this.abVotingX = this.abX.voting;

    await this.newOracle.initialize(
      this.ggr.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );

    await this.updateOracle.initialize(
      this.ggr.address,
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

    this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
      CUSTODIAN_APPLICATION,
      [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
      [60, 40],
      [ES, ES],
      { from: applicationTypeManager }
    );

    await this.oracles.addOracle(this.mX, bob, BOB, MN, '', [], [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE], {
      from: oracleManager
    });
  });

  it('should be initialized successfully', async function() {
    assert.equal(await this.updateOracle.ggr(), this.ggr.address);
  });

  describe('#submit()', () => {
    describe('with GALT payment', () => {
      it('should allow an applicant pay commission in Galt', async function() {
        await this.galtToken.approve(this.updateOracle.address, ether(45), { from: alice });
        let res = await this.updateOracle.submit(
          this.mX,
          bob,
          BOB,
          MN,
          this.description,
          this.attachedDocumentsBytes32,
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
          ether(45),
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.applicationId;
        res = await this.updateOracle.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny applying for non-validator', async function() {
        await this.galtToken.approve(this.updateOracle.address, ether(45), { from: alice });
        await assertRevert(
          this.updateOracle.submit(
            this.mX,
            galtSpaceOrg,
            BOB,
            MN,
            this.description,
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
          BOB,
          MN,
          this.description,
          this.attachedDocumentsBytes32,
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
          0,
          {
            from: alice,
            value: ether(7)
          }
        );
        this.aId = res.logs[0].args.applicationId;
        res = await this.updateOracle.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      it('should deny applying for non-validator', async function() {
        await assertRevert(
          this.updateOracle.submit(
            this.mX,
            galtSpaceOrg,
            BOB,
            MN,
            this.description,
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
        ANOTHER_APPLICATION,
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE, PC_ANOTHER_ORACLE_TYPE],
        [30, 40, 30],
        [ES, ES, ES],
        { from: applicationTypeManager }
      );

      // NewOracle
      await this.galtToken.approve(this.newOracle.address, ether(47), { from: alice });
      let res = await this.newOracle.submit(
        this.mX,
        bob,
        BOB,
        MN,
        this.description,
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
        BOB,
        MN,
        this.description,
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

      res = await this.oracles.getOracle(bob);
      assert.sameMembers(
        res.assignedOracleTypes.map(hexToUtf8),
        [PC_AUDITOR_ORACLE_TYPE, PC_ANOTHER_ORACLE_TYPE].map(hexToUtf8)
      );
    });
  });
});
