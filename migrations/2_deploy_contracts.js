const GaltToken = artifacts.require('./GaltToken');
const SpaceToken = artifacts.require('./SpaceToken');
const LandUtils = artifacts.require('./LandUtils');
const AdminUpgradeabilityProxy = artifacts.require('zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test') {
    return;
  }

  const coreTeam = accounts[0];
  const proxiesAdmin = accounts[1];

  // Deploy contracts...
  await deployer.deploy(GaltToken, { from: coreTeam });
  await deployer.deploy(SpaceToken, 'Space Token', 'SPACE', { from: coreTeam });
  await deployer.deploy(LandUtils, { from: coreTeam });

  // Setup proxies...
  // NOTICE: The address of a proxy creator couldn't be used in the future for logic contract calls.
  // https://github.com/zeppelinos/zos-lib/issues/226
  const spaceProxy = await AdminUpgradeabilityProxy.new(SpaceToken.address, { from: proxiesAdmin });
  const spaceToken = await SpaceToken.at(spaceProxy.address);
  spaceToken.initialize('Space Token', 'SPACE', { from: coreTeam });

  const landUtilsProxy = await AdminUpgradeabilityProxy.new(LandUtils.address, { from: proxiesAdmin });
  const landUtils = await LandUtils.at(landUtilsProxy.address);
  landUtils.initialize({ from: coreTeam });

  console.log('SpaceToken Proxy:', spaceProxy.address);
  console.log('LandUtils Proxy:', landUtils.address);
};
