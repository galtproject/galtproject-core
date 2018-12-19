const GaltToken = artifacts.require('./GaltToken.sol');
const GaltGenesis = artifacts.require('./GaltGenesis.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const {
  zeroAddress,
  initHelperWeb3,
  initHelperArtifacts,
  ether,
  szabo,
  deploySplitMerge,
  clearLibCache
} = require('../helpers');

const web3 = new Web3(GaltToken.web3.currentProvider);
initHelperWeb3(web3);
initHelperArtifacts(artifacts);
const { BN } = Web3.utils;

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract.only('GaltGenesis', ([coreTeam, alice, bob, dan, eve]) => {
  before(clearLibCache);

  beforeEach(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.galtGenesis = await GaltGenesis.new(this.galtToken.address, { from: coreTeam });

    await this.galtToken.mint(this.galtGenesis.address, ether(100));
  });

  it('should be started successfully', async function() {
    await this.galtGenesis.start(3600);
    const openingTime = await this.galtGenesis.openingTime();
    const closingTime = await this.galtGenesis.closingTime();
    (closingTime - openingTime).toString(10).should.be.eq('3600');
  });

  // describe('#buyGalt()', async () => {
  //   const ethToSend = parseInt(ether(10), 10);
  //   const shouldEthFee = (ethToSend / 100) * fee;
  //   const galtByFirstExchange = ethToSend * baseExchangeRate;
  //
  //   const galtToSend = ethToSend / 4;
  //   const shouldGaltFee = (galtToSend / 100) * fee;
  //
  //   beforeEach(async function() {
  //     const ethFeeForAmount = await this.galtDex.getEthFeeForAmount(ethToSend, { from: alice });
  //     ethFeeForAmount.toString(10).should.be.eq(shouldEthFee.toString(10));
  //
  //     const galtToReceive = await this.galtDex.getExchangeEthAmountForGalt(ethToSend, { from: alice });
  //     galtToReceive.toString(10).should.be.eq(galtByFirstExchange.toString(10));
  //
  //     await this.galtDex.exchangeEthToGalt({ from: alice, value: ethToSend });
  //   });
  //
  //   it('should be correct balance on buy', async function() {
  //     // this.showGaltDexStatus();
  //
  //     let galtBalance = (await this.galtToken.balanceOf(alice)).toString(10);
  //     galtBalance.should.be.eq(galtByFirstExchange.toString(10));
  //
  //     (await web3.eth.getBalance(this.galtDex.address)).toString(10).should.be.eq(ethToSend.toString(10));
  //
  //     (await this.galtDex.ethToGaltSum()).toString(10).should.be.eq(ethToSend.toString(10));
  //
  //     const shouldReceiveGalt = (await this.shouldReceiveGalt(ethToSend)).toString(10);
  //
  //     await this.galtDex.exchangeEthToGalt({ from: alice, value: ethToSend });
  //
  //     // this.showGaltDexStatus();
  //
  //     galtBalance = (await this.galtToken.balanceOf(alice)).toString(10);
  //     galtBalance.should.be.eq(new BN(galtByFirstExchange.toString(10)).add(new BN(shouldReceiveGalt)).toString(10));
  //
  //     (await web3.eth.getBalance(this.galtDex.address)).toString(10).should.be.eq((ethToSend * 2).toString(10));
  //
  //     (await this.galtDex.ethToGaltSum()).toString(10).should.be.eq((ethToSend * 2).toString(10));
  //   });
  //
  //   it('should exchange back to eth', async function() {
  //     const galtBalance = await this.galtToken.balanceOf(alice);
  //
  //     const aliceBalance = await web3.eth.getBalance(alice);
  //
  //     await this.galtToken.approve(this.galtDex.address, galtToSend, { from: alice });
  //
  //     const allowance = await this.galtToken.allowance(alice, this.galtDex.address);
  //     allowance.toString(10).should.be.eq(galtToSend.toString(10));
  //
  //     const shouldReceiveEth = await this.shouldReceiveEth(galtToSend);
  //
  //     await this.galtDex.exchangeGaltToEth(galtToSend, { from: alice });
  //
  //     const aliceBalanceDiff = (await web3.eth.getBalance(alice)) - aliceBalance;
  //
  //     (shouldReceiveEth - aliceBalanceDiff).should.be.lt(parseInt(ether(0.03), 10));
  //
  //     const galtBalanceAfterExchange = await this.galtToken.balanceOf(alice);
  //
  //     (galtBalance - galtBalanceAfterExchange).toString(10).should.be.eq(galtToSend.toString(10));
  //
  //     (await this.galtDex.galtToEthSum()).toString(10).should.be.eq(galtToSend.toString(10));
  //   });
  //
  //   it('should receive fee', async function() {
  //     await this.galtToken.approve(this.galtDex.address, galtToSend, { from: alice });
  //     await this.galtDex.exchangeGaltToEth(galtToSend, { from: alice });
  //
  //     let ethFeePayout = await this.galtDex.ethFeePayout();
  //     ethFeePayout.toString(10).should.be.eq(shouldEthFee.toString(10));
  //
  //     const coreTeamEthBalance = await web3.eth.getBalance(coreTeam);
  //     await this.galtDex.withdrawEthFee({ from: coreTeam });
  //     const coreTeamEthBalanceProfit = (await web3.eth.getBalance(coreTeam)) - coreTeamEthBalance;
  //
  //     (shouldEthFee - coreTeamEthBalanceProfit).should.be.lt(parseInt(ether(0.003), 10));
  //
  //     ethFeePayout = await this.galtDex.ethFeePayout();
  //     ethFeePayout.toString(10).should.be.eq((0).toString(10));
  //
  //     const totalEthFeePayout = await this.galtDex.ethFeeTotalPayout();
  //     totalEthFeePayout.toString(10).should.be.eq(shouldEthFee.toString(10));
  //
  //     let galtFeePayout = await this.galtDex.galtFeePayout();
  //     galtFeePayout.toString(10).should.be.eq(shouldGaltFee.toString(10));
  //
  //     await this.galtDex.withdrawGaltFee({ from: coreTeam });
  //     const coreTeamGaltBalance = await this.galtToken.balanceOf(coreTeam);
  //
  //     coreTeamGaltBalance.toString(10).should.be.eq(shouldGaltFee.toString(10));
  //
  //     galtFeePayout = await this.galtDex.galtFeePayout();
  //     galtFeePayout.toString(10).should.be.eq((0).toString(10));
  //
  //     const totalGaltFeePayout = await this.galtDex.galtFeeTotalPayout();
  //     totalGaltFeePayout.toString(10).should.be.eq(shouldGaltFee.toString(10));
  //   });
  // });
});
