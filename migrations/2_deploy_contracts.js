const GaltToken = artifacts.require('./GaltToken');
const SpaceToken = artifacts.require('./SpaceToken');
const LandUtils = artifacts.require('./LandUtils');
const PlotManagerLib = artifacts.require('./PlotManagerLib');
const PlotManager = artifacts.require('./PlotManager');
const PlotEscrowLib = artifacts.require('./PlotEscrowLib');
const PlotEscrow = artifacts.require('./PlotEscrow');
const PlotValuation = artifacts.require('./PlotValuation');
const PlotCustodian = artifacts.require('./PlotCustodianManager');
const SplitMerge = artifacts.require('./SplitMerge');
const GaltDex = artifacts.require('./GaltDex');
const SpaceDex = artifacts.require('./SpaceDex');
const Validators = artifacts.require('./Validators');
const Web3 = require('web3');

// const AdminUpgradeabilityProxy = artifacts.require('zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol');

const fs = require('fs');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  deployer.then(async () => {
    const coreTeam = accounts[0];
    // const proxiesAdmin = accounts[1];

    // Deploy contracts...
    console.log('Create contract instances...');
    const galtToken = await GaltToken.new({ from: coreTeam });
    const spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    const splitMerge = await SplitMerge.new({ from: coreTeam });

    const galtDex = await GaltDex.new({ from: coreTeam });
    const spaceDex = await SpaceDex.new({ from: coreTeam });

    const validators = await Validators.new({ from: coreTeam });

    const landUtils = await LandUtils.new({ from: coreTeam });
    PlotManagerLib.link('LandUtils', landUtils.address);

    const plotManagerLib = await PlotManagerLib.new({ from: coreTeam });
    PlotManager.link('PlotManagerLib', plotManagerLib.address);

    const plotManager = await PlotManager.new({ from: coreTeam });
    const plotValuation = await PlotValuation.new({ from: coreTeam });
    const plotCustodian = await PlotCustodian.new({ from: coreTeam });

    const plotEscrowLib = await PlotEscrowLib.new({ from: coreTeam });
    PlotEscrow.link('PlotEscrowLib', plotEscrowLib.address);

    const plotEscrow = await PlotEscrow.new({ from: coreTeam });

    // Setup proxies...
    // NOTICE: The address of a proxy creator couldn't be used in the future for logic contract calls.
    // https://github.com/zeppelinos/zos-lib/issues/226
    // const spaceTokenProxy = await AdminUpgradeabilityProxy.new(SpaceToken.address, { from: proxiesAdmin });
    // const splitMergeProxy = await AdminUpgradeabilityProxy.new(SplitMerge.address, { from: proxiesAdmin });
    // const plotManagerProxy = await AdminUpgradeabilityProxy.new(PlotManager.address, { from: proxiesAdmin });
    // const landUtilsProxy = await AdminUpgradeabilityProxy.new(LandUtils.address, { from: proxiesAdmin });
    //
    // // Instantiate logic contract at proxy addresses...
    // await SpaceToken.at(spaceTokenProxy.address);
    // await SplitMerge.at(splitMergeProxy.address);
    // await PlotManager.at(plotManagerProxy.address);
    // await LandUtils.at(landUtilsProxy.address);

    // Call initialize methods (constructor substitute for proxy-backed contract)
    console.log('Initialize contracts...');
    await spaceToken.initialize('Space Token', 'SPACE', { from: coreTeam });

    await splitMerge.initialize(spaceToken.address, plotManager.address, { from: coreTeam });

    await plotManager.initialize(
      spaceToken.address,
      splitMerge.address,
      validators.address,
      galtToken.address,
      coreTeam,
      {
        from: coreTeam
      }
    );

    await plotValuation.initialize(
      spaceToken.address,
      splitMerge.address,
      validators.address,
      galtToken.address,
      coreTeam,
      {
        from: coreTeam
      }
    );

    await plotCustodian.initialize(
      spaceToken.address,
      splitMerge.address,
      validators.address,
      galtToken.address,
      plotEscrow.address,
      coreTeam,
      {
        from: coreTeam
      }
    );

    await plotEscrow.initialize(
      spaceToken.address,
      plotCustodian.address,
      validators.address,
      galtToken.address,
      coreTeam,
      {
        from: coreTeam
      }
    );

    await galtDex.initialize(
      Web3.utils.toWei('100', 'szabo'),
      Web3.utils.toWei('1', 'szabo'),
      Web3.utils.toWei('1', 'szabo'),
      galtToken.address,
      { from: coreTeam }
    );

    await galtDex.setSpaceDex(spaceDex.address, { from: coreTeam });

    await spaceDex.initialize(galtToken.address, spaceToken.address, plotValuation.address, plotCustodian.address, {
      from: coreTeam
    });

    console.log('Mint GALT to dex contracts..');
    await galtToken.mint(galtDex.address, Web3.utils.toWei('1000000', 'ether'));
    await galtToken.mint(spaceDex.address, Web3.utils.toWei('1000000', 'ether'));

    console.log('Set roles of contracts...');
    await galtDex.addRoleTo(coreTeam, 'fee_manager', { from: coreTeam });
    await spaceDex.addRoleTo(coreTeam, 'fee_manager', { from: coreTeam });

    await spaceToken.addRoleTo(plotManager.address, 'minter', { from: coreTeam });
    await spaceToken.addRoleTo(splitMerge.address, 'minter', { from: coreTeam });
    await spaceToken.addRoleTo(splitMerge.address, 'burner', { from: coreTeam });
    await spaceToken.addRoleTo(splitMerge.address, 'operator', { from: coreTeam });

    await validators.addRoleTo(coreTeam, 'validator_manager', { from: coreTeam });
    await validators.addRoleTo(coreTeam, 'application_type_manager', { from: coreTeam });

    await plotManager.setFeeManager(coreTeam, true, { from: coreTeam });
    await plotValuation.setFeeManager(coreTeam, true, { from: coreTeam });
    await plotCustodian.setFeeManager(coreTeam, true, { from: coreTeam });

    console.log('Set fees of contracts...');
    await plotManager.setGasPriceForDeposits(Web3.utils.toWei('4', 'gwei'), { from: coreTeam });
    await plotValuation.setGasPriceForDeposits(Web3.utils.toWei('4', 'gwei'), { from: coreTeam });

    await plotManager.setSubmissionFeeRate(Web3.utils.toWei('776.6', 'gwei'), Web3.utils.toWei('38830', 'gwei'), {
      from: coreTeam
    });

    await plotValuation.setMinimalApplicationFeeInEth(Web3.utils.toWei('0.1', 'ether'), {
      from: coreTeam
    });
    await plotCustodian.setMinimalApplicationFeeInEth(Web3.utils.toWei('0.1', 'ether'), {
      from: coreTeam
    });

    await plotValuation.setMinimalApplicationFeeInGalt(Web3.utils.toWei('1', 'ether'), {
      from: coreTeam
    });
    await plotCustodian.setMinimalApplicationFeeInGalt(Web3.utils.toWei('1', 'ether'), {
      from: coreTeam
    });

    await spaceDex.setFee('0', '0', { from: coreTeam });
    await spaceDex.setFee(Web3.utils.toWei('1', 'szabo'), '1', { from: coreTeam });

    console.log('Save addresses and abi to deployed folder...');

    await new Promise(resolve => {
      const deployDirectory = `${__dirname}/../deployed`;
      if (!fs.existsSync(deployDirectory)) {
        fs.mkdirSync(deployDirectory);
      }

      const deployFile = `${deployDirectory}/${network}.json`;
      console.log(`saved to ${deployFile}`);

      fs.writeFile(
        deployFile,
        JSON.stringify(
          {
            galtTokenAddress: galtToken.address,
            galtTokenAbi: galtToken.abi,
            spaceTokenAddress: spaceToken.address,
            spaceTokenAbi: spaceToken.abi,
            splitMergeAddress: splitMerge.address,
            splitMergeAbi: splitMerge.abi,
            plotManagerAddress: plotManager.address,
            plotManagerAbi: plotManager.abi,
            plotValuationAddress: plotValuation.address,
            plotValuationAbi: plotValuation.abi,
            plotCustodianAddress: plotCustodian.address,
            plotCustodianAbi: plotCustodian.abi,
            plotEscrowAddress: plotEscrow.address,
            plotEscrowAbi: plotEscrow.abi,
            landUtilsAddress: landUtils.address,
            landUtilsAbi: landUtils.abi,
            galtDexAddress: galtDex.address,
            galtDexAbi: galtDex.abi,
            spaceDexAddress: spaceDex.address,
            spaceDexAbi: spaceDex.abi,
            validatorsAddress: validators.address,
            validatorsAbi: validators.abi
          },
          null,
          2
        ),
        resolve
      );
    });
  });
};
