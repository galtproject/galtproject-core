const GaltToken = artifacts.require('./GaltToken');
const SpaceToken = artifacts.require('./SpaceToken');
const LandUtils = artifacts.require('./LandUtils');
const PlotManager = artifacts.require('./PlotManager');
const SplitMerge = artifacts.require('./SplitMerge');
const AdminUpgradeabilityProxy = artifacts.require('zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol');
const assert = require('assert');
const { ether, initHelperWeb3 } = require('../test/helpers');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  initHelperWeb3(deployer.provider);

  const coreTeam = accounts[0];
  const proxiesAdmin = accounts[1];
  const galtSpaceRewards = accounts[2];

  // Deploy contracts...
  await deployer.deploy(GaltToken);
  await deployer.deploy(SpaceToken, 'Space Token', 'SPACE');
  await deployer.deploy(SplitMerge);
  await deployer.deploy(PlotManager);
  await deployer.deploy(LandUtils);

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
  await spaceToken.initialize('Space Token', 'SPACE', { from: coreTeam });
  await plotManager.initialize(ether(1), '25', galtSpaceRewards, spaceToken.address, splitMerge.address, {
    from: coreTeam
  });
  await splitMerge.initialize(spaceToken.address, plotManager.address, { from: coreTeam });
  await landUtils.initialize({ from: coreTeam });

  // Setup roles
  await spaceToken.addRoleTo(plotManager.address, 'minter');
  await spaceToken.addRoleTo(splitMerge.address, 'minter');
  await spaceToken.addRoleTo(splitMerge.address, 'operator');

  // Ensure roles
  assert(await spaceToken.hasRole(plotManager.address, 'minter'));
  assert(await spaceToken.hasRole(splitMerge.address, 'minter'));
  assert(await spaceToken.hasRole(splitMerge.address, 'operator'));

  // Log out proxy addresses
  console.log('SpaceToken Proxy:', spaceToken.address);
  console.log('SplitMerge Proxy:', splitMerge.address);
  console.log('PlotManager Proxy:', plotManager.address);
  console.log('LandUtils Proxy:', landUtils.address);
};
