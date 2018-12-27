const Oracles = artifacts.require('./Oracles.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3 } = require('../helpers');

const web3 = new Web3(Oracles.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

// NOTICE: we don't wrap MockToken with a proxy on production
contract.only('ArbitratorsMultiSig', accounts => {
  const [coreTeam, alice, bob, charlie, dan] = accounts;

  beforeEach(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });
    this.abMultiSig = await ArbitratorsMultiSig.new([alice, bob, charlie], 2, { from: coreTeam });
    this.abMultiSigWeb3 = new web3.eth.Contract(this.abMultiSig.abi, this.abMultiSig.address);
  });

  describe('forbidden methods', () => {
    it('#addOwner()', async function() {
      const txData = this.abMultiSig.contract.addOwner.getData(dan);
      let res = await this.abMultiSig.submitTransaction(this.abMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.abMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.abMultiSigWeb3.methods.getOwners().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, bob, charlie]);
    });

    it('#removeOwner()', async function() {
      const txData = this.abMultiSig.contract.removeOwner.getData(charlie);
      let res = await this.abMultiSig.submitTransaction(this.abMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.abMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.abMultiSigWeb3.methods.getOwners().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, bob, charlie]);
    });

    it('#replaceOwner()', async function() {
      const txData = this.abMultiSig.contract.replaceOwner.getData(charlie, dan);
      let res = await this.abMultiSig.submitTransaction(this.abMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.abMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.abMultiSigWeb3.methods.getOwners().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, bob, charlie]);
    });

    it('#changeRequirement()', async function() {
      const txData = this.abMultiSig.contract.changeRequirement.getData(1);
      let res = await this.abMultiSig.submitTransaction(this.abMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.abMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.abMultiSigWeb3.methods.getOwners().call();
      assert.sameMembers(res.map(a => a.toLowerCase()), [alice, bob, charlie]);
    });
  });
});
