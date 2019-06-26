const GaltToken = artifacts.require('./GaltToken.sol');
const ACL = artifacts.require('./ACL.sol');
const PGGRegistry = artifacts.require('./PGGRegistry.sol');
const NewOracleManager = artifacts.require('./NewOracleManager.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const PGGOracleStakeAccounting = artifacts.require('./PGGOracleStakeAccounting.sol');
const StakeTracker = artifacts.require('./StakeTracker.sol');

const Web3 = require('web3');
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  ether,
  numberToEvmWord,
  assertEthBalanceChanged,
  assertGaltBalanceChanged,
  paymentMethods,
  assertRevert
} = require('../../helpers');
const { deployPGGFactory, buildPGG } = require('../../deploymentHelpers');

GaltToken.numberFormat = 'String';
NewOracleManager.numberFormat = 'String';

const web3 = new Web3(GaltToken.web3.currentProvider);
const { hexToUtf8, utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

// eslint-disable-next-line no-underscore-dangle
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const EVE = bytes32('Eve');

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

// eslint-disable-next-line
contract('NewOracleManager', (accounts) => {
  const [coreTeam, feeMixerAddress, spaceRA, alice, bob, charlie, dan, eve, frank, george, henrey] = accounts;

  before(async function() {
    this.attachedDocuments = [
      'QmYNQJoKGNHTpPxCBPh9KkDpaExgd2duMa3aF6ytMpHdao',
      'QmeveuwF5wWBSgUXLG6p1oxF3GKkgjEnhA6AAwHUoVsx6E',
      'QmSrPmbaUKA3ZodhzPWZnpFgcPMFWF4QsxXbkWfEptTBJd'
    ];
    this.attachedDocumentsBytes32 = this.attachedDocuments.map(galt.ipfsHashToBytes32);
    this.description = '';

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.newOracle = await NewOracleManager.new({ from: coreTeam });

    this.acl = await ACL.new({ from: coreTeam });
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.pggRegistry = await PGGRegistry.new({ from: coreTeam });
    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.myPGGOracleStakeAccounting = await PGGOracleStakeAccounting.new(alice, { from: coreTeam });
    this.stakeTracker = await StakeTracker.new({ from: coreTeam });

    this.acl = await ACL.new({ from: coreTeam });
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.pggRegistry = await PGGRegistry.new({ from: coreTeam });
    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.stakeTracker = await StakeTracker.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.pggRegistry.initialize(this.ggr.address);
    await this.stakeTracker.initialize(this.ggr.address);

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.PGG_REGISTRY(), this.pggRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.STAKE_TRACKER(), this.stakeTracker.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_RA(), spaceRA, {
      from: coreTeam
    });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    await this.feeRegistry.setProtocolEthShare(33, { from: coreTeam });
    await this.feeRegistry.setProtocolGaltShare(13, { from: coreTeam });

    this.pggFactory = await deployPGGFactory(this.ggr, coreTeam);

    await this.feeRegistry.setGaltFee(await this.pggFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.pggFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.pggFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });
    await this.acl.setRole(bytes32('PGG_REGISTRAR'), this.pggFactory.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('FEE_COLLECTOR'), feeMixerAddress, true, { from: coreTeam });

    const applicationConfig = {};
    applicationConfig[bytes32('NO_MINIMAL_FEE_ETH')] = numberToEvmWord(ether(6));
    applicationConfig[bytes32('NO_MINIMAL_FEE_GALT')] = numberToEvmWord(ether(45));
    applicationConfig[bytes32('NO_M')] = numberToEvmWord(3);
    applicationConfig[bytes32('NO_N')] = numberToEvmWord(5);
    applicationConfig[bytes32('NO_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_AND_GALT);

    const pcCustodianKey = await this.myPGGOracleStakeAccounting.oracleTypeMinimalStakeKey(PC_CUSTODIAN_ORACLE_TYPE);
    const pcAuditorKey = await this.myPGGOracleStakeAccounting.oracleTypeMinimalStakeKey(PC_AUDITOR_ORACLE_TYPE);

    applicationConfig[pcCustodianKey] = numberToEvmWord(ether(30));
    applicationConfig[pcAuditorKey] = numberToEvmWord(ether(30));

    this.applicationConfig = applicationConfig;

    await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });
    this.pggX = await buildPGG(
      this.pggFactory,
      [bob, charlie, dan, eve, frank, george],
      3,
      7,
      10,
      60,
      ether(1000),
      300000,
      {},
      applicationConfig,
      alice
    );

    this.mX = this.pggX.config.address;
    this.pggMultiSigX = this.pggX.multiSig;
    this.oracleStakesAccountingX = this.pggX.oracleStakeAccounting;
    this.oraclesX = this.pggX.oracles;
  });

  beforeEach(async function() {
    this.newOracle = await NewOracleManager.new({ from: coreTeam });
    await this.newOracle.initialize(this.ggr.address, {
      from: coreTeam
    });
    await this.acl.setRole(bytes32('ORACLE_MODIFIER'), this.newOracle.address, true, { from: coreTeam });
  });

  describe('#executeBytecode()', async function() {
    before(async function() {
      await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
      await this.acl.setRole(bytes32('APPLICATION_BYTECODE_EXECUTOR'), charlie, true, { from: coreTeam });
    });

    describe('ETH', () => {
      beforeEach(async function() {
        await this.newOracle.submit(
          this.mX,
          bob,
          BOB,
          MN,
          '',
          this.attachedDocumentsBytes32,
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
          0,
          {
            from: alice,
            value: ether(7)
          }
        );
      });

      it('should allow APPLICATION_BYTECODE_EXECUTOR withdrawing ETHs', async function() {
        const bytecode = '0x0';

        const aliceBalanceBefore = await web3.eth.getBalance(alice);
        await this.newOracle.executeBytecode(alice, ether(4), bytecode, { from: charlie });
        const aliceBalanceAfter = await web3.eth.getBalance(alice);

        assertEthBalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(4));
      });

      it('should deny non-APPLICATION_BYTECODE_EXECUTOR withdrawing ETHs', async function() {
        const bytecode = '0x0';

        await assertRevert(this.newOracle.executeBytecode(alice, ether(4), bytecode, { from: bob }));
      });
    });

    describe('GALT', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.newOracle.address, ether(45), { from: alice });
        await this.newOracle.submit(
          this.mX,
          bob,
          BOB,
          MN,
          '',
          this.attachedDocumentsBytes32,
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
          ether(45),
          {
            from: alice
          }
        );
      });

      it('should allow APPLICATION_BYTECODE_EXECUTOR withdrawing GALTs', async function() {
        const bytecode = this.galtToken.contract.methods.transfer(alice, ether(12)).encodeABI();

        const aliceBalanceBefore = await this.galtToken.balanceOf(alice);
        await this.newOracle.executeBytecode(this.galtToken.address, 0, bytecode, { from: charlie });
        const aliceBalanceAfter = await this.galtToken.balanceOf(alice);

        assertGaltBalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(12));
      });

      it('should deny non-APPLICATION_BYTECODE_EXECUTOR withdrawing GALTs', async function() {
        const bytecode = this.galtToken.contract.methods.transfer(alice, ether(12)).encodeABI();

        await assertRevert(this.newOracle.executeBytecode(this.galtToken.address, 0, bytecode, { from: bob }));
      });
    });
  });

  describe('#submit()', () => {
    describe('with GALT payment', () => {
      it('should allow an applicant pay commission in Galt', async function() {
        await this.galtToken.approve(this.newOracle.address, ether(45), { from: alice });
        let res = await this.newOracle.submit(
          this.mX,
          bob,
          BOB,
          MN,
          '',
          this.attachedDocumentsBytes32,
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
          ether(45),
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.applicationId;
        res = await this.newOracle.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(parseInt(res.createdAt, 10) > 0, true);
      });

      describe('payable', () => {
        it('should reject applications if GALT payment is disabled', async function() {
          await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });
          this.applicationConfig[bytes32('NO_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_ONLY);

          // disabled GALT payments
          const pggDisabledGalt = await buildPGG(
            this.pggFactory,
            [bob, charlie, dan, eve, frank],
            3,
            7,
            10,
            60,
            ether(1000),
            300000,
            {},
            this.applicationConfig,
            alice
          );

          await this.galtToken.approve(this.newOracle.address, ether(45), { from: alice });
          await assertRevert(
            this.newOracle.submit(
              pggDisabledGalt.config.address,
              bob,
              BOB,
              MN,
              '',
              this.attachedDocumentsBytes32,
              [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
              ether(45),
              {
                from: alice
              }
            )
          );
        });

        it('should reject applications without payment', async function() {
          await this.galtToken.approve(this.newOracle.address, ether(45), { from: alice });
          await assertRevert(
            this.newOracle.submit(
              this.mX,
              bob,
              BOB,
              MN,
              '',
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
              this.mX,
              bob,
              BOB,
              MN,
              '',
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
            this.mX,
            bob,
            BOB,
            MN,
            '',
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

          res = await this.newOracle.getApplicationRewards(this.aId);
          assert.equal(res.arbitratorsReward, ether('46.11'));
          assert.equal(res.galtProtocolFee, ether('6.89'));
          assert.equal(res.currency, Currency.GALT);
          assert.equal(res.galtProtocolFeePaidOut, false);
        });
      });

      describe('claim rewards', () => {
        beforeEach(async function() {
          await this.galtToken.approve(this.newOracle.address, ether(47), { from: alice });
          const res = await this.newOracle.submit(
            this.mX,
            bob,
            BOB,
            MN,
            '',
            this.attachedDocumentsBytes32,
            [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
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
        });

        it('should allow galt space withdrawal only once', async function() {
          await this.newOracle.claimArbitratorReward(this.aId, { from: bob });
          const galtSpaceBalanceBefore = await this.galtToken.balanceOf(feeMixerAddress);
          await this.newOracle.claimGaltProtocolFeeGalt({ from: feeMixerAddress });
          const galtSpaceBalanceAfter = await this.galtToken.balanceOf(feeMixerAddress);

          assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(6.11));
        });

        it('should allow oracles claiming their rewards', async function() {
          const bobBalanceBefore = await this.galtToken.balanceOf(bob);
          const danBalanceBefore = await this.galtToken.balanceOf(dan);
          const charlieBalanceBefore = await this.galtToken.balanceOf(charlie);
          const frankBalanceBefore = await this.galtToken.balanceOf(frank);

          await this.newOracle.claimArbitratorReward(this.aId, { from: bob });
          await this.newOracle.claimArbitratorReward(this.aId, { from: dan });
          await this.newOracle.claimArbitratorReward(this.aId, { from: charlie });
          await this.newOracle.claimArbitratorReward(this.aId, { from: frank });

          const bobBalanceAfter = await this.galtToken.balanceOf(bob);
          const danBalanceAfter = await this.galtToken.balanceOf(dan);
          const charlieBalanceAfter = await this.galtToken.balanceOf(charlie);
          const frankBalanceAfter = await this.galtToken.balanceOf(frank);

          assertGaltBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(10.2225));
          assertGaltBalanceChanged(danBalanceBefore, danBalanceAfter, ether(10.2225));
          assertGaltBalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(10.2225));
          assertGaltBalanceChanged(frankBalanceBefore, frankBalanceAfter, ether(10.2225));
        });

        it('should deny oracles claiming their rewards twice', async function() {
          await this.newOracle.claimArbitratorReward(this.aId, { from: bob });
          await this.newOracle.claimArbitratorReward(this.aId, { from: dan });
          await this.newOracle.claimArbitratorReward(this.aId, { from: charlie });
          await this.newOracle.claimArbitratorReward(this.aId, { from: frank });

          await assertRevert(this.newOracle.claimArbitratorReward(this.aId, { from: bob }));
          await assertRevert(this.newOracle.claimArbitratorReward(this.aId, { from: dan }));
          await assertRevert(this.newOracle.claimArbitratorReward(this.aId, { from: charlie }));
          await assertRevert(this.newOracle.claimArbitratorReward(this.aId, { from: frank }));
        });
      });
    });

    describe('with ETH payment', () => {
      it('should allow an applicant pay commission in ETH', async function() {
        let res = await this.newOracle.submit(
          this.mX,
          bob,
          BOB,
          MN,
          '',
          this.attachedDocumentsBytes32,
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
          0,
          {
            from: alice,
            value: ether(7)
          }
        );
        this.aId = res.logs[0].args.applicationId;

        res = await this.newOracle.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.applicant, alice);
        assert.sameMembers(res.arbitrators, []);
        assert.equal(res.m, 3);
        assert.equal(res.n, 5);
        assert.equal(res.ayeCount, 0);
        assert.equal(res.nayCount, 0);

        res = await this.newOracle.getApplicationOracle(this.aId);
        assert.equal(res.addr, bob);
        assert.equal(hexToUtf8(res.name), 'Bob');
        assert.sameMembers(res.descriptionHashes.map(galt.bytes32ToIpfsHash), this.attachedDocuments);
        assert.sameMembers(
          res.oracleTypes.map(web3.utils.hexToUtf8),
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE].map(web3.utils.hexToUtf8)
        );
      });

      describe('payable', () => {
        it('should reject applications if ETH payment is disabled', async function() {
          await this.galtToken.approve(this.pggFactory.address, ether(20), { from: alice });
          this.applicationConfig[bytes32('NO_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.GALT_ONLY);

          // disabled GALT payments
          const pggDisabledEth = await buildPGG(
            this.pggFactory,
            [bob, charlie, dan, eve, frank],
            3,
            7,
            10,
            60,
            ether(1000),
            300000,
            {},
            this.applicationConfig,
            alice
          );

          await assertRevert(
            this.newOracle.submit(
              pggDisabledEth.config.address,
              bob,
              BOB,
              MN,
              '',
              this.attachedDocumentsBytes32,
              [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
              0,
              {
                from: alice,
                value: 20
              }
            )
          );
        });

        it('should reject applications without payment', async function() {
          await assertRevert(
            this.newOracle.submit(
              this.mX,
              bob,
              BOB,
              MN,
              '',
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
              this.mX,
              bob,
              BOB,
              MN,
              '',
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
          let res = await this.newOracle.submit(
            this.mX,
            bob,
            BOB,
            MN,
            '',
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

          res = await this.newOracle.getApplicationRewards(this.aId);
          assert.equal(res.arbitratorsReward, ether('8.71'));
          assert.equal(res.galtProtocolFee, ether('4.29'));
          assert.equal(res.currency, Currency.ETH);
          assert.equal(res.galtProtocolFeePaidOut, false);
        });
      });

      describe('claim rewards', () => {
        beforeEach(async function() {
          const res = await this.newOracle.submit(
            this.mX,
            bob,
            BOB,
            MN,
            '',
            this.attachedDocumentsBytes32,
            [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE],
            0,
            {
              from: alice,
              value: ether(9)
            }
          );
          this.aId = res.logs[0].args.applicationId;

          await this.newOracle.lock(this.aId, { from: bob });
          await this.newOracle.lock(this.aId, { from: charlie });
          await this.newOracle.lock(this.aId, { from: dan });
          await this.newOracle.lock(this.aId, { from: frank });
          await this.newOracle.lock(this.aId, { from: george });

          await this.newOracle.aye(this.aId, { from: bob });
          await this.newOracle.nay(this.aId, { from: charlie });
          await this.newOracle.nay(this.aId, { from: dan });
          await this.newOracle.aye(this.aId, { from: frank });
          await this.newOracle.aye(this.aId, { from: george });
        });

        it('should allow galt space withdrawal only once', async function() {
          await this.newOracle.claimArbitratorReward(this.aId, { from: bob });
          const galtSpaceBalanceBefore = await web3.eth.getBalance(feeMixerAddress);
          await this.newOracle.claimGaltProtocolFeeEth({ from: feeMixerAddress });
          const galtSpaceBalanceAfter = await web3.eth.getBalance(feeMixerAddress);

          assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(2.97));
        });

        it('should allow oracles claiming their rewards', async function() {
          const bobBalanceBefore = await web3.eth.getBalance(bob);
          const danBalanceBefore = await web3.eth.getBalance(dan);
          const charlieBalanceBefore = await web3.eth.getBalance(charlie);
          const frankBalanceBefore = await web3.eth.getBalance(frank);
          const georgeBalanceBefore = await web3.eth.getBalance(george);

          await this.newOracle.claimArbitratorReward(this.aId, { from: bob });
          await this.newOracle.claimArbitratorReward(this.aId, { from: charlie });
          await this.newOracle.claimArbitratorReward(this.aId, { from: dan });
          await this.newOracle.claimArbitratorReward(this.aId, { from: frank });
          await this.newOracle.claimArbitratorReward(this.aId, { from: george });

          const bobBalanceAfter = await web3.eth.getBalance(bob);
          const charlieBalanceAfter = await web3.eth.getBalance(charlie);
          const danBalanceAfter = await web3.eth.getBalance(dan);
          const frankBalanceAfter = await web3.eth.getBalance(frank);
          const georgeBalanceAfter = await web3.eth.getBalance(george);

          assertEthBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(1.206));
          assertEthBalanceChanged(danBalanceBefore, danBalanceAfter, ether(1.206));
          assertEthBalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(1.206));
          assertEthBalanceChanged(frankBalanceBefore, frankBalanceAfter, ether(1.206));
          assertEthBalanceChanged(georgeBalanceBefore, georgeBalanceAfter, ether(1.206));
        });

        it('should deny oracles claiming their rewards twice', async function() {
          await this.newOracle.claimArbitratorReward(this.aId, { from: bob });
          await this.newOracle.claimArbitratorReward(this.aId, { from: dan });
          await this.newOracle.claimArbitratorReward(this.aId, { from: charlie });
          await this.newOracle.claimArbitratorReward(this.aId, { from: frank });

          await assertRevert(this.newOracle.claimArbitratorReward(this.aId, { from: bob }));
          await assertRevert(this.newOracle.claimArbitratorReward(this.aId, { from: dan }));
          await assertRevert(this.newOracle.claimArbitratorReward(this.aId, { from: charlie }));
          await assertRevert(this.newOracle.claimArbitratorReward(this.aId, { from: frank }));
        });
      });
    });
  });

  describe('pipeline', () => {
    beforeEach(async function() {
      const res = await this.newOracle.submit(
        this.mX,
        eve,
        EVE,
        MN,
        '',
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

    describe('#lock()', () => {
      it('should allow a valid arbitrator locking an application', async function() {
        await this.newOracle.lock(this.aId, { from: bob });

        const res = await this.newOracle.getApplication(this.aId);
        assert.sameMembers(res.arbitrators, [bob]);
      });

      it('should deny locking more slots than n', async function() {
        await this.newOracle.lock(this.aId, { from: bob });
        await this.newOracle.lock(this.aId, { from: charlie });
        await this.newOracle.lock(this.aId, { from: dan });
        await this.newOracle.lock(this.aId, { from: frank });
        await this.newOracle.lock(this.aId, { from: george });
        await assertRevert(this.newOracle.lock(this.aId, { from: henrey }));

        const res = await this.newOracle.getApplication(this.aId);
        assert.sameMembers(res.arbitrators, [bob, charlie, dan, frank, george]);
      });

      it('should deny non-arbitrator locking an application', async function() {
        await assertRevert(this.newOracle.lock(this.aId, { from: alice }));
      });
    });

    describe('voting (#aye()/#nay()', () => {
      it('should allow voting to arbitrators who locked application', async function() {
        await this.newOracle.lock(this.aId, { from: bob });
        await this.newOracle.aye(this.aId, { from: bob });

        const res = await this.newOracle.getApplication(this.aId);
        assert.equal(res.ayeCount, 1);
        assert.equal(res.nayCount, 0);
      });

      it('should deny voting to arbitrators who dont locked application', async function() {
        await assertRevert(this.newOracle.aye(this.aId, { from: bob }));
      });

      it('should deny voting to non-arbitrator', async function() {
        await assertRevert(this.newOracle.aye(this.aId, { from: coreTeam }));
      });

      it('should deny voting for approved applications', async function() {
        await this.newOracle.lock(this.aId, { from: bob });
        await this.newOracle.lock(this.aId, { from: charlie });
        await this.newOracle.lock(this.aId, { from: dan });
        await this.newOracle.lock(this.aId, { from: frank });
        await this.newOracle.lock(this.aId, { from: george });

        await this.newOracle.aye(this.aId, { from: bob });
        await this.newOracle.nay(this.aId, { from: charlie });
        await this.newOracle.aye(this.aId, { from: dan });
        await this.newOracle.aye(this.aId, { from: frank });

        const res = await this.newOracle.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
        assert.equal(res.ayeCount, 3);
        assert.equal(res.nayCount, 1);

        await assertRevert(this.newOracle.aye(this.aId, { from: george }));
        await assertRevert(this.newOracle.nay(this.aId, { from: george }));
      });

      it('should deny voting for rejected applications', async function() {
        await this.newOracle.lock(this.aId, { from: bob });
        await this.newOracle.lock(this.aId, { from: charlie });
        await this.newOracle.lock(this.aId, { from: dan });
        await this.newOracle.lock(this.aId, { from: frank });
        await this.newOracle.lock(this.aId, { from: george });

        await this.newOracle.aye(this.aId, { from: bob });
        await this.newOracle.nay(this.aId, { from: charlie });
        await this.newOracle.nay(this.aId, { from: dan });
        await this.newOracle.aye(this.aId, { from: frank });
        await this.newOracle.nay(this.aId, { from: george });

        const res = await this.newOracle.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.REJECTED);
        assert.equal(res.ayeCount, 2);
        assert.equal(res.nayCount, 3);

        await assertRevert(this.newOracle.aye(this.aId, { from: george }));
        await assertRevert(this.newOracle.nay(this.aId, { from: george }));
      });

      it('should allow changing decision if voting is still active', async function() {
        await this.newOracle.lock(this.aId, { from: bob });
        await this.newOracle.lock(this.aId, { from: charlie });
        await this.newOracle.lock(this.aId, { from: dan });
        await this.newOracle.lock(this.aId, { from: frank });

        await this.newOracle.aye(this.aId, { from: bob });
        await this.newOracle.nay(this.aId, { from: charlie });
        await this.newOracle.aye(this.aId, { from: dan });

        let res = await this.newOracle.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.ayeCount, 2);
        assert.equal(res.nayCount, 1);

        await this.newOracle.nay(this.aId, { from: dan });

        res = await this.newOracle.getApplication(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.ayeCount, 1);
        assert.equal(res.nayCount, 2);
      });
    });

    describe('success execution', () => {
      it('should add oracle to oracles registry', async function() {
        await this.newOracle.lock(this.aId, { from: bob });
        await this.newOracle.lock(this.aId, { from: charlie });
        await this.newOracle.lock(this.aId, { from: dan });
        await this.newOracle.lock(this.aId, { from: frank });
        await this.newOracle.lock(this.aId, { from: george });

        await this.newOracle.aye(this.aId, { from: bob });
        await this.newOracle.nay(this.aId, { from: charlie });
        await this.newOracle.aye(this.aId, { from: dan });
        await this.newOracle.aye(this.aId, { from: frank });

        const res = await this.oraclesX.getOracle(eve);
        assert.equal(hexToUtf8(res.name), 'Eve');
        assert.equal(hexToUtf8(res.position), 'MN');
        assert.equal(res.active, true);
        assert.sameMembers(
          res.assignedOracleTypes.map(hexToUtf8),
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE].map(hexToUtf8)
        );
        assert.sameMembers(res.descriptionHashes, this.attachedDocumentsBytes32);
      });
    });
  });
});
