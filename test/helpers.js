const Web3 = require('web3');

const { BN } = Web3.utils;
const max = new BN('10000000000000000'); // <- 0.01 ether
const min = new BN('0');
const adjust = new BN('10000000000000000');

let web3;
let artifacts;

let requireCache = {};
let libCache = {};

const Helpers = {
  initHelperWeb3(_web3) {
    web3 = new Web3(_web3.currentProvider);
  },
  zeroAddress: '0x0000000000000000000000000000000000000000',
  hex(input) {
    return web3.utils.toHex(input);
  },
  gwei(number) {
    return web3.utils.toWei(number.toString(), 'gwei');
  },
  szabo(number) {
    return web3.utils.toWei(number.toString(), 'szabo');
  },
  ether(number) {
    return web3.utils.toWei(number.toString(), 'ether');
  },
  galt(number) {
    return web3.utils.toWei(number.toString(), 'ether');
  },
  roundToPrecision(number, precision = 4) {
    return Math.round(number / 10 ** precision) * 10 ** precision;
  },
  log(...args) {
    console.log('>>>', new Date().toLocaleTimeString(), '>>>', ...args);
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
  },
  assertEqualBN(actual, expected) {
    assert(actual instanceof BN, 'Actual value isn not a BN instance');
    assert(expected instanceof BN, 'Expected value isn not a BN instance');

    assert(
      actual.toString(10) === expected.toString(10),
      `Expected ${web3.utils.fromWei(actual)} (actual) ether to be equal ${web3.utils.fromWei(
        expected
      )} ether (expected)`
    );
  },
  /**
   * Compare ETH balances
   *
   * @param balanceBefore string
   * @param balanceAfter string
   * @param balanceDiff string
   */
  assertEthBalanceChanged(balanceBefore, balanceAfter, balanceDiff) {
    const diff = new BN(balanceAfter)
      .sub(new BN(balanceDiff)) // <- the diff
      .sub(new BN(balanceBefore))
      .add(adjust); // <- 0.01 ether

    assert(
      diff.lt(max), // diff < 0.01 ether
      `Expected ${web3.utils.fromWei(diff.toString(10))} (${diff.toString(10)} wei) to be less than 0.01 ether`
    );

    assert(
      diff.gt(min), // diff > 0
      `Expected ${web3.utils.fromWei(diff.toString(10))} (${diff.toString(10)} wei) to be greater than 0`
    );
  },
  /**
   * Compare GALT balances
   *
   * @param balanceBefore string | BN
   * @param balanceAfter string | BN
   * @param balanceDiff string | BN
   */
  assertGaltBalanceChanged(balanceBeforeArg, balanceAfterArg, balanceDiffArg) {
    let balanceBefore;
    let balanceAfter;
    let balanceDiff;

    if (typeof balanceBeforeArg == 'string') {
      balanceBefore = new BN(balanceBeforeArg);
    } else if (balanceBeforeArg instanceof BN) {
      balanceBefore = balanceBeforeArg;
    } else {
      throw Error('#assertGaltBalanceChanged(): balanceBeforeArg is neither BN instance nor a string');
    }

    if (typeof balanceAfterArg == 'string') {
      balanceAfter = new BN(balanceAfterArg);
    } else if (balanceAfterArg instanceof BN) {
      balanceAfter = balanceAfterArg;
    } else {
      throw Error('#assertGaltBalanceChanged(): balanceAfterArg is neither BN instance nor a string');
    }

    if (typeof balanceDiffArg == 'string') {
      balanceDiff = new BN(balanceDiffArg);
    } else if (balanceDiffArg instanceof BN) {
      balanceDiff = balanceDiffArg;
    } else {
      throw Error('#assertGaltBalanceChanged(): balanceDiffArg is neither BN instance nor a string');
    }

    Helpers.assertEqualBN(balanceAfter, balanceBefore.add(balanceDiff));
  },
  async printStorage(address, slotsToPrint) {
    assert(typeof address !== 'undefined');
    assert(address.length > 0);

    console.log('Storage listing for', address);
    const tasks = [];

    for (let i = 0; i < (slotsToPrint || 20); i++) {
      tasks.push(web3.eth.getStorageAt(address, i));
    }

    const results = await Promise.all(tasks);

    for (let i = 0; i < results.length; i++) {
      console.log(`slot #${i}`, results[i]);
    }
  },
  initHelperArtifacts(_artifacts) {
    artifacts = _artifacts;
  },
  clearRequireCache() {
    requireCache = {};
  },
  clearLibCache() {
    libCache = {};
  },
  requireContract(path) {
    if (!requireCache[path]) {
      requireCache[path] = artifacts.require(path);
    }
    return requireCache[path];
  },
  async getSegmentUtilsLib() {
    if (libCache.SegmentUtils) {
      return libCache.SegmentUtils;
    }
    const SegmentUtils = Helpers.requireContract('./utils/SegmentUtils.sol');
    libCache.SegmentUtils = await SegmentUtils.new();
    return libCache.SegmentUtils;
  },
  async getLandUtilsLib() {
    if (libCache.LandUtils) {
      return libCache.LandUtils;
    }
    const LandUtils = Helpers.requireContract('./utils/LandUtils.sol');
    libCache.LandUtils = await LandUtils.new();
    return libCache.LandUtils;
  },
  async getArrayUtilsLib() {
    if (libCache.ArrayUtils) {
      return libCache.ArrayUtils;
    }
    const ArrayUtils = Helpers.requireContract('./utils/ArrayUtils.sol');
    libCache.ArrayUtils = await ArrayUtils.new();
    return libCache.ArrayUtils;
  },
  async getPolygonUtilsLib() {
    if (libCache.PolygonUtils) {
      return libCache.PolygonUtils;
    }
    const PolygonUtils = Helpers.requireContract('./utils/PolygonUtils.sol');
    PolygonUtils.link('LandUtils', (await Helpers.getLandUtilsLib()).address);
    libCache.PolygonUtils = await PolygonUtils.new();
    return libCache.PolygonUtils;
  },
  async getRedBlackTreeLib() {
    if (libCache.RedBlackTree) {
      return libCache.RedBlackTree;
    }
    const RedBlackTree = Helpers.requireContract('./collections/RedBlackTree.sol');
    libCache.RedBlackTree = await RedBlackTree.new();
    return libCache.RedBlackTree;
  },
  async getPointRedBlackTreeLib() {
    if (libCache.PointRedBlackTree) {
      return libCache.PointRedBlackTree;
    }
    const PointRedBlackTree = Helpers.requireContract('./collections/PointRedBlackTree.sol');
    libCache.PointRedBlackTree = await PointRedBlackTree.new();
    return libCache.PointRedBlackTree;
  },
  async getSegmentRedBlackTreeLib() {
    if (libCache.SegmentRedBlackTree) {
      return libCache.SegmentRedBlackTree;
    }
    const SegmentRedBlackTree = Helpers.requireContract('./collections/SegmentRedBlackTree.sol');
    libCache.SegmentRedBlackTree = await SegmentRedBlackTree.new();
    return libCache.SegmentRedBlackTree;
  },
  async getSweepLineRedBlackTreeLib() {
    if (libCache.SweepLineRedBlackTree) {
      return libCache.SweepLineRedBlackTree;
    }
    const SweepLineRedBlackTree = Helpers.requireContract('./collections/SweepLineRedBlackTree.sol');
    libCache.SweepLineRedBlackTree = await SweepLineRedBlackTree.new();
    return libCache.SweepLineRedBlackTree;
  },
  async getSweepQueueRedBlackTreeLib() {
    if (libCache.SweepQueueRedBlackTree) {
      return libCache.SweepQueueRedBlackTree;
    }
    const SweepQueueRedBlackTree = Helpers.requireContract('./collections/SweepQueueRedBlackTree.sol');
    libCache.SweepQueueRedBlackTree = await SweepQueueRedBlackTree.new();
    return libCache.SweepQueueRedBlackTree;
  },
  async getMartinezRuedaLib() {
    if (libCache.MartinezRueda) {
      return libCache.MartinezRueda;
    }
    const MartinezRueda = Helpers.requireContract('./utils/MartinezRueda.sol');
    MartinezRueda.link('RedBlackTree', (await Helpers.getRedBlackTreeLib()).address);
    MartinezRueda.link('SweepLineRedBlackTree', (await Helpers.getSweepLineRedBlackTreeLib()).address);
    MartinezRueda.link('SweepQueueRedBlackTree', (await Helpers.getSweepQueueRedBlackTreeLib()).address);
    libCache.MartinezRueda = await MartinezRueda.new();
    return libCache.MartinezRueda;
  },
  async getWeilerAthertonLib() {
    if (libCache.WeilerAtherton) {
      return libCache.WeilerAtherton;
    }
    const WeilerAtherton = Helpers.requireContract('./utils/WeilerAtherton.sol');
    WeilerAtherton.link('BentleyOttman', (await Helpers.getBentleyOttmanLib()).address);
    WeilerAtherton.link('PolygonUtils', (await Helpers.getPolygonUtilsLib()).address);
    libCache.WeilerAtherton = await WeilerAtherton.new();
    return libCache.WeilerAtherton;
  },
  async deploySplitMerge() {
    const SplitMerge = Helpers.requireContract('./SplitMerge.sol');

    const arrayUtils = await Helpers.getArrayUtilsLib();
    const landUtils = await Helpers.getLandUtilsLib();
    const polygonUtils = await Helpers.getPolygonUtilsLib();
    const weilerAtherton = await Helpers.getWeilerAthertonLib();

    SplitMerge.link('LandUtils', landUtils.address);
    SplitMerge.link('ArrayUtils', arrayUtils.address);
    SplitMerge.link('PolygonUtils', polygonUtils.address);
    SplitMerge.link('WeilerAtherton', weilerAtherton.address);

    const splitMerge = await SplitMerge.new();
    return splitMerge;
  }
};

module.exports = Helpers;
