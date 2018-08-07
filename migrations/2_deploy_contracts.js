const GaltToken = artifacts.require('./GaltToken');
const SpaceToken = artifacts.require('./SpaceToken');
const LandUtils = artifacts.require('./LandUtils');
const PlotManager = artifacts.require('./PlotManager');
const SplitMerge = artifacts.require('./SplitMerge');
const AdminUpgradeabilityProxy = artifacts.require('zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  const coreTeam = accounts[0];
  const proxiesAdmin = accounts[1];

  // Deploy contracts...
  await deployer.deploy(GaltToken, { from: coreTeam });
  await deployer.deploy(SpaceToken, 'Space Token', 'SPACE', { from: coreTeam });
  await deployer.deploy(SplitMerge, { from: coreTeam });
  await deployer.deploy(PlotManager, { from: coreTeam });
  await deployer.deploy(LandUtils, { from: coreTeam });

  // Setup proxies...
  // NOTICE: The address of a proxy creator couldn't be used in the future for logic contract calls.
  // https://github.com/zeppelinos/zos-lib/issues/226
  const spaceTokenProxy = await AdminUpgradeabilityProxy.new(SpaceToken.address, { from: proxiesAdmin });
  const splitMergeProxy = await AdminUpgradeabilityProxy.new(SplitMerge.address, { from: proxiesAdmin });
  const plotManagerProxy = await AdminUpgradeabilityProxy.new(PlotManager.address, { from: proxiesAdmin });
  const landUtilsProxy = await AdminUpgradeabilityProxy.new(LandUtils.address, { from: proxiesAdmin });

  // Instantiate logic contract at proxy addresses...
  const spaceToken = await SpaceToken.at(spaceTokenProxy.address);
  const splitMerge = await SplitMerge.at(splitMergeProxy.address);
  const plotManager = await PlotManager.at(plotManagerProxy.address);
  const landUtils = await LandUtils.at(landUtilsProxy.address);

  // Call initialize methods (constructor substitute for proxy-backed contract)
  spaceToken.initialize(plotManager.address, 'Space Token', 'SPACE', { from: coreTeam });
  spaceToken.setSplitMerge(splitMerge.address, { from: coreTeam });
  splitMerge.initialize(spaceToken.address, { from: coreTeam });
  plotManager.initialize(spaceToken.address, splitMerge.address, { from: coreTeam });
  landUtils.initialize({ from: coreTeam });

  // Log out proxy addresses
  console.log('SpaceToken Proxy:', spaceToken.address);
  console.log('SplitMerge Proxy:', splitMerge.address);
  console.log('PlotManager Proxy:', plotManager.address);
  console.log('LandUtils Proxy:', landUtils.address);
};
