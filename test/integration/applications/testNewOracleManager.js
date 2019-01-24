const GaltToken = artifacts.require('./GaltToken.sol');
const Oracles = artifacts.require('./Oracles.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const NewOracleManager = artifacts.require('./NewOracleManager.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const Web3 = require('web3');
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  ether,
  assertEthBalanceChanged,
  assertGaltBalanceChanged,
  assertRevert
} = require('../../helpers');
const { deployMultiSigFactory } = require('../../deploymentHelpers');

const web3 = new Web3(GaltToken.web3.currentProvider);
const { hexToUtf8, utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;

const CUSTODIAN_APPLICATION = '0xe2ce825e66d1e2b4efe1252bf2f9dc4f1d7274c343ac8a9f28b6776eb58188a6';

// eslint-disable-next-line no-underscore-dangle
const _ES = bytes32('');
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
  const [
    coreTeam,
    galtSpaceOrg,
    feeManager,
    claimManager,
    applicationTypeManager,
    spaceReputationAccounting,
    oracleManager,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank,
    george,
    henrey
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

    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    this.multiSigFactory = await deployMultiSigFactory(
      this.galtToken.address,
      this.oracles,
      claimManager,
      this.multiSigRegistry,
      spaceReputationAccounting,
      coreTeam
    );

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.approve(this.multiSigFactory.address, ether(20), { from: alice });

    const res = await this.multiSigFactory.build([bob, charlie, dan, eve, frank, george], 3, { from: alice });
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

    this.newOracleWeb3 = new web3.eth.Contract(this.newOracle.abi, this.newOracle.address);
    this.oraclesWeb3 = new web3.eth.Contract(this.oracles.abi, this.oracles.address);
    this.galtTokenWeb3 = new web3.eth.Contract(this.galtToken.abi, this.galtToken.address);
  });

  it('should be initialized successfully', async function() {
    assert.equal(await this.newOracleWeb3.methods.minimalApplicationFeeInEth().call(), ether(6));
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
        [_ES, _ES],
        { from: applicationTypeManager }
      );
    });

    describe('with GALT payment', () => {
      it('should allow an applicant pay commission in Galt', async function() {
        await this.galtToken.approve(this.newOracle.address, ether(45), { from: alice });
        let res = await this.newOracle.submit(
          this.mX,
          bob,
          BOB,
          MN,
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
              this.mX,
              bob,
              BOB,
              MN,
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

      describe('claim rewards', () => {
        beforeEach(async function() {
          await this.galtToken.approve(this.newOracle.address, ether(47), { from: alice });
          const res = await this.newOracle.submit(
            this.mX,
            bob,
            BOB,
            MN,
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
          const galtSpaceBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();
          await this.newOracle.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
          const galtSpaceBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();

          assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(6.11));
        });

        it('should deny galt space double claim a reward', async function() {
          await this.newOracle.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
          await assertRevert(this.newOracle.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
        });

        it('should allow oracles claiming their rewards', async function() {
          const bobBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(bob).call();
          const danBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(dan).call();
          const charlieBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(charlie).call();
          const frankBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(frank).call();

          await this.newOracle.claimArbitratorReward(this.aId, { from: bob });
          await this.newOracle.claimArbitratorReward(this.aId, { from: dan });
          await this.newOracle.claimArbitratorReward(this.aId, { from: charlie });
          await this.newOracle.claimArbitratorReward(this.aId, { from: frank });

          const bobBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(bob).call();
          const danBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(dan).call();
          const charlieBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(charlie).call();
          const frankBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(frank).call();

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
        assert.equal(res.applicant, alice);
        assert.sameMembers(res.arbitrators, []);
        assert.equal(res.m, 3);
        assert.equal(res.n, 5);
        assert.equal(res.ayeCount, 0);
        assert.equal(res.nayCount, 0);

        res = await this.newOracleWeb3.methods.getApplicationOracle(this.aId).call();
        assert.equal(res.addr, bob);
        assert.equal(hexToUtf8(res.name), 'Bob');
        assert.sameMembers(res.descriptionHashes.map(galt.bytes32ToIpfsHash), this.attachedDocuments);
        assert.sameMembers(
          res.oracleTypes.map(web3.utils.hexToUtf8),
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE].map(web3.utils.hexToUtf8)
        );
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(
            this.newOracle.submit(
              this.mX,
              bob,
              BOB,
              MN,
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

      describe('claim rewards', () => {
        beforeEach(async function() {
          const res = await this.newOracle.submit(
            this.mX,
            bob,
            BOB,
            MN,
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
          const galtSpaceBalanceBefore = await web3.eth.getBalance(galtSpaceOrg);
          await this.newOracle.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
          const galtSpaceBalanceAfter = await web3.eth.getBalance(galtSpaceOrg);

          assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(2.97));
        });

        it('should deny galt space double claim a reward', async function() {
          await this.newOracle.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg });
          await assertRevert(this.newOracle.claimGaltSpaceReward(this.aId, { from: galtSpaceOrg }));
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
      await this.newOracle.setMofN(3, 5, { from: galtSpaceOrg });

      this.resClarificationAddRoles = await this.oracles.setApplicationTypeOracleTypes(
        CUSTODIAN_APPLICATION,
        [PC_CUSTODIAN_ORACLE_TYPE, PC_AUDITOR_ORACLE_TYPE],
        [60, 40],
        [_ES, _ES],
        { from: applicationTypeManager }
      );

      const res = await this.newOracle.submit(
        this.mX,
        eve,
        EVE,
        MN,
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

        const res = await this.newOracleWeb3.methods.getApplicationById(this.aId).call();
        assert.sameMembers(res.arbitrators, [bob]);
      });

      it('should deny locking more slots than n', async function() {
        await this.newOracle.lock(this.aId, { from: bob });
        await this.newOracle.lock(this.aId, { from: charlie });
        await this.newOracle.lock(this.aId, { from: dan });
        await this.newOracle.lock(this.aId, { from: frank });
        await this.newOracle.lock(this.aId, { from: george });
        await assertRevert(this.newOracle.lock(this.aId, { from: henrey }));

        const res = await this.newOracleWeb3.methods.getApplicationById(this.aId).call();
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

        const res = await this.newOracleWeb3.methods.getApplicationById(this.aId).call();
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

        const res = await this.newOracleWeb3.methods.getApplicationById(this.aId).call();
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

        const res = await this.newOracleWeb3.methods.getApplicationById(this.aId).call();
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

        let res = await this.newOracleWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.ayeCount, 2);
        assert.equal(res.nayCount, 1);

        await this.newOracle.nay(this.aId, { from: dan });

        res = await this.newOracleWeb3.methods.getApplicationById(this.aId).call();
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

        const res = await this.oraclesWeb3.methods.getOracle(eve).call();
        assert.equal(hexToUtf8(res.name), 'Eve');
        assert.equal(hexToUtf8(res.position), 'MN');
        assert.equal(res.active, true);
        assert.sameMembers(
          res.assignedOracleTypes.map(hexToUtf8),
          [PC_AUDITOR_ORACLE_TYPE, PC_CUSTODIAN_ORACLE_TYPE].map(hexToUtf8)
        );
        assert.sameMembers(res.descriptionHashes, this.attachedDocumentsBytes32);
        assert.sameMembers(res.activeOracleTypes, []);
      });
    });
  });
});
