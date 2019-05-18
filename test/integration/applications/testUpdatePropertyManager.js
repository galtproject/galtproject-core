const ACL = artifacts.require('./ACL.sol');
const UpdatePropertyManager = artifacts.require('./UpdatePropertyManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const FeeRegistry = artifacts.require('./FeeRegistry.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');
const StakeTracker = artifacts.require('./StakeTracker.sol');

const Web3 = require('web3');
const galt = require('@galtproject/utils');
const {
  initHelperWeb3,
  initHelperArtifacts,
  ether,
  assertEthBalanceChanged,
  assertEqualBN,
  assertRevert,
  numberToEvmWord,
  paymentMethods,
  zeroAddress,
  deploySpaceGeoDataMock,
  clearLibCache
} = require('../../helpers');
const { deployMultiSigFactory, buildArbitration } = require('../../deploymentHelpers');

const web3 = new Web3(UpdatePropertyManager.web3.currentProvider);
const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const bytes32 = utf8ToHex;
// const PUSHER_ROLE = 'clarification pusher';

// eslint-disable-next-line no-underscore-dangle
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');
const EVE = bytes32('Eve');

const PM_SURVEYOR = bytes32('PM_SURVEYOR_ORACLE_TYPE');
const PM_LAWYER = bytes32('PM_LAWYER_ORACLE_TYPE');
const PM_AUDITOR = bytes32('PM_AUDITOR_ORACLE_TYPE');
const PL_SURVEYOR = bytes32('PL_SURVEYOR_ORACLE_TYPE');
const PL_LAWYER = bytes32('PL_LAWYER_ORACLE_TYPE');
const PL_AUDITOR = bytes32('PL_AUDITOR_ORACLE_TYPE');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

const ApplicationStatus = {
  NOT_EXISTS: 0,
  SUBMITTED: 1,
  APPROVED: 2,
  REVERTED: 3
};

const ValidationStatus = {
  NOT_EXISTS: 0,
  PENDING: 1,
  LOCKED: 2,
  APPROVED: 3,
  REVERTED: 4
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
contract.only('UpdatePropertyManager', (accounts) => {
  const [
    coreTeam,
    feeMixerAddress,
    minter,
    oracleModifier,
    claimManagerAddress,
    spaceReputationAccountingAddress,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank
  ] = accounts;

  before(async function() {
    clearLibCache();

    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.newContourRaw = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.newContour = this.newContourRaw.map(galt.geohashToNumber);
    this.newHeights = this.newContour.map(() => ether(10));
    this.heights = [1, 2, 3];
    this.newLevel = 1;
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);
    this.description = 'test description';

    this.acl = await ACL.new({ from: coreTeam });
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });

    this.updatePropertyManager = await UpdatePropertyManager.new({ from: coreTeam });

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });
    this.myOracleStakesAccounting = await OracleStakesAccounting.new(alice, { from: coreTeam });
    this.stakeTracker = await StakeTracker.new({ from: coreTeam });

    await this.acl.initialize();
    await this.ggr.initialize();
    await this.multiSigRegistry.initialize(this.ggr.address);
    await this.stakeTracker.initialize(this.ggr.address);

    const deployment = await deploySpaceGeoDataMock(this.ggr);
    this.spaceGeoData = deployment.spaceGeoData;
    this.geodesic = deployment.geodesic;

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.MULTI_SIG_REGISTRY(), this.multiSigRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.CLAIM_MANAGER(), claimManagerAddress, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.STAKE_TRACKER(), this.stakeTracker.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_RA(), spaceReputationAccountingAddress, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_GEO_DATA(), this.spaceGeoData.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_COLLECTOR(), feeMixerAddress, { from: coreTeam });

    await this.feeRegistry.setProtocolEthShare(33, { from: coreTeam });
    await this.feeRegistry.setProtocolGaltShare(13, { from: coreTeam });

    this.multiSigFactory = await deployMultiSigFactory(this.ggr, coreTeam);

    await this.feeRegistry.setGaltFee(await this.multiSigFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.multiSigFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.multiSigFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });
    await this.acl.setRole(bytes32('MULTI_SIG_REGISTRAR'), this.multiSigFactory.address, true, { from: coreTeam });
    await this.acl.setRole(bytes32('ORACLE_MODIFIER'), oracleModifier, true, { from: coreTeam });

    await this.galtToken.mint(alice, ether(100000000), { from: coreTeam });

    await this.galtToken.approve(this.multiSigFactory.address, ether(20), { from: alice });

    const applicationConfig = {};
    applicationConfig[bytes32('PL_MINIMAL_FEE_ETH')] = numberToEvmWord(ether(6));
    applicationConfig[bytes32('PL_MINIMAL_FEE_GALT')] = numberToEvmWord(ether(45));
    applicationConfig[bytes32('PL_PAYMENT_METHOD')] = numberToEvmWord(PaymentMethods.ETH_AND_GALT);

    // [52, 47, 1],
    applicationConfig[await this.updatePropertyManager.getOracleTypeShareKey(PL_SURVEYOR)] = numberToEvmWord(50);
    applicationConfig[await this.updatePropertyManager.getOracleTypeShareKey(PL_LAWYER)] = numberToEvmWord(25);
    applicationConfig[await this.updatePropertyManager.getOracleTypeShareKey(PL_AUDITOR)] = numberToEvmWord(25);

    // Oracle minimal stake values setup
    const surveyorKey = await this.myOracleStakesAccounting.oracleTypeMinimalStakeKey(PL_SURVEYOR);
    const lawyerKey = await this.myOracleStakesAccounting.oracleTypeMinimalStakeKey(PL_LAWYER);
    const auditorKey = await this.myOracleStakesAccounting.oracleTypeMinimalStakeKey(PL_AUDITOR);

    applicationConfig[surveyorKey] = numberToEvmWord(ether(1500));
    applicationConfig[lawyerKey] = numberToEvmWord(ether(1500));
    applicationConfig[auditorKey] = numberToEvmWord(ether(1500));

    this.abX = await buildArbitration(
      this.multiSigFactory,
      [bob, charlie, dan, eve, frank],
      3,
      7,
      10,
      60,
      ether(1000),
      [30, 30, 30, 30, 30, 30, 30, 30],
      applicationConfig,
      alice
    );

    this.mX = this.abX.multiSig.address;
    this.abMultiSigX = this.abX.multiSig;
    this.abConfig = this.abX.config;
    this.oracleStakesAccountingX = this.abX.oracleStakeAccounting;
    this.oraclesX = this.abX.oracles;

    await this.spaceToken.addRoleTo(minter, 'minter');
    await this.spaceToken.addRoleTo(this.spaceGeoData.address, 'minter');
    await this.spaceToken.addRoleTo(this.spaceGeoData.address, 'operator');

    await this.oraclesX.addOracle(bob, BOB, MN, '', [], [PM_SURVEYOR, PL_SURVEYOR], {
      from: oracleModifier
    });
    await this.oraclesX.addOracle(charlie, CHARLIE, MN, '', [], [PM_LAWYER, PL_LAWYER], {
      from: oracleModifier
    });
    await this.oraclesX.addOracle(dan, DAN, MN, '', [], [PM_LAWYER, PL_LAWYER], {
      from: oracleModifier
    });
    await this.oraclesX.addOracle(eve, EVE, MN, '', [], [PM_AUDITOR, PL_AUDITOR], {
      from: oracleModifier
    });

    await this.galtToken.approve(this.oracleStakesAccountingX.address, ether(30000), { from: alice });

    await this.oracleStakesAccountingX.stake(bob, PM_SURVEYOR, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(charlie, PM_LAWYER, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(dan, PM_LAWYER, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(eve, PM_AUDITOR, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(bob, PL_SURVEYOR, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(charlie, PL_LAWYER, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(dan, PL_LAWYER, ether(2000), { from: alice });
    await this.oracleStakesAccountingX.stake(eve, PL_AUDITOR, ether(2000), { from: alice });
  });

  beforeEach(async function() {
    this.updatePropertyManager = await UpdatePropertyManager.new({ from: coreTeam });

    await this.updatePropertyManager.initialize(this.ggr.address, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('GEO_DATA_MANAGER'), this.updatePropertyManager.address, true, {
      from: coreTeam
    });
  });

  describe('application pipeline for GALT', () => {
    beforeEach(async function() {
      let res = await this.spaceToken.mint(alice, { from: minter });
      this.spaceTokenId = res.logs[0].args.tokenId.toNumber();
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
      await this.spaceToken.approve(this.updatePropertyManager.address, this.spaceTokenId, { from: alice });
    });

    describe('#submitApplication()', () => {
      it('should allow an applicant pay commission and gas deposit in Galt', async function() {
        await this.galtToken.approve(this.updatePropertyManager.address, ether(45), { from: alice });
        let res = await this.updatePropertyManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          ether(45),
          {
            from: alice
          }
        );

        this.aId = res.logs[0].args.id;

        res = await this.updatePropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('payable', () => {
        it('should reject applications with payment less than required', async function() {
          await this.galtToken.approve(this.updatePropertyManager.address, ether(42), { from: alice });
          await assertRevert(
            this.updatePropertyManager.submitApplication(
              this.abMultiSigX.address,
              this.spaceTokenId,
              this.ledgerIdentifier,
              this.description,
              this.newContour,
              this.newHeights,
              this.newLevel,
              ether(42),
              {
                from: alice
              }
            )
          );
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          await this.galtToken.approve(this.updatePropertyManager.address, ether(47), { from: alice });
          let res = await this.updatePropertyManager.submitApplication(
            this.abMultiSigX.address,
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.description,
            this.newContour,
            this.newHeights,
            this.newLevel,
            ether(47),
            {
              from: alice
            }
          );
          this.aId = res.logs[0].args.id;

          // oracle share - 87%
          // galtspace share - 13%

          res = await this.updatePropertyManager.getApplicationById(this.aId);
          assert.equal(res.oraclesReward, '40890000000000000000');
          assert.equal(res.galtProtocolFee, '6110000000000000000');
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          await this.galtToken.approve(this.updatePropertyManager.address, ether(47), { from: alice });
          let res = await this.updatePropertyManager.submitApplication(
            this.abMultiSigX.address,
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.description,
            this.newContour,
            this.newHeights,
            this.newLevel,
            ether(47),
            {
              from: alice
            }
          );
          this.aId = res.logs[0].args.id;

          // oracle share - 87% (50%/25%/25%)
          // galtspace share - 13%

          res = await this.updatePropertyManager.getApplicationById(this.aId);
          assert.sameMembers(
            res.assignedOracleTypes.map(hexToUtf8),
            [PL_SURVEYOR, PL_LAWYER, PL_AUDITOR].map(hexToUtf8)
          );

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_AUDITOR);
          assert.equal(res.reward.toString(), '10222500000000000000');

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.reward.toString(), '10222500000000000000');

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.reward.toString(), '20445000000000000000');
        });
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        await this.galtToken.approve(this.updatePropertyManager.address, ether(57), { from: alice });
        const res = await this.updatePropertyManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          ether(57),
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.id;
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
      });

      describe('for approved applications', () => {
        beforeEach(async function() {
          await this.updatePropertyManager.approveApplication(this.aId, { from: bob });
          await this.updatePropertyManager.approveApplication(this.aId, { from: dan });
          await this.updatePropertyManager.approveApplication(this.aId, { from: eve });
        });

        describe('after package token was withdrawn by user', () => {
          beforeEach(async function() {
            await this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice });
          });

          it('should be allowed', async function() {
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

            let res = await this.updatePropertyManager.getApplicationById(this.aId);

            assert.equal(res.status, ApplicationStatus.APPROVED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtProtocolFeePaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.rewardPaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
            assert.equal(res.rewardPaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_AUDITOR);
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsInitialBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString());

            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

            const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsFinalBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString());

            const res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.reward.toString(), '24795000000000000000');

            // bobs fee is (100 - 13) / 100 * 57 ether * 50%  = 24795000000000000000 wei

            assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('24795000000000000000')));
            assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('7410000000000000000')));
          });

          it('should revert on double claim', async function() {
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: dan }));
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: eve }));
          });

          // TODO: fix
          it.skip('should revert on non-oracle claim', async function() {
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: alice }));
        });
      });

      describe('for reverted applications', () => {
        beforeEach(async function() {
          await this.updatePropertyManager.revertApplication(this.aId, 'some reason', { from: bob });
        });

        describe('after package token was withdrawn by user', () => {
          beforeEach(async function() {
            await this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice });
          });

          it('should revert on claim without token been withdrawn', async function() {
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

            let res = await this.updatePropertyManager.getApplicationById(this.aId);

            assert.equal(res.status, ApplicationStatus.REVERTED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtProtocolFeePaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.rewardPaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
            assert.equal(res.rewardPaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_AUDITOR);
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansInitialBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesInitialBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsInitialBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString());

            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });

            const bobsFinalBalance = new BN((await this.galtToken.balanceOf(bob)).toString());
            const dansFinalBalance = new BN((await this.galtToken.balanceOf(dan)).toString());
            const evesFinalBalance = new BN((await this.galtToken.balanceOf(eve)).toString());
            const orgsFinalBalance = new BN((await this.galtToken.balanceOf(feeMixerAddress)).toString());

            const res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.reward.toString(), '24795000000000000000');

            // bobs fee is (100 - 13) / 100 * 57 ether * 50%  = 24795000000000000000 wei

            assertEqualBN(bobsFinalBalance, bobsInitialBalance.add(new BN('24795000000000000000')));
            assertEqualBN(dansFinalBalance, dansInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(evesFinalBalance, evesInitialBalance.add(new BN('12397500000000000000')));
            assertEqualBN(orgsFinalBalance, orgsInitialBalance.add(new BN('7410000000000000000')));
          });

          it('should revert on double claim', async function() {
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeGalt({ from: feeMixerAddress });
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: dan }));
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: eve }));
          });

          // TODO: fix
          it.skip('should revert on non-oracle claim', async function() {
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: alice }));
        });
      });
    });
  });

  describe('application pipeline for ETH', () => {
    beforeEach(async function() {
      // Alice obtains a package token
      let res = await this.spaceToken.mint(alice, { from: minter });
      this.spaceTokenId = res.logs[0].args.tokenId.toNumber();
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
      await this.spaceToken.approve(this.updatePropertyManager.address, this.spaceTokenId, { from: alice });
    });

    describe('#submitApplication()', () => {
      it('should create a new application', async function() {
        let res = await this.updatePropertyManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(6)
          }
        );
        this.aId = res.logs[0].args.id;

        res = await this.spaceToken.ownerOf(this.spaceTokenId);
        assert.equal(res, this.updatePropertyManager.address);

        res = await this.updatePropertyManager.getApplicationById(this.aId);
        const res2 = await this.updatePropertyManager.getApplicationPayloadById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
        assert.equal(res.spaceTokenId, this.spaceTokenId);
        assert.equal(res.applicant, alice);
        assert.equal(res.currency, Currency.ETH);
        assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
      });

      describe('payable', () => {
        it('should reject applications with payment which less than required', async function() {
          await assertRevert(
            this.updatePropertyManager.submitApplication(
              this.abMultiSigX.address,
              this.spaceTokenId,
              this.ledgerIdentifier,
              this.description,
              this.newContour,
              this.newHeights,
              this.newLevel,
              0,
              {
                from: alice,
                value: ether(1)
              }
            )
          );
        });

        it('should allow applications with payment greater than required', async function() {
          await this.updatePropertyManager.submitApplication(
            this.abMultiSigX.address,
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.description,
            this.newContour,
            this.newHeights,
            this.newLevel,
            0,
            {
              from: alice,
              value: ether(23)
            }
          );
        });

        it('should calculate corresponding oracle and galtspace rewards', async function() {
          let res = await this.updatePropertyManager.submitApplication(
            this.abMultiSigX.address,
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.description,
            this.newContour,
            this.newHeights,
            this.newLevel,
            0,
            {
              from: alice,
              value: ether(7)
            }
          );
          this.aId = res.logs[0].args.id;
          // oracle share - 67%
          // galtspace share - 33%

          res = await this.updatePropertyManager.getApplicationById(this.aId);
          assert.equal(res.galtProtocolFee, '2310000000000000000');
          assert.equal(res.oraclesReward, '4690000000000000000');
        });

        it('should calculate oracle rewards according to their roles share', async function() {
          let res = await this.updatePropertyManager.submitApplication(
            this.abMultiSigX.address,
            this.spaceTokenId,
            this.ledgerIdentifier,
            this.description,
            this.newContour,
            this.newHeights,
            this.newLevel,
            0,
            {
              from: alice,
              value: ether(13)
            }
          );
          this.aId = res.logs[0].args.id;
          // oracle share - 67% (50%/25%/25%)
          // galtspace share - 33%

          res = await this.updatePropertyManager.getApplicationById(this.aId);
          assert.sameMembers(
            res.assignedOracleTypes.map(hexToUtf8),
            [PL_LAWYER, PL_AUDITOR, PL_SURVEYOR].map(hexToUtf8)
          );

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.reward.toString(), '2177500000000000000');

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_AUDITOR);
          assert.equal(res.reward.toString(), '2177500000000000000');

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.reward.toString(), '4355000000000000000');
        });
      });
    });

    describe('#lockApplicationForReview()', () => {
      beforeEach(async function() {
        const res = await this.updatePropertyManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;
      });

      it('should allow multiple oracles of different roles to lock a submitted application', async function() {
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });

        let res = await this.updatePropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
        assert.equal(res.oracle, bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
        assert.equal(res.oracle, dan);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_AUDITOR);
        assert.equal(res.oracle, zeroAddress);
        assert.equal(res.status, ValidationStatus.PENDING);
      });

      // eslint-disable-next-line
      it('should deny a oracle with the same role to lock an application which is already on consideration', async function() {
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await assertRevert(
          this.updatePropertyManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: charlie })
        );
      });

      it('should deny non-oracle lock application', async function() {
        await assertRevert(
          this.updatePropertyManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: coreTeam })
        );
      });
    });

    describe('#approveApplication', () => {
      beforeEach(async function() {
        let res = await this.updatePropertyManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;

        res = await this.updatePropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
      });

      it('should allow a oracle approve application', async function() {
        await this.updatePropertyManager.approveApplication(this.aId, { from: bob });
        await this.updatePropertyManager.approveApplication(this.aId, { from: dan });

        let res = await this.updatePropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        await this.updatePropertyManager.approveApplication(this.aId, { from: eve });

        res = await this.updatePropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
      });

      it('should deny non-oracle approve application', async function() {
        await assertRevert(this.updatePropertyManager.approveApplication(this.aId, { from: coreTeam }));
        const res = await this.updatePropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      // eslint-disable-next-line
      it('should deny oracle whose role doesnt present in application type to approve application', async function() {
        await assertRevert(this.updatePropertyManager.approveApplication(this.aId, { from: charlie }));
      });

      // eslint-disable-next-line
      it('should deny oracle approve application with other than submitted', async function() {
        await this.updatePropertyManager.approveApplication(this.aId, { from: bob });
        await this.updatePropertyManager.approveApplication(this.aId, { from: dan });
        await this.updatePropertyManager.approveApplication(this.aId, { from: eve });
        await assertRevert(this.updatePropertyManager.approveApplication(this.aId, { from: bob }));
      });
    });

    describe('#revertApplication', () => {
      beforeEach(async function() {
        let res = await this.updatePropertyManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;
        res = await this.updatePropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);
      });

      describe('completely locked application', () => {
        beforeEach(async function() {
          await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
          await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });
          await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
        });

        it('should allow a oracle revert application', async function() {
          await this.updatePropertyManager.revertApplication(this.aId, 'msg', { from: bob });

          let res = await this.updatePropertyManager.getApplicationById(this.aId);
          assert.equal(res.status, ApplicationStatus.REVERTED);

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
          assert.equal(res.status, ValidationStatus.REVERTED);

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
          assert.equal(res.status, ValidationStatus.LOCKED);

          res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_AUDITOR);
          assert.equal(res.status, ValidationStatus.LOCKED);
        });

        it('should deny non-oracle revert application', async function() {
          await assertRevert(this.updatePropertyManager.revertApplication(this.aId, 'msg', { from: coreTeam }));
          const res = await this.updatePropertyManager.getApplicationById(this.aId);
          assert.equal(res.status, ApplicationStatus.SUBMITTED);
        });

        // eslint-disable-next-line
        it('should deny oracle whose role doesnt present in application type to revret application', async function() {
          await assertRevert(this.updatePropertyManager.revertApplication(this.aId, 'msg', { from: charlie }));
        });

        // eslint-disable-next-line
        it('should deny oracle reverted application with other than submitted', async function() {
          await this.updatePropertyManager.approveApplication(this.aId, { from: bob });
          await this.updatePropertyManager.approveApplication(this.aId, { from: dan });
          await this.updatePropertyManager.approveApplication(this.aId, { from: eve });
          await assertRevert(this.updatePropertyManager.revertApplication(this.aId, 'msg', { from: bob }));
        });
      });

      it('should deny revert partially locked application', async function() {
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await assertRevert(this.updatePropertyManager.revertApplication(this.aId, 'msg', { from: bob }));
      });
    });

    describe('#resubmitApplication', () => {
      beforeEach(async function() {
        let res = await this.updatePropertyManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
        await this.updatePropertyManager.revertApplication(this.aId, 'msg', { from: bob });

        res = await this.updatePropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });

      it('should allow an applicant resubmit application', async function() {
        await this.updatePropertyManager.resubmitApplication(this.aId, { from: alice });

        let res = await this.updatePropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.SUBMITTED);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_AUDITOR);
        assert.equal(res.status, ValidationStatus.LOCKED);
      });

      it('should deny non-applicant resubmit application', async function() {
        await assertRevert(this.updatePropertyManager.resubmitApplication(this.aId, { from: bob }));

        const res = await this.updatePropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.REVERTED);
      });
    });

    describe('#withdrawSpaceToken()', () => {
      beforeEach(async function() {
        const res = await this.updatePropertyManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(13)
          }
        );
        this.aId = res.logs[0].args.id;
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });

        await this.updatePropertyManager.approveApplication(this.aId, { from: bob });
        await this.updatePropertyManager.approveApplication(this.aId, { from: dan });
        await this.updatePropertyManager.approveApplication(this.aId, { from: eve });
      });

      it('should change status tokenWithdrawn flag to true', async function() {
        await this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice });

        const res = await this.updatePropertyManager.getApplicationById(this.aId);
        assert.equal(res.status, ApplicationStatus.APPROVED);
        assert.equal(res.tokenWithdrawn, true);
      });
    });

    describe('claim reward', () => {
      beforeEach(async function() {
        const res = await this.updatePropertyManager.submitApplication(
          this.abMultiSigX.address,
          this.spaceTokenId,
          this.ledgerIdentifier,
          this.description,
          this.newContour,
          this.newHeights,
          this.newLevel,
          0,
          {
            from: alice,
            value: ether(6)
          }
        );
        this.aId = res.logs[0].args.id;
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_SURVEYOR, { from: bob });
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_LAWYER, { from: dan });
        await this.updatePropertyManager.lockApplicationForReview(this.aId, PL_AUDITOR, { from: eve });
      });

      describe('for approved applications', () => {
        beforeEach(async function() {
          await this.updatePropertyManager.approveApplication(this.aId, { from: bob });
          await this.updatePropertyManager.approveApplication(this.aId, { from: dan });
          await this.updatePropertyManager.approveApplication(this.aId, { from: eve });
        });

        describe('after package token was withdrawn by user', () => {
          beforeEach(async function() {
            await this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice });
          });

          it('should be allowed', async function() {
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

            let res = await this.updatePropertyManager.getApplicationById(this.aId);

            assert.equal(res.status, ApplicationStatus.APPROVED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtProtocolFeePaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.rewardPaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
            assert.equal(res.rewardPaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_AUDITOR);
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
            const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
            const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
            const orgsInitialBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

            const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
            const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
            const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
            const orgsFinalBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

            const res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.reward.toString(), '2010000000000000000');

            // eves fee is around (100 - 33) / 100 * 6 ether * 50%  = 1005000000000000000 wei

            assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(2.01));
            assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(1.005));
            assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(1.005));
            assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(1.98));
          });

          it('should revert on double claim', async function() {
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: dan }));
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: eve }));
          });

          // TODO: fix
          it.skip('should revert on non-oracle claim', async function() {
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: alice }));
        });
      });

      describe('for reverted applications', () => {
        beforeEach(async function() {
          await this.updatePropertyManager.revertApplication(this.aId, 'some reason', { from: bob });
        });

        describe('after package token was withdrawn by user', () => {
          beforeEach(async function() {
            await this.updatePropertyManager.withdrawSpaceToken(this.aId, { from: alice });
          });

          it('should revert on claim without token been withdrawn', async function() {
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

            let res = await this.updatePropertyManager.getApplicationById(this.aId);

            assert.equal(res.status, ApplicationStatus.REVERTED);
            assert.equal(res.tokenWithdrawn, true);
            assert.equal(res.galtProtocolFeePaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.rewardPaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_LAWYER);
            assert.equal(res.rewardPaidOut, true);

            res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_AUDITOR);
            assert.equal(res.rewardPaidOut, true);
          });

          it('should send funds to claimers', async function() {
            const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
            const dansInitialBalance = new BN(await web3.eth.getBalance(dan));
            const evesInitialBalance = new BN(await web3.eth.getBalance(eve));
            const orgsInitialBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });

            const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));
            const dansFinalBalance = new BN(await web3.eth.getBalance(dan));
            const evesFinalBalance = new BN(await web3.eth.getBalance(eve));
            const orgsFinalBalance = new BN(await web3.eth.getBalance(feeMixerAddress));

            const res = await this.updatePropertyManager.getApplicationOracle(this.aId, PL_SURVEYOR);
            assert.equal(res.reward.toString(), '2010000000000000000');

            // eves fee is around (100 - 33) / 100 * 6 ether * 50%  = 1005000000000000000 wei
            // assume that the commission paid by bob isn't greater than 0.1 ether

            assertEthBalanceChanged(bobsInitialBalance, bobsFinalBalance, ether(2.01));
            assertEthBalanceChanged(dansInitialBalance, dansFinalBalance, ether(1.005));
            assertEthBalanceChanged(evesInitialBalance, evesFinalBalance, ether(1.005));
            assertEthBalanceChanged(orgsInitialBalance, orgsFinalBalance, ether(1.98));
          });

          it('should revert on double claim', async function() {
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: bob });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: dan });
            await this.updatePropertyManager.claimOracleReward(this.aId, { from: eve });
            await this.updatePropertyManager.claimGaltProtocolFeeEth({ from: feeMixerAddress });
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: bob }));
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: dan }));
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: eve }));
          });

          // TODO: fix
          it.skip('should revert on non-oracle claim', async function() {
            await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: alice }));
          });
        });

        it('should revert on claim without token been withdrawn', async function() {
          await assertRevert(this.updatePropertyManager.claimOracleReward(this.aId, { from: alice }));
        });
      });
    });
  });
});
