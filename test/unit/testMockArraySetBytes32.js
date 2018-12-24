const MockArraySetBytes32 = artifacts.require('./collections/MockArraySetBytes32.sol');
const Web3 = require('web3');

const web3 = new Web3(MockArraySetBytes32.web3.currentProvider);

const { utf8ToHex, hexToUtf8 } = web3.utils;

const a = utf8ToHex('A');
const b = utf8ToHex('B');
const c = utf8ToHex('C');
const d = utf8ToHex('D');
const e = utf8ToHex('E');

const A = 'A';
const B = 'B';
const C = 'C';
const D = 'D';
const E = 'E';

contract('MockArraySetBytes32', ([deployer]) => {
  beforeEach(async function() {
    this.set = await MockArraySetBytes32.new({ from: deployer });
    this.setWeb3 = new web3.eth.Contract(this.set.abi, this.set.address);
  });

  describe('clear', () => {
    it('it should remove all elements', async function() {
      await this.set.add(a);
      await this.set.add(b);
      await this.set.add(c);

      let res = await this.setWeb3.methods.elements().call();
      assert.sameMembers(res.map(hexToUtf8), [A, B, C]);

      await this.set.clear();

      res = await this.setWeb3.methods.elements().call();
      assert.sameMembers(res, []);

      res = await this.setWeb3.methods.isEmpty().call();
      assert.equal(res, true);

      res = await this.setWeb3.methods.size().call();
      assert.equal(res, 0);

      res = await this.setWeb3.methods.has(a).call();
      assert.equal(res, false);

      res = await this.setWeb3.methods.has(b).call();
      assert.equal(res, false);

      res = await this.setWeb3.methods.has(c).call();
      assert.equal(res, false);
    });

    it('it should able to merge the same elements after been cleared', async function() {
      await this.set.add(a);
      await this.set.add(b);
      await this.set.add(c);

      let res = await this.setWeb3.methods.elements().call();
      assert.sameMembers(res.map(hexToUtf8), [A, B, C]);

      await this.set.clear();

      await this.set.add(b);
      await this.set.add(d);
      await this.set.add(e);

      res = await this.setWeb3.methods.elements().call();
      assert.sameMembers(res.map(hexToUtf8), [B, D, E]);

      res = await this.setWeb3.methods.isEmpty().call();
      assert.equal(res, false);

      res = await this.setWeb3.methods.size().call();
      assert.equal(res, 3);

      res = await this.setWeb3.methods.has(a).call();
      assert.equal(res, false);

      res = await this.setWeb3.methods.has(b).call();
      assert.equal(res, true);

      res = await this.setWeb3.methods.has(c).call();
      assert.equal(res, false);

      res = await this.setWeb3.methods.has(d).call();
      assert.equal(res, true);

      res = await this.setWeb3.methods.has(e).call();
      assert.equal(res, true);
    });
  });
});
