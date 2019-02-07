const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const Web3 = require('web3');
const { initHelperWeb3 } = require('../helpers');

const web3 = new Web3(ArbitratorsMultiSig.web3.currentProvider);

initHelperWeb3(web3);

// NOTICE: we don't wrap MockToken with a proxy on production
contract('ArbitratorsMultiSig', accounts => {
  const [coreTeam, alice, bob, charlie, dan] = accounts;

  beforeEach(async function() {
    this.abMultiSig = await ArbitratorsMultiSig.new([alice, bob, charlie], 2, { from: coreTeam });
  });

  describe('forbidden methods', () => {
    it('#addOwner()', async function() {
      const txData = this.abMultiSig.contract.methods.addOwner(dan).encodeABI();
      let res = await this.abMultiSig.submitTransaction(this.abMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.abMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.abMultiSig.getOwners();
      assert.sameMembers(res, [alice, bob, charlie]);
    });

    it('#removeOwner()', async function() {
      const txData = this.abMultiSig.contract.methods.removeOwner(charlie).encodeABI();
      let res = await this.abMultiSig.submitTransaction(this.abMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.abMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.abMultiSig.getOwners();
      assert.sameMembers(res, [alice, bob, charlie]);
    });

    it('#replaceOwner()', async function() {
      const txData = this.abMultiSig.contract.methods.replaceOwner(charlie, dan).encodeABI();
      let res = await this.abMultiSig.submitTransaction(this.abMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.abMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.abMultiSig.getOwners();
      assert.sameMembers(res, [alice, bob, charlie]);
    });

    it('#changeRequirement()', async function() {
      const txData = this.abMultiSig.contract.methods.changeRequirement(1).encodeABI();
      let res = await this.abMultiSig.submitTransaction(this.abMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.abMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.abMultiSig.getOwners();
      assert.sameMembers(res, [alice, bob, charlie]);
    });
  });
});
