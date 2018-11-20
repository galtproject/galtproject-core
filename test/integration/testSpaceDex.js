const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltDex = artifacts.require('./GaltDex.sol');
const SpaceDex = artifacts.require('./SpaceDex.sol');
const PlotValuation = artifacts.require('./PlotValuation.sol');
const PlotCustodian = artifacts.require('./PlotCustodianManager.sol');
const Validators = artifacts.require('./Validators.sol');

const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { zeroAddress, initHelperWeb3, ether, szabo, initHelperArtifacts, deploySplitMerge } = require('../helpers');

const { BN } = Web3.utils;

const web3 = new Web3(GaltToken.web3.currentProvider);
initHelperWeb3(web3);
initHelperArtifacts(artifacts);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SpaceDex', ([coreTeam, stakeManager, alice, bob, dan, eve]) => {
  const feePercent = 5;
  const plotPriceGalt = 150;

  beforeEach(async function() {
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.galtDex = await GaltDex.new({ from: coreTeam });

    this.splitMerge = await deploySplitMerge();
    this.validators = await Validators.new({ from: coreTeam });
    this.spaceDex = await SpaceDex.new({ from: coreTeam });
    this.plotValuation = await PlotValuation.new({ from: coreTeam });
    this.plotCustodian = await PlotCustodian.new({ from: coreTeam });

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

    await this.validators.addRoleTo(coreTeam, await this.validators.ROLE_APPLICATION_TYPE_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(coreTeam, await this.validators.ROLE_VALIDATOR_MANAGER(), {
      from: coreTeam
    });
    await this.validators.addRoleTo(stakeManager, await this.validators.ROLE_VALIDATOR_STAKES(), {
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

    await this.validators.addValidator(bob, 'Bob', 'MN', [], [PV_APPRAISER_ROLE, PC_CUSTODIAN_ROLE], {
      from: coreTeam
    });
    await this.validators.addValidator(dan, 'Dan', 'MN', [], [PV_APPRAISER2_ROLE, PC_AUDITOR_ROLE], {
      from: coreTeam
    });
    await this.validators.addValidator(eve, 'Eve', 'MN', [], [PV_AUDITOR_ROLE], {
      from: coreTeam
    });

    await this.validators.setRoleMinimalDeposit(PV_APPRAISER_ROLE, ether(30), { from: coreTeam });
    await this.validators.setRoleMinimalDeposit(PV_APPRAISER2_ROLE, ether(30), { from: coreTeam });
    await this.validators.setRoleMinimalDeposit(PV_AUDITOR_ROLE, ether(30), { from: coreTeam });
    await this.validators.setRoleMinimalDeposit(PC_CUSTODIAN_ROLE, ether(30), { from: coreTeam });
    await this.validators.setRoleMinimalDeposit(PC_AUDITOR_ROLE, ether(30), { from: coreTeam });

    await this.validators.onStakeChanged(bob, PV_APPRAISER_ROLE, ether(30), { from: stakeManager });
    await this.validators.onStakeChanged(bob, PC_CUSTODIAN_ROLE, ether(30), { from: stakeManager });
    await this.validators.onStakeChanged(dan, PV_APPRAISER2_ROLE, ether(30), { from: stakeManager });
    await this.validators.onStakeChanged(dan, PC_AUDITOR_ROLE, ether(30), { from: stakeManager });
    await this.validators.onStakeChanged(eve, PV_AUDITOR_ROLE, ether(30), { from: stakeManager });

    await this.galtDex.initialize(szabo(1), szabo(5), szabo(5), this.galtToken.address, {
      from: coreTeam
    });

    await this.spaceDex.initialize(
      this.galtToken.address,
      this.spaceToken.address,
      this.plotValuation.address,
      this.plotCustodian.address,
      {
        from: coreTeam
      }
    );

    await this.spaceDex.addRoleTo(coreTeam, 'fee_manager');

    await this.spaceDex.setFee(szabo(feePercent), '0');
    await this.spaceDex.setFee(szabo(feePercent), '1');

    await this.spaceToken.addRoleTo(coreTeam, 'minter');

    await this.galtToken.mint(this.galtDex.address, ether(1000000));
    await this.galtToken.mint(this.spaceDex.address, ether(1000000));

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

  describe('#exchangeSpaceToGalt()', async () => {
    it('should successfully sell spaceToken', async function() {
      await this.spaceToken.mint(alice, {
        from: coreTeam
      });

      const spaceTokenId = '0x0000000000000000000000000000000000000000000000000000000000000000';

      await this.valuatePlot(spaceTokenId, ether(plotPriceGalt));
      await this.setCustodianForPlot(spaceTokenId, bob);

      await this.spaceToken.approve(this.spaceDex.address, spaceTokenId, {
        from: alice
      });

      const geohashPrice = await this.spaceDex.getSpaceTokenActualPriceWithFee(spaceTokenId);
      await this.spaceDex.exchangeSpaceToGalt(spaceTokenId, {
        from: alice
      });

      const oId = await this.spaceDex.operationsArray(0);
      const operation = await this.spaceDex.getOperationById(oId);
      assert.equal(operation[3], alice);

      const aliceGaltBalance = await this.galtToken.balanceOf(alice);
      assert.equal(aliceGaltBalance.toString(10), geohashPrice.toString(10));

      const expectedFeeGalt = ether((plotPriceGalt * feePercent) / 100);
      await this.spaceDex.withdrawFee({
        from: coreTeam
      });
      const coreTeamBalance = await this.galtToken.balanceOf(coreTeam);
      assert.equal(coreTeamBalance.toString(10), expectedFeeGalt.toString(10));
    });
  });

  describe('#exchangeGaltToSpace()', async () => {
    it('should successfully buy spaceToken', async function() {
      await this.spaceToken.mint(alice, {
        from: coreTeam
      });

      const spaceTokenId = '0x0000000000000000000000000000000000000000000000000000000000000000';

      await this.valuatePlot(spaceTokenId, ether(plotPriceGalt));
      await this.setCustodianForPlot(spaceTokenId, bob);

      await this.spaceToken.approve(this.spaceDex.address, spaceTokenId, {
        from: alice
      });

      await this.spaceDex.exchangeSpaceToGalt(spaceTokenId, {
        from: alice
      });

      const expectedFeeGalt = ether((plotPriceGalt * feePercent) / 100);

      const geohashPrice = await this.spaceDex.getSpaceTokenActualPriceWithFee(spaceTokenId);
      assert.equal(geohashPrice.toString(10), new BN(expectedFeeGalt).add(new BN(ether(plotPriceGalt))).toString(10));

      await this.galtToken.mint(alice, geohashPrice);
      await this.galtToken.approve(this.spaceDex.address, geohashPrice, { from: alice });

      await this.spaceDex.exchangeGaltToSpace(spaceTokenId, {
        from: alice
      });

      const ownerOfGeohashToken = await this.spaceToken.ownerOf(spaceTokenId);
      assert.equal(ownerOfGeohashToken, alice);

      const feePayout = await this.spaceDex.feePayout();
      assert.equal(feePayout.toString(10), (expectedFeeGalt * 2).toString(10));

      await this.spaceDex.withdrawFee({
        from: coreTeam
      });
      const coreTeamBalance = await this.galtToken.balanceOf(coreTeam);
      assert.equal(coreTeamBalance.toString(10), (expectedFeeGalt * 2).toString(10));
    });
  });
});
