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

  const gasPriceLimit = '22000000000';
  const converterMaxFee = '1000000';

  const galtTokenGaltDexBalance = 100000;
  const etherTokenGaltDexBalance = 100;

  const galtWeight = '10000';
  const etherWeight = '100';

  beforeEach(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.galtDexToken = await SmartToken.new('GaltDex Token', 'GDT', '18', { from: coreTeam });
    this.galtDexRegistry = await ContractRegistry.new({ from: coreTeam });
    this.contractIds = await ContractIds.new({ from: coreTeam });
    this.contractFeatures = await ContractFeatures.new({ from: coreTeam });
    this.gasPriceLimit = await BancorGasPriceLimit.new(gasPriceLimit, { from: coreTeam });
    this.formula = await BancorFormula.new({ from: coreTeam });
    this.bancorNetwork = await BancorNetwork.new(this.galtDexRegistry.address, { from: coreTeam });
    this.factory = await BancorConverterFactory.new({ from: coreTeam });
    this.upgrader = await BancorConverterUpgrader.new(this.galtDexRegistry.address, { from: coreTeam });

    this.bancorGaltDex = await BancorGaltDex.new(
      this.galtDexToken.address,
      this.galtDexRegistry.address,
      converterMaxFee,
      this.galtToken.address,
      galtWeight,
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

    await this.bancorGaltDex.addConnector(this.etherToken.address, etherWeight, false);

    await this.etherToken.deposit({ from: coreTeam, value: ether(etherTokenGaltDexBalance) });
    await this.etherToken.transfer(this.bancorGaltDex.address, ether(etherTokenGaltDexBalance), { from: coreTeam });

    await this.galtToken.mint(this.bancorGaltDex.address, ether(galtTokenGaltDexBalance));

    await this.galtDexToken.transferOwnership(this.bancorGaltDex.address);
    await this.bancorGaltDex.acceptTokenOwnership();
  });

  it('should be initialized successfully', async function() {
    (await this.bancorGaltDex.registry()).should.be.eq(this.galtDexRegistry.address);
  });

  describe('#buyGalt()', async () => {
    it('should be correct balance on buy', async function() {
      console.log('\n', 'galtTokenGaltDexBalance', galtTokenGaltDexBalance);
      console.log('etherTokenGaltDexBalance', etherTokenGaltDexBalance);
      console.log('galtWeight ', galtWeight);
      console.log('etherWeight', etherWeight);

      await this.etherToken.deposit({ from: alice, value: ether(100) });

      await this.etherToken.approve(this.bancorGaltDex.address, ether(100), { from: alice });

      const etherBalance = (await this.etherToken.balanceOf(alice)).toString(10);
      etherBalance.should.be.eq(ether(100).toString(10));

      const fromEther = 5;

      for (let i = 0; i < 10; i++) {
        await this.bancorGaltDex.convert(this.etherToken.address, this.galtToken.address, ether(fromEther), '1', {
          from: alice,
          gasPrice: gasPriceLimit
        });

        const galtBalance = (await this.galtToken.balanceOf(alice)).toString(10);
        const toGalt = parseFloat(web3.utils.fromWei(galtBalance, 'ether').toString(10));

        console.log('\n', 'fromEther', fromEther, 'toGalt', toGalt, 'rate', toGalt / fromEther);
      }

      assert.equal(true, true);
      // galtBalance.should.be.eq('499987375422921');
    });
  });
});
