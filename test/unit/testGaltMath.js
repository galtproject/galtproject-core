const GaltMath = artifacts.require('./GaltMath.sol');
const Web3 = require('web3');
const chai = require('chai');
const _ = require('lodash');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, initHelperArtifacts, ether, assertRevert, clearLibCache } = require('../helpers');

const web3 = new Web3(GaltMath.web3.currentProvider);
initHelperWeb3(web3);
initHelperArtifacts(artifacts);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract.only('GaltMath', ([coreTeam]) => {
  before(clearLibCache);

  const txBaseGas = 21000;

  beforeEach(async function() {
    this.galtMath = await GaltMath.new({ from: coreTeam });
  });

  const funcErrors = {
    sin: 0.000000000001,
    cos: 0.000000000001,
    tan: 0.000000000001,
    atan: 0.00000001,
    atan2: 0.0000000001,
    atanh: 0.0000000001,
    cosh: 0.0000000001,
    sinh: 0.0000000001,
    sqrt: 0.000000001,
    exp: 0.000000001,
    log: 0.00000000001,
    log2: 0.00000000001,
    log10: 0.00000000001
  };
  _.forEach(funcErrors, (funcError, funcName) => {
    if (_.includes(['atan2', 'atanh', 'sinh', 'cosh'], funcName)) {
      // need to check as exception
      return;
    }
    let inputs;

    if (_.includes(['sqrt', 'exp', 'log', 'log2', 'log10'], funcName)) {
      // regular math functions
      inputs = [1.2291728239506483]; // , 104.51007032766938
    } else {
      // trigonometry functions
      inputs = [
        -360,
        -353.25640983302395,
        -295.8468666647008,
        -270,
        -255.66048229791718,
        -180,
        -125.7200201845722,
        -90,
        -49.34383799818403,
        -45,
        -23.671655618420573,
        0,
        0.629251144823229,
        14.393778717133728,
        40.363743810009,
        45,
        71.2332318923772,
        90,
        94.79435139029357,
        173.36734672061414,
        180,
        200.76726108424293,
        270,
        287.4700270792159,
        328.9057124460045,
        360
      ];

      inputs = inputs.map(degree => (degree * Math.PI) / 180);
    }

    inputs.forEach(input => {
      it(`should calculate ${funcName} of ${input} correctly`, async function() {
        await checkMethodCallResult.bind(this)(funcName, [input], Math[funcName](input), funcError);
      });
    });
  });

  async function checkMethodCallResult(methodName, etherArgs, expectedResult, maxError) {
    const weiArgs = etherArgs.map(arg => Web3.utils.toWei(arg.toString(), 'ether'));

    let res = await this.galtMath[methodName].apply(this.galtMath[methodName], weiArgs);
    const gasUsedOnFirstCall = res.receipt.gasUsed - txBaseGas;

    const firstFuncRes = convertResultToFloat(res);
    console.log(methodName, 'sol', firstFuncRes);
    console.log(methodName, 'js ', expectedResult);
    console.log(methodName, 'diff', Math.abs(firstFuncRes - expectedResult));

    assert.isBelow(Math.abs(firstFuncRes - expectedResult), maxError);

    res = await this.galtMath[methodName].apply(this.galtMath[methodName], weiArgs);
    const gasUsedOnSecondCall = res.receipt.gasUsed - txBaseGas;
    const secondFuncRes = convertResultToFloat(res);

    assert.equal(firstFuncRes, secondFuncRes);

    if (etherArgs[0] !== 0) {
      const gasEconomyMultiplier = gasUsedOnFirstCall / gasUsedOnSecondCall;
      assert.isAbove(gasEconomyMultiplier, 5);
    }
  }
});

function convertResultToFloat(res) {
  return parseInt(res.logs[0].args.result.toString(10), 10) / 10 ** 18;
}
