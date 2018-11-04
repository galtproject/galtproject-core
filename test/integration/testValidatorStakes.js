const Validators = artifacts.require('./Validators.sol');
const ValidatorStakes = artifacts.require('./ValidatorStakes.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { assertRevert, ether, initHelperWeb3 } = require('../helpers');

const { stringToHex } = Web3.utils;
const web3 = new Web3(Validators.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

const NEW_APPLICATION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const ESCROW_APPLICATION = '0xf17a99d990bb2b0a5c887c16a380aa68996c0b23307f6633bd7a2e1632e1ef48';
const CUSTODIAN_APPLICATION = '0xe2ce825e66d1e2b4efe1252bf2f9dc4f1d7274c343ac8a9f28b6776eb58188a6';

const CM_JUROR = 'CM_JUROR';
const PE_AUDITOR_ROLE = 'PE_AUDITOR_ROLE';
const PC_CUSTODIAN_ROLE = 'PC_CUSTODIAN_ROLE';
const PC_AUDITOR_ROLE = 'PC_AUDITOR_ROLE';

// NOTICE: we don't wrap MockToken with a proxy on production
contract('ValidatorStakes', accounts => {
  const [
    coreTeam,
    slashManager,
    applicationTypeManager,
    validatorManager,
    alice,
    bob,
    charlie,
    dan,
    eve,
    multiSigWallet
  ] = accounts;

  beforeEach(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.validators = await Validators.new({ from: coreTeam });
    this.validatorStakes = await ValidatorStakes.new({ from: coreTeam });

    await this.validatorStakes.initialize(this.validators.address, this.galtToken.address, multiSigWallet, {
      from: coreTeam
    });
    await this.validators.addRoleTo(applicationTypeManager, await this.validators.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(validatorManager, await this.validators.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(this.validatorStakes.address, await this.validators.ROLE_VALIDATOR_STAKES(), {
      from: coreTeam
    });
    await this.validatorStakes.addRoleTo(slashManager, await this.validatorStakes.ROLE_SLASH_MANAGER(), {
      from: coreTeam
    });

    await this.galtToken.mint(alice, ether(10000000000), { from: coreTeam });

    await this.validators.setApplicationTypeRoles(NEW_APPLICATION, ['foo', 'bar', 'buzz'], [30, 30, 40], ['', '', ''], {
      from: applicationTypeManager
    });
    await this.validators.setApplicationTypeRoles(ESCROW_APPLICATION, [PE_AUDITOR_ROLE], [100], [''], {
      from: applicationTypeManager
    });
    this.resClarificationAddRoles = await this.validators.setApplicationTypeRoles(
      CUSTODIAN_APPLICATION,
      [PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE],
      [60, 40],
      ['', ''],
      { from: applicationTypeManager }
    );

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

    this.validatorStakesWeb3 = new web3.eth.Contract(this.validatorStakes.abi, this.validatorStakes.address);
  });

  describe('#stake()', () => {
    it('should allow any user stake for validator', async function() {
      await this.galtToken.approve(this.validatorStakes.address, ether(35), { from: alice });
      await this.validatorStakes.stake(bob, PC_CUSTODIAN_ROLE, ether(35), { from: alice });

      let res = await this.validatorStakesWeb3.methods.stakeOf(bob, stringToHex(CM_JUROR)).call();
      assert.equal(res, 0);
      res = await this.validatorStakesWeb3.methods.stakeOf(bob, stringToHex(PC_CUSTODIAN_ROLE)).call();
      assert.equal(res, ether(35));
    });

    it('should deny staking for non-existing role', async function() {
      await this.galtToken.approve(this.validatorStakes.address, ether(35), { from: alice });
      await assertRevert(this.validatorStakes.stake(bob, 'non-exisitng-role', ether(35), { from: alice }));

      const res = await this.validatorStakesWeb3.methods.stakeOf(bob, stringToHex(CM_JUROR)).call();
      assert.equal(res, 0);
    });

    it('should deny staking for non-existing validator', async function() {
      await this.galtToken.approve(this.validatorStakes.address, ether(35), { from: alice });
      await assertRevert(this.validatorStakes.stake(alice, CM_JUROR, ether(35), { from: alice }));

      const res = await this.validatorStakesWeb3.methods.stakeOf(alice, stringToHex(CM_JUROR)).call();
      assert.equal(res, 0);
    });
  });

  describe('#slash()', () => {
    beforeEach(async function() {
      await this.validators.addValidator(
        bob,
        'Bob',
        'MN',
        [],
        [PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE, PC_CUSTODIAN_ROLE, 'foo'],
        {
          from: validatorManager
        }
      );

      await this.galtToken.approve(this.validatorStakes.address, ether(1000), { from: alice });
      await this.validatorStakes.stake(bob, PC_CUSTODIAN_ROLE, ether(35), { from: alice });
      await this.validatorStakes.stake(bob, PC_AUDITOR_ROLE, ether(55), { from: alice });
      await this.validatorStakes.stake(bob, PC_CUSTODIAN_ROLE, ether(25), { from: alice });
    });

    it('should allow slash manager slashing validator stake', async function() {
      await this.validatorStakes.slash(bob, PC_AUDITOR_ROLE, ether(18), { from: slashManager });

      const res = await this.validatorStakesWeb3.methods.stakeOf(bob, stringToHex(PC_AUDITOR_ROLE)).call();
      assert.equal(res, ether(37));
    });

    it('should allow slash a stake to a negative value', async function() {
      await this.validatorStakes.slash(bob, PC_AUDITOR_ROLE, ether(100), { from: slashManager });

      const res = await this.validatorStakesWeb3.methods.stakeOf(bob, stringToHex(PC_AUDITOR_ROLE)).call();
      assert.equal(res, ether(-45));
    });

    it('should deny non-slashing manager slashing stake', async function() {
      await assertRevert(this.validatorStakes.slash(bob, PC_AUDITOR_ROLE, ether(100), { from: bob }));
    });

    it('should deny slashing non-existent role', async function() {
      await assertRevert(this.validatorStakes.slash(bob, PE_AUDITOR_ROLE, ether(100), { from: slashManager }));
    });

    it('should allow slashing existent role with 0 balance', async function() {
      await this.validatorStakes.slash(dan, PE_AUDITOR_ROLE, ether(100), { from: slashManager });

      const res = await this.validatorStakesWeb3.methods.stakeOf(dan, stringToHex(PE_AUDITOR_ROLE)).call();
      assert.equal(res, ether(-100));
    });
  });
});
