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
  int(input) {
    return parseInt(input, 10);
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
    return Math.round(number * 10 ** precision) / 10 ** precision;
  },
  weiToEtherRound(wei, precision = 4) {
    return Helpers.roundToPrecision(parseFloat(web3.utils.fromWei(wei.toFixed(), 'ether')), precision);
  },
  numberToEvmWord(number) {
    return web3.utils.padLeft(web3.utils.numberToHex(number), 64);
  },
  addressToEvmWord(address) {
    return web3.utils.padLeft(address, 64);
  },
  bytes32ToEvmWord(bytes32) {
    return web3.utils.padRight(bytes32, 64);
  },
  log(...args) {
    console.log('>>>', new Date().toLocaleTimeString(), '>>>', ...args);
  },
  applicationStatus: {
    NOT_EXISTS: 0,
    SUBMITTED: 1,
    APPROVED: 2,
    REJECTED: 3,
    REVERTED: 4,
    ACCEPTED: 5,
    LOCKED: 6,
    REVIEW: 7,
    COMPLETED: 8,
    CLOSED: 9
  },
  paymentMethods: {
    NONE: 0,
    ETH_ONLY: 1,
    GALT_ONLY: 2,
    ETH_AND_GALT: 3
  },
  async sleep(timeout) {
    return new Promise(resolve => {
      setTimeout(resolve, timeout);
    });
  },
  // For Geth/Truffle
  async debugTraceTransaction(transactionHash, traceTypes = {}) {
    return new Promise(function(resolve, reject) {
      web3.eth.currentProvider.send(
        {
          jsonrpc: '2.0',
          method: 'debug_traceTransaction',
          params: [transactionHash, traceTypes],
          id: 0
        },
        function(err, res) {
          if (err) {
            reject(err);
            return;
          }

          resolve(res);
        }
      );
    });
  },
  // For Parity
  async traceReplayTransaction(transactionHash, traceTypes = ['vmTrace']) {
    return new Promise(function(resolve, reject) {
      web3.eth.currentProvider.send(
        {
          jsonrpc: '2.0',
          method: 'trace_replayTransaction',
          params: [transactionHash, traceTypes],
          id: 0
        },
        function(err, res) {
          if (err) {
            reject(err);
            return;
          }

          resolve(res);
        }
      );
    });
  },
  async evmMineBlock() {
    return new Promise(function(resolve, reject) {
      web3.eth.currentProvider.send(
        {
          jsonrpc: '2.0',
          method: 'evm_mine',
          id: 0
        },
        function(err, res) {
          if (err) {
            reject(err);
            return;
          }

          resolve(res);
        }
      );
    });
  },
  async evmIncreaseTime(seconds) {
    return new Promise(function(resolve, reject) {
      web3.eth.currentProvider.send(
        {
          jsonrpc: '2.0',
          method: 'evm_increaseTime',
          params: [seconds],
          id: 0
        },
        function(err, res) {
          if (err) {
            reject(err);
            return;
          }

          resolve(res);
        }
      );
    });
  },
  async assertInvalid(promise) {
    try {
      await promise;
    } catch (error) {
      const revert = error.message.search('invalid opcode') >= 0;
      assert(revert, `Expected INVALID (0xfe), got '${error}' instead`);
      return;
    }
    assert.fail('Expected INVALID (0xfe) not received');
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
      diff.lte(max), // diff < 0.01 ether
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
  // TODO: Move functions with deploy of contracts to builders.js
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
  async getLinkedListLib() {
    if (libCache.LinkedList) {
      return libCache.LinkedList;
    }
    const LinkedList = Helpers.requireContract('./collections/LinkedList.sol');
    libCache.LinkedList = await LinkedList.new();
    return libCache.LinkedList;
  },
  async getSweepQueueLinkedListLib() {
    if (libCache.SweepQueueLinkedList) {
      return libCache.SweepQueueLinkedList;
    }
    const SweepQueueLinkedList = Helpers.requireContract('./collections/SweepQueueLinkedList.sol');
    SweepQueueLinkedList.link('LinkedList', (await Helpers.getLinkedListLib()).address);
    libCache.SweepQueueLinkedList = await SweepQueueLinkedList.new();
    return libCache.SweepQueueLinkedList;
  },
  async getMartinezRuedaLib() {
    if (libCache.MartinezRueda) {
      return libCache.MartinezRueda;
    }
    const MartinezRueda = Helpers.requireContract('./utils/MartinezRueda.sol');
    MartinezRueda.link('LinkedList', (await Helpers.getLinkedListLib()).address);
    MartinezRueda.link('SweepQueueLinkedList', (await Helpers.getSweepQueueLinkedListLib()).address);
    MartinezRueda.link('RedBlackTree', (await Helpers.getRedBlackTreeLib()).address);
    MartinezRueda.link('SweepLineRedBlackTree', (await Helpers.getSweepLineRedBlackTreeLib()).address);
    libCache.MartinezRueda = await MartinezRueda.new();
    return libCache.MartinezRueda;
  },
  async getWeilerAthertonLib() {
    if (libCache.WeilerAtherton) {
      return libCache.WeilerAtherton;
    }
    const WeilerAtherton = Helpers.requireContract('./utils/WeilerAtherton.sol');
    WeilerAtherton.link('LinkedList', (await Helpers.getLinkedListLib()).address);
    WeilerAtherton.link('SweepQueueLinkedList', (await Helpers.getSweepQueueLinkedListLib()).address);
    WeilerAtherton.link('MartinezRueda', (await Helpers.getMartinezRuedaLib()).address);
    WeilerAtherton.link('PolygonUtils', (await Helpers.getPolygonUtilsLib()).address);
    libCache.WeilerAtherton = await WeilerAtherton.new();
    return libCache.WeilerAtherton;
  },
  async getSpaceGeoDataLib() {
    if (libCache.SpaceGeoDataLib) {
      return libCache.SpaceGeoDataLib;
    }
    const SpaceGeoDataLib = Helpers.requireContract('./SpaceGeoDataLib.sol');
    SpaceGeoDataLib.link('ArrayUtils', (await Helpers.getArrayUtilsLib()).address);
    libCache.SpaceGeoDataLib = await SpaceGeoDataLib.new();
    return libCache.SpaceGeoDataLib;
  },
  async deployGeodesic() {
    const Geodesic = Helpers.requireContract('./Geodesic.sol');

    const landUtils = await Helpers.getLandUtilsLib();
    const polygonUtils = await Helpers.getPolygonUtilsLib();
    Geodesic.link('LandUtils', landUtils.address);
    Geodesic.link('PolygonUtils', polygonUtils.address);
    return Geodesic.new();
  },
  async deploySpaceGeoDataLight(ggr) {
    const SpaceGeoData = Helpers.requireContract('./SpaceGeoDataRegistry.sol');

    const spaceGeoData = await SpaceGeoData.new();

    await ggr.setContract(await ggr.SPACE_GEO_DATA_REGISTRY(), spaceGeoData.address);

    await spaceGeoData.initialize(ggr.address);

    return spaceGeoData;
  },
  async deploySpaceGeoDataMock(ggr) {
    const SpaceGeoData = Helpers.requireContract('./SpaceGeoDataRegistry.sol');
    const Geodesic = Helpers.requireContract('./MockGeodesic.sol');

    SpaceGeoData.numberFormat = 'String';

    const spaceGeoData = await SpaceGeoData.new();
    const geodesic = await Geodesic.new();

    await ggr.setContract(await ggr.GEODESIC(), geodesic.address);
    await ggr.setContract(await ggr.SPACE_GEO_DATA_REGISTRY(), spaceGeoData.address);

    await spaceGeoData.initialize(ggr.address);

    return { spaceGeoData, geodesic };
  },
  async deploySpaceGeoData(ggr) {
    const SpaceGeoDataRegistry = Helpers.requireContract('./SpaceGeoDataRegistry.sol');
    const SpaceSplitOperationFactory = Helpers.requireContract('./SpaceSplitOperationFactory.sol');

    const weilerAtherton = await Helpers.getWeilerAthertonLib();
    const polygonUtils = await Helpers.getPolygonUtilsLib();

    SpaceSplitOperationFactory.link('PolygonUtils', polygonUtils.address);
    SpaceSplitOperationFactory.link('WeilerAtherton', weilerAtherton.address);

    const spaceGeoData = await SpaceGeoDataRegistry.new();
    const splitOperationFactory = await SpaceSplitOperationFactory.new(ggr.address);
    const geodesic = await Helpers.deployGeodesic();

    await ggr.setContract(await ggr.SPACE_SPLIT_OPERATION_FACTORY(), splitOperationFactory.address);
    await ggr.setContract(await ggr.GEODESIC(), geodesic.address);
    await ggr.setContract(await ggr.SPACE_GEO_DATA_REGISTRY(), spaceGeoData.address);

    await spaceGeoData.initialize(ggr.address);

    return spaceGeoData;
  },

  // TODO: fix Error: Invalid number of arguments to Solidity function
  async deployBancorGaltDex(
    galtTokenAddress,
    etherTokenAddress,
    galtWeight,
    etherWeight,
    maxConversionFee,
    gasPriceLimitValue
  ) {
    const SmartToken = Helpers.requireContract('bancor-contracts/solidity/contracts/token/SmartToken.sol');
    const ContractRegistry = Helpers.requireContract(
      'bancor-contracts/solidity/contracts/utility/ContractRegistry.sol'
    );
    const ContractIds = Helpers.requireContract('bancor-contracts/solidity/contracts/ContractIds.sol');
    const ContractFeatures = Helpers.requireContract(
      'bancor-contracts/solidity/contracts/utility/ContractFeatures.sol'
    );
    const BancorGasPriceLimit = Helpers.requireContract(
      'bancor-contracts/solidity/contracts/converter/BancorGasPriceLimit.sol'
    );
    const BancorFormula = Helpers.requireContract('bancor-contracts/solidity/contracts/converter/BancorFormula.sol');
    const BancorNetwork = Helpers.requireContract('bancor-contracts/solidity/contracts/BancorNetwork.sol');
    const BancorConverterFactory = Helpers.requireContract(
      'bancor-contracts/solidity/contracts/converter/BancorConverterFactory.sol'
    );
    const BancorConverterUpgrader = Helpers.requireContract(
      'bancor-contracts/solidity/contracts/converter/BancorConverterUpgrader.sol'
    );
    const BancorGaltDex = Helpers.requireContract('./BancorGaltDex.sol');

    const galtDexToken = await SmartToken.new('GaltDex Token', 'GDT', '18');
    const galtDexRegistry = await ContractRegistry.new();
    const contractIds = await ContractIds.new();
    const contractFeatures = await ContractFeatures.new();
    const gasPriceLimit = await BancorGasPriceLimit.new(gasPriceLimitValue);
    const formula = await BancorFormula.new();
    const bancorNetwork = await BancorNetwork.new(galtDexRegistry.address);
    const factory = await BancorConverterFactory.new();
    const upgrader = await BancorConverterUpgrader.new(galtDexRegistry.address);

    const bancorGaltDex = await BancorGaltDex.new(
      galtDexToken.address,
      galtDexRegistry.address,
      maxConversionFee,
      galtTokenAddress,
      galtWeight
    );

    const contractsOwner = await bancorGaltDex.manager();

    await galtDexRegistry.registerAddress(await contractIds.CONTRACT_FEATURES.call(), contractFeatures.address);

    await galtDexRegistry.registerAddress(await contractIds.BANCOR_GAS_PRICE_LIMIT.call(), gasPriceLimit.address);

    await galtDexRegistry.registerAddress(await contractIds.BANCOR_FORMULA.call(), formula.address);

    await galtDexRegistry.registerAddress(await contractIds.BANCOR_NETWORK.call(), bancorNetwork.address);
    await bancorNetwork.setSignerAddress(contractsOwner);

    await galtDexRegistry.registerAddress(await contractIds.BANCOR_CONVERTER_FACTORY.call(), factory.address);

    await galtDexRegistry.registerAddress(await contractIds.BANCOR_CONVERTER_UPGRADER.call(), upgrader.address);

    await galtDexRegistry.registerAddress(await contractIds.BANCOR_X.call(), contractsOwner);

    await bancorGaltDex.addConnector(etherTokenAddress, etherWeight, false);

    await galtDexToken.transferOwnership(bancorGaltDex.address);
    await bancorGaltDex.acceptTokenOwnership();
  }
};

Object.freeze(Helpers.applicationStatus);

module.exports = Helpers;
