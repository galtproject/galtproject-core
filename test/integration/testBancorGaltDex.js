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
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, initHelperArtifacts, ether, szabo, clearLibCache } = require('../helpers');

const web3 = new Web3(GaltToken.web3.currentProvider);
initHelperWeb3(web3);
initHelperArtifacts(artifacts);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('BancorGaltDex', ([coreTeam, alice, feeFund]) => {
  before(clearLibCache);

  const gasPriceLimit = '22000000000';
  const converterMaxFee = '1000000';

  const galtTokenGaltDexBalance = 500000;
  const etherTokenGaltDexBalance = 100000;

  const galtWeight = '1';
  const etherWeight = '2';

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

    await this.galtDexToken.transferOwnership(this.bancorGaltDex.address);
    await this.bancorGaltDex.acceptTokenOwnership();
  });

  it('should be initialized successfully', async function() {
    (await this.bancorGaltDex.registry()).should.be.eq(this.galtDexRegistry.address);
  });

  describe('custom ETH and GALT mint', async () => {
    beforeEach(async function() {
      await this.etherToken.deposit({ from: coreTeam, value: ether(etherTokenGaltDexBalance) });
      await this.etherToken.transfer(this.bancorGaltDex.address, ether(etherTokenGaltDexBalance), { from: coreTeam });

      await this.galtToken.mint(this.bancorGaltDex.address, ether(galtTokenGaltDexBalance));
    });

    describe('#convert()', async () => {
      it('should be change the rate on buy', async function() {
        await this.etherToken.deposit({ from: alice, value: ether(100) });

        await this.etherToken.approve(this.bancorGaltDex.address, ether(100), { from: alice });

        const etherBalance = (await this.etherToken.balanceOf(alice)).toString(10);
        etherBalance.should.be.eq(ether(100).toString(10));

        const etherToExchange = 1;

        let lastRate;
        for (let i = 0; i < 20; i++) {
          // eslint-disable-next-line
                  const res = await this.bancorGaltDex.convert(
            this.etherToken.address,
            this.galtToken.address,
            ether(etherToExchange),
            '1',
            {
              from: alice,
              gasPrice: gasPriceLimit
            }
          );

          // eslint-disable-next-line
                  const fromEther = web3.utils.fromWei(res.logs[0].args._amount.toString(10), 'ether');
          // eslint-disable-next-line
                  const toGalt = web3.utils.fromWei(res.logs[0].args._return.toString(10), 'ether');

          const rate = toGalt / fromEther;
          if (i > 0) {
            assert.isBelow(rate, lastRate);
          }
          // console.log('fromEther', fromEther, 'toGalt', toGalt, 'rate', rate, 'rateDiff', lastRate - rate);
          lastRate = rate;
        }
      });
    });

    describe('#claimFeeToFund()', async () => {
      it('should be fee taken', async function() {
        await this.bancorGaltDex.setConversionFee('1000'); // 0.2%
        await this.bancorGaltDex.setFeeFund(feeFund);

        await this.etherToken.deposit({ from: alice, value: ether(100) });
        await this.etherToken.approve(this.bancorGaltDex.address, ether(100), { from: alice });

        const res = await this.bancorGaltDex.convert(this.etherToken.address, this.galtToken.address, ether(1), '1', {
          from: alice,
          gasPrice: gasPriceLimit
        });
        // eslint-disable-next-line
              const feeTaken = res.logs[0].args._conversionFee.toFixed();
        assert.isAbove(parseInt(feeTaken, 10), 0);

        await this.bancorGaltDex.claimFeeToFund(this.galtToken.address);

        assert.equal((await this.galtToken.balanceOf(feeFund)).toFixed(), feeTaken);
      });
    });
  });

  describe('GaltGenesis then GaltDex', async () => {
    beforeEach(async function() {
      const galtTotalSupply = 60 * 10 ** 6;
      this.galtGenesis = await MockGaltGenesis.new(this.galtToken.address, this.galtDex.address, { from: coreTeam });

      await this.galtToken.mint(this.galtGenesis.address, ether(galtTotalSupply * 0.05));
      await this.galtToken.mint(this.bancorGaltDex.address, ether(galtTotalSupply * 0.75));
      await this.galtToken.mint(coreTeam, ether(galtTotalSupply * 0.2));

      await this.galtGenesis.start(3600);

      await this.etherToken.deposit({ from: coreTeam, value: ether(etherTokenGaltDexBalance) });
      await this.etherToken.transfer(this.bancorGaltDex.address, ether(etherTokenGaltDexBalance), { from: coreTeam });
    });

    it('should be correct continue with supply of ETH and GALT from GaltGenesis', async () => {});
  });
});
