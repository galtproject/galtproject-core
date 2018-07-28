const web3 = require('web3');

module.exports = {
  zeroAddress: '0x0000000000000000000000000000000000000000',
  hex(input) {
    return web3.utils.toHex(input);
  },
  ether(number) {
    return web3.utils.toWei(number.toString(), 'ether');
  },
  async sleep(timeout) {
    return new Promise(resolve => {
      setTimeout(resolve, timeout);
    });
  },
  async assertRevert(promise) {
    try {
      await promise;
    } catch (error) {
      const revert = error.message.search('revert') >= 0;
      assert(revert, `Expected throw, got '${error}' instead`);
      return;
    }
    assert.fail('Expected throw not received');
  }
};
