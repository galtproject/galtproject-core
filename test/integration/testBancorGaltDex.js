const GaltToken = artifacts.require('./GaltToken.sol');
const BancorGaltDex = artifacts.require('./BancorGaltDex.sol');
const SmartToken = artifacts.require('bancor-contracts/solidity/contracts/token/SmartToken.sol');
const ContractRegistry = artifacts.require('bancor-contracts/solidity/contracts/utility/ContractRegistry.sol');
const ContractIds = artifacts.require('bancor-contracts/solidity/contracts/ContractIds.sol');
const ContractFeatures = artifacts.require('bancor-contracts/solidity/contracts/utility/ContractFeatures.sol');
const BancorGasPriceLimit = artifacts.require('bancor-contracts/solidity/contracts/converter/BancorGasPriceLimit.sol');
const BancorFormula = artifacts.require('bancor-contracts/solidity/contracts/converter/BancorFormula.sol');
const BancorNetwork = artifacts.require('bancor-contracts/solidity/contracts/BancorNetwork.sol');
const BancorConverterFactory = artifacts.require(
  'bancor-contracts/solidity/contracts/converter/BancorConverterFactory.sol'
);
const BancorConverterUpgrader = artifacts.require(
  'bancor-contracts/solidity/contracts/converter/BancorConverterUpgrader.sol'
);
const EtherToken = artifacts.require('bancor-contracts/solidity/contracts/token/EtherToken.sol');
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

contract.only('GaltDex', ([coreTeam, alice, bob, dan, eve]) => {
  before(clearLibCache);

  beforeEach(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.galtDexToken = await SmartToken.new('GaltDex Token', 'GDT', '18', { from: coreTeam });
    this.galtDexRegistry = await ContractRegistry.new({ from: coreTeam });
    this.contractIds = await ContractIds.new({ from: coreTeam });
    this.contractFeatures = await ContractFeatures.new({ from: coreTeam });
    this.gasPriceLimit = await BancorGasPriceLimit.new('22000000000', { from: coreTeam });
    this.formula = await BancorFormula.new({ from: coreTeam });
    this.bancorNetwork = await BancorNetwork.new(this.galtDexRegistry.address, { from: coreTeam });
    this.factory = await BancorConverterFactory.new({ from: coreTeam });
    this.upgrader = await BancorConverterUpgrader.new(this.galtDexRegistry.address, { from: coreTeam });

    this.bancorGaltDex = await BancorGaltDex.new(
      this.galtDexToken.address,
      this.galtDexRegistry.address,
      '1000000',
      this.galtToken.address,
      '100',
      { from: coreTeam }
    );

    await this.galtDexRegistry.registerAddress(
      await this.contractIds.CONTRACT_FEATURES.call(),
      this.contractFeatures.address
    );

    await this.galtDexRegistry.registerAddress(
      await this.contractIds.BANCOR_GAS_PRICE_LIMIT.call(),
      this.gasPriceLimit.address
    );

    await this.galtDexRegistry.registerAddress(await this.contractIds.BANCOR_FORMULA.call(), this.formula.address);

    await this.galtDexRegistry.registerAddress(
      await this.contractIds.BANCOR_NETWORK.call(),
      this.bancorNetwork.address
    );
    await this.bancorNetwork.setSignerAddress(coreTeam);

    await this.galtDexRegistry.registerAddress(
      await this.contractIds.BANCOR_CONVERTER_FACTORY.call(),
      this.factory.address
    );

    await this.galtDexRegistry.registerAddress(
      await this.contractIds.BANCOR_CONVERTER_UPGRADER.call(),
      this.upgrader.address
    );

    await this.galtDexRegistry.registerAddress(await this.contractIds.BANCOR_X.call(), coreTeam);

    this.etherToken = await EtherToken.new({ from: coreTeam });

    await this.bancorGaltDex.addConnector(this.etherToken.address, '1', false);

    await this.etherToken.deposit({ from: coreTeam, value: ether(100000) });
    await this.etherToken.transfer(this.bancorGaltDex.address, ether(100000), { from: coreTeam });

    await this.galtToken.mint(this.bancorGaltDex.address, ether(1000));

    await this.galtDexToken.issue(coreTeam, ether(100000000));

    await this.galtDexToken.transferOwnership(this.bancorGaltDex.address);
    await this.bancorGaltDex.acceptTokenOwnership();
  });

  it('should be initialized successfully', async function() {
    (await this.bancorGaltDex.registry()).should.be.eq(this.galtDexRegistry.address);
  });

  describe('#buyGalt()', async () => {
    it('should be correct balance on buy', async function() {
      await this.etherToken.deposit({ from: alice, value: ether(10) });

      await this.etherToken.approve(this.bancorGaltDex.address, ether(10), { from: alice });
        
      await this.bancorGaltDex.convert(this.etherToken.address, this.galtToken.address, ether(5), '1');
    });
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
