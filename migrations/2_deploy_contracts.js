const GaltToken = artifacts.require('./GaltToken');
const SpaceToken = artifacts.require('./SpaceToken');
const LandUtils = artifacts.require('./LandUtils');
const PlotManager = artifacts.require('./PlotManager');
const SplitMerge = artifacts.require('./SplitMerge');
const GaltDex = artifacts.require('./GaltDex');
const Validators = artifacts.require('./Validators');
const Web3 = require('web3');
const galt = require('@galtproject/utils');

const web3 = new Web3(GaltToken.web3.currentProvider);
// const AdminUpgradeabilityProxy = artifacts.require('zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol');

const fs = require('fs');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  deployer.then(async () => {
    const coreTeam = accounts[0];
    const alice = accounts[1];
    const bob = accounts[2];
    // const proxiesAdmin = accounts[1];

    // Deploy contracts...
    console.log('Deploy contracts...');
    const galtToken = await GaltToken.new({ from: coreTeam });
    const spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    const splitMerge = await SplitMerge.new({ from: coreTeam });
    const plotManager = await PlotManager.new({ from: coreTeam });
    const landUtils = await LandUtils.new({ from: coreTeam });

    const galtDex = await GaltDex.new({ from: coreTeam });
    const validators = await Validators.new({ from: coreTeam });

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
    await spaceToken.initialize('Space Token', 'SPACE', { from: coreTeam });
    await spaceToken.addRoleTo(plotManager.address, 'minter', { from: coreTeam });
    await spaceToken.addRoleTo(splitMerge.address, 'minter', { from: coreTeam });
    await spaceToken.addRoleTo(splitMerge.address, 'operator', { from: coreTeam });

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

    await landUtils.initialize({ from: coreTeam });

    await galtDex.initialize(
      Web3.utils.toWei('100', 'szabo'),
      Web3.utils.toWei('1', 'szabo'),
      Web3.utils.toWei('1', 'szabo'),
      galtToken.address,
      { from: coreTeam }
    );

    await galtToken.mint(galtDex.address, Web3.utils.toWei('1000000', 'ether'));

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
            landUtilsAddress: landUtils.address,
            landUtilsAbi: landUtils.abi,
            galtDexAddress: galtDex.address,
            galtDexAbi: galtDex.abi,
            validatorsAddress: validators.address,
            validatorsAbi: validators.abi
          },
          null,
          2
        ),
        resolve
      );
    });

    // Log out proxy addresses
    console.log('SpaceToken Proxy:', spaceToken.address);
    console.log('SplitMerge Proxy:', splitMerge.address);
    console.log('PlotManager Proxy:', plotManager.address);
    console.log('LandUtils Proxy:', landUtils.address);
  });
};
