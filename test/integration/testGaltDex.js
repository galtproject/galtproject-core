const PolygonUtils = artifacts.require('./utils/PolygonUtils.sol');
const LandUtils = artifacts.require('./utils/LandUtils.sol');
const ArrayUtils = artifacts.require('./utils/ArrayUtils.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const GaltDex = artifacts.require('./GaltDex.sol');
const SpaceDex = artifacts.require('./SpaceDex.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const PlotValuation = artifacts.require('./PlotValuation.sol');
const PlotCustodian = artifacts.require('./PlotCustodianManager.sol');
const Validators = artifacts.require('./Validators.sol');
const ValidatorStakes = artifacts.require('./ValidatorStakes.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { zeroAddress, assertGaltBalanceChanged, initHelperWeb3, ether, szabo } = require('../helpers');

const web3 = new Web3(GaltToken.web3.currentProvider);
initHelperWeb3(web3);
const { BN } = Web3.utils;

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('GaltDex', ([coreTeam, multiSigWallet, alice, bob, dan, eve, frank]) => {
  const fee = 15;
  const baseExchangeRate = 1;

  beforeEach(async function() {
    this.arrayUtils = await ArrayUtils.new({ from: coreTeam });
    this.landUtils = await LandUtils.new({ from: coreTeam });
    PolygonUtils.link('LandUtils', this.landUtils.address);
    SplitMerge.link('LandUtils', this.landUtils.address);
    SplitMerge.link('ArrayUtils', this.arrayUtils.address);

    this.polygonUtils = await PolygonUtils.new({ from: coreTeam });
    SplitMerge.link('PolygonUtils', this.polygonUtils.address);

    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });

    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.galtDex = await GaltDex.new({ from: coreTeam });
    this.spaceDex = await SpaceDex.new({ from: coreTeam });
    this.splitMerge = await SplitMerge.new({ from: coreTeam });
    this.validators = await Validators.new({ from: coreTeam });
    this.validatorStakes = await ValidatorStakes.new({ from: coreTeam });
    this.plotValuation = await PlotValuation.new({ from: coreTeam });
    this.plotCustodian = await PlotCustodian.new({ from: coreTeam });

    this.galtDex.initialize(szabo(baseExchangeRate), szabo(fee), szabo(fee), this.galtToken.address, {
      from: coreTeam
    });

    this.spaceDex.initialize(
      this.galtToken.address,
      this.spaceToken.address,
      this.plotValuation.address,
      this.plotCustodian.address,
      {
        from: coreTeam
      }
    );

    await this.spaceDex.addRoleTo(coreTeam, 'fee_manager');
    await this.spaceDex.setFee(szabo(fee), '0');
    await this.spaceDex.setFee(szabo(fee), '1');

    await this.spaceToken.addRoleTo(coreTeam, 'minter');

    await this.galtDex.addRoleTo(coreTeam, 'fee_manager');
    await this.galtDex.setSpaceDex(this.spaceDex.address);

    await this.galtToken.mint(this.galtDex.address, ether(100));
    await this.galtToken.mint(frank, ether(100000));

    await this.plotValuation.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.validators.address,
      this.galtToken.address,
      coreTeam,
      {
        from: coreTeam
      }
    );

    await this.plotCustodian.initialize(
      this.spaceToken.address,
      this.splitMerge.address,
      this.validators.address,
      this.galtToken.address,
      zeroAddress,
      coreTeam,
      {
        from: coreTeam
      }
    );
    await this.validatorStakes.initialize(this.validators.address, this.galtToken.address, multiSigWallet, {
      from: coreTeam
    });

    await this.validators.addRoleTo(coreTeam, await this.validators.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(coreTeam, await this.validators.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(this.validatorStakes.address, await this.validators.ROLE_VALIDATOR_STAKES(), {
      from: coreTeam
    });
    const PV_APPRAISER_ROLE = await this.plotValuation.PV_APPRAISER_ROLE.call();
    const PV_APPRAISER2_ROLE = await this.plotValuation.PV_APPRAISER2_ROLE.call();
    const PV_AUDITOR_ROLE = await this.plotValuation.PV_AUDITOR_ROLE.call();

    await this.validators.setApplicationTypeRoles(
      await this.plotValuation.APPLICATION_TYPE(),
      [PV_APPRAISER_ROLE, PV_APPRAISER2_ROLE, PV_AUDITOR_ROLE],
      [50, 25, 25],
      ['', '', ''],
      { from: coreTeam }
    );

    const PC_CUSTODIAN_ROLE = await this.plotCustodian.PC_CUSTODIAN_ROLE.call();
    const PC_AUDITOR_ROLE = await this.plotCustodian.PC_AUDITOR_ROLE.call();

    await this.validators.setApplicationTypeRoles(
      await this.plotCustodian.APPLICATION_TYPE(),
      [PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE],
      [60, 40],
      ['', ''],
      { from: coreTeam }
    );

    await this.validators.setRoleMinimalDeposit(PV_APPRAISER_ROLE, ether(30), { from: coreTeam });
    await this.validators.setRoleMinimalDeposit(PV_APPRAISER2_ROLE, ether(30), { from: coreTeam });
    await this.validators.setRoleMinimalDeposit(PV_AUDITOR_ROLE, ether(30), { from: coreTeam });
    await this.validators.setRoleMinimalDeposit(PC_CUSTODIAN_ROLE, ether(30), { from: coreTeam });
    await this.validators.setRoleMinimalDeposit(PC_AUDITOR_ROLE, ether(30), { from: coreTeam });

    await this.validators.addValidator(bob, 'Bob', 'MN', [], [PV_APPRAISER_ROLE, PC_CUSTODIAN_ROLE], {
      from: coreTeam
    });
    await this.validators.addValidator(dan, 'Dan', 'MN', [], [PV_APPRAISER2_ROLE, PC_AUDITOR_ROLE], {
      from: coreTeam
    });
    await this.validators.addValidator(eve, 'Eve', 'MN', [], [PV_AUDITOR_ROLE], {
      from: coreTeam
    });

    await this.galtToken.approve(this.validatorStakes.address, ether(1500), { from: frank });
    await this.validatorStakes.stake(bob, PV_APPRAISER_ROLE, ether(30), { from: frank });
    await this.validatorStakes.stake(bob, PC_CUSTODIAN_ROLE, ether(30), { from: frank });
    await this.validatorStakes.stake(dan, PV_APPRAISER2_ROLE, ether(30), { from: frank });
    await this.validatorStakes.stake(dan, PC_AUDITOR_ROLE, ether(30), { from: frank });
    await this.validatorStakes.stake(eve, PV_AUDITOR_ROLE, ether(30), { from: frank });
    this.galtTokenWeb3 = new web3.eth.Contract(this.galtToken.abi, this.galtToken.address);

    // TODO: move to helper
    this.showGaltDexStatus = async function() {
      const totalSupply = (await this.galtToken.totalSupply()) / 10 ** 18;
      const galtBalanceOfGaltDex = (await this.galtToken.balanceOf(this.galtDex.address)) / 10 ** 18;
      const galtBalanceOfSpaceDex = (await this.galtToken.balanceOf(this.spaceDex.address)) / 10 ** 18;
      const spacePriceOnSaleSum = (await this.spaceDex.spacePriceOnSaleSum()) / 10 ** 18;
      const totalSupplyMinusGaltBalance = totalSupply - galtBalanceOfGaltDex;
      const ethBalanceOfGaltDex = (await web3.eth.getBalance(this.galtDex.address)) / 10 ** 18;
      const exchangeRate = (await this.galtDex.exchangeRate('0')) / 10 ** 12;

      console.log(
        'totalSupply',
        totalSupply.toString(10),
        'galtBalanceOfGaltDex',
        galtBalanceOfGaltDex.toString(10),
        'totalSupplyMinusGaltBalance',
        totalSupplyMinusGaltBalance.toString(10),
        'ethBalanceOfGaltDex',
        ethBalanceOfGaltDex.toString(10),
        'exchangeRate',
        exchangeRate.toString(10)
      );
      console.log(
        'galtBalanceOfSpaceDex',
        galtBalanceOfSpaceDex.toString(10),
        'spacePriceOnSaleSum',
        spacePriceOnSaleSum.toString(10)
      );
    };

    this.showGaltDexStatus.bind(this);

    this.shouldReceiveGalt = async function(ethToSend) {
      const exchangeRate = await this.galtDex.exchangeRate(0);
      return (ethToSend * exchangeRate) / szabo(1);
    };
    this.shouldReceiveEth = async function(galtToSend) {
      const exchangeRate = await this.galtDex.exchangeRate(0);
      return galtToSend / exchangeRate / szabo(1);
    };

    // TODO: move to helper
    this.valuatePlot = async (tokenId, price) => {
      const res = await this.plotValuation.submitApplication(tokenId, [''], 0, {
        from: alice,
        value: ether(1)
      });
      const aId = res.logs[0].args.id;
      await this.plotValuation.lockApplication(aId, PV_APPRAISER_ROLE, { from: bob });
      await this.plotValuation.lockApplication(aId, PV_APPRAISER2_ROLE, { from: dan });
      await this.plotValuation.valuatePlot(aId, price, { from: bob });
      await this.plotValuation.valuatePlot2(aId, price, { from: dan });

      await this.plotValuation.lockApplication(aId, PV_AUDITOR_ROLE, { from: eve });
      await this.plotValuation.approveValuation(aId, { from: eve });
    };

    // TODO: move to helper
    this.setCustodianForPlot = async (tokenId, custodian) => {
      const auditor = dan;
      const tokenOwner = alice;

      const Action = {
        ATTACH: 0,
        DETACH: 1
      };

      const res = await this.plotCustodian.submitApplication(tokenId, Action.ATTACH, custodian, 0, {
        from: tokenOwner,
        value: ether(1)
      });

      const aId = res.logs[0].args.id;
      await this.plotCustodian.lockApplication(aId, { from: auditor });
      await this.plotCustodian.acceptApplication(aId, { from: custodian });
      await this.spaceToken.approve(this.plotCustodian.address, tokenId, { from: tokenOwner });
      await this.plotCustodian.attachToken(aId, {
        from: alice
      });
      await this.plotCustodian.approveApplication(aId, { from: auditor });
      await this.plotCustodian.approveApplication(aId, { from: tokenOwner });
      await this.plotCustodian.approveApplication(aId, { from: custodian });
      await this.plotCustodian.withdrawToken(aId, { from: tokenOwner });
    };
  });

  it('should be initialized successfully', async function() {
    (await this.galtDex.baseExchangeRate()).toString(10).should.be.eq(szabo(baseExchangeRate).toString(10));
    (await this.galtDex.galtFee()).toString(10).should.be.eq(szabo(fee).toString(10));
    (await this.galtDex.ethFee()).toString(10).should.be.eq(szabo(fee).toString(10));
  });

  describe.skip('#buyGalt()', async () => {
    const ethToSend = parseInt(ether(10), 10);
    const shouldEthFee = (ethToSend / 100) * fee;
    const galtByFirstExchange = ethToSend * baseExchangeRate;

    const galtToSend = ethToSend / 4;
    const shouldGaltFee = (galtToSend / 100) * fee;

    beforeEach(async function() {
      const ethFeeForAmount = await this.galtDex.getEthFeeForAmount(ethToSend, { from: alice });
      ethFeeForAmount.toString(10).should.be.eq(shouldEthFee.toString(10));

      const galtToReceive = await this.galtDex.getExchangeEthAmountForGalt(ethToSend, { from: alice });
      galtToReceive.toString(10).should.be.eq(galtByFirstExchange.toString(10));

      await this.galtDex.exchangeEthToGalt({ from: alice, value: ethToSend });
    });

    it('should be correct balance on buy', async function() {
      // this.showGaltDexStatus();

      let galtBalance = (await this.galtToken.balanceOf(alice)).toString(10);
      galtBalance.should.be.eq(galtByFirstExchange.toString(10));

      (await web3.eth.getBalance(this.galtDex.address)).toString(10).should.be.eq(ethToSend.toString(10));

      (await this.galtDex.ethToGaltSum()).toString(10).should.be.eq(ethToSend.toString(10));

      const shouldReceiveGalt = (await this.shouldReceiveGalt(ethToSend)).toString(10);

      await this.galtDex.exchangeEthToGalt({ from: alice, value: ethToSend });

      // this.showGaltDexStatus();

      galtBalance = (await this.galtToken.balanceOf(alice)).toString(10);
      galtBalance.should.be.eq(new BN(galtByFirstExchange.toString(10)).add(new BN(shouldReceiveGalt)).toString(10));

      (await web3.eth.getBalance(this.galtDex.address)).toString(10).should.be.eq((ethToSend * 2).toString(10));

      (await this.galtDex.ethToGaltSum()).toString(10).should.be.eq((ethToSend * 2).toString(10));
    });

    it('should exchange back to eth', async function() {
      const galtBalance = await this.galtToken.balanceOf(alice);

      const aliceBalance = await web3.eth.getBalance(alice);

      await this.galtToken.approve(this.galtDex.address, galtToSend, { from: alice });

      const allowance = await this.galtToken.allowance(alice, this.galtDex.address);
      allowance.toString(10).should.be.eq(galtToSend.toString(10));

      const shouldReceiveEth = await this.shouldReceiveEth(galtToSend);

      await this.galtDex.exchangeGaltToEth(galtToSend, { from: alice });

      const aliceBalanceDiff = (await web3.eth.getBalance(alice)) - aliceBalance;

      (shouldReceiveEth - aliceBalanceDiff).should.be.lt(parseInt(ether(0.03), 10));

      const galtBalanceAfterExchange = await this.galtToken.balanceOf(alice);

      (galtBalance - galtBalanceAfterExchange).toString(10).should.be.eq(galtToSend.toString(10));

      (await this.galtDex.galtToEthSum()).toString(10).should.be.eq(galtToSend.toString(10));
    });

    it('should receive fee', async function() {
      await this.galtToken.approve(this.galtDex.address, galtToSend, { from: alice });
      await this.galtDex.exchangeGaltToEth(galtToSend, { from: alice });

      let ethFeePayout = await this.galtDex.ethFeePayout();
      ethFeePayout.toString(10).should.be.eq(shouldEthFee.toString(10));

      const coreTeamEthBalance = await web3.eth.getBalance(coreTeam);
      await this.galtDex.withdrawEthFee({ from: coreTeam });
      const coreTeamEthBalanceProfit = (await web3.eth.getBalance(coreTeam)) - coreTeamEthBalance;

      (shouldEthFee - coreTeamEthBalanceProfit).should.be.lt(parseInt(ether(0.003), 10));

      ethFeePayout = await this.galtDex.ethFeePayout();
      ethFeePayout.toString(10).should.be.eq((0).toString(10));

      const totalEthFeePayout = await this.galtDex.ethFeeTotalPayout();
      totalEthFeePayout.toString(10).should.be.eq(shouldEthFee.toString(10));

      let galtFeePayout = await this.galtDex.galtFeePayout();
      galtFeePayout.toString(10).should.be.eq(shouldGaltFee.toString(10));

      await this.galtDex.withdrawGaltFee({ from: coreTeam });
      const coreTeamGaltBalance = await this.galtToken.balanceOf(coreTeam);

      coreTeamGaltBalance.toString(10).should.be.eq(shouldGaltFee.toString(10));

      galtFeePayout = await this.galtDex.galtFeePayout();
      galtFeePayout.toString(10).should.be.eq((0).toString(10));

      const totalGaltFeePayout = await this.galtDex.galtFeeTotalPayout();
      totalGaltFeePayout.toString(10).should.be.eq(shouldGaltFee.toString(10));
    });
  });

  describe('spaceDex dependency', async () => {
    it('should be correct exchangeRate after exchange on spaceDex', async function() {
      const galtDexEchangeRateBefore = await this.galtDex.exchangeRate('0');

      await this.galtToken.mint(this.spaceDex.address, ether(100));

      await this.spaceToken.mint(alice, {
        from: coreTeam
      });

      const geohashTokenId = '0x0000000000000000000000000000000000000000000000000000000000000000';

      await this.valuatePlot(geohashTokenId, ether(5));
      await this.setCustodianForPlot(geohashTokenId, bob);
      await this.spaceToken.approve(this.spaceDex.address, geohashTokenId, {
        from: alice
      });

      const aliceBalanceBefore = await this.galtTokenWeb3.methods.balanceOf(alice).call();

      const geohashPrice = await this.spaceDex.getSpaceTokenActualPriceWithFee(geohashTokenId);
      await this.spaceDex.exchangeSpaceToGalt(geohashTokenId, {
        from: alice
      });

      const aliceBalanceAfter = await this.galtTokenWeb3.methods.balanceOf(alice).call();
      assertGaltBalanceChanged(aliceBalanceBefore, aliceBalanceAfter, geohashPrice.toString(10));

      const galtDexEchangeRateAfter = await this.galtDex.exchangeRate('0');
      assert.equal(galtDexEchangeRateBefore.toString(10), galtDexEchangeRateAfter.toString(10));
    });
  });
});
