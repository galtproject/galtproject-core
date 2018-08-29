const PlotManager = artifacts.require('./PlotManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const { ether, sleep, assertRevert, zeroAddress } = require('../helpers');

const web3 = new Web3(PlotManager.web3.currentProvider);
const { BN, keccak256, utf8ToHex, hexToUtf8 } = Web3.utils;

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

const GEOHASH_MASK = new BN('0100000000000000000000000000000000000000000000000000000000000000', 16);
const ApplicationStatuses = {
  NOT_EXISTS: 0,
  NEW: 1,
  SUBMITTED: 2,
  CONSIDERATION: 3,
  APPROVED: 4,
  REJECTED: 5,
  REVERTED: 6,
  DISASSEMBLED: 7,
  REFUNDED: 8,
  COMPLETED: 9,
  CLOSED: 10
};

const ValidationStatus = {
  INTACT: 0,
  LOCKED: 1,
  APPROVED: 0,
  REJECTED: 1,
  REVERTED: 0
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

Object.freeze(ApplicationStatuses);
Object.freeze(ValidationStatus);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

/**
 * Alice is an applicant
 * Bob is a validator
 */
contract.only('PlotManager', ([coreTeam, galtSpaceOrg, alice, bob, charlie, dan, eve]) => {
  beforeEach(async function() {
    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.plotManager = await PlotManager.new({ from: coreTeam, gas: 17700000 });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.splitMerge = await SplitMerge.new({ from: coreTeam });

    await this.spaceToken.initialize('SpaceToken', 'SPACE', { from: coreTeam });
    await this.plotManager.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.galtToken.address,
      galtSpaceOrg,
      {
        from: coreTeam
      }
    );
    await this.splitMerge.initialize(this.spaceToken.address, this.plotManager.address, { from: coreTeam });

    await this.plotManager.setApplicationFeeInEth(ether(6));
    await this.plotManager.setApplicationFeeInGalt(ether(45));
    await this.plotManager.setGaltSpaceEthShare(33);
    await this.plotManager.setGaltSpaceGaltShare(13);

    await this.spaceToken.addRoleTo(this.plotManager.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    await this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    await this.galtToken.mint(alice, ether(10000), { from: coreTeam });

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  it('should be initialized successfully', async function() {
    (await this.plotManager.applicationFeeInEth()).toString(10).should.be.a.bignumber.eq(ether(6));
  });

  describe('validators', () => {
    describe('roles', () => {
      describe('#addValidatorRole()', () => {
        it('should allow owner add a role', async function() {
          await this.plotManager.addValidatorRole('lawyer', 30, { from: coreTeam });
          const roles = await this.plotManager.getValidatorRoles();
          assert.equal(roles.length, 1);
          assert.equal(hexToUtf8(roles[0]), 'lawyer');
        });

        it('should allow owner add multiple roles', async function() {
          await this.plotManager.addValidatorRole('lawyer', 20, { from: coreTeam });
          await this.plotManager.addValidatorRole('cat', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('dog', 20, { from: coreTeam });
          const roles = await this.plotManager.getValidatorRoles();
          assert.equal(roles.length, 3);
          assert.equal(hexToUtf8(roles[0]), 'lawyer');
          assert.equal(hexToUtf8(roles[1]), 'cat');
          assert.equal(hexToUtf8(roles[2]), 'dog');
        });

        it('should deny non-owner to add a role', async function() {
          await assertRevert(this.plotManager.addValidatorRole('lawyer', 20, { from: bob }));
        });

        it('should deny owner to add an existing role', async function() {
          await this.plotManager.addValidatorRole('lawyer', 20, { from: coreTeam });
          await assertRevert(this.plotManager.addValidatorRole('lawyer', 20, { from: coreTeam }));
        });
      });

      describe('#removeValidatorRole()', () => {
        beforeEach(async function() {
          await this.plotManager.addValidatorRole('lawyer', 20, { from: coreTeam });
          await this.plotManager.addValidatorRole('cat', 20, { from: coreTeam });
          await this.plotManager.addValidatorRole('dog', 20, { from: coreTeam });
          await this.plotManager.addValidatorRole('human', 40, { from: coreTeam });
        });

        it('should allow owner remove a role in the middle', async function() {
          await this.plotManager.removeValidatorRole('cat', { from: coreTeam });
          const roles = await this.plotManager.getValidatorRoles();
          assert.equal(roles.length, 3);
          assert.equal(hexToUtf8(roles[0]), 'lawyer');
          assert.equal(hexToUtf8(roles[1]), 'human');
          assert.equal(hexToUtf8(roles[2]), 'dog');

          const human = await this.plotManagerWeb3.methods.validatorRolesMap(utf8ToHex('human')).call();
          assert.equal(human.exists, true);
          assert.equal(human.active, true);
          assert.equal(human.index, 1);

          const cat = await this.plotManagerWeb3.methods.validatorRolesMap(utf8ToHex('cat')).call();
          assert.equal(cat.exists, false);
          assert.equal(cat.active, false);
          assert.equal(cat.index, 0);
        });

        it('should allow owner remove a role from the end', async function() {
          await this.plotManager.removeValidatorRole('human', { from: coreTeam });
          const roles = await this.plotManager.getValidatorRoles();
          assert.equal(roles.length, 3);
          assert.equal(hexToUtf8(roles[0]), 'lawyer');
          assert.equal(hexToUtf8(roles[1]), 'cat');
          assert.equal(hexToUtf8(roles[2]), 'dog');

          const dog = await this.plotManagerWeb3.methods.validatorRolesMap(utf8ToHex('dog')).call();
          assert.equal(dog.exists, true);
          assert.equal(dog.active, true);
          assert.equal(dog.index, 2);

          const human = await this.plotManagerWeb3.methods.validatorRolesMap(utf8ToHex('human')).call();
          assert.equal(human.exists, false);
          assert.equal(human.active, false);
          assert.equal(human.index, 0);
        });

        it('should allow owner remove all roles', async function() {
          await this.plotManager.removeValidatorRole('human', { from: coreTeam });
          await this.plotManager.removeValidatorRole('lawyer', { from: coreTeam });
          await this.plotManager.removeValidatorRole('cat', { from: coreTeam });
          await this.plotManager.removeValidatorRole('dog', { from: coreTeam });
          const roles = await this.plotManager.getValidatorRoles();
          assert.equal(roles.length, 0);

          const dog = await this.plotManagerWeb3.methods.validatorRolesMap(keccak256('dog')).call();
          assert.equal(dog.exists, false);
          assert.equal(dog.active, false);
          assert.equal(dog.index, 0);

          const human = await this.plotManagerWeb3.methods.validatorRolesMap(keccak256('human')).call();
          assert.equal(human.exists, false);
          assert.equal(human.active, false);
          assert.equal(human.index, 0);
        });

        it('should deny non-owner to remove a role', async function() {
          await assertRevert(this.plotManager.removeValidatorRole('lawyer', { from: bob }));
        });

        it('should deny owner to remove non-existing', async function() {
          await assertRevert(this.plotManager.removeValidatorRole('tiger', { from: coreTeam }));
        });
      });

      describe('readiness', () => {
        it('should be enabled when 100% shares reached', async function() {
          assert(!(await this.plotManager.readyForApplications()));
          await this.plotManager.addValidatorRole('lawyer', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('cat', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('dog', 40, { from: coreTeam });
          assert(await this.plotManager.readyForApplications());
        });

        it('should be disabled on less than 100% shares total on share change', async function() {
          await this.plotManager.addValidatorRole('lawyer', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('cat', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('dog', 40, { from: coreTeam });
          assert(await this.plotManager.readyForApplications());
          await this.plotManager.setValidatorRoleShare('cat', 10, { from: coreTeam });
          assert(!(await this.plotManager.readyForApplications()));
        });

        it('should be disabled on less than 100% shares total on role disable', async function() {
          await this.plotManager.addValidatorRole('lawyer', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('cat', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('dog', 40, { from: coreTeam });
          assert(await this.plotManager.readyForApplications());
          await this.plotManager.disableValidatorRole('cat', { from: coreTeam });
          await sleep(500);
          assert(!(await this.plotManager.readyForApplications()));
          await this.plotManager.enableValidatorRole('cat', { from: coreTeam });
          assert(await this.plotManager.readyForApplications());
        });

        it('should be disabled on less than 100% shares total on role removal', async function() {
          await this.plotManager.addValidatorRole('lawyer', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('cat', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('dog', 40, { from: coreTeam });
          assert(await this.plotManager.readyForApplications());
          await this.plotManager.removeValidatorRole('cat', { from: coreTeam });
          assert(!(await this.plotManager.readyForApplications()));
        });

        it('should be disabled on more than 100% shares total', async function() {
          assert(!(await this.plotManager.readyForApplications()));
          await this.plotManager.addValidatorRole('lawyer', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('cat', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('dog', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('pony', 50, { from: coreTeam });
          assert(!(await this.plotManager.readyForApplications()));
        });

        it('should be disabled on more than 100% shares total on share change', async function() {
          await this.plotManager.addValidatorRole('lawyer', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('cat', 30, { from: coreTeam });
          await this.plotManager.addValidatorRole('dog', 40, { from: coreTeam });
          assert(await this.plotManager.readyForApplications());
          await this.plotManager.setValidatorRoleShare('cat', 50, { from: coreTeam });
          assert(!(await this.plotManager.readyForApplications()));
        });
      });
    });

    describe('#addValidator()', () => {
      beforeEach(async function() {
        await this.plotManager.addValidatorRole('🦄', 100, { from: coreTeam });
      });

      it('should allow an owner to assign validators', async function() {
        await this.plotManager.addValidator(alice, 'Alice', 'IN', '🦄', { from: coreTeam });
      });

      it('should deny an owner to assign validator with non-existent role', async function() {
        await assertRevert(this.plotManager.addValidator(alice, 'Alice', 'IN', '🦆️', { from: coreTeam }));
      });

      it('should deny any other person than owner to assign validators', async function() {
        await assertRevert(this.plotManager.addValidator(alice, 'Alice', 'IN', '🦄', { from: alice }));
      });
    });

    describe('#removeValidator()', () => {
      it('should allow an ower to remove validators', async function() {
        await this.plotManager.removeValidator(alice, { from: coreTeam });
      });

      it('should deny any other person than owner to remove validators', async function() {
        await assertRevert(this.plotManager.removeValidator(alice, { from: alice }));
      });
    });

    describe('#isValidator()', () => {
      it('return true if validator is active', async function() {
        assert(!(await this.plotManager.isValidator(alice)));
        await this.plotManager.addValidatorRole('lawyer', 30, { from: coreTeam });
        await this.plotManager.addValidator(alice, 'Alice', 'IN', 'lawyer', { from: coreTeam });
        assert(await this.plotManager.isValidator(alice));
        await this.plotManager.removeValidator(alice, { from: coreTeam });
        assert(!(await this.plotManager.isValidator(alice)));
      });
    });
  });

  describe('contract config modifiers', () => {
    describe('#setGaltSpaceRewardsAddress()', () => {
      it('should allow an owner set rewards address', async function() {
        await this.plotManager.setGaltSpaceRewardsAddress(bob, { from: coreTeam });
        // const res = await web3.eth.getStorageAt(this.plotManager.address, 5);
        // assert.equal(res, bob);
      });

      it('should deny non-owner set rewards address', async function() {
        await assertRevert(this.plotManager.setGaltSpaceRewardsAddress(bob, { from: alice }));
      });
    });

    describe('#setPaymentMethod()', () => {
      it('should allow an owner set a payment method', async function() {
        await this.plotManager.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: coreTeam });
        const res = await this.plotManager.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_ONLY);
      });

      it('should deny non-owner set a payment method', async function() {
        await assertRevert(this.plotManager.setPaymentMethod(PaymentMethods.ETH_ONLY, { from: alice }));
        const res = await this.plotManager.paymentMethod();
        assert.equal(res, PaymentMethods.ETH_AND_GALT);
      });
    });

    describe('#setApplicationFeeInEth()', () => {
      it('should allow an owner set a new minimum fee in ETH', async function() {
        await this.plotManager.setApplicationFeeInEth(ether(0.05), { from: coreTeam });
        const res = await this.plotManager.applicationFeeInEth();
        assert.equal(res, ether(0.05));
      });

      it('should deny any other than owner person set fee in ETH', async function() {
        await assertRevert(this.plotManager.setApplicationFeeInEth(ether(0.05), { from: alice }));
      });
    });

    describe('#setApplicationFeeInGalt()', () => {
      it('should allow an owner set a new minimum fee in GALT', async function() {
        await this.plotManager.setApplicationFeeInGalt(ether(0.15), { from: coreTeam });
        const res = await this.plotManager.applicationFeeInGalt();
        assert.equal(res, ether(0.15));
      });

      it('should deny any other than owner person set fee in GALT', async function() {
        await assertRevert(this.plotManager.setApplicationFeeInGalt(ether(0.15), { from: alice }));
      });
    });

    describe('#setGaltSpaceEthShare()', () => {
      it('should allow an owner set galtSpace ETH share in percents', async function() {
        await this.plotManager.setGaltSpaceEthShare('42', { from: coreTeam });
        const res = await this.plotManager.galtSpaceEthShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space EHT share less than 1 percent', async function() {
        await assertRevert(this.plotManager.setGaltSpaceEthShare('0.5', { from: coreTeam }));
      });

      it('should deny owner set Galt Space EHT share grater than 100 percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceEthShare('101', { from: coreTeam }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceEthShare('20', { from: alice }));
      });
    });

    describe('#setGaltSpaceGaltShare()', () => {
      it('should allow an owner set galtSpace Galt share in percents', async function() {
        await this.plotManager.setGaltSpaceGaltShare('42', { from: coreTeam });
        const res = await this.plotManager.galtSpaceGaltShare();
        assert.equal(res.toString(10), '42');
      });

      it('should deny owner set Galt Space Galt share less than 1 percent', async function() {
        await assertRevert(this.plotManager.setGaltSpaceGaltShare('0.5', { from: coreTeam }));
      });

      it('should deny owner set Galt Space Galt share grater than 100 percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceGaltShare('101', { from: coreTeam }));
      });

      it('should deny any other than owner set Galt Space EHT share in percents', async function() {
        await assertRevert(this.plotManager.setGaltSpaceGaltShare('20', { from: alice }));
      });
    });
  });

  describe('application modifiers', () => {
    beforeEach(async function() {
      await this.plotManager.addValidatorRole('🦄', 100, { from: coreTeam });
    });

    beforeEach(async function() {
      const res = await this.plotManager.applyForPlotOwnership(
        this.contour,
        galt.geohashToGeohash5('sezu06'),
        this.credentials,
        this.ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        7,
        { from: alice, value: ether(6) }
      );

      this.aId = res.logs[0].args.id;
    });

    it('should allow change application fields to the owner when status is NEW', async function() {
      const hash = web3.utils.keccak256('AnotherPerson');
      const ledgedIdentifier = 'foo-123';
      const country = 'SG';
      const precision = 9;

      await this.plotManager.changeApplicationCredentialsHash(this.aId, hash, { from: alice });
      await this.plotManager.changeApplicationLedgerIdentifier(this.aId, ledgedIdentifier, { from: alice });
      await this.plotManager.changeApplicationCountry(this.aId, country, { from: alice });
      await this.plotManager.changeApplicationPrecision(this.aId, precision, { from: alice });

      const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();

      assert.equal(res.credentialsHash, hash);
      assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), ledgedIdentifier);
      assert.equal(web3.utils.hexToAscii(res.country), 'SG');
      assert.equal(res.precision, 9);
    });

    it('should allow change hash to the owner when status is REVERTED', async function() {
      await this.plotManager.submitApplication(this.aId, { from: alice });
      await this.plotManager.addValidator(bob, 'Bob', 'BB', '🦄', { from: coreTeam });
      await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
      await this.plotManager.revertApplication(this.aId, { from: bob });

      let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      assert.equal(res.credentialsHash, this.credentials);
      assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));
      assert.equal(web3.utils.hexToAscii(res.country), 'MN');
      assert.equal(res.precision, 7);

      const hash = web3.utils.keccak256('AnotherPerson');
      const ledgedIdentifier = 'foo-123';
      const country = 'SG';
      const precision = 9;

      await this.plotManager.changeApplicationCredentialsHash(this.aId, hash, { from: alice });
      await this.plotManager.changeApplicationLedgerIdentifier(this.aId, ledgedIdentifier, { from: alice });
      await this.plotManager.changeApplicationCountry(this.aId, country, { from: alice });
      await this.plotManager.changeApplicationPrecision(this.aId, precision, { from: alice });

      res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      assert.equal(res.credentialsHash, hash);
      assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), ledgedIdentifier);
      assert.equal(web3.utils.hexToAscii(res.country), 'SG');
      assert.equal(res.precision, 9);
    });

    it('should deny hash change to another person', async function() {
      await assertRevert(
        this.plotManager.changeApplicationCredentialsHash(this.aId, web3.utils.keccak256('AnotherPerson'), {
          from: coreTeam
        })
      );
      await assertRevert(this.plotManager.changeApplicationLedgerIdentifier(this.aId, 'foo-bar', { from: coreTeam }));
      await assertRevert(this.plotManager.changeApplicationCountry(this.aId, 'SG', { from: coreTeam }));
      await assertRevert(this.plotManager.changeApplicationPrecision(this.aId, 9, { from: coreTeam }));

      const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      assert.equal(res.credentialsHash, this.credentials);
      assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));
      assert.equal(web3.utils.hexToAscii(res.country), 'MN');
      assert.equal(res.precision, 7);
    });

    it('should deny hash change if applicaiton is submitted', async function() {
      await this.plotManager.submitApplication(this.aId, { from: alice });
      await assertRevert(
        this.plotManager.changeApplicationCredentialsHash(this.aId, web3.utils.keccak256('AnotherPerson'), {
          from: alice
        })
      );
      await assertRevert(this.plotManager.changeApplicationLedgerIdentifier(this.aId, 'foo-bar', { from: alice }));
      await assertRevert(this.plotManager.changeApplicationCountry(this.aId, 'SG', { from: alice }));
      await assertRevert(this.plotManager.changeApplicationPrecision(this.aId, 9, { from: alice }));

      const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
      assert.equal(res.credentialsHash, this.credentials);
      assert.equal(web3.utils.hexToUtf8(res.ledgerIdentifier), web3.utils.hexToUtf8(this.ledgerIdentifier));
      assert.equal(web3.utils.hexToAscii(res.country), 'MN');
      assert.equal(res.precision, 7);
    });
  });

  describe('application pipeline for GALT payment method', () => {
    describe('#applyForPlotOwnershipGalt()', () => {
      beforeEach(async function() {
        await this.plotManager.addValidatorRole('🦄', 100, { from: coreTeam });
        await this.galtToken.approve(this.plotManager.address, ether(47), { from: alice });
        const res = await this.plotManager.applyForPlotOwnershipGalt(
          this.contour,
          galt.geohashToGeohash5('sezu06'),
          this.credentials,
          this.ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          ether(47),
          { from: alice }
        );

        this.aId = res.logs[0].args.id;
      });

      it('should provide methods to create and read an application', async function() {
        const res2 = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        const res3 = await this.splitMerge.getPackageContour(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );

        // assertions
        for (let i = 0; i < res3.length; i++) {
          galt.numberToGeohash(res3[i].toString(10)).should.be.equal(this.initContour[i]);
        }

        assert.equal(res2.status, 1);
        assert.equal(res2.precision, 7);
        assert.equal(res2.applicant.toLowerCase(), alice);
        assert.equal(web3.utils.hexToAscii(res2.country), 'MN');
        assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
      });

      // eslint-disable-next-line
      it('should mint a pack, geohash, swap the geohash into the pack and keep it at PlotManager address', async function() {
        let res = await this.spaceToken.totalSupply();
        assert.equal(res.toString(), 2);
        res = await this.spaceToken.balanceOf(this.plotManager.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.balanceOf(this.splitMerge.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.ownerOf('0x0100000000000000000000000000000000000000000000000000000030dfe806');
        assert.equal(res, this.splitMerge.address);
        res = await this.spaceToken.ownerOf('0x0200000000000000000000000000000000000000000000000000000000000000');
        assert.equal(res, this.plotManager.address);
        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert(res, 1);
      });

      describe('payable', () => {
        it('should split fee between GaltSpace and Validator', async function() {
          const res4 = await this.plotManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
          assert.equal(res4.currency, Currency.GALT);
          assert.equal(res4.validatorsReward, '40890000000000000000');
          assert.equal(res4.galtSpaceReward, '6110000000000000000');
        });

        it('should reject fees less than the minial', async function() {
          await this.galtToken.approve(this.plotManager.address, ether(37), { from: alice });
          await assertRevert(
            this.plotManager.applyForPlotOwnershipGalt(
              this.contour,
              galt.geohashToGeohash5('sezu07'),
              this.credentials,
              this.ledgerIdentifier,
              web3.utils.asciiToHex('MN'),
              7,
              ether(37),
              { from: alice, gas: 1000000 }
            )
          );
        });

        it('accept fees greater than the minimal', async function() {
          await this.galtToken.approve(this.plotManager.address, ether(87), { from: alice });
          const res = await this.plotManager.applyForPlotOwnershipGalt(
            this.contour,
            galt.geohashToGeohash5('sezu07'),
            this.credentials,
            this.ledgerIdentifier,
            web3.utils.asciiToHex('MN'),
            7,
            ether(87),
            { from: alice, gas: 1000000 }
          );

          this.aId = res.logs[0].args.id;
        });

        it('should calculate validator rewards according to their roles share', async function() {
          await this.plotManager.removeValidatorRole('🦄', { from: coreTeam });
          await this.plotManager.addValidatorRole('cat', 52, { from: coreTeam });
          await this.plotManager.addValidatorRole('dog', 47, { from: coreTeam });
          await this.plotManager.addValidatorRole('human', 1, { from: coreTeam });

          await this.galtToken.approve(this.plotManager.address, ether(53), { from: alice });
          let res = await this.plotManager.applyForPlotOwnershipGalt(
            this.contour,
            galt.geohashToGeohash5('sezu07'),
            this.credentials,
            this.ledgerIdentifier,
            web3.utils.asciiToHex('MN'),
            7,
            ether(53),
            { from: alice }
          );
          const aId = res.logs[0].args.id;

          res = await this.plotManagerWeb3.methods.getApplicationFinanceById(aId).call();
          assert.equal(res.status, 1);
          assert.equal(res.currency, Currency.GALT);
          res.validatorsReward.should.be.a.bignumber.eq(new BN('46110000000000000000'));
          res.galtSpaceReward.should.be.a.bignumber.eq(new BN('6890000000000000000'));

          res = await this.plotManagerWeb3.methods.getApplicationById(aId).call();
          assert.sameMembers(res.assignedValidatorRoles.map(hexToUtf8), ['cat', 'dog', 'human']);

          res = await this.plotManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('cat')).call();
          assert.equal(res.reward.toString(), '23977200000000000000');

          res = await this.plotManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('dog')).call();
          assert.equal(res.reward.toString(), '21671700000000000000');

          res = await this.plotManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('human')).call();
          assert.equal(res.reward.toString(), '461100000000000000');
        });
      });
    });
  });

  describe('application pipeline for ETH', () => {
    beforeEach(async function() {
      await this.plotManager.addValidatorRole('🦄', 100, { from: coreTeam });
      const res = await this.plotManager.applyForPlotOwnership(
        this.contour,
        galt.geohashToGeohash5('sezu03'),
        this.credentials,
        this.ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        7,
        { from: alice, value: ether(6) }
      );

      this.aId = res.logs[0].args.id;
    });

    describe('#applyForPlotOwnership()', () => {
      it('should provide methods to create and read an application', async function() {
        const res2 = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        const res3 = await this.splitMerge.getPackageContour(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );

        // assertions
        for (let i = 0; i < res3.length; i++) {
          galt.numberToGeohash(res3[i].toString(10)).should.be.equal(this.initContour[i]);
        }

        assert.equal(res2.status, 1);
        assert.equal(res2.precision, 7);
        assert.equal(res2.applicant.toLowerCase(), alice);
        assert.equal(web3.utils.hexToAscii(res2.country), 'MN');
        assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
      });

      // eslint-disable-next-line
      it('should mint a pack, geohash, swap the geohash into the pack and keep it at PlotManager address', async function() {
        let res = await this.spaceToken.totalSupply();
        assert.equal(res.toString(), 2);
        res = await this.spaceToken.balanceOf(this.plotManager.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.balanceOf(this.splitMerge.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.ownerOf('0x0100000000000000000000000000000000000000000000000000000030dfe806');
        assert.equal(res, this.splitMerge.address);
        res = await this.spaceToken.ownerOf('0x0200000000000000000000000000000000000000000000000000000000000000');
        assert.equal(res, this.plotManager.address);
        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert(res, 1);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(
            this.plotManager.applyForPlotOwnership(
              this.contour,
              galt.geohashToGeohash5('sezu06'),
              this.credentials,
              this.ledgerIdentifier,
              web3.utils.asciiToHex('MN'),
              7,
              { from: alice, gas: 1000000 }
            )
          );
        });

        it('should reject applications with payment less than required', async function() {
          await assertRevert(
            this.plotManager.applyForPlotOwnership(
              this.contour,
              galt.geohashToGeohash5('sezu06'),
              this.credentials,
              this.ledgerIdentifier,
              web3.utils.asciiToHex('MN'),
              7,
              { from: alice, gas: 1000000, value: ether(3) }
            )
          );
        });

        it('should allow applications with payment greater than required', async function() {
          await this.plotManager.applyForPlotOwnership(
            this.contour,
            galt.geohashToGeohash5('sezu07'),
            this.credentials,
            this.ledgerIdentifier,
            web3.utils.asciiToHex('MN'),
            7,
            { from: alice, gas: 1000000, value: ether(7) }
          );
        });

        it('should calculate corresponding validator and coreTeam rewards in Eth', async function() {
          const res = await this.plotManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
          assert.equal(res.status, 1);
          res.validatorsReward.should.be.a.bignumber.eq(new BN('4020000000000000000'));
          res.galtSpaceReward.should.be.a.bignumber.eq(new BN('1980000000000000000'));
        });

        it('should calculate validator rewards according to their roles share', async function() {
          await this.plotManager.removeValidatorRole('🦄', { from: coreTeam });
          await this.plotManager.addValidatorRole('cat', 52, { from: coreTeam });
          await this.plotManager.addValidatorRole('dog', 33, { from: coreTeam });
          await this.plotManager.addValidatorRole('human', 15, { from: coreTeam });

          let res = await this.plotManager.applyForPlotOwnership(
            this.contour,
            galt.geohashToGeohash5('sezu07'),
            this.credentials,
            this.ledgerIdentifier,
            web3.utils.asciiToHex('MN'),
            7,
            { from: alice, value: ether(9) }
          );
          const aId = res.logs[0].args.id;

          res = await this.plotManagerWeb3.methods.getApplicationFinanceById(aId).call();
          assert.equal(res.status, 1);
          assert.equal(res.currency, Currency.ETH);
          res.validatorsReward.should.be.a.bignumber.eq(new BN('6030000000000000000'));

          res = await this.plotManagerWeb3.methods.getApplicationById(aId).call();
          assert.sameMembers(res.assignedValidatorRoles.map(hexToUtf8), ['cat', 'dog', 'human']);

          res = await this.plotManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('cat')).call();
          assert.equal(res.reward.toString(), '3135600000000000000');

          res = await this.plotManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('dog')).call();
          assert.equal(res.reward.toString(), '1989900000000000000');

          res = await this.plotManagerWeb3.methods.getApplicationValidator(aId, utf8ToHex('human')).call();
          assert.equal(res.reward.toString(), '904500000000000000');
        });
      });
    });

    describe.skip('#addGeohashesToApplication', () => {
      it('should add a list of geohashes', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes += ` gbsuv7zq gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });
      });

      it('should re-use geohash space tokens if they belong to PlotManager', async function() {
        const tokenId = galt.geohashToNumber('sezu05');
        let res = await this.spaceToken.mintGeohash(this.plotManager.address, tokenId.toString(10), {
          from: coreTeam
        });

        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);
        geohashes.push(tokenId.toString());
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });

        res = await this.spaceToken.ownerOf(tokenId.xor(GEOHASH_MASK).toString());
        assert.equal(res, this.splitMerge.address);
      });

      it('should reject if already minted token doesnt belong to PlotManager', async function() {
        const tokenId = galt.geohashToNumber('sezu05');
        let res = await this.spaceToken.mintGeohash(bob, tokenId.toString(10), {
          from: coreTeam
        });

        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);
        geohashes.push(tokenId.toString());
        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice }));

        res = await this.spaceToken.ownerOf(tokenId.xor(GEOHASH_MASK).toString());
        assert.equal(res, bob);
      });

      it('should add a list of geohashes if an application status is reverted', async function() {
        let geohashes1 = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes1 = geohashes1.split(' ').map(galt.geohashToGeohash5);
        const geohashes2 = ['sezu01', 'sezu02'].map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes1, [], [], { from: alice });

        assert.equal(await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashes1[0])), this.splitMerge.address);
        assert.equal(await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashes1[1])), this.splitMerge.address);

        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', '🦄', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        await this.plotManager.revertApplication(this.aId, { from: bob });

        let res = await this.splitMerge.packageGeohashesCount(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );
        assert.equal(res, 9);

        await this.plotManager.addGeohashesToApplication(this.aId, geohashes2, [], [], { from: alice });
        res = await this.splitMerge.packageGeohashesCount(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );
        assert.equal(res, 11);
      });

      it('should throw if already existing geohashes are passed in', async function() {
        let geohashes1 = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes1 = geohashes1.split(' ').map(galt.geohashToGeohash5);
        const geohashes2 = ['sezu01', 'gbsuv7ztm'].map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes1, [], [], { from: alice });

        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes2, [], [], { from: alice }));
      });

      it('should reject push from non-owner', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: coreTeam }));
      });

      it('should reject push when status is not new or rejected', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        await this.plotManager.submitApplication(this.aId, { from: alice });
        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice }));
      });

      // TODO: add check for non allowed symbols on geohash token minting
      it.skip('should reject push if geohash array contains an empty element', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);
        geohashes.push('');

        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice }));
      });
    });

    describe.skip('#submitApplication', () => {
      it('should change status of an application from from new to submitted', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);

        await this.plotManager.submitApplication(this.aId, { from: alice });

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 2);
      });

      it('should allow submit reverted application to the same validator who reverted it', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);

        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', '🦄', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        await this.plotManager.revertApplication(this.aId, { from: bob });
        await this.plotManager.submitApplication(this.aId, { from: alice });

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
        assert.equal(res.validator.toLowerCase(), bob);
      });

      it('should reject if status is not new or rejected', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);

        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', '🦄', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });

        await assertRevert(this.plotManager.submitApplication(this.aId, { from: alice }));

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.APPROVED);
      });

      it('should reject if another person tries to submit the application', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);

        await assertRevert(this.plotManager.submitApplication(this.aId, { from: bob }));

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);
      });
    });

    describe('#lockApplicationForReview', () => {
      beforeEach(async function() {
        await this.plotManager.removeValidatorRole('🦄', { from: coreTeam });
        await this.plotManager.addValidatorRole('human', 50, { from: coreTeam });
        await this.plotManager.addValidatorRole('dog', 25, { from: coreTeam });
        await this.plotManager.addValidatorRole('cat', 25, { from: coreTeam });

        await this.plotManager.submitApplication(this.aId, { from: alice });

        await this.plotManager.addValidator(bob, 'Bob', 'MN', 'human', { from: coreTeam });
        await this.plotManager.addValidator(charlie, 'Charlie', 'MN', 'human', { from: coreTeam });

        await this.plotManager.addValidator(dan, 'Dan', 'MN', 'cat', { from: coreTeam });
        await this.plotManager.addValidator(eve, 'Eve', 'MN', 'dog', { from: coreTeam });
      });

      it('should allow multiple validators of different roles to lock a submitted application', async function() {
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        await this.plotManager.lockApplicationForReview(this.aId, { from: dan });

        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.SUBMITTED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
        assert.equal(res.validator.toLowerCase(), bob);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('cat')).call();
        assert.equal(res.validator.toLowerCase(), dan);
        assert.equal(res.status, ValidationStatus.LOCKED);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('dog')).call();
        assert.equal(res.validator.toLowerCase(), zeroAddress);
        assert.equal(res.status, ValidationStatus.INTACT);
      });

      // eslint-disable-next-line
      it('should deny a validator with the same role to lock an application which is already on consideration', async function() {
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        await assertRevert(this.plotManager.lockApplicationForReview(this.aId, { from: charlie }));
      });

      it('should push an application id to the validators list for caching', async function() {
        // lock first
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });

        // submit second
        let res = await this.plotManager.applyForPlotOwnership(
          this.contour,
          galt.geohashToGeohash5('sezu09'),
          this.credentials,
          this.ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: alice, value: ether(6) }
        );
        const a2Id = res.logs[0].args.id;
        await this.plotManager.submitApplication(a2Id, { from: alice });

        // lock second
        await this.plotManager.lockApplicationForReview(a2Id, { from: bob });

        res = await this.plotManager.getApplicationsByValidator(bob);
        assert.equal(res.length, 2);
        assert.equal(res[0], this.aId);
        assert.equal(res[1], a2Id);
      });

      it('should deny validator to lock an application which is new', async function() {
        let res = await this.plotManager.applyForPlotOwnership(
          this.contour,
          galt.geohashToGeohash5('sezu05'),
          this.credentials,
          this.ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: alice, value: ether(6) }
        );
        const a2Id = res.logs[0].args.id;
        await assertRevert(this.plotManager.lockApplicationForReview(a2Id, { from: charlie }));
        res = await this.plotManagerWeb3.methods.getApplicationById(a2Id).call();
        assert.equal(res.status, ApplicationStatuses.NEW);

        res = await this.plotManagerWeb3.methods.getApplicationValidator(this.aId, utf8ToHex('human')).call();
        assert.equal(res.validator.toLowerCase(), zeroAddress);
        assert.equal(res.status, ValidationStatus.INTACT);
      });

      it('should deny non-validator to lock an application', async function() {
        await assertRevert(this.plotManager.lockApplicationForReview(this.aId, { from: coreTeam }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 2);
      });
    });

    describe.skip('#unlockApplication', () => {
      beforeEach(async function() {
        assert(this.aId);
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', '🦄', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
      });

      it('should should allow a contract owner to unlock an application under consideration', async function() {
        await this.plotManager.unlockApplication(this.aId, { from: coreTeam });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 2);
        assert.equal(res.validator.toLowerCase(), zeroAddress);
      });

      it('should deny non-owner to unlock an application under consideration', async function() {
        await assertRevert(this.plotManager.unlockApplication(this.aId, { from: charlie }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
        assert.equal(res.validator.toLowerCase(), bob);
      });
    });

    describe.only('#approveApplication', () => {
      beforeEach(async function() {
        assert(this.aId, 'Application ID not catched');
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'MN', '🦄', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
      });

      it('should allow a validator approve application', async function() {
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.APPROVED);
      });

      it('should transfer package to an applicant', async function() {
        const packId = '0x0200000000000000000000000000000000000000000000000000000000000000';
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        const res = await this.spaceToken.ownerOf(packId);
        assert.equal(res, alice);
      });

      it('should deny a validator approve application if hash doesnt match', async function() {
        await assertRevert(this.plotManager.approveApplication(this.aId, `${this.credentials}_foo`, { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
      });

      it('should deny non-validator approve application', async function() {
        await assertRevert(this.plotManager.approveApplication(this.aId, this.credentials, { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
      });

      it('should deny validator approve an application with non-consideration status', async function() {
        await this.plotManager.unlockApplication(this.aId, { from: coreTeam });
        await assertRevert(this.plotManager.approveApplication(this.aId, this.credentials, { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.SUBMITTED);
      });
    });

    describe('#revertApplication()', () => {
      beforeEach(async function() {
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', '🦄', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
      });

      it('should allow a validator revert application', async function() {
        await this.plotManager.revertApplication(this.aId, { from: bob });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.REVERTED);
      });

      it('should deny non-validator revert application', async function() {
        await assertRevert(this.plotManager.revertApplication(this.aId, { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
      });

      it('should deny validator revert an application with non-consideration status', async function() {
        await this.plotManager.unlockApplication(this.aId, { from: coreTeam });
        await assertRevert(this.plotManager.revertApplication(this.aId, { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.SUBMITTED);
      });
    });

    describe.skip('#rejectApplication()', () => {
      beforeEach(async function() {
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', '🦄', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
      });

      it('should allow a validator reject application', async function() {
        await this.plotManager.rejectApplication(this.aId, { from: bob });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.REJECTED);
      });

      it('should deny non-validator reject application', async function() {
        await assertRevert(this.plotManager.rejectApplication(this.aId, { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
      });

      it('should deny validator revert an application with non-consideration status', async function() {
        await this.plotManager.unlockApplication(this.aId, { from: coreTeam });
        await assertRevert(this.plotManager.rejectApplication(this.aId, { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.SUBMITTED);
      });
    });

    describe.skip('#removeGeohashFromApplication()', () => {
      beforeEach(async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes += ` gbsuv7zq gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
        this.geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        await this.plotManager.addGeohashesToApplication(this.aId, this.geohashes, [], [], { from: alice });
      });

      it('should allow owner partially remove geohashes from an application', async function() {
        const geohashesToRemove = this.geohashes.slice(0, 2);
        let res = await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashesToRemove[0]));
        assert.equal(res, this.splitMerge.address);
        res = await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashesToRemove[1]));
        assert.equal(res, this.splitMerge.address);

        res = await this.splitMerge.packageGeohashesCount(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );
        assert.equal(res, 18);

        await this.plotManager.removeGeohashesFromApplication(this.aId, geohashesToRemove, [], [], {
          from: alice
        });

        res = await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashesToRemove[0]));
        assert.equal(res, this.plotManager.address);
        res = await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashesToRemove[1]));
        assert.equal(res, this.plotManager.address);

        res = await this.splitMerge.packageGeohashesCount(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );
        assert.equal(res, 16);
      });

      it('should set DISASSEMBLED on all geohases remove', async function() {
        let res;

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();

        const packageGeohashes = await this.splitMerge.getPackageGeohashes(res.packageTokenId);
        const geohashesToRemove = packageGeohashes.map(tokenId => galt.tokenIdToGeohash(tokenId.toString(10)));

        res = await this.splitMerge.packageGeohashesCount(res.packageTokenId);
        assert.equal(res, 18);

        await this.plotManager.removeGeohashesFromApplication(this.aId, geohashesToRemove, [], [], {
          from: alice
        });

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.DISASSEMBLED);

        res = await this.splitMerge.packageGeohashesCount(res.packageTokenId);
        assert.equal(res, 0);
      });
    });

    describe.skip('#claimValidatorRewardEth()', () => {
      beforeEach(async function() {
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', '🦄', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
      });

      it('should allow validator claim reward after approve', async function() {
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
        await this.plotManager.claimValidatorRewardEth(this.aId, { from: bob });
        const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));

        // bobs fee is around (100 - 24) / 100 * 6 ether = 4560000000000000000 wei
        // assume that the commission paid by bob isn't greater than 0.1 ether
        assert(
          bobsInitialBalance
            .add(new BN('4560000000000000000'))
            .sub(new BN(ether(0.1)))
            .lt(bobsFinalBalance)
        );
        assert(
          bobsInitialBalance
            .add(new BN('4560000000000000000'))
            .add(new BN(ether(0.1)))
            .gt(bobsFinalBalance)
        );
      });

      it('should allow validator claim reward after reject', async function() {
        await this.plotManager.rejectApplication(this.aId, { from: bob });

        await assertRevert(this.plotManager.claimValidatorRewardEth(this.aId, { from: bob }));

        let res;

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();

        const packageGeohashes = await this.splitMerge.getPackageGeohashes(res.packageTokenId);
        const geohashesToRemove = packageGeohashes.map(tokenId => galt.tokenIdToGeohash(tokenId.toString(10)));

        await this.plotManager.removeGeohashesFromApplication(this.aId, geohashesToRemove, [], [], {
          from: alice
        });

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.REJECTED);

        res = await this.splitMerge.packageGeohashesCount(res.packageTokenId);
        assert.equal(res.toString(10), (0).toString(10));

        const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));

        await this.plotManager.claimValidatorRewardEth(this.aId, { from: bob });
        const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));

        // bobs fee is around (100 - 24) / 100 * 6 ether = 4560000000000000000 wei
        // assume that the commission paid by bob isn't greater than 0.1 ether
        assert(
          bobsInitialBalance
            .add(new BN('4560000000000000000'))
            .sub(new BN(ether(0.1)))
            .lt(bobsFinalBalance)
        );
        assert(
          bobsInitialBalance
            .add(new BN('4560000000000000000'))
            .add(new BN(ether(0.1)))
            .gt(bobsFinalBalance)
        );
      });
    });

    describe.skip('#claimGaltSpaceRewardEth()', () => {
      beforeEach(async function() {
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        await this.plotManager.claimValidatorRewardEth(this.aId, { from: bob });
      });

      it('should allow validator claim reward', async function() {
        const plotManagerInitialBalance = new BN(await web3.eth.getBalance(this.plotManager.address));
        const galtSpaceOrgInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));
        await this.plotManager.claimGaltSpaceRewardEth(this.aId, { from: galtSpaceOrg });
        const galtSpaceOrgFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));
        const plotManagerFinalBalance = new BN(await web3.eth.getBalance(this.plotManager.address));

        // galtSpaceOrg fee is around 24 / 100 * 6 ether = 1440000000000000000 wei
        // assume that the commission paid by bob isn't greater than 0.1 ether
        assert(
          galtSpaceOrgInitialBalance
            .add(new BN('1440000000000000000'))
            .sub(new BN(ether(0.1)))
            .lt(galtSpaceOrgFinalBalance)
        );
        assert(
          galtSpaceOrgInitialBalance
            .add(new BN('1440000000000000000'))
            .add(new BN(ether(0.1)))
            .gt(galtSpaceOrgFinalBalance)
        );
        assert(plotManagerInitialBalance.eq(new BN('1440000000000000000')));
        assert(plotManagerFinalBalance.eq(new BN('0')));
      });
    });
  });
});
