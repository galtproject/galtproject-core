const GlobalGovernance = artifacts.require('./GlobalGovernance.sol');
const MockBar = artifacts.require('./MockBar.sol');

const Web3 = require('web3');
const { initHelperWeb3, initHelperArtifacts } = require('../helpers');

const web3 = new Web3(GlobalGovernance.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

contract('GlobalGovernance Unit', accounts => {
  const [coreTeam, alice] = accounts;

  beforeEach(async function() {
    this.globalGovernance = await GlobalGovernance.new({ from: coreTeam });
    this.mockBar = await MockBar.new({ from: coreTeam });
  });

  describe('#getMarker()', () => {
    it('should provide correct marker for method without arguments', async function() {
      const method = '0xf44db402';
      const res = await this.globalGovernance.getMarker(alice, method);
      const encoded = await web3.eth.abi.encodeParameters(
        ['address', 'bytes32'],
        [alice, '0xf44db40200000000000000000000000000000000000000000000000000000000']
      );
      assert.equal(res, web3.utils.soliditySha3(encoded));
    });

    it('should provide correct marker for method with arguments', async function() {
      const method = '0x88d7ca0300000000000000000000000098142bdb536ef70033f4075104294ed9106e65a2';
      const res = await this.globalGovernance.getMarker(alice, method);
      const encoded = await web3.eth.abi.encodeParameters(
        ['address', 'bytes32'],
        [alice, '0x88d7ca0300000000000000000000000000000000000000000000000000000000']
      );
      assert.equal(res, web3.utils.soliditySha3(encoded));
    });
  });
});
