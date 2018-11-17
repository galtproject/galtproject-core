const Validators = artifacts.require('./Validators.sol');
const ValidatorStakesMultiSig = artifacts.require('./ValidatorStakesMultiSig.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3 } = require('../helpers');

const web3 = new Web3(Validators.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

// NOTICE: we don't wrap MockToken with a proxy on production
contract('ValidatorStakesMultiSig', accounts => {
  const [coreTeam, alice, bob, charlie, dan] = accounts;

  beforeEach(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.validators = await Validators.new({ from: coreTeam });
    this.vsMultiSig = await ValidatorStakesMultiSig.new(coreTeam, [alice, bob, charlie], 2, { from: coreTeam });
    this.vsMultiSigWeb3 = new web3.eth.Contract(this.vsMultiSig.abi, this.vsMultiSig.address);
  });

  describe('forbidden methods', () => {
    it('#addOwner()', async function() {
      const txData = this.vsMultiSig.contract.addOwner.getData(dan);
      let res = await this.vsMultiSig.submitTransaction(this.vsMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.vsMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.vsMultiSigWeb3.methods.getOwners().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, bob, charlie]);
    });

    it('#removeOwner()', async function() {
      const txData = this.vsMultiSig.contract.removeOwner.getData(charlie);
      let res = await this.vsMultiSig.submitTransaction(this.vsMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.vsMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.vsMultiSigWeb3.methods.getOwners().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, bob, charlie]);
    });

    it('#replaceOwner()', async function() {
      const txData = this.vsMultiSig.contract.replaceOwner.getData(charlie, dan);
      let res = await this.vsMultiSig.submitTransaction(this.vsMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.vsMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.vsMultiSigWeb3.methods.getOwners().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, bob, charlie]);
    });

    it('#changeRequirement()', async function() {
      const txData = this.vsMultiSig.contract.changeRequirement.getData(1);
      let res = await this.vsMultiSig.submitTransaction(this.vsMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.vsMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.vsMultiSigWeb3.methods.getOwners().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, bob, charlie]);
    });
  });
});
