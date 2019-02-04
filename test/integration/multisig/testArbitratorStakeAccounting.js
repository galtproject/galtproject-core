const GaltToken = artifacts.require('./GaltToken.sol');
const ArbitratorStakeAccounting = artifacts.require('./ArbitratorStakeAccounting.sol');
const AddressLinkedList = artifacts.require('./AddressLinkedList.sol');
const VotingLinkedList = artifacts.require('./VotingLinkedList.sol');
const Web3 = require('web3');
const { assertRevert, ether, initHelperWeb3 } = require('../../helpers');

const { utf8ToHex } = Web3.utils;
const bytes32 = utf8ToHex;
const web3 = new Web3(GaltToken.web3.currentProvider);

initHelperWeb3(web3);

const NEW_APPLICATION = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
const ESCROW_APPLICATION = '0xf17a99d990bb2b0a5c887c16a380aa68996c0b23307f6633bd7a2e1632e1ef48';
const CUSTODIAN_APPLICATION = '0xe2ce825e66d1e2b4efe1252bf2f9dc4f1d7274c343ac8a9f28b6776eb58188a6';

const NON_EXISTENT_ROLE = bytes32('blah');
const PE_AUDITOR_ORACLE_TYPE = bytes32('PE_AUDITOR_ORACLE_TYPE');
const PC_CUSTODIAN_ORACLE_TYPE = bytes32('PC_CUSTODIAN_ORACLE_TYPE');
const PC_AUDITOR_ORACLE_TYPE = bytes32('PC_AUDITOR_ORACLE_TYPE');

const FOO = bytes32('foo');
const BAR = bytes32('bar');
const BUZZ = bytes32('buzz');
// eslint-disable-next-line no-underscore-dangle
const _ES = bytes32('');
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');
const DAN = bytes32('Dan');
const EVE = bytes32('Eve');

// NOTICE: we don't wrap MockToken with a proxy on production
contract.only('ArbitratorStakeAccounting', accounts => {
  const [coreTeam, slashManager, oracleManager, multiSig, alice, bob, charlie, dan, eve] = accounts;

  beforeEach(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.arbitratorStakeAccountingX = await ArbitratorStakeAccounting.new(this.galtToken.address, multiSig, {
      from: coreTeam
    });

    this.arbitratorStakeAccountingX.addRoleTo(slashManager, 'slash_manager');

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });

    this.mX = multiSig;
  });

  describe('#stake()', () => {
    it('should allow any address stake in GALT', async function() {
      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(35), { from: alice });

      await this.arbitratorStakeAccountingX.stake(bob, ether(35), { from: alice });

      let res = await this.arbitratorStakeAccountingX.balanceOf(bob);
      assert.equal(res, ether(35));

      res = await this.galtToken.balanceOf(multiSig);
      assert.equal(res, ether(35));

      // add some more deposit
      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(10), { from: bob });
      await this.arbitratorStakeAccountingX.stake(bob, ether(10), { from: bob });

      res = await this.arbitratorStakeAccountingX.balanceOf(bob);
      assert.equal(res, ether(45));

      res = await this.galtToken.balanceOf(multiSig);
      assert.equal(res, ether(45));
    });
  });

  describe('#slash()', () => {
    beforeEach(async function() {
      await this.galtToken.approve(this.arbitratorStakeAccountingX.address, ether(35), { from: alice });
      await this.arbitratorStakeAccountingX.stake(bob, ether(35), { from: alice });
    });

    it('should allow slash manager slashing arbitrator stake', async function() {
      await this.arbitratorStakeAccountingX.slash(bob, ether(18), { from: slashManager });

      const res = await this.arbitratorStakeAccountingX.balanceOf(bob);
      assert.equal(res, ether(17));
    });

    it('should deny non-slashing manager slashing stake', async function() {
      await assertRevert(this.arbitratorStakeAccountingX.slash(bob, ether(10), { from: bob }));
    });

    it('should deny slashing with a value grater than current stake', async function() {
      await assertRevert(this.arbitratorStakeAccountingX.slash(bob, ether(36), { from: slashManager }));
    });
  });
});
