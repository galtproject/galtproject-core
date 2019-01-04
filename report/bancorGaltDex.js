const GaltToken = artifacts.require('./GaltToken.sol');
const MockGaltGenesis = artifacts.require('./MockGaltGenesis.sol');
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

const fs = require('fs');
const Web3 = require('web3');
const { initHelperWeb3, initHelperArtifacts, weiToEtherRound, ether, roundToPrecision } = require('../test/helpers');

const web3 = new Web3(GaltToken.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

module.exports = async function(callback) {
  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];

  const gasPriceLimitValue = '22000000000';
  const converterMaxFee = '1000000';

  const galtWeight = '1';
  const etherWeight = '3';

  const galtTotalSupply = 60 * 10 ** 6;
  const ethSpentOnGaltGenesis = 10 * 10 ** 3;

  const ethToConvert = 500;
  const iterations = 200;

  const galtToken = await GaltToken.new({ from: coreTeam });

  const etherToken = await EtherToken.new();

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
    converterMaxFee,
    galtToken.address,
    galtWeight
  );

  await galtDexRegistry.registerAddress(await contractIds.CONTRACT_FEATURES.call(), contractFeatures.address);

  await galtDexRegistry.registerAddress(await contractIds.BANCOR_GAS_PRICE_LIMIT.call(), gasPriceLimit.address);

  await galtDexRegistry.registerAddress(await contractIds.BANCOR_FORMULA.call(), formula.address);

  await galtDexRegistry.registerAddress(await contractIds.BANCOR_NETWORK.call(), bancorNetwork.address);
  await bancorNetwork.setSignerAddress(coreTeam);

  await galtDexRegistry.registerAddress(await contractIds.BANCOR_CONVERTER_FACTORY.call(), factory.address);

  await galtDexRegistry.registerAddress(await contractIds.BANCOR_CONVERTER_UPGRADER.call(), upgrader.address);

  await galtDexRegistry.registerAddress(await contractIds.BANCOR_X.call(), coreTeam);

  await bancorGaltDex.addConnector(etherToken.address, etherWeight, false);

  await galtDexToken.transferOwnership(bancorGaltDex.address);
  await bancorGaltDex.acceptTokenOwnership();

  // prepare tokens for GaltDex

  const galtGenesis = await MockGaltGenesis.new(galtToken.address, bancorGaltDex.address, etherToken.address);

  await galtToken.mint(galtGenesis.address, ether(galtTotalSupply * 0.05));
  await galtToken.mint(bancorGaltDex.address, ether(galtTotalSupply * 0.75));
  await galtToken.mint(coreTeam, ether(galtTotalSupply * 0.2));

  await galtGenesis.start(3600);
  await galtGenesis.pay({ from: coreTeam, value: ether(ethSpentOnGaltGenesis) });
  await galtGenesis.hackClose();
  await galtGenesis.finish({ from: coreTeam });

  const galtDexGalt = weiToEtherRound(await galtToken.balanceOf(bancorGaltDex.address));
  const galtDexEth = weiToEtherRound(await etherToken.balanceOf(bancorGaltDex.address));

  let csv = '';
  csv += `galtDex GALT balance,${galtDexGalt},,\n`;
  csv += `galtDex ETH balance,${galtDexEth},,\n`;
  csv += ',,,\n';
  csv += `galtWeight,${galtWeight},,\n`;
  csv += `etherWeight,${etherWeight},,\n`;
  csv += ',,,\n';
  csv += 'ethSpent,galtReceived,galtPerEth,restGalt\n';

  await etherToken.deposit({ from: coreTeam, value: ether(ethToConvert * iterations) });
  await etherToken.approve(bancorGaltDex.address, ether(ethToConvert * iterations), { from: coreTeam });

  for (let i = 0; i < iterations; i++) {
    // eslint-disable-next-line
    const res = await bancorGaltDex.convert(etherToken.address, galtToken.address, ether(ethToConvert), '1', {
      from: coreTeam,
      gasPrice: gasPriceLimitValue
    });
    // eslint-disable-next-line
    const galtReceived = weiToEtherRound(res.logs[0].args._return);
    // eslint-disable-next-line
    const restGalt = weiToEtherRound(await galtToken.balanceOf(bancorGaltDex.address));
    const galtPerEth = roundToPrecision(galtReceived / ethToConvert);

    csv += `${ethToConvert},${galtReceived},${galtPerEth},${restGalt}\n`;
    console.log(`${ethToConvert},${galtReceived},${galtPerEth},${restGalt}`);
  }

  fs.writeFile(`${__dirname}/bancorGaltDex.csv`, csv, callback);

  // Helpers

  // Helpers end
};
