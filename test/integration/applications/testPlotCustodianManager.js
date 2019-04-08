const SpaceCustodianRegistry = artifacts.require('./SpaceCustodianRegistry.sol');
const PlotCustodianManager = artifacts.require('./PlotCustodianManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const ACL = artifacts.require('./ACL.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');

const Web3 = require('web3');
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  initHelperArtifacts,
  assertEthBalanceChanged,
  ether,
  numberToEvmWord,
  assertEqualBN,
  assertRevert,
  deploySplitMergeMock,
  clearLibCache,
  paymentMethods,
  applicationStatus
} = require('../../helpers');
const { deployMultiSigFactory, buildArbitration } = require('../../deploymentHelpers');

const web3 = new Web3(PlotCustodianManager.web3.currentProvider);
const { BN, utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

const CUSTODIAN_APPLICATION = '0xe2ce825e66d1e2b4efe1252bf2f9dc4f1d7274c343ac8a9f28b6776eb58188a6';
const FAKE_APPLICATION = '0x6421c172ed119558ac0b0fb3c16787d36451c23d21b46c87fc94aee231f08823';

const PV_APPRAISER_ORACLE_TYPE = bytes32('PV_APPRAISER_ORACLE_TYPE');
const PV_APPRAISER2_ORACLE_TYPE = bytes32('PV_APPRAISER2_ORACLE_TYPE');
const PV_AUDITOR_ORACLE_TYPE = bytes32('PV_AUDITOR_ORACLE_TYPE');
const PC_CUSTODIAN = bytes32('PC_CUSTODIAN_ORACLE_TYPE');
const PC_AUDITOR = bytes32('PC_AUDITOR_ORACLE_TYPE');

const FOO = bytes32('foo');
const BAR = bytes32('bar');
const BUZZ = bytes32('buzz');
const ES = bytes32('');
const MN = bytes32('MN');
const BOB = bytes32('bob');
const CHARLIE = bytes32('charlie');
const DAN = bytes32('dan');
const EVE = bytes32('eve');
const FRANK = bytes32('frank');
const GEORGE = bytes32('george');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

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

Object.freeze(ValidationStatus);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

// eslint-disable-next-line
contract('PlotCustodianManager', (accounts) => {
  const [
    coreTeam,
    feeMixerAddress,
    multiSigX,
    stakesNotifier,
    minter,
    claimManagerAddress,
    applicationTypeManager,
    manualCustodianManager,
    spaceRA,
    oracleManager,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank,
    george
  ] = accounts;

  before(async function() {
    clearLibCache();

    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';
    this.attachedDocuments = [
      'QmYNQJoKGNHTpPxCBPh9KkDpaExgd2duMa3aF6ytMpHdao',
      'QmeveuwF5wWBSgUXLG6p1oxF3GKkgjEnhA6AAwHUoVsx6E',
      'QmSrPmbaUKA3ZodhzPWZnpFgcPMFWF4QsxXbkWfEptTBJd'
    ].map(galt.ipfsHashToBytes32);

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.heights = [1, 2, 3];
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.galtToken = await GaltToken.new({ from: coreTeam });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    this.acl = await ACL.new({ from: coreTeam });
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.multiSigRegistry = await MultiSigRegistry.new(this.ggr.address, { from: coreTeam });
    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.plotCustodianManager = await PlotCustodianManager.new({ from: coreTeam });
    this.spaceCustodianRegistry = await SpaceCustodianRegistry.new(this.ggr.address, { from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    const deployment = await deploySplitMergeMock(this.ggr);
    this.splitMerge = deployment.splitMerge;
    this.geodesic = deployment.geodesic;

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.MULTI_SIG_REGISTRY(), this.multiSigRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GEODESIC(), this.geodesic.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.ORACLES(), this.oracles.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_COLLECTOR(), feeMixerAddress, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_CUSTODIAN_REGISTRY(), this.spaceCustodianRegistry.address, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.CLAIM_MANAGER(), claimManagerAddress, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_RA(), spaceRA, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPLIT_MERGE(), this.splitMerge.address, { from: coreTeam });

    this.multiSigFactory = await deployMultiSigFactory(this.ggr, coreTeam);

    await this.feeRegistry.setGaltFee(await this.multiSigFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.multiSigFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.multiSigFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });
    await this.acl.setRole(bytes32('MULTI_SIG_REGISTRAR'), this.multiSigFactory.address, true, { from: coreTeam });

    await this.galtToken.approve(this.multiSigFactory.address, ether(20), { from: alice });

    const applicationConfig = {};
    applicationConfig[bytes32('PC_MINIMAL_FEE_ETH')] = numberToEvmWord(ether(6));
    applicationConfig[bytes32('PC_MINIMAL_FEE_GALT')] = numberToEvmWord(ether(45));
    applicationConfig[bytes32('PC_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_AND_GALT);

    // [52, 47, 1],
    applicationConfig[await this.plotCustodianManager.getOracleTypeShareKey(PC_CUSTODIAN)] = numberToEvmWord(60);
    applicationConfig[await this.plotCustodianManager.getOracleTypeShareKey(PC_AUDITOR)] = numberToEvmWord(40);

    this.abX = await buildArbitration(
      this.multiSigFactory,
      [bob, charlie, dan, eve, frank],
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
    this.abConfig = this.abX.config;
    this.oracleStakesAccountingX = this.abX.oracleStakeAccounting;

    await this.oracles.addRoleTo(applicationTypeManager, await this.oracles.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(oracleManager, await this.oracles.ROLE_ORACLE_STAKES_MANAGER(), {
      from: coreTeam
    });
    await this.oracles.addRoleTo(stakesNotifier, await this.oracles.ROLE_ORACLE_STAKES_NOTIFIER(), {
      from: coreTeam
    });

    this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
      FAKE_APPLICATION,
      [FOO, BAR, BUZZ],
      [50, 25, 25],
      [ES, ES, ES],
      { from: applicationTypeManager }
    );
    this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
      CUSTODIAN_APPLICATION,
      [PC_CUSTODIAN, PC_AUDITOR],
      [60, 40],
      [ES, ES],
      { from: applicationTypeManager }
    );

    await this.spaceToken.addRoleTo(minter, 'minter', { from: coreTeam });
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.oracles.setOracleTypeMinimalDeposit(PV_APPRAISER_ORACLE_TYPE, ether(30), {
      from: applicationTypeManager
    });
    await this.oracles.setOracleTypeMinimalDeposit(PV_APPRAISER2_ORACLE_TYPE, ether(30), {
      from: applicationTypeManager
    });
    await this.oracles.setOracleTypeMinimalDeposit(PV_AUDITOR_ORACLE_TYPE, ether(30), { from: applicationTypeManager });
    await this.oracles.setOracleTypeMinimalDeposit(PC_CUSTODIAN, ether(30), {
      from: applicationTypeManager
    });
    await this.oracles.setOracleTypeMinimalDeposit(PC_AUDITOR, ether(30), { from: applicationTypeManager });

    await this.oracles.addOracle(multiSigX, bob, BOB, MN, '', [], [PC_CUSTODIAN, FOO], {
      from: oracleManager
    });
    await this.oracles.addOracle(multiSigX, charlie, CHARLIE, MN, '', [], [PC_CUSTODIAN, PC_AUDITOR, BAR], {
      from: oracleManager
    });
    await this.oracles.addOracle(multiSigX, dan, DAN, MN, '', [], [BUZZ], {
      from: oracleManager
    });
    await this.oracles.addOracle(multiSigX, eve, EVE, MN, '', [], [PC_AUDITOR], {
      from: oracleManager
    });
    await this.oracles.addOracle(multiSigX, frank, FRANK, MN, '', [], [PC_CUSTODIAN], {
      from: oracleManager
    });
    await this.oracles.addOracle(multiSigX, george, GEORGE, MN, '', [], [PC_CUSTODIAN], {
      from: oracleManager
    });

    // bob
    await this.oracles.onOracleStakeChanged(bob, PC_CUSTODIAN, ether(30), {
      from: stakesNotifier
    });
    await this.oracles.onOracleStakeChanged(bob, FOO, ether(30), { from: stakesNotifier });

    // charlie
    await this.oracles.onOracleStakeChanged(charlie, PC_CUSTODIAN, ether(30), {
      from: stakesNotifier
    });
    await this.oracles.onOracleStakeChanged(charlie, PC_AUDITOR, ether(30), {
      from: stakesNotifier
    });
    await this.oracles.onOracleStakeChanged(charlie, BAR, ether(30), { from: stakesNotifier });

    // dan
    await this.oracles.onOracleStakeChanged(dan, BUZZ, ether(30), { from: stakesNotifier });

    // eve
    await this.oracles.onOracleStakeChanged(eve, PC_AUDITOR, ether(30), {
      from: stakesNotifier
    });

    // frank
    await this.oracles.onOracleStakeChanged(frank, PC_CUSTODIAN, ether(30), {
      from: stakesNotifier
    });

    // george
    await this.oracles.onOracleStakeChanged(george, PC_CUSTODIAN, ether(30), {
      from: stakesNotifier
    });

    await this.acl.setRole(bytes32('SPACE_CUSTODIAN_REGISTRAR'), manualCustodianManager, true, { from: coreTeam });
  });

  beforeEach(async function() {
    this.plotCustodianManager = await PlotCustodianManager.new({ from: coreTeam });

    await this.plotCustodianManager.initialize(this.ggr.address, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('SPACE_CUSTODIAN_REGISTRAR'), this.plotCustodianManager.address, true, {
      from: coreTeam
    });
  });

  it('should be initialized successfully', async function() {
    assert.equal(await this.plotCustodianManager.ggr(), this.ggr.address);
  });

  describe('application pipeline for GALT', () => {
    beforeEach(async function() {
      let res = await this.spaceToken.mint(alice, { from: minter });
      this.spaceTokenId = res.logs[0].args.tokenId.toNumber();
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
    });

    describe('#submit()', () => {
      it('should allow an applicant pay commission in Galt', async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
        let res = await this.plotCustodianManager.submit(
          this.abMultiSigX.address,
          this.spaceTokenId,
          Action.ATTACH,
          [bob],
          ether(45),
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.id;
        res = await this.plotCustodianManager.getApplicationById(this.aId);
        assert.equal(res.status, applicationStatus.SUBMITTED);
      });

      it('should deny attaching non-unique custodians', async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
        await assertRevert(
          this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, bob],
            ether(45),
            {
              from: alice
            }
          )
        );
      });

      it('should deny detaching non-attached custodian', async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
        await assertRevert(
          this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.DETACH,
            [bob],
            ether(45),
            {
              from: alice
            }
          )
        );
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
          await assertRevert(
            this.plotCustodianManager.submit(this.abMultiSigX.address, this.spaceTokenId, Action.ATTACH, [bob], 0, {
              from: alice
            })
          );
        });

        it('should reject applications with payment which less than required', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(45), { from: alice });
          await assertRevert(
            this.plotCustodianManager.submit(
              this.abMultiSigX.address,
              this.spaceTokenId,
              Action.DETACH,
              [bob],
              ether(43),
              {
                from: alice
              }
            )
          );
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          await this.galtToken.approve(this.plotCustodianManager.address, ether(47), { from: alice });
          let res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob],
            ether(47),
            {
              from: alice
            }
          );
          this.aId = res.logs[0].args.id;

          // oracle share - 87%
          // galtspace share - 13%

          res = await this.plotCustodianManager.getApplicationRewards(this.aId);
          assert.equal(res.galtProtocolFee, '6110000000000000000');
          assert.equal(res.oraclesReward, '40890000000000000000');
          assert.equal(res.totalCustodiansReward, '24534000000000000000');
          assert.equal(res.auditorReward, '16356000000000000000');
        });
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.plotCustodianManager.address, ether(47), { from: alice });
        const res = await this.plotCustodianManager.submit(
          this.abMultiSigX.address,
          this.spaceTokenId,
          Action.ATTACH,
          [bob, charlie],
          ether(47),
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.id;
        await this.plotCustodianManager.accept(this.aId, { from: bob });
        await this.plotCustodianManager.accept(this.aId, { from: charlie });
        await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
        await this.plotCustodianManager.attachToken(this.aId, { from: alice });
        await this.plotCustodianManager.auditorLock(this.aId, { from: eve });

        await this.plotCustodianManager.approve(this.aId, { from: charlie });
        await this.plotCustodianManager.approve(this.aId, { from: eve });
        await this.plotCustodianManager.approve(this.aId, { from: alice });
      });

      describe('for COMPLETED applications', () => {
        beforeEach(async function() {
          await this.plotCustodianManager.approve(this.aId, { from: bob });
          await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });
        });

        it('should be allowed', async function() {
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

          let res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.COMPLETED);

          res = await this.plotCustodianManager.getApplicationRewards(this.aId);
          assert.equal(res.galtProtocolFeePaidOut, true);
          assert.equal(res.auditorRewardPaidOut, true);

          res = await this.plotCustodianManager.getApplicationCustodian(this.aId, bob);
          assert.equal(res.approved, true);
          assert.equal(res.rewardPaidOut, true);
          assert.equal(res.involved, true);

          res = await this.plotCustodianManager.getApplicationCustodian(this.aId, charlie);
          assert.equal(res.approved, true);
          assert.equal(res.rewardPaidOut, false);
          assert.equal(res.involved, true);
        });

        it('should send funds to claimers', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString());

          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString());

          const res = await this.plotCustodianManager.getApplicationRewards(this.aId);

          assert.equal(res.galtProtocolFee, 6110000000000000000);
          assert.equal(res.oraclesReward, 40890000000000000000);
          assert.equal(res.totalCustodiansReward, 24534000000000000000);
          assert.equal(res.custodianReward, 8178000000000000000);
          assert.equal(res.auditorReward, 16356000000000000000);
          assert.equal(res.galtProtocolFeePaidOut, true);
          assert.equal(res.auditorRewardPaidOut, true);

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('8178000000000000000')));
          assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('16356000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('6110000000000000000')));
        });

        it('should revert on double claim', async function() {
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: bob }));
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: eve }));
        });

        it('should revert on non-oracle claim', async function() {
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
        });

        it('should revert on applicant claim attempt', async function() {
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
        });
      });

      describe('for CLOSED applications', () => {
        beforeEach(async function() {
          await this.plotCustodianManager.reject(this.aId, 'fix it', { from: bob });
          await this.plotCustodianManager.close(this.aId, { from: alice });
        });

        it('should be allowed', async function() {
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

          let res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.CLOSED);

          res = await this.plotCustodianManager.getApplicationRewards(this.aId);
          assert.equal(res.galtProtocolFeePaidOut, true);
          assert.equal(res.auditorRewardPaidOut, true);

          res = await this.plotCustodianManager.getApplicationCustodian(this.aId, bob);
          assert.equal(res.approved, false);
          assert.equal(res.rewardPaidOut, true);
          assert.equal(res.involved, true);

          res = await this.plotCustodianManager.getApplicationCustodian(this.aId, charlie);
          assert.equal(res.approved, true);
          assert.equal(res.rewardPaidOut, false);
          assert.equal(res.involved, true);
        });

        it('should send funds to claimers', async function() {
          const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsInitialBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString());

          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

          const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
          const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
          const orgsFinalBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString());

          assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('8178000000000000000')));
          assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('16356000000000000000')));
          assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('6110000000000000000')));
        });

        it('should revert on double claim', async function() {
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
          await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
          await this.plotCustodianManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: bob }));
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: eve }));
        });

        it('should revert on non-oracle claim', async function() {
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
        });

        it('should revert on applicant claim attempt', async function() {
          await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
        });
      });
    });
  });

  describe('application pipeline for ETH', () => {
    beforeEach(async function() {
      let res = await this.spaceToken.mint(alice, { from: minter });
      this.spaceTokenId = res.logs[0].args.tokenId.toNumber();

      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
    });

    describe('without current custodians exist', () => {
      describe('#submit() by an applicant', () => {
        it('should allow an applicant pay commission in ETH', async function() {
          let res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.SUBMITTED);
        });

        it('should reject applications if chosen custodian is invalid', async function() {
          await assertRevert(
            this.plotCustodianManager.submit(this.abMultiSigX.address, this.spaceTokenId, Action.DETACH, [dan], 0, {
              from: alice,
              value: ether(20)
            })
          );
        });

        describe('payable', () => {
          it('should reject applications without payment', async function() {
            await assertRevert(
              this.plotCustodianManager.submit(this.abMultiSigX.address, this.spaceTokenId, Action.ATTACH, [bob], 0, {
                from: alice
              })
            );
          });

          it('should reject applications with payment which less than required', async function() {
            await assertRevert(
              this.plotCustodianManager.submit(this.abMultiSigX.address, this.spaceTokenId, Action.ATTACH, [bob], 0, {
                from: alice,
                value: 10
              })
            );
          });

          it('should allow applications with payment greater than required', async function() {
            await this.plotCustodianManager.submit(
              this.abMultiSigX.address,
              this.spaceTokenId,
              Action.ATTACH,
              [bob],
              0,
              {
                from: alice,
                value: ether(23)
              }
            );
          });

          it('should calculate corresponding oracle and galtspace rewards', async function() {
            let res = await this.plotCustodianManager.submit(
              this.abMultiSigX.address,
              this.spaceTokenId,
              Action.ATTACH,
              [bob],
              0,
              {
                from: alice,
                value: ether(7)
              }
            );
            this.aId = res.logs[0].args.id;
            // oracle share - 67%
            // galtspace share - 33%

            res = await this.plotCustodianManager.getApplicationRewards(this.aId);

            assert.equal(res.galtProtocolFee, '2310000000000000000');
            assert.equal(res.oraclesReward, '4690000000000000000');
            assert.equal(res.totalCustodiansReward, '2814000000000000000');
            assert.equal(res.auditorReward, '1876000000000000000');
          });
        });
      });

      describe('#accept() by a modifying custodian', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, charlie],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
        });

        it('should allow custodians accepting a submitted application', async function() {
          await this.plotCustodianManager.accept(this.aId, { from: bob });

          let res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.SUBMITTED);
          assert.sameMembers(res.custodiansToModify, [bob, charlie]);
          assert.sameMembers(res.acceptedCustodians, [bob]);
          assert.sameMembers(res.lockedCustodians, []);

          await this.plotCustodianManager.accept(this.aId, { from: charlie });

          // bypasses ACCEPTED status since current custodian array size is 0
          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.LOCKED);
          assert.sameMembers(res.custodiansToModify, [bob, charlie]);
          assert.sameMembers(res.acceptedCustodians, [bob, charlie]);
          assert.sameMembers(res.lockedCustodians, []);
        });

        it('should deny a non-chosen custodian accepting an  application', async function() {
          await assertRevert(this.plotCustodianManager.accept(this.aId, { from: dan }));
        });

        it('should deny non-custodian accepting an application', async function() {
          await assertRevert(this.plotCustodianManager.accept(this.aId, { from: alice }));
        });
      });

      describe('#revert() by a new custodian', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, charlie],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
        });

        it('should allow custodian revert application if he wont work with it', async function() {
          await this.plotCustodianManager.revert(this.aId, { from: bob });

          const res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.REVERTED);
        });

        it('should deny a non-chosen custodian reverting an  application', async function() {
          await assertRevert(this.plotCustodianManager.revert(this.aId, { from: dan }));
        });

        it('should deny double revert of the same application', async function() {
          await this.plotCustodianManager.revert(this.aId, { from: bob });
          await assertRevert(this.plotCustodianManager.revert(this.aId, { from: bob }));
        });

        it('should deny non-custodian revert an application', async function() {
          await assertRevert(this.plotCustodianManager.revert(this.aId, { from: alice }));
        });
      });

      describe('#resubmit() by an applicant', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, charlie],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.revert(this.aId, { from: bob });
        });

        it('should allow an applicant to resubmit an application with the same payload', async function() {
          await this.plotCustodianManager.resubmit(this.aId, this.spaceTokenId, Action.ATTACH, [bob], {
            from: alice
          });

          const res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.SUBMITTED);
          assert.sameMembers(res.custodiansToModify, [bob]);
          assert.sameMembers(res.acceptedCustodians, []);
          assert.sameMembers(res.lockedCustodians, []);
        });

        it('should allow an applicant to resubmit an application with different payload', async function() {
          await this.plotCustodianManager.resubmit(this.aId, this.spaceTokenId, Action.ATTACH, [charlie, frank], {
            from: alice
          });

          const res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.SUBMITTED);
          assert.equal(res.action, Action.ATTACH);

          assert.sameMembers(res.custodiansToModify, [charlie, frank]);
          assert.sameMembers(res.acceptedCustodians, []);
          assert.sameMembers(res.lockedCustodians, []);
        });

        it('should deny a non-applicant resubmitting an  application', async function() {
          await assertRevert(
            this.plotCustodianManager.resubmit(this.aId, this.spaceTokenId, Action.DETACH, [charlie], {
              from: charlie
            })
          );
        });
      });

      describe('#attachToken() by an applicant', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, charlie],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
        });

        it('should allow an applicant attaching package token to the application', async function() {
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, {
            from: alice
          });

          let res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.REVIEW);

          res = await this.spaceToken.ownerOf(this.spaceTokenId);
          assert.equal(res, this.plotCustodianManager.address);
        });

        it('should deny a non-oracle attaching token to an application', async function() {
          await assertRevert(this.plotCustodianManager.attachToken(this.aId, { from: charlie }));
        });
      });

      describe('#attachDocuments() by a custodian', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, charlie],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, {
            from: alice
          });
        });

        it('should allow a custodian attaching documents to an application', async function() {
          await this.plotCustodianManager.attachDocuments(this.aId, this.attachedDocuments, {
            from: bob
          });

          const res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.REVIEW);
          assert.sameMembers(res.custodianDocuments, this.attachedDocuments);
        });

        it('should deny a non-custodian of the application attaching documents to it', async function() {
          await assertRevert(
            this.plotCustodianManager.attachDocuments(this.aId, this.attachedDocuments, {
              from: dan
            })
          );
        });
      });

      describe('#audotirLock() by an auditor', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, charlie],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
        });

        describe('with attached token', () => {
          beforeEach(async function() {
            await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
            await this.plotCustodianManager.attachToken(this.aId, {
              from: alice
            });
          });

          it('should allow an auditor locking the application', async function() {
            await this.plotCustodianManager.auditorLock(this.aId, {
              from: eve
            });

            const res = await this.plotCustodianManager.getApplicationById(this.aId);
            assert.equal(res.status, applicationStatus.REVIEW);
            assert.equal(res.auditor, eve);
          });

          it('should deny a non-auditor locking the application', async function() {
            await assertRevert(
              this.plotCustodianManager.auditorLock(this.aId, {
                from: dan
              })
            );
          });
        });

        it('should deny an auditor locking the application in non-REVIEW status', async function() {
          await assertRevert(
            this.plotCustodianManager.auditorLock(this.aId, {
              from: eve
            })
          );
        });
      });

      describe('#approve() by 4 of 4 (applicant, custodian and auditors)', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, charlie],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });
        });

        it('should change application status to APPROVED if all 3 roles voted', async function() {
          let res = await this.plotCustodianManager.getApplicationVoting(this.aId);
          assert.equal(res.approveCount, 0);
          assert.equal(res.required, 4);
          assert.sameMembers(res.voters.map(v => v), [alice, bob, charlie, eve]);

          await this.plotCustodianManager.approve(this.aId, { from: charlie });
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: bob });
          await this.plotCustodianManager.approve(this.aId, { from: alice });

          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.APPROVED);

          res = await this.plotCustodianManager.getApplicationVoting(this.aId);
          assert.equal(res.approveCount, 4);
          assert.equal(res.required, 4);
          assert.sameMembers(res.voters.map(v => v), [alice, bob, charlie, eve]);

          res = await this.spaceCustodianRegistry.spaceCustodians(this.spaceTokenId);
          assert.sameMembers(res, [bob, charlie]);
        });

        it('should keep application status in REVIEW if not all participants voted yet', async function() {
          await this.plotCustodianManager.approve(this.aId, { from: bob });
          await this.plotCustodianManager.approve(this.aId, { from: alice });

          let res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.REVIEW);

          res = await this.plotCustodianManager.getApplicationVoting(this.aId);
          assert.equal(res.approveCount, 2);
          assert.equal(res.required, 4);
        });
      });

      describe('#reject() by custodian', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, charlie],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });
        });

        it('should change application status to REJECTED', async function() {
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: alice });
          await this.plotCustodianManager.reject(this.aId, 'fix it', { from: bob });

          const res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.REJECTED);
        });

        it('should deny non-custodian perform this action', async function() {
          await assertRevert(this.plotCustodianManager.reject(this.aId, 'fix it', { from: eve }));

          const res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.REVIEW);
        });
      });

      describe('#withdrawToken() by an applicant', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, charlie],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });

          await this.plotCustodianManager.approve(this.aId, { from: charlie });
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: bob });
          await this.plotCustodianManager.approve(this.aId, { from: alice });
        });

        it('should allow an applicant withdraw the attached token', async function() {
          await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });

          let res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.COMPLETED);

          res = await this.spaceToken.ownerOf(this.spaceTokenId);
          assert.equal(res, alice);
        });

        it('should deny non-applicant withdraw the token', async function() {
          await assertRevert(this.plotCustodianManager.withdrawToken(this.aId, { from: eve }));

          let res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.APPROVED);

          res = await this.spaceToken.ownerOf(this.spaceTokenId);
          assert.equal(res, this.plotCustodianManager.address);
        });
      });

      describe('#close() by an applicant', () => {
        beforeEach(async function() {
          let res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, charlie],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;

          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });

          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.LOCKED);
        });

        describe('when application status is LOCKED', () => {
          it('should allow an applicant close the application', async function() {
            await this.plotCustodianManager.close(this.aId, { from: alice });

            const res = await this.plotCustodianManager.getApplicationById(this.aId);
            assert.equal(res.status, applicationStatus.CLOSED);
          });

          it('should deny non-applicant closing the application', async function() {
            await assertRevert(this.plotCustodianManager.close(this.aId, { from: eve }));
          });
        });

        describe('when application status is REJECTED', () => {
          beforeEach(async function() {
            await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
            await this.plotCustodianManager.attachToken(this.aId, {
              from: alice
            });
            await this.plotCustodianManager.auditorLock(this.aId, { from: eve });
            await this.plotCustodianManager.approve(this.aId, { from: eve });
            await this.plotCustodianManager.approve(this.aId, { from: alice });
            await this.plotCustodianManager.reject(this.aId, 'fix it', { from: bob });
          });

          it('should allow an applicant to close the application', async function() {
            await this.plotCustodianManager.close(this.aId, { from: alice });

            let res = await this.plotCustodianManager.getApplicationById(this.aId);
            assert.equal(res.status, applicationStatus.CLOSED);

            res = await this.spaceToken.ownerOf(this.spaceTokenId);
            assert.equal(res, alice);
          });

          it('should deny non-applicant closing the application', async function() {
            await assertRevert(this.plotCustodianManager.close(this.aId, { from: eve }));
          });
        });
      });

      describe('claim reward', () => {
        beforeEach(async function() {
          const res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, charlie],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });

          await this.plotCustodianManager.approve(this.aId, { from: charlie });
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: alice });
        });

        describe('for COMPLETED applications', () => {
          beforeEach(async function() {
            await this.plotCustodianManager.approve(this.aId, { from: bob });
            await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });
          });

          it('should be allowed', async function() {
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

            let res = await this.plotCustodianManager.getApplicationById(this.aId);
            assert.equal(res.status, applicationStatus.COMPLETED);

            res = await this.plotCustodianManager.getApplicationRewards(this.aId);
            assert.equal(res.galtProtocolFeePaidOut, true);
            assert.equal(res.auditorRewardPaidOut, true);

            res = await this.plotCustodianManager.getApplicationCustodian(this.aId, bob);
            assert.equal(res.approved, true);
            assert.equal(res.rewardPaidOut, true);
            assert.equal(res.involved, true);

            res = await this.plotCustodianManager.getApplicationCustodian(this.aId, charlie);
            assert.equal(res.approved, true);
            assert.equal(res.rewardPaidOut, false);
            assert.equal(res.involved, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
            const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
            const orgsInitialBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

            const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
            const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
            const orgsFinalBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

            const res = await this.plotCustodianManager.getApplicationRewards(this.aId);

            assert.equal(res.galtProtocolFee, 2310000000000000000);
            assert.equal(res.oraclesReward, 4690000000000000000);
            assert.equal(res.totalCustodiansReward, 2814000000000000000);
            assert.equal(res.custodianReward, 938000000000000000);
            assert.equal(res.auditorReward, 1876000000000000000);
            assert.equal(res.galtProtocolFeePaidOut, true);
            assert.equal(res.auditorRewardPaidOut, true);

            assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(0.938));
            assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(1.876));
            assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(2.31));
          });

          it('should revert on double claim', async function() {
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: eve }));
          });

          it('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
          });

          it('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
          });
        });

        describe('for CLOSED applications', () => {
          beforeEach(async function() {
            await this.plotCustodianManager.reject(this.aId, 'fix it', { from: bob });
            await this.plotCustodianManager.close(this.aId, { from: alice });
          });

          it('should be allowed', async function() {
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

            let res = await this.plotCustodianManager.getApplicationById(this.aId);
            assert.equal(res.status, applicationStatus.CLOSED);

            res = await this.plotCustodianManager.getApplicationRewards(this.aId);
            assert.equal(res.galtProtocolFeePaidOut, true);
            assert.equal(res.auditorRewardPaidOut, true);

            res = await this.plotCustodianManager.getApplicationCustodian(this.aId, bob);
            assert.equal(res.approved, false);
            assert.equal(res.rewardPaidOut, true);
            assert.equal(res.involved, true);

            res = await this.plotCustodianManager.getApplicationCustodian(this.aId, charlie);
            assert.equal(res.approved, true);
            assert.equal(res.rewardPaidOut, false);
            assert.equal(res.involved, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
            const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
            const orgsInitialBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

            const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
            const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
            const orgsFinalBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

            const res = await this.plotCustodianManager.getApplicationRewards(this.aId);

            assert.equal(res.galtProtocolFee, 2310000000000000000);
            assert.equal(res.oraclesReward, 4690000000000000000);
            assert.equal(res.totalCustodiansReward, 2814000000000000000);
            assert.equal(res.custodianReward, 938000000000000000);
            assert.equal(res.auditorReward, 1876000000000000000);
            assert.equal(res.galtProtocolFeePaidOut, true);
            assert.equal(res.auditorRewardPaidOut, true);

            assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(0.938));
            assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(1.876));
            assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(2.31));
          });

          it('should revert on double claim', async function() {
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: bob });
            await this.plotCustodianManager.claimOracleReward(this.aId, { from: eve });
            await this.plotCustodianManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: eve }));
          });

          it('should revert on non-oracle claim', async function() {
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
          });

          it('should revert on applicant claim attempt', async function() {
            await assertRevert(this.plotCustodianManager.claimOracleReward(this.aId, { from: alice }));
          });
        });
      });
    });

    describe('with current custodians exist', () => {
      beforeEach(async function() {
        await this.spaceCustodianRegistry.attach(this.spaceTokenId, [charlie, frank], this.attachedDocuments, {
          from: manualCustodianManager
        });
        const res = await this.spaceCustodianRegistry.spaceCustodians(this.spaceTokenId);
        assert.sameMembers(res, [charlie, frank]);
      });

      describe('attach', () => {
        describe('#submit()', () => {
          it('should deny attaching existing custodians', async function() {
            await assertRevert(
              this.plotCustodianManager.submit(
                this.abMultiSigX.address,
                this.spaceTokenId,
                Action.ATTACH,
                [bob, frank],
                0,
                {
                  from: alice,
                  value: ether(7)
                }
              )
            );
          });

          it('should allow submitting non existing custodians', async function() {
            await this.plotCustodianManager.submit(
              this.abMultiSigX.address,
              this.spaceTokenId,
              Action.ATTACH,
              [bob, george],
              0,
              {
                from: alice,
                value: ether(7)
              }
            );
          });
        });

        it('should allow simple pipeline', async function() {
          let res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.ATTACH,
            [bob, george],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          await this.plotCustodianManager.accept(this.aId, { from: bob });
          await this.plotCustodianManager.accept(this.aId, { from: george });
          await this.plotCustodianManager.lock(this.aId, { from: charlie });
          await this.plotCustodianManager.lock(this.aId, { from: frank });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });

          await this.plotCustodianManager.approve(this.aId, { from: charlie });
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: alice });
          await this.plotCustodianManager.approve(this.aId, { from: bob });

          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.REVIEW);

          await this.plotCustodianManager.approve(this.aId, { from: george });
          await this.plotCustodianManager.approve(this.aId, { from: frank });

          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.APPROVED);

          res = await this.spaceCustodianRegistry.spaceCustodians(this.spaceTokenId);
          assert.sameMembers(res, [charlie, frank, bob, george]);
        });
      });

      describe('detach', () => {
        describe('#submit()', () => {
          it('should deny detaching non-existing custodians', async function() {
            await assertRevert(
              this.plotCustodianManager.submit(
                this.abMultiSigX.address,
                this.spaceTokenId,
                Action.DETACH,
                [bob, frank],
                0,
                {
                  from: alice,
                  value: ether(7)
                }
              )
            );
          });

          it('should allow detaching existing custodians', async function() {
            const res = await this.spaceCustodianRegistry.spaceCustodians(this.spaceTokenId);
            assert.sameMembers(res, [charlie, frank]);
            await this.plotCustodianManager.submit(
              this.abMultiSigX.address,
              this.spaceTokenId,
              Action.DETACH,
              [charlie, frank],
              0,
              {
                from: alice,
                value: ether(7)
              }
            );
          });
        });

        it('should allow simple pipeline', async function() {
          await this.spaceCustodianRegistry.attach(this.spaceTokenId, [bob, george], this.attachedDocuments, {
            from: manualCustodianManager
          });
          let res = await this.spaceCustodianRegistry.spaceCustodians(this.spaceTokenId);
          assert.sameMembers(res, [charlie, frank, bob, george]);

          res = await this.spaceCustodianRegistry.spaceDocuments(this.spaceTokenId);
          assert.sameMembers(res, this.attachedDocuments);

          // Now there are 4 custodians: [charlie, frank, bob, george]
          res = await this.plotCustodianManager.submit(
            this.abMultiSigX.address,
            this.spaceTokenId,
            Action.DETACH,
            [charlie, george],
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;

          await this.plotCustodianManager.accept(this.aId, { from: charlie });
          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.SUBMITTED);

          await this.plotCustodianManager.accept(this.aId, { from: george });
          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.ACCEPTED);

          await this.plotCustodianManager.lock(this.aId, { from: charlie });
          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.ACCEPTED);

          await this.plotCustodianManager.lock(this.aId, { from: george });
          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.ACCEPTED);

          await this.plotCustodianManager.lock(this.aId, { from: bob });
          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.ACCEPTED);

          await this.plotCustodianManager.lock(this.aId, { from: frank });
          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.LOCKED);

          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, { from: alice });
          await this.plotCustodianManager.auditorLock(this.aId, { from: eve });

          await this.plotCustodianManager.approve(this.aId, { from: charlie });
          await this.plotCustodianManager.approve(this.aId, { from: eve });
          await this.plotCustodianManager.approve(this.aId, { from: alice });
          await this.plotCustodianManager.approve(this.aId, { from: bob });

          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.REVIEW);

          await this.plotCustodianManager.approve(this.aId, { from: george });
          await this.plotCustodianManager.approve(this.aId, { from: frank });

          res = await this.plotCustodianManager.getApplicationById(this.aId);
          assert.equal(res.status, applicationStatus.APPROVED);

          res = await this.spaceCustodianRegistry.spaceCustodians(this.spaceTokenId);
          assert.sameMembers(res, [frank, bob]);
        });
      });
    });
  });
});
