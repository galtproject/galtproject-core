const PGGMultiSig = artifacts.require('./PGGMultiSig.sol');
const PGGConfig = artifacts.require('./PGGConfig.sol');
const GaltGlobalRegistry = artifacts.require('./GaltGlobalRegistry.sol');
const GaltToken = artifacts.require('./GaltToken.sol');

const Web3 = require('web3');
const { initHelperWeb3 } = require('../../helpers');

const web3 = new Web3(PGGMultiSig.web3.currentProvider);

initHelperWeb3(web3);

// NOTICE: we don't wrap MockToken with a proxy on production
contract('PGGMultiSig', accounts => {
  const [coreTeam, alice, bob, charlie, dan] = accounts;

  beforeEach(async function() {
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    await this.ggr.initialize();

    this.galtToken = await GaltToken.new({ from: coreTeam });

    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });

    this.pggConfigX = await PGGConfig.new(this.ggr.address, 2, 3, 200, 30, {
      from: coreTeam
    });
    this.pggMultiSig = await PGGMultiSig.new([alice, bob, charlie], 2, this.pggConfigX.address, {
      from: coreTeam
    });
  });

  describe('forbidden methods', () => {
    it('#addOwner()', async function() {
      const txData = this.pggMultiSig.contract.methods.addOwner(dan).encodeABI();
      let res = await this.pggMultiSig.submitTransaction(this.pggMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.pggMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.pggMultiSig.getOwners();
      assert.sameMembers(res, [alice, bob, charlie]);
    });

    it('#removeOwner()', async function() {
      const txData = this.pggMultiSig.contract.methods.removeOwner(charlie).encodeABI();
      let res = await this.pggMultiSig.submitTransaction(this.pggMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.pggMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.pggMultiSig.getOwners();
      assert.sameMembers(res, [alice, bob, charlie]);
    });

    it('#replaceOwner()', async function() {
      const txData = this.pggMultiSig.contract.methods.replaceOwner(charlie, dan).encodeABI();
      let res = await this.pggMultiSig.submitTransaction(this.pggMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.pggMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.pggMultiSig.getOwners();
      assert.sameMembers(res, [alice, bob, charlie]);
    });

    it('#changeRequirement()', async function() {
      const txData = this.pggMultiSig.contract.methods.changeRequirement(1).encodeABI();
      let res = await this.pggMultiSig.submitTransaction(this.pggMultiSig.address, '0', txData, { from: alice });
      const txId = res.logs[0].args.transactionId.toString(10);
      res = await this.pggMultiSig.confirmTransaction(txId, { from: bob });
      assert.equal(res.logs[1].event, 'ExecutionFailure');
      res = await this.pggMultiSig.getOwners();
      assert.sameMembers(res, [alice, bob, charlie]);
    });
  });
});
