const PlotManager = artifacts.require('./PlotManager.sol');
const PlotManagerLib = artifacts.require('./PlotManagerLib.sol');
const PlotCustodianManager = artifacts.require('./PlotCustodianManager.sol');
const PlotEscrow = artifacts.require('./PlotEscrow.sol');
const PlotEscrowLib = artifacts.require('./PlotEscrowLib.sol');
const ArraySet = artifacts.require('./collections/ArraySet.sol');
const ArrayUtils = artifacts.require('./utils/ArrayUtils.sol');
const PolygonUtils = artifacts.require('./utils/PolygonUtils.sol');
const LandUtils = artifacts.require('./utils/LandUtils.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Validators = artifacts.require('./Validators.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const { assertEthBalanceChanged, assertGaltBalanceChanged, ether, assertRevert, zeroAddress } = require('../helpers');

const web3 = new Web3(PlotEscrow.web3.currentProvider);
// const { BN, utf8ToHex, hexToUtf8 } = Web3.utils;
const NEW_APPLICATION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const ESCROW_APPLICATION = '0xf17a99d990bb2b0a5c887c16a380aa68996c0b23307f6633bd7a2e1632e1ef48';
const CUSTODIAN_APPLICATION = '0xe2ce825e66d1e2b4efe1252bf2f9dc4f1d7274c343ac8a9f28b6776eb58188a6';

const PE_AUDITOR_ROLE = 'PE_AUDITOR_ROLE';
const PC_CUSTODIAN_ROLE = 'PC_CUSTODIAN_ROLE';
const PC_AUDITOR_ROLE = 'PC_AUDITOR_ROLE';

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

const SaleOrderStatus = {
  NOT_EXISTS: 0,
  OPEN: 1,
  LOCKED: 2,
  CLOSED: 3,
  CANCELLED: 4
};

const SaleOfferStatus = {
  NOT_EXISTS: 0,
  OPEN: 1,
  MATCH: 2,
  ESCROW: 3,
  CUSTODIAN_REVIEW: 4,
  AUDIT_REQUIRED: 5,
  AUDIT: 6,
  RESOLVED: 7,
  CLOSED: 8,
  CANCELLED: 9,
  EMPTY: 10
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

const EscrowCurrency = {
  ETH: 0,
  ERC20: 1
};

const CustodianAction = {
  ATTACH: 0,
  DETACH: 1
};

Object.freeze(SaleOrderStatus);
Object.freeze(SaleOfferStatus);
Object.freeze(ValidationStatus);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

// eslint-disable-next-line
contract("PlotEscrow", (accounts) => {
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
    eve
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

    this.arrayUtils = await ArrayUtils.new({ from: coreTeam });

    this.landUtils = await LandUtils.new({ from: coreTeam });
    PlotManagerLib.link('LandUtils', this.landUtils.address);

    this.plotManagerLib = await PlotManagerLib.new({ from: coreTeam });
    PlotManager.link('PlotManagerLib', this.plotManagerLib.address);

    this.arraySet = await ArraySet.new({ from: coreTeam });
    PlotEscrow.link('ArraySet', this.arraySet.address);

    this.plotEscrowLib = await PlotEscrowLib.new({ from: coreTeam });
    PlotEscrow.link('PlotEscrowLib', this.plotEscrowLib.address);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.validators = await Validators.new({ from: coreTeam });
    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.plotEscrow = await PlotEscrow.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });

    PolygonUtils.link('LandUtils', this.landUtils.address);
    SplitMerge.link('LandUtils', this.landUtils.address);
    SplitMerge.link('ArrayUtils', this.arrayUtils.address);

    this.polygonUtils = await PolygonUtils.new({ from: coreTeam });
    SplitMerge.link('PolygonUtils', this.polygonUtils.address);

    this.splitMerge = await SplitMerge.new({ from: coreTeam });
    this.plotCustodianManager = await PlotCustodianManager.new({ from: coreTeam });

    await this.spaceToken.initialize('SpaceToken', 'SPACE', { from: coreTeam });
    await this.plotManager.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.validators.address,
      this.galtToken.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.plotEscrow.initialize(
      this.spaceToken.address,
      this.plotCustodianManager.address,
      this.validators.address,
      this.galtToken.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.plotCustodianManager.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.validators.address,
      this.galtToken.address,
      this.plotEscrow.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.splitMerge.initialize(this.spaceToken.address, this.plotManager.address, {
      from: coreTeam
    });
    await this.plotManager.setFeeManager(feeManager, true, { from: coreTeam });
    await this.plotEscrow.setFeeManager(feeManager, true, { from: coreTeam });
    await this.plotCustodianManager.setFeeManager(feeManager, true, { from: coreTeam });

    await this.validators.addRoleTo(applicationTypeManager, await this.validators.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(validatorManager, await this.validators.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });

    await this.plotManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotManager.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.plotEscrow.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotEscrow.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotEscrow.setGaltSpaceEthShare(60, { from: feeManager });
    await this.plotEscrow.setGaltSpaceGaltShare(40, { from: feeManager });

    await this.plotCustodianManager.setMinimalApplicationFeeInEth(ether(6), { from: feeManager });
    await this.plotCustodianManager.setMinimalApplicationFeeInGalt(ether(45), { from: feeManager });
    await this.plotCustodianManager.setGaltSpaceEthShare(33, { from: feeManager });
    await this.plotCustodianManager.setGaltSpaceGaltShare(13, { from: feeManager });

    await this.spaceToken.addRoleTo(this.plotManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.plotEscrowWeb3 = new web3.eth.Contract(this.plotEscrow.abi, this.plotEscrow.address);
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
    this.galtTokenWeb3 = new web3.eth.Contract(this.galtToken.abi, this.galtToken.address);
  });

  it('should be initialized successfully', async function() {
    (await this.plotEscrow.minimalApplicationFeeInEth()).toString(10).should.be.a.bignumber.eq(ether(6));
  });

  describe('contract config modifiers', () => {
    describe('#setGaltSpaceRewardsAddress()', () => {
      it('should allow an owner set rewards address', async function() {
        await this.plotEscrow.setGaltSpaceRewardsAddress(bob, { from: coreTeam });
      });

      it('should deny non-owner set rewards address', async function() {
        await assertRevert(this.plotEscrow.setGaltSpaceRewardsAddress(bob, { from: alice }));
      });
    });

    describe('#setPaymentMethod()', () => {
      it('should allow an owner set a payment method', async function() {
        await this.plotEscrow.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: feeManager });
        const res = await this.plotEscrow.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_ONLY);
      });

      it('should deny non-owner set a payment method', async function() {
        await assertRevert(this.plotEscrow.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: alice }));
        const res = await this.plotEscrow.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_AND_GALT);
      });
    });

    describe('#setApplicationFeeInEth()', () => {
      it('should allow an owner set a new minimum fee in ETH', async function() {
        await this.plotEscrow.setMinimalApplicationFeeInEth(ether(0.05), { from: feeManager });
        const res = await this.plotEscrow.minimalApplicationFeeInEth();
        assert.equal(res, ether(0.05));
      });

      it('should deny any other than owner person set fee in ETH', async function() {
        await assertRevert(this.plotEscrow.setMinimalApplicationFeeInEth(ether(0.05), { from: alice }));
      });
    });

    describe('#setApplicationFeeInGalt()', () => {
      it('should allow an owner set a new minimum fee in GALT', async function() {
        await this.plotEscrow.setMinimalApplicationFeeInGalt(ether(0.15), { from: feeManager });
        const res = await this.plotEscrow.minimalApplicationFeeInGalt();
        assert.equal(res, ether(0.15));
      });

      it('should deny any other than owner person set fee in GALT', async function() {
        await assertRevert(this.plotEscrow.setMinimalApplicationFeeInGalt(ether(0.15), { from: alice }));
      });
    });

    describe('#setGaltSpaceEthShare()', () => {
      it('should allow an owner set galtSpace ETH share in percents', async function() {
        await this.plotEscrow.setGaltSpaceEthShare('42', { from: feeManager });
        const res = await this.plotEscrow.galtSpaceEthShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space EHT share less than 1 percent', async function() {
        await assertRevert(this.plotEscrow.setGaltSpaceEthShare('0.5', { from: feeManager }));
      });

      it('should deny owner set Galt Space EHT share grater than 100 percents', async function() {
        await assertRevert(this.plotEscrow.setGaltSpaceEthShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotEscrow.setGaltSpaceEthShare('20', { from: alice }));
      });
    });

    describe('#setGaltSpaceGaltShare()', () => {
      it('should allow an owner set galtSpace Galt share in percents', async function() {
        await this.plotEscrow.setGaltSpaceGaltShare('42', { from: feeManager });
        const res = await this.plotEscrow.galtSpaceGaltShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space Galt share less than 1 percent', async function() {
        await assertRevert(this.plotEscrow.setGaltSpaceGaltShare('0.5', { from: feeManager }));
      });

      it('should deny owner set Galt Space Galt share grater than 100 percents', async function() {
        await assertRevert(this.plotEscrow.setGaltSpaceGaltShare('101', { from: feeManager }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotEscrow.setGaltSpaceGaltShare('20', { from: alice }));
      });
    });
  });

  describe('pipeline', () => {
    beforeEach(async function() {
      await this.validators.setApplicationTypeRoles(
        NEW_APPLICATION,
        ['foo', 'bar', 'buzz'],
        [50, 25, 25],
        ['', '', ''],
        { from: applicationTypeManager }
      );

      await this.validators.setApplicationTypeRoles(
        CUSTODIAN_APPLICATION,
        [PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE],
        [60, 40],
        ['', ''],
        { from: applicationTypeManager }
      );

      await this.validators.setApplicationTypeRoles(ESCROW_APPLICATION, [PE_AUDITOR_ROLE], [100], [''], {
        from: applicationTypeManager
      });

      // Alice obtains a package token
      let res = await this.plotManager.applyForPlotOwnership(
        this.contour,
        [],
        0,
        this.credentials,
        this.ledgerIdentifier,
        {
          from: alice
        }
      );
      this.aId = res.logs[0].args.id;

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      this.spaceTokenId = res.spaceTokenId;

      // assign validators
      await this.validators.addValidator(bob, 'Bob', 'MN', [], [PC_CUSTODIAN_ROLE, 'foo'], {
        from: validatorManager
      });
      await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['bar', PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE], {
        from: validatorManager
      });
      await this.validators.addValidator(dan, 'Dan', 'MN', [], ['buzz', PE_AUDITOR_ROLE], {
        from: validatorManager
      });
      await this.validators.addValidator(eve, 'Eve', 'MN', [], [PC_AUDITOR_ROLE, PE_AUDITOR_ROLE], {
        from: validatorManager
      });

      const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();
      await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });
      await this.plotManager.lockApplicationForReview(this.aId, 'foo', { from: bob });
      await this.plotManager.lockApplicationForReview(this.aId, 'bar', { from: charlie });
      await this.plotManager.lockApplicationForReview(this.aId, 'buzz', { from: dan });

      await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
      await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
      res = await this.spaceToken.ownerOf(this.spaceTokenId);
      assert.equal(res, alice);
    });

    describe('sale order submission', () => {
      describe('with fee paid in ETH', () => {
        it('should create a new sale order with ETH payment method', async function() {
          // TOOD: alice should already own a plot to escrow
          let res = await this.plotEscrow.createSaleOrder(
            this.spaceTokenId,
            ether(50),
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            EscrowCurrency.ETH,
            0,
            0,
            { from: alice, value: ether(6) }
          );
          this.rId = res.logs[0].args.orderId;

          res = await this.plotEscrowWeb3.methods.getSaleOrder(this.rId).call();
          assert.equal(res.id, this.rId);
          assert.equal(res.status, SaleOrderStatus.OPEN);
          assert.equal(res.ask, ether(50));
          assert.equal(res.escrowCurrency, EscrowCurrency.ETH);
          assert.equal(res.tokenContract, zeroAddress);
          assert.equal(res.spaceTokenId, this.spaceTokenId);
          assert.equal(res.seller.toLowerCase(), alice);

          assert(parseInt(res.createdAt, 10) > 1538291634);
        });

        it('should create a new sale order with ERC20 payment method', async function() {
          // TOOD: alice should already own a plot to escrow
          let res = await this.plotEscrow.createSaleOrder(
            this.spaceTokenId,
            ether(50),
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            EscrowCurrency.ERC20,
            this.galtToken.address,
            0,
            { from: alice, value: ether(6) }
          );
          this.rId = res.logs[0].args.orderId;

          res = await this.plotEscrowWeb3.methods.getSaleOrder(this.rId).call();
          assert.equal(res.id, this.rId);
          assert.equal(res.ask, ether(50));
          assert.equal(res.escrowCurrency, EscrowCurrency.ERC20);
          assert.equal(res.tokenContract.toLowerCase(), this.galtToken.address);
          assert.equal(res.spaceTokenId, this.spaceTokenId);
          assert.equal(res.seller.toLowerCase(), alice);

          assert(parseInt(res.createdAt, 10) > 1538291634);
        });

        it('should reject sale order if the token is not owned by an applicant', async function() {
          await assertRevert(
            this.plotEscrow.createSaleOrder(
              this.spaceTokenId,
              ether(50),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              EscrowCurrency.ETH,
              0,
              0,
              { from: bob, value: ether(6) }
            )
          );
        });

        it('should reject sale orders if the token is already on sale', async function() {
          await this.plotEscrow.createSaleOrder(
            this.spaceTokenId,
            ether(50),
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            EscrowCurrency.ETH,
            0,
            0,
            { from: alice, value: ether(6) }
          );
          await assertRevert(
            this.plotEscrow.createSaleOrder(
              this.spaceTokenId,
              ether(50),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              EscrowCurrency.ETH,
              0,
              0,
              { from: alice, value: ether(6) }
            )
          );
        });

        describe('payable', () => {
          it('should allow payments greater than required', async function() {
            await this.plotEscrow.createSaleOrder(
              this.spaceTokenId,
              ether(50),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              EscrowCurrency.ETH,
              0,
              0,
              { from: alice, value: ether(8) }
            );
          });

          it('should reject order with insufficient payment', async function() {
            await assertRevert(
              this.plotEscrow.createSaleOrder(
                this.spaceTokenId,
                ether(50),
                this.attachedDocuments.map(galt.ipfsHashToBytes32),
                EscrowCurrency.ETH,
                0,
                0,
                { from: alice, value: ether(4) }
              )
            );
          });

          it('should reject order with payment both in eth and galt', async function() {
            await assertRevert(
              this.plotEscrow.createSaleOrder(
                this.spaceTokenId,
                ether(50),
                this.attachedDocuments.map(galt.ipfsHashToBytes32),
                EscrowCurrency.ETH,
                0,
                ether(50),
                { from: alice, value: ether(8) }
              )
            );
          });

          it('should calculate required payment', async function() {
            let res = await this.plotEscrow.createSaleOrder(
              this.spaceTokenId,
              ether(50),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              EscrowCurrency.ETH,
              0,
              0,
              { from: alice, value: ether(8) }
            );
            this.rId = res.logs[0].args.orderId;

            res = await this.plotEscrowWeb3.methods.getSaleOrderFees(this.rId).call();

            assert.equal(res.auditorRewardPaidOut, false);
            assert.equal(res.galtSpaceRewardPaidOut, false);
            assert.equal(res.auditorReward, ether(3.2));
            assert.equal(res.galtSpaceReward, ether(4.8));
            assert.equal(res.totalReward, ether(8));
          });
        });

        describe('claim auditor/galtspace rewards', () => {
          beforeEach(async function() {
            const res = await this.plotEscrow.createSaleOrder(
              this.spaceTokenId,
              ether(50),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              EscrowCurrency.ETH,
              0,
              0,
              { from: alice, value: ether(13) }
            );
            this.rId = res.logs[0].args.orderId;

            await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob });
            await this.plotEscrow.changeSaleOfferAsk(this.rId, bob, ether(35), { from: alice });
            await this.plotEscrow.changeSaleOfferBid(this.rId, ether(35), { from: bob });
            await this.plotEscrow.selectSaleOffer(this.rId, bob, { from: alice });
          });

          describe('for cancelled offer', () => {
            describe('when auditor is bound', () => {
              beforeEach(async function() {
                // MATCH => ESCROW
                await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
                await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
                await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

                // ESCROW => AUDIT_REQUIRED
                await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: alice });

                // AUDIT_REQUIRED => AUDIT
                await this.plotEscrow.lockForAudit(this.rId, bob, { from: eve });

                // AUDIT => CANCELLED
                await this.plotEscrow.cancellationAuditApprove(this.rId, bob, { from: eve });

                // CANCELLED => EMPTY
                await this.plotEscrow.withdrawPayment(this.rId, bob, { from: bob });
                await this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: alice });

                const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
                assert.equal(res.status, SaleOfferStatus.EMPTY);

                // EMPTY (offer) => OPEN(order)
                await this.plotEscrow.reopenSaleOrder(this.rId, bob, { from: alice });

                // OPEN(order) => CANCELLED(order)
                await this.plotEscrow.cancelOpenSaleOrder(this.rId, { from: alice });
              });

              it('should allow claiming rewards', async function() {
                // claim reward and check balance diff
                const eveBalanceBefore = await web3.eth.getBalance(eve);
                await this.plotEscrow.claimValidatorReward(this.rId, { from: eve });
                const eveBalanceAfter = await web3.eth.getBalance(eve);

                const galtSpaceBalanceBefore = await web3.eth.getBalance(galtSpaceOrg);
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                const galtSpaceBalanceAfter = await web3.eth.getBalance(galtSpaceOrg);

                // reward = 13 ether * (100 - 60 = 40)% = 5.2 ether
                assertEthBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(5.2));
                // reward = 13 ether * 60% = 7.8 ether
                assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(7.8));
              });

              it('should prevent double-claim', async function() {
                await this.plotEscrow.claimValidatorReward(this.rId, { from: eve });
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });

                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: eve }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg }));
              });

              it('should deny others claiming rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: alice }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: feeManager }));
              });
            });

            describe('when no auditor bound', () => {
              beforeEach(async function() {
                // MATCH => CANCELLED
                await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });

                // CANCELLED => EMPTY
                await this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie });

                // EMPTY (offer) => OPEN(order)
                await this.plotEscrow.reopenSaleOrder(this.rId, bob, { from: alice });

                // OPEN(order) => CANCELLED(order)
                await this.plotEscrow.cancelOpenSaleOrder(this.rId, { from: alice });
              });

              it('should allow galt space claiming reward', async function() {
                const galtSpaceBalanceBefore = await web3.eth.getBalance(galtSpaceOrg);
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                const galtSpaceBalanceAfter = await web3.eth.getBalance(galtSpaceOrg);

                assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(13));
              });

              it('should deny other person claiming validator rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: eve }));
              });

              it('should prevent double-claim', async function() {
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg }));
              });

              it('should deny others claiming rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: alice }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: feeManager }));
              });
            });
          });

          describe('for closed(successful) offers', () => {
            beforeEach(async function() {
              // assign custodian
              const res = await this.plotCustodianManager.submitApplication(
                this.spaceTokenId,
                CustodianAction.ATTACH,
                bob,
                0,
                {
                  from: alice,
                  value: ether(6)
                }
              );
              this.aId = res.logs[0].args.id;

              await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
              await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
              await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
              await this.plotCustodianManager.attachToken(this.aId, {
                from: alice
              });
              await this.plotCustodianManager.approveApplication(this.aId, { from: bob });
              await this.plotCustodianManager.approveApplication(this.aId, { from: eve });
              await this.plotCustodianManager.approveApplication(this.aId, { from: alice });
              await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });
            });

            describe('when auditor is bound', () => {
              beforeEach(async function() {
                // MATCH => ESCROW
                await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
                await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
                await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

                // ESCROW => AUDIT_REQUIRED
                await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: alice });

                // AUDIT_REQUIRED => AUDIT
                await this.plotEscrow.lockForAudit(this.rId, bob, { from: eve });

                // AUDIT => ESCROW
                await this.plotEscrow.cancellationAuditReject(this.rId, bob, { from: eve });

                // ESCROW => RESOLVED
                await this.plotEscrow.resolve(this.rId, bob, { from: bob });
                await this.plotEscrow.resolve(this.rId, bob, { from: alice });

                // RESOLVED => CLOSED (offer/order)
                await this.plotEscrow.claimSpaceToken(this.rId, bob, { from: bob });
                await this.plotEscrow.claimPayment(this.rId, bob, { from: alice });
              });

              it('should allow claiming rewards', async function() {
                // claim reward and check balance diff
                const eveBalanceBefore = await web3.eth.getBalance(eve);
                await this.plotEscrow.claimValidatorReward(this.rId, { from: eve });
                const eveBalanceAfter = await web3.eth.getBalance(eve);

                const galtSpaceBalanceBefore = await web3.eth.getBalance(galtSpaceOrg);
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                const galtSpaceBalanceAfter = await web3.eth.getBalance(galtSpaceOrg);

                // reward = 13 ether * (100 - 60 = 40)% = 5.2 ether
                assertEthBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(5.2));
                // reward = 13 ether * 60% = 7.8 ether
                assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(7.8));
              });

              it('should prevent double-claim', async function() {
                await this.plotEscrow.claimValidatorReward(this.rId, { from: eve });
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });

                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: eve }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg }));
              });

              it('should deny others claiming rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: alice }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: feeManager }));
              });
            });

            describe('when no auditor bound', () => {
              beforeEach(async function() {
                // MATCH => ESCROW
                await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
                await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
                await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

                // ESCROW => RESOLVED
                await this.plotEscrow.resolve(this.rId, bob, { from: bob });
                await this.plotEscrow.resolve(this.rId, bob, { from: alice });

                // RESOLVED => CLOSED (offer/order)
                await this.plotEscrow.claimSpaceToken(this.rId, bob, { from: bob });
                await this.plotEscrow.claimPayment(this.rId, bob, { from: alice });
              });

              it('should allow galt space claiming reward', async function() {
                const galtSpaceBalanceBefore = await web3.eth.getBalance(galtSpaceOrg);
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                const galtSpaceBalanceAfter = await web3.eth.getBalance(galtSpaceOrg);

                assertEthBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(13));
              });

              it('should deny other person claiming validator rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: eve }));
              });

              it('should prevent double-claim', async function() {
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg }));
              });

              it('should deny others claiming rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: alice }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: feeManager }));
              });
            });
          });
        });
      });

      describe('with fee paid in GALT', () => {
        describe('payable', () => {
          it('should allow payments greater than required', async function() {
            await this.galtToken.approve(this.plotEscrow.address, ether(55), { from: alice });
            await this.plotEscrow.createSaleOrder(
              this.spaceTokenId,
              ether(50),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              EscrowCurrency.ETH,
              0,
              ether(55),
              { from: alice }
            );
          });

          it('should reject order with insufficient payment', async function() {
            await this.galtToken.approve(this.plotEscrow.address, ether(53), { from: alice });
            await assertRevert(
              this.plotEscrow.createSaleOrder(
                this.spaceTokenId,
                ether(50),
                this.attachedDocuments.map(galt.ipfsHashToBytes32),
                EscrowCurrency.ETH,
                0,
                ether(44),
                { from: alice }
              )
            );
          });

          it('should reject order with payment both in eth and galt', async function() {
            await this.galtToken.approve(this.plotEscrow.address, ether(53), { from: alice });
            await assertRevert(
              this.plotEscrow.createSaleOrder(
                this.spaceTokenId,
                ether(50),
                this.attachedDocuments.map(galt.ipfsHashToBytes32),
                EscrowCurrency.ETH,
                0,
                ether(45),
                { from: alice, value: ether(1) }
              )
            );
          });

          it('should calculate required payment', async function() {
            await this.galtToken.approve(this.plotEscrow.address, ether(53), { from: alice });
            let res = await this.plotEscrow.createSaleOrder(
              this.spaceTokenId,
              ether(50),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              EscrowCurrency.ETH,
              0,
              ether(53),
              { from: alice }
            );
            this.rId = res.logs[0].args.orderId;

            res = await this.plotEscrowWeb3.methods.getSaleOrderFees(this.rId).call();

            assert.equal(res.auditorRewardPaidOut, false);
            assert.equal(res.galtSpaceRewardPaidOut, false);
            assert.equal(res.auditorReward, ether(31.8));
            assert.equal(res.galtSpaceReward, ether(21.2));
            assert.equal(res.totalReward, ether(53));
          });
        });

        describe('claim auditor/galtspace rewards', () => {
          beforeEach(async function() {
            await this.galtToken.approve(this.plotEscrow.address, ether(57), { from: alice });
            const res = await this.plotEscrow.createSaleOrder(
              this.spaceTokenId,
              ether(50),
              this.attachedDocuments.map(galt.ipfsHashToBytes32),
              EscrowCurrency.ETH,
              0,
              ether(57),
              { from: alice }
            );
            this.rId = res.logs[0].args.orderId;

            await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob });
            await this.plotEscrow.changeSaleOfferAsk(this.rId, bob, ether(35), { from: alice });
            await this.plotEscrow.changeSaleOfferBid(this.rId, ether(35), { from: bob });
            await this.plotEscrow.selectSaleOffer(this.rId, bob, { from: alice });
          });

          describe('for cancelled offer', () => {
            describe('when auditor is bound', () => {
              beforeEach(async function() {
                // MATCH => ESCROW
                await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
                await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
                await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

                // ESCROW => AUDIT_REQUIRED
                await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: alice });

                // AUDIT_REQUIRED => AUDIT
                await this.plotEscrow.lockForAudit(this.rId, bob, { from: eve });

                // AUDIT => CANCELLED
                await this.plotEscrow.cancellationAuditApprove(this.rId, bob, { from: eve });

                // CANCELLED => EMPTY
                await this.plotEscrow.withdrawPayment(this.rId, bob, { from: bob });
                await this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: alice });

                const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
                assert.equal(res.status, SaleOfferStatus.EMPTY);

                // EMPTY (offer) => OPEN(order)
                await this.plotEscrow.reopenSaleOrder(this.rId, bob, { from: alice });

                // OPEN(order) => CANCELLED(order)
                await this.plotEscrow.cancelOpenSaleOrder(this.rId, { from: alice });
              });

              it('should allow claiming rewards', async function() {
                // claim reward and check balance diff
                const eveBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(eve).call();
                await this.plotEscrow.claimValidatorReward(this.rId, { from: eve });
                const eveBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(eve).call();

                const galtSpaceBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                const galtSpaceBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();

                // reward = 57 ether * (100 - 40 = 60)% = 34.2 ether
                assertGaltBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(34.2));
                // reward = 13 ether * 40% = 22.8 ether
                assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(22.8));
              });

              it('should prevent double-claim', async function() {
                await this.plotEscrow.claimValidatorReward(this.rId, { from: eve });
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });

                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: eve }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg }));
              });

              it('should deny others claiming rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: alice }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: feeManager }));
              });
            });

            describe('when no auditor bound', () => {
              beforeEach(async function() {
                // MATCH => CANCELLED
                await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });

                // CANCELLED => EMPTY
                await this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie });

                // EMPTY (offer) => OPEN(order)
                await this.plotEscrow.reopenSaleOrder(this.rId, bob, { from: alice });

                // OPEN(order) => CANCELLED(order)
                await this.plotEscrow.cancelOpenSaleOrder(this.rId, { from: alice });
              });

              it('should allow galt space claiming reward', async function() {
                const galtSpaceBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                const galtSpaceBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();

                assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(57));
              });

              it('should deny other person claiming validator rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: eve }));
              });

              it('should prevent double-claim', async function() {
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg }));
              });

              it('should deny others claiming rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: alice }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: feeManager }));
              });
            });
          });

          describe('for closed(successful) offers', () => {
            beforeEach(async function() {
              // assign custodian
              const res = await this.plotCustodianManager.submitApplication(
                this.spaceTokenId,
                CustodianAction.ATTACH,
                bob,
                0,
                {
                  from: alice,
                  value: ether(6)
                }
              );
              this.aId = res.logs[0].args.id;

              await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
              await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
              await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
              await this.plotCustodianManager.attachToken(this.aId, {
                from: alice
              });
              await this.plotCustodianManager.approveApplication(this.aId, { from: bob });
              await this.plotCustodianManager.approveApplication(this.aId, { from: eve });
              await this.plotCustodianManager.approveApplication(this.aId, { from: alice });
              await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });
            });

            describe('when auditor is bound', () => {
              beforeEach(async function() {
                // MATCH => ESCROW
                await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
                await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
                await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

                // ESCROW => AUDIT_REQUIRED
                await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: alice });

                // AUDIT_REQUIRED => AUDIT
                await this.plotEscrow.lockForAudit(this.rId, bob, { from: eve });

                // AUDIT => ESCROW
                await this.plotEscrow.cancellationAuditReject(this.rId, bob, { from: eve });

                // ESCROW => RESOLVED
                await this.plotEscrow.resolve(this.rId, bob, { from: bob });
                await this.plotEscrow.resolve(this.rId, bob, { from: alice });

                // RESOLVED => CLOSED (offer/order)
                await this.plotEscrow.claimSpaceToken(this.rId, bob, { from: bob });
                await this.plotEscrow.claimPayment(this.rId, bob, { from: alice });
              });

              it('should allow claiming rewards', async function() {
                const eveBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(eve).call();
                await this.plotEscrow.claimValidatorReward(this.rId, { from: eve });
                const eveBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(eve).call();

                const galtSpaceBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                const galtSpaceBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();

                // reward = 57 ether * (100 - 40 = 60)% = 34.2 ether
                assertGaltBalanceChanged(eveBalanceBefore, eveBalanceAfter, ether(34.2));
                // reward = 13 ether * 40% = 22.8 ether
                assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(22.8));
              });

              it('should prevent double-claim', async function() {
                await this.plotEscrow.claimValidatorReward(this.rId, { from: eve });
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });

                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: eve }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg }));
              });

              it('should deny others claiming rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: alice }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: feeManager }));
              });
            });

            describe('when no auditor bound', () => {
              beforeEach(async function() {
                // MATCH => ESCROW
                await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
                await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
                await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

                // ESCROW => RESOLVED
                await this.plotEscrow.resolve(this.rId, bob, { from: bob });
                await this.plotEscrow.resolve(this.rId, bob, { from: alice });

                // RESOLVED => CLOSED (offer/order)
                await this.plotEscrow.claimSpaceToken(this.rId, bob, { from: bob });
                await this.plotEscrow.claimPayment(this.rId, bob, { from: alice });
              });

              it('should allow galt space claiming reward', async function() {
                const galtSpaceBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                const galtSpaceBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(galtSpaceOrg).call();

                assertGaltBalanceChanged(galtSpaceBalanceBefore, galtSpaceBalanceAfter, ether(57));
              });

              it('should deny other person claiming validator rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: eve }));
              });

              it('should prevent double-claim', async function() {
                await this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg });
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: galtSpaceOrg }));
              });

              it('should deny others claiming rewards', async function() {
                await assertRevert(this.plotEscrow.claimValidatorReward(this.rId, { from: alice }));
                await assertRevert(this.plotEscrow.claimGaltSpaceReward(this.rId, { from: feeManager }));
              });
            });
          });
        });
      });
    });

    describe('sale order matching', () => {
      describe('#createSaleOffer()', () => {
        beforeEach(async function() {
          const res = await this.plotEscrow.createSaleOrder(
            this.spaceTokenId,
            ether(50),
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            EscrowCurrency.ETH,
            0,
            0,
            { from: alice, value: ether(7) }
          );
          this.rId = res.logs[0].args.orderId;
        });

        it('should create a new offer', async function() {
          await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob });

          let res = await this.plotEscrowWeb3.methods.getSaleOrder(this.rId).call();
          assert.equal(res.offerCount, 1);

          res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.index, 0);
          assert.equal(res.status, SaleOfferStatus.OPEN);
          assert.equal(res.bid, ether(30));
          assert.equal(res.lastAskAt, 0);
          assert(res.lastBidAt > 0);
          assert(res.createdAt > 0);
        });

        it('should increment offerCount', async function() {
          await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob });
          await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: charlie });
          const res = await this.plotEscrowWeb3.methods.getSaleOrder(this.rId).call();
          assert.equal(res.offerCount, 2);
        });

        it('should reject offers from seller', async function() {
          await assertRevert(this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: alice }));
        });

        it('should reject if order state is not OPEN', async function() {
          await this.plotEscrow.cancelOpenSaleOrder(this.rId, { from: alice });
          await assertRevert(this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob }));
        });

        it('should reject second offer from the same buyer', async function() {
          await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob });
          await assertRevert(this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob }));
          const res = await this.plotEscrowWeb3.methods.getSaleOrder(this.rId).call();
          assert.equal(res.offerCount, 1);
        });
      });

      describe('#changeOfferBid/Ask()', () => {
        beforeEach(async function() {
          // TOOD: alice should already own a plot to escrow
          const res = await this.plotEscrow.createSaleOrder(
            this.spaceTokenId,
            ether(50),
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            EscrowCurrency.ETH,
            0,
            0,
            { from: alice, value: ether(6) }
          );
          this.rId = res.logs[0].args.orderId;

          await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob });
        });

        it('should allow bid/ask combinations', async function() {
          let res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.ask, ether(50));
          assert.equal(res.bid, ether(30));

          await this.plotEscrow.changeSaleOfferAsk(this.rId, bob, ether(45), { from: alice });

          res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.ask, ether(45));
          assert.equal(res.bid, ether(30));

          await this.plotEscrow.changeSaleOfferBid(this.rId, ether(35), { from: bob });

          res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.ask, ether(45));
          assert.equal(res.bid, ether(35));
        });

        it('should deny another person changing ask price', async function() {
          await assertRevert(this.plotEscrow.changeSaleOfferAsk(this.rId, bob, ether(45), { from: bob }));
        });

        it('should deny changing bid price for non existing offers', async function() {
          await assertRevert(this.plotEscrow.changeSaleOfferAsk(this.rId, charlie, ether(45), { from: alice }));
        });
      });

      describe('#selectSaleOffer()', () => {
        beforeEach(async function() {
          // TOOD: alice should already own a plot to escrow
          const res = await this.plotEscrow.createSaleOrder(
            this.spaceTokenId,
            ether(50),
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            EscrowCurrency.ETH,
            0,
            0,
            { from: alice, value: ether(6) }
          );
          this.rId = res.logs[0].args.orderId;

          await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob });
        });

        describe('for matching deals', () => {
          beforeEach(async function() {
            await this.plotEscrow.changeSaleOfferAsk(this.rId, bob, ether(35), { from: alice });
            await this.plotEscrow.changeSaleOfferBid(this.rId, ether(35), { from: bob });
          });

          it('should allow bid/ask combinations', async function() {
            let res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.OPEN);
            assert.equal(res.ask, ether(35));
            assert.equal(res.bid, ether(35));

            await this.plotEscrow.selectSaleOffer(this.rId, bob, { from: alice });

            res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.MATCH);
          });

          it('should deny another person selecting order', async function() {
            await assertRevert(this.plotEscrow.selectSaleOffer(this.rId, bob, { from: bob }));
          });
        });

        it('should reject when ask/bid prices differs', async function() {
          await this.plotEscrow.changeSaleOfferAsk(this.rId, bob, ether(45), { from: alice });
          await this.plotEscrow.changeSaleOfferBid(this.rId, ether(35), { from: bob });

          await assertRevert(this.plotEscrow.selectSaleOffer(this.rId, bob, { from: alice }));
        });
      });

      describe('#cancelOpenSaleOrder()', () => {
        it('should allow seller closing the order', async function() {
          let res = await this.plotEscrow.createSaleOrder(
            this.spaceTokenId,
            ether(50),
            this.attachedDocuments.map(galt.ipfsHashToBytes32),
            EscrowCurrency.ETH,
            0,
            0,
            { from: alice, value: ether(6) }
          );
          this.rId = res.logs[0].args.orderId;

          await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob });
          await this.plotEscrow.changeSaleOfferAsk(this.rId, bob, ether(35), { from: alice });
          await this.plotEscrow.changeSaleOfferBid(this.rId, ether(35), { from: bob });
          await this.plotEscrow.cancelOpenSaleOrder(this.rId, { from: alice });

          res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.OPEN);

          res = await this.plotEscrowWeb3.methods.getSaleOrder(this.rId).call();
          assert.equal(res.status, SaleOrderStatus.CANCELLED);
        });
      });
    });

    describe('sale order with ETH payment method', () => {
      beforeEach(async function() {
        const res = await this.plotEscrow.createSaleOrder(
          this.spaceTokenId,
          ether(50),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          EscrowCurrency.ETH,
          0,
          0,
          { from: alice, value: ether(6) }
        );
        this.rId = res.logs[0].args.orderId;

        await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob });
        await this.plotEscrow.changeSaleOfferAsk(this.rId, bob, ether(35), { from: alice });
        await this.plotEscrow.changeSaleOfferBid(this.rId, ether(35), { from: bob });
        await this.plotEscrow.selectSaleOffer(this.rId, bob, { from: alice });
      });

      describe('#attachSpaceToken()', () => {
        it('should attach the token', async function() {
          await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
          await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

          let res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.MATCH);

          res = await this.spaceTokenWeb3.methods.ownerOf(this.spaceTokenId).call();
          assert.equal(res.toLowerCase(), this.plotEscrow.address);
        });

        it('should reject if token not approved', async function() {
          await assertRevert(this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice }));
        });

        it('should token transfer processing from non-applicant address', async function() {
          await this.spaceToken.transferFrom(alice, charlie, this.spaceTokenId, { from: alice });
          await assertRevert(this.plotEscrow.attachSpaceToken(this.rId, bob, { from: charlie }));
        });
      });

      describe('#attachPayment()', () => {
        it('should accept payments in the sale order currency', async function() {
          await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });

          const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.MATCH);
          assert.equal(res.paymentAttached, true);
        });

        it('should reject if msg.value is not enought', async function() {
          await assertRevert(this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(30) }));
        });
      });

      describe('#cancelSaleOffer()', () => {
        describe('with only payment attached', () => {
          beforeEach(async function() {
            await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
          });

          it('should allow seller cancel an offer', async function() {
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.CANCELLED);
          });

          it('should allow buyer cancel an offer', async function() {
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: bob });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.CANCELLED);
          });
        });

        describe('with only spaceToken attached', () => {
          beforeEach(async function() {
            await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
            await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });
          });

          it('should allow seller cancel an offer', async function() {
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.CANCELLED);
          });

          it('should allow buyer cancel an offer', async function() {
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: bob });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.CANCELLED);
          });
        });

        describe('with nor space token no payment attached', () => {
          it('should allow seller cancel an offer', async function() {
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.CANCELLED);
          });

          it('should allow buyer cancel an offer', async function() {
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: bob });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.CANCELLED);
          });
        });

        it('should reject another person closing this offer', async function() {
          await assertRevert(this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: charlie }));
        });
      });

      describe('#withdrawSpaceToken() and #withdrawPayment()', () => {
        describe('with only payment attached', () => {
          beforeEach(async function() {
            await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });
          });

          it('should trigger order status to EMPTY after payment withdrawal', async function() {
            const bobInitialBalance = await web3.eth.getBalance(bob);
            await this.plotEscrow.withdrawPayment(this.rId, bob, { from: bob });
            const bobFinalBalance = await web3.eth.getBalance(bob);

            assertEthBalanceChanged(bobInitialBalance, bobFinalBalance, ether(35));

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.EMPTY);
          });

          it('should revert as no Space token was attached', async function() {
            await assertRevert(this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: alice }));
          });

          it('should revert on non-buyer withdrawal attempt', async function() {
            await assertRevert(this.plotEscrow.withdrawPayment(this.rId, bob, { from: alice }));
          });

          it('should deny performing empty action', async function() {
            await assertRevert(this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie }));
          });
        });

        describe('with only spaceToken attached', () => {
          beforeEach(async function() {
            await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
            await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });
          });

          it('should trigger order status to EMPTY after space token withdrawal', async function() {
            await this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: alice });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.EMPTY);
          });

          it('should revert as no payment was attached', async function() {
            await assertRevert(this.plotEscrow.withdrawPayment(this.rId, bob, { from: bob }));
          });

          it('should revert on non-seller withdrawal attempt', async function() {
            await assertRevert(this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: bob }));
          });

          it('should deny performing empty action', async function() {
            await assertRevert(this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie }));
          });
        });

        describe('with both space token and payment attached (after audit)', () => {
          beforeEach(async function() {
            await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
            await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });
            await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });

            // audit request
            await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: alice });
            await this.plotEscrow.lockForAudit(this.rId, bob, { from: eve });
            await this.plotEscrow.cancellationAuditApprove(this.rId, bob, { from: eve });
          });

          it('should not trigger order status  after payment withdrawal', async function() {
            await this.plotEscrow.withdrawPayment(this.rId, bob, { from: bob });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.CANCELLED);
          });

          it('should not trigger order status  after space token withdrawal', async function() {
            await this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: alice });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.CANCELLED);
          });

          it('should trigger order status after both space token and payment withdrawal', async function() {
            await this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: alice });
            await this.plotEscrow.withdrawPayment(this.rId, bob, { from: bob });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.EMPTY);
          });

          it('should deny performing empty action', async function() {
            await assertRevert(this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie }));
          });
        });

        describe('with nor space token no payment attached', () => {
          beforeEach(async function() {
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });
          });

          it('should allow anyone to transfer status to EMPTY', async function() {
            await this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.EMPTY);
          });
        });
      });

      describe('#applyCustodianAssignment()', () => {
        beforeEach(async function() {
          await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
          await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

          await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
        });

        it('should allow seller apply for custodian assignment', async function() {
          // apply for custodian assignment through PlotEscrow contract
          let res = await this.plotEscrow.applyCustodianAssignment(this.rId, bob, charlie, 0, {
            from: alice,
            value: ether(8)
          });
          const cId = res.logs[0].args.id;

          // continue custodian registration
          await this.plotCustodianManager.lockApplication(cId, { from: eve });
          await this.plotCustodianManager.acceptApplication(cId, { from: charlie });
          await this.plotCustodianManager.attachToken(cId, {
            from: alice
          });
          await this.plotCustodianManager.approveApplication(cId, { from: charlie });
          await this.plotCustodianManager.approveApplication(cId, { from: alice });
          await this.plotCustodianManager.approveApplication(cId, { from: eve });

          await this.plotEscrow.withdrawTokenFromCustodianContract(this.rId, bob, { from: alice });

          res = await this.spaceTokenWeb3.methods.ownerOf(this.spaceTokenId).call();
          assert.equal(res.toLowerCase(), this.plotEscrow.address);

          res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.ESCROW);
        });
      });

      describe('#requestCancellationAudit()', () => {
        beforeEach(async function() {
          await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
          await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

          await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
        });

        it('should allow seller request cancellation audit', async function() {
          await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: alice });

          let res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.AUDIT_REQUIRED);

          res = await this.plotEscrowWeb3.methods.getSaleOfferAudit(this.rId, bob).call();
          assert.equal(res.status, ValidationStatus.PENDING);
        });

        it('should buyer seller request cancellation audit', async function() {
          await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: bob });

          let res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.AUDIT_REQUIRED);

          res = await this.plotEscrowWeb3.methods.getSaleOfferAudit(this.rId, bob).call();
          assert.equal(res.status, ValidationStatus.PENDING);
        });

        it('should reject if account unknown', async function() {
          await assertRevert(this.plotEscrow.resolve(this.rId, bob, { from: charlie }));
        });
      });

      describe('#lockForAudit()', () => {
        beforeEach(async function() {
          await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
          await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

          await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });

          // audit request
          await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: alice });
        });

        it('should allow auditor lock the application', async function() {
          await this.plotEscrow.lockForAudit(this.rId, bob, { from: eve });

          let res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.AUDIT);

          res = await this.plotEscrowWeb3.methods.getSaleOfferAudit(this.rId, bob).call();
          assert.equal(res.status, ValidationStatus.LOCKED);
          assert.equal(res.addr.toLowerCase(), eve);
        });

        it('should allow auditor lock a rejected application', async function() {
          await this.plotEscrow.lockForAudit(this.rId, bob, { from: eve });
          await this.plotEscrow.cancellationAuditReject(this.rId, bob, { from: eve });

          await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: alice });
          await this.plotEscrow.lockForAudit(this.rId, bob, { from: dan });

          let res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.AUDIT);

          res = await this.plotEscrowWeb3.methods.getSaleOfferAudit(this.rId, bob).call();
          assert.equal(res.status, ValidationStatus.LOCKED);
          assert.equal(res.addr.toLowerCase(), dan);
        });

        it('should reject non-auditors', async function() {
          await assertRevert(this.plotEscrow.resolve(this.rId, bob, { from: charlie }));
        });

        it('should reject locking already locked application', async function() {
          await this.plotEscrow.lockForAudit(this.rId, bob, { from: eve });
          await assertRevert(this.plotEscrow.lockForAudit(this.rId, bob, { from: eve }));
        });
      });

      describe('#cancellationAuditReject()', () => {
        beforeEach(async function() {
          await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
          await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

          await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });

          // audit request
          await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: alice });
          await this.plotEscrow.lockForAudit(this.rId, bob, { from: eve });
        });

        it('should allow auditor reject a request', async function() {
          await this.plotEscrow.cancellationAuditReject(this.rId, bob, { from: eve });

          let res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.ESCROW);

          res = await this.plotEscrowWeb3.methods.getSaleOfferAudit(this.rId, bob).call();
          assert.equal(res.status, ValidationStatus.REJECTED);
          assert.equal(res.addr.toLowerCase(), eve);
        });

        it('should deny non-auditors', async function() {
          await assertRevert(this.plotEscrow.cancellationAuditReject(this.rId, bob, { from: charlie }));
        });

        it('should deny rejecting already denied application', async function() {
          await this.plotEscrow.cancellationAuditReject(this.rId, bob, { from: eve });
          await assertRevert(this.plotEscrow.cancellationAuditReject(this.rId, bob, { from: eve }));
        });
      });

      describe('#cancellationAuditApprove()', () => {
        beforeEach(async function() {
          await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
          await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

          await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });

          // audit request
          await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: alice });
          await this.plotEscrow.lockForAudit(this.rId, bob, { from: eve });
        });

        it('should allow auditor reject a request', async function() {
          await this.plotEscrow.cancellationAuditApprove(this.rId, bob, { from: eve });

          let res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.CANCELLED);

          res = await this.plotEscrowWeb3.methods.getSaleOfferAudit(this.rId, bob).call();
          assert.equal(res.status, ValidationStatus.APPROVED);
          assert.equal(res.addr.toLowerCase(), eve);
        });

        it('should deny non-auditors', async function() {
          await assertRevert(this.plotEscrow.cancellationAuditApprove(this.rId, bob, { from: charlie }));
        });

        it('should deny rejecting already denied application', async function() {
          await this.plotEscrow.cancellationAuditApprove(this.rId, bob, { from: eve });
          await assertRevert(this.plotEscrow.cancellationAuditApprove(this.rId, bob, { from: eve }));
        });
      });

      describe('#reopenSaleOrder()', () => {
        it('should allow seller reopen the order', async function() {
          await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });
          await this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie });
          await this.plotEscrow.reopenSaleOrder(this.rId, bob, { from: alice });

          let res = await this.plotEscrowWeb3.methods.getSaleOrder(this.rId).call();
          assert.equal(res.status, SaleOrderStatus.OPEN);

          res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.OPEN);
        });
      });

      describe('without attached custodian', () => {
        describe('#resolve()', () => {
          beforeEach(async function() {
            await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
            await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

            await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
          });

          it('should revert keep status ESCROW not attached custodian', async function() {
            await this.plotEscrow.resolve(this.rId, bob, { from: alice });
            await this.plotEscrow.resolve(this.rId, bob, { from: bob });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.ESCROW);
            assert.equal(res.resolved, 3);
          });
        });
      });

      describe('with already attached custodian', () => {
        beforeEach(async function() {
          // assign custodian
          const res = await this.plotCustodianManager.submitApplication(
            this.spaceTokenId,
            CustodianAction.ATTACH,
            bob,
            0,
            {
              from: alice,
              value: ether(6)
            }
          );
          this.aId = res.logs[0].args.id;

          await this.plotCustodianManager.lockApplication(this.aId, { from: eve });
          await this.plotCustodianManager.acceptApplication(this.aId, { from: bob });
          await this.spaceToken.approve(this.plotCustodianManager.address, this.spaceTokenId, { from: alice });
          await this.plotCustodianManager.attachToken(this.aId, {
            from: alice
          });
          await this.plotCustodianManager.approveApplication(this.aId, { from: bob });
          await this.plotCustodianManager.approveApplication(this.aId, { from: eve });
          await this.plotCustodianManager.approveApplication(this.aId, { from: alice });
          await this.plotCustodianManager.withdrawToken(this.aId, { from: alice });
        });

        describe('#resolve()', () => {
          beforeEach(async function() {
            await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
            await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

            await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });
          });

          it('should accept seller decision', async function() {
            await this.plotEscrow.resolve(this.rId, bob, { from: alice });
            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.resolved, 2);
            assert.equal(res.status, SaleOfferStatus.ESCROW);
          });

          it('should accept buyer decision', async function() {
            await this.plotEscrow.resolve(this.rId, bob, { from: bob });
            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.resolved, 1);
            assert.equal(res.status, SaleOfferStatus.ESCROW);
          });

          it('should reject if account unknown', async function() {
            await assertRevert(this.plotEscrow.resolve(this.rId, bob, { from: charlie }));
          });

          it('should change status to RESOLVED if both seller and buyer triggered it', async function() {
            await this.plotEscrow.resolve(this.rId, bob, { from: alice });
            await this.plotEscrow.resolve(this.rId, bob, { from: bob });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.RESOLVED);
            assert.equal(res.resolved, 3);
          });
        });

        describe('#claimSpaceToken() and #claimPayment()', () => {
          beforeEach(async function() {
            await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
            await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });
            await this.plotEscrow.attachPayment(this.rId, bob, { from: bob, value: ether(35) });

            await this.plotEscrow.resolve(this.rId, bob, { from: alice });
            await this.plotEscrow.resolve(this.rId, bob, { from: bob });
          });

          it('should allow buyer claim space token he bought', async function() {
            await this.plotEscrow.claimSpaceToken(this.rId, bob, { from: bob });

            let res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.RESOLVED);

            res = await this.spaceTokenWeb3.methods.ownerOf(this.spaceTokenId).call();
            assert.equal(res.toLowerCase(), bob);
          });

          it('should allow seller claim payment he earned', async function() {
            const aliceInitialBalance = await web3.eth.getBalance(alice);
            await this.plotEscrow.claimPayment(this.rId, bob, { from: alice });
            const aliceFinalBalance = await web3.eth.getBalance(alice);

            assertEthBalanceChanged(aliceInitialBalance, aliceFinalBalance, ether(35));

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.RESOLVED);
          });

          // eslint-disable-next-line
          it('should change order&offer statuses to CLOSED after both space token and payment being withdrawn', async function() {
            await this.plotEscrow.claimPayment(this.rId, bob, { from: alice });
            await this.plotEscrow.claimSpaceToken(this.rId, bob, { from: bob });

            let res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.CLOSED);

            res = await this.plotEscrowWeb3.methods.getSaleOrder(this.rId).call();
            assert.equal(res.status, SaleOrderStatus.CLOSED);
          });
        });
      });
    });

    describe('sale order with ERC20 payment method', () => {
      beforeEach(async function() {
        // Alice obtains a package token
        let res = await this.plotManager.applyForPlotOwnership(
          this.contour,
          [],
          0,
          this.credentials,
          this.ledgerIdentifier,
          {
            from: alice
          }
        );
        this.aId = res.logs[0].args.id;

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        this.spaceTokenId = res.spaceTokenId;

        const payment = await this.plotManagerWeb3.methods.getSubmissionPaymentInEth(this.aId, Currency.ETH).call();
        await this.plotManager.submitApplication(this.aId, 0, { from: alice, value: payment });
        await this.plotManager.lockApplicationForReview(this.aId, 'foo', { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, 'bar', { from: charlie });
        await this.plotManager.lockApplicationForReview(this.aId, 'buzz', { from: dan });

        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: charlie });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: dan });
        res = await this.spaceToken.ownerOf(this.spaceTokenId);
        assert.equal(res, alice);

        // claim sale application
        res = await this.plotEscrow.createSaleOrder(
          this.spaceTokenId,
          ether(50),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          EscrowCurrency.ERC20,
          this.galtToken.address,
          0,
          { from: alice, value: ether(6) }
        );
        this.rId = res.logs[0].args.orderId;

        await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob });
        await this.plotEscrow.changeSaleOfferAsk(this.rId, bob, ether(35), { from: alice });
        await this.plotEscrow.changeSaleOfferBid(this.rId, ether(35), { from: bob });
        await this.plotEscrow.selectSaleOffer(this.rId, bob, { from: alice });
      });

      describe('#attachPayment()', () => {
        it('should accept payments', async function() {
          await this.galtToken.approve(this.plotEscrow.address, ether(35), { from: bob });
          await this.plotEscrow.attachPayment(this.rId, bob, { from: bob });
          //
          const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.MATCH);
          assert.equal(res.paymentAttached, true);
        });

        it('should reject if token not approved', async function() {
          await assertRevert(this.plotEscrow.attachPayment(this.rId, bob, { from: bob }));
        });

        it('should reject if the approval is not enough', async function() {
          await this.galtToken.approve(this.plotEscrow.address, ether(30), { from: bob });
          await assertRevert(this.plotEscrow.attachPayment(this.rId, bob, { from: bob }));
        });

        it('should change status to ESCROW if the token is already attached', async function() {
          // space token
          await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
          await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });

          // payment
          await this.galtToken.approve(this.plotEscrow.address, ether(35), { from: bob });
          await this.plotEscrow.attachPayment(this.rId, bob, { from: bob });

          const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
          assert.equal(res.status, SaleOfferStatus.ESCROW);
        });
      });

      describe('#withdrawSpaceToken() and #withdrawPayment()', () => {
        describe('with only payment attached', () => {
          beforeEach(async function() {
            await this.galtToken.approve(this.plotEscrow.address, ether(35), { from: bob });
            await this.plotEscrow.attachPayment(this.rId, bob, { from: bob });
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });
          });

          it('should trigger order status to EMPTY after payment withdrawal', async function() {
            await this.plotEscrow.withdrawPayment(this.rId, bob, { from: bob });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.EMPTY);
          });

          it('should change ERC20 balance of a buyer', async function() {
            const bobInitialBalance = await this.galtTokenWeb3.methods.balanceOf(bob).call();
            await this.plotEscrow.withdrawPayment(this.rId, bob, { from: bob });
            const bobFinalBalance = await this.galtTokenWeb3.methods.balanceOf(bob).call();

            assertGaltBalanceChanged(bobInitialBalance, bobFinalBalance, ether(35));
            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.EMPTY);
          });

          it('should revert as no Space token was attached', async function() {
            await assertRevert(this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: alice }));
          });

          it('should revert on non-buyer withdrawal attempt', async function() {
            await assertRevert(this.plotEscrow.withdrawPayment(this.rId, bob, { from: alice }));
          });

          it('should deny performing empty action', async function() {
            await assertRevert(this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie }));
          });
        });

        describe('with only spaceToken attached', () => {
          beforeEach(async function() {
            await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
            await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });
          });

          it('should trigger order status to EMPTY after space token withdrawal', async function() {
            await this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: alice });

            let res = await this.spaceTokenWeb3.methods.ownerOf(this.spaceTokenId).call();
            assert.equal(res.toLowerCase(), alice);

            res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.EMPTY);
          });

          it('should revert as no payment was attached', async function() {
            await assertRevert(this.plotEscrow.withdrawPayment(this.rId, bob, { from: bob }));
          });

          it('should revert on non-seller withdrawal attempt', async function() {
            await assertRevert(this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: bob }));
          });

          it('should deny performing empty action', async function() {
            await assertRevert(this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie }));
          });
        });

        describe('with both space token and payment attached (after audit)', () => {
          beforeEach(async function() {
            await this.galtToken.approve(this.plotEscrow.address, ether(35), { from: bob });
            await this.spaceToken.approve(this.plotEscrow.address, this.spaceTokenId, { from: alice });
            await this.plotEscrow.attachSpaceToken(this.rId, bob, { from: alice });
            await this.plotEscrow.attachPayment(this.rId, bob, { from: bob });

            // audit request
            await this.plotEscrow.requestCancellationAudit(this.rId, bob, { from: alice });
            await this.plotEscrow.lockForAudit(this.rId, bob, { from: eve });
            await this.plotEscrow.cancellationAuditApprove(this.rId, bob, { from: eve });
          });

          it('should not trigger order status  after payment withdrawal', async function() {
            await this.plotEscrow.withdrawPayment(this.rId, bob, { from: bob });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.CANCELLED);
          });

          it('should not trigger order status  after space token withdrawal', async function() {
            await this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: alice });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.CANCELLED);
          });

          it('should trigger order status after both space token and payment withdrawal', async function() {
            await this.plotEscrow.withdrawSpaceToken(this.rId, bob, { from: alice });
            await this.plotEscrow.withdrawPayment(this.rId, bob, { from: bob });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.EMPTY);
          });

          it('should deny performing empty action', async function() {
            await assertRevert(this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie }));
          });
        });

        describe('with nor space token no payment attached', () => {
          beforeEach(async function() {
            await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: alice });
          });

          it('should allow anyone to transfer status to EMPTY', async function() {
            await this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie });

            const res = await this.plotEscrowWeb3.methods.getSaleOffer(this.rId, bob).call();
            assert.equal(res.status, SaleOfferStatus.EMPTY);
          });
        });
      });
    });
  });

  describe('open sale orders caching', () => {
    describe('with no elements', () => {
      it('should return 0 length', async function() {
        const len = await this.plotEscrowWeb3.methods.getOpenSaleOrders().call();
        assert.equal(len, 0);
      });
    });

    describe('with some elements', () => {
      beforeEach(async function() {
        await this.validators.setApplicationTypeRoles(
          NEW_APPLICATION,
          ['foo', 'bar', 'buzz'],
          [50, 25, 25],
          ['', '', ''],
          { from: applicationTypeManager }
        );

        await this.validators.setApplicationTypeRoles(
          CUSTODIAN_APPLICATION,
          [PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE],
          [60, 40],
          ['', ''],
          { from: applicationTypeManager }
        );

        await this.validators.setApplicationTypeRoles(ESCROW_APPLICATION, [PE_AUDITOR_ROLE], [100], [''], {
          from: applicationTypeManager
        });

        // assign validators
        await this.validators.addValidator(bob, 'Bob', 'MN', [], [PC_CUSTODIAN_ROLE, 'foo'], {
          from: validatorManager
        });
        await this.validators.addValidator(charlie, 'Charlie', 'MN', [], ['bar', PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE], {
          from: validatorManager
        });
        await this.validators.addValidator(dan, 'Dan', 'MN', [], ['buzz', PE_AUDITOR_ROLE], {
          from: validatorManager
        });
        await this.validators.addValidator(eve, 'Eve', 'MN', [], [PC_AUDITOR_ROLE, PE_AUDITOR_ROLE], {
          from: validatorManager
        });
      });

      it('should return correct values', async function() {
        let len = await this.plotEscrowWeb3.methods.getOpenSaleOrdersLength().call();
        assert.equal(len, 0);

        await this.spaceToken.mint(alice, { from: coreTeam });
        await this.spaceToken.mint(alice, { from: coreTeam });

        assert.equal(await this.spaceTokenWeb3.methods.totalSupply().call(), 2);

        const spaceToken1 = '0';
        const spaceToken2 = '1';

        // create 1st order
        let res = await this.plotEscrow.createSaleOrder(
          spaceToken1,
          ether(50),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          EscrowCurrency.ERC20,
          this.galtToken.address,
          0,
          { from: alice, value: ether(6) }
        );
        this.rId = res.logs[0].args.orderId;

        len = await this.plotEscrowWeb3.methods.getOpenSaleOrdersLength().call();
        assert.equal(len, 1);
        let elements = await this.plotEscrowWeb3.methods.getOpenSaleOrders().call();
        assert.equal(elements[0], this.rId);

        // lock 1st order
        await this.plotEscrow.createSaleOffer(this.rId, ether(30), { from: bob });
        await this.plotEscrow.changeSaleOfferAsk(this.rId, bob, ether(35), { from: alice });
        await this.plotEscrow.changeSaleOfferBid(this.rId, ether(35), { from: bob });
        await this.plotEscrow.selectSaleOffer(this.rId, bob, { from: alice });

        len = await this.plotEscrowWeb3.methods.getOpenSaleOrdersLength().call();
        assert.equal(len, 0);
        elements = await this.plotEscrowWeb3.methods.getOpenSaleOrders().call();
        assert.equal(elements.length, 0);

        // create 2nd order
        res = await this.plotEscrow.createSaleOrder(
          spaceToken2,
          ether(50),
          this.attachedDocuments.map(galt.ipfsHashToBytes32),
          EscrowCurrency.ERC20,
          this.galtToken.address,
          0,
          { from: alice, value: ether(6) }
        );
        this.rId2 = res.logs[0].args.orderId;
        await this.plotEscrow.createSaleOffer(this.rId2, ether(30), { from: bob });
        await this.plotEscrow.changeSaleOfferAsk(this.rId2, bob, ether(35), { from: alice });
        await this.plotEscrow.changeSaleOfferBid(this.rId2, ether(35), { from: bob });

        len = await this.plotEscrowWeb3.methods.getOpenSaleOrdersLength().call();
        assert.equal(len, 1);
        elements = await this.plotEscrowWeb3.methods.getOpenSaleOrders().call();
        assert.equal(elements[0], this.rId2);

        // reopen 1st order
        await this.plotEscrow.cancelSaleOffer(this.rId, bob, { from: bob });
        await this.plotEscrow.emptySaleOffer(this.rId, bob, { from: charlie });
        await this.plotEscrow.reopenSaleOrder(this.rId, bob, { from: alice });

        len = await this.plotEscrowWeb3.methods.getOpenSaleOrdersLength().call();
        assert.equal(len, 2);
        elements = await this.plotEscrowWeb3.methods.getOpenSaleOrders().call();
        assert.equal(elements[0], this.rId2);
        assert.equal(elements[1], this.rId);

        // lock 2nd order
        await this.plotEscrow.selectSaleOffer(this.rId2, bob, { from: alice });

        len = await this.plotEscrowWeb3.methods.getOpenSaleOrdersLength().call();
        assert.equal(len, 1);
        elements = await this.plotEscrowWeb3.methods.getOpenSaleOrders().call();
        assert.equal(elements[0], this.rId);

        // cancel 1st order
        await this.plotEscrow.cancelOpenSaleOrder(this.rId, { from: alice });

        len = await this.plotEscrowWeb3.methods.getOpenSaleOrdersLength().call();
        assert.equal(len, 0);
        elements = await this.plotEscrowWeb3.methods.getOpenSaleOrders().call();
        assert.equal(elements.length, 0);
      });
    });
  });
});
