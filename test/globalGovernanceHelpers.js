const SpaceLocker = artifacts.require('./SpaceLocker.sol');
const GaltLocker = artifacts.require('./GaltLocker.sol');

const pIteration = require('p-iteration');

const { ether, initHelperWeb3 } = require('./helpers');
const { buildPGG } = require('./deploymentHelpers');

const { web3 } = SpaceLocker;
const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);

const FAKE_TYPE = bytes32('fake_type');

function noLogger() {}

function globalGovernanceHelpers(
  _glatToken,
  _spaceToken,
  _spaceRA,
  _galtRA,
  _spaceGeoData,
  _spaceLockerFactory,
  _galtLockerFactory,
  _initialOwners,
  _spaceMinterAddress,
  _oracleModifierAddress,
  _geoDataManagerAddress,
  _sponsorAddress,
  _logger
) {
  const galtToken = _glatToken;
  const spaceToken = _spaceToken;
  const spaceRA = _spaceRA;
  const galtRA = _galtRA;
  const spaceGeoData = _spaceGeoData;
  const spaceLockerFactory = _spaceLockerFactory;
  const galtLockerFactory = _galtLockerFactory;
  const spaceMinterAddress = _spaceMinterAddress;
  const geoDataManagerAddress = _geoDataManagerAddress;
  const sponsorAddress = _sponsorAddress;
  const log = _logger || noLogger;

  const Helpers = {
    async addSpaceReputationDelegate(delegateAddress, msToLockTo, amount) {
      log('Adding Space Delegate...', delegateAddress, 'with weight', amount);

      // Mint a space token
      let res = await spaceToken.mint(delegateAddress, { from: spaceMinterAddress });
      const { tokenId } = res.logs[0].args;

      await spaceGeoData.setSpaceTokenArea(tokenId, amount, '0', { from: geoDataManagerAddress });

      // Build a space locker
      await galtToken.transfer(delegateAddress, ether(10), { from: sponsorAddress });
      await galtToken.approve(spaceLockerFactory.address, ether(10), { from: delegateAddress });

      res = await spaceLockerFactory.build({ from: delegateAddress });
      const lockerAddress = res.logs[0].args.locker;
      const spaceLocker = await SpaceLocker.at(lockerAddress);

      // Deposit the space token to a locker
      await spaceToken.approve(lockerAddress, tokenId, { from: delegateAddress });
      await spaceLocker.deposit(tokenId, { from: delegateAddress });

      // Mint reputation at spaceRA
      await spaceLocker.approveMint(spaceRA.address, { from: delegateAddress });
      await spaceRA.mint(lockerAddress, { from: delegateAddress });

      // Lock !all the minted amount! to the given multiSig
      await spaceRA.lockReputation(msToLockTo, amount, { from: delegateAddress });
    },
    async addGaltReputationDelegate(delegateAddress, msToLockTo, amount) {
      log('Adding Galt Delegate...', delegateAddress, 'with weight', amount);

      await galtToken.transfer(delegateAddress, amount, { from: sponsorAddress });
      await galtToken.transfer(delegateAddress, ether(10), { from: sponsorAddress });

      // Build a space locker
      await galtToken.approve(galtLockerFactory.address, ether(10), { from: delegateAddress });

      const res = await galtLockerFactory.build({ from: delegateAddress });
      const lockerAddress = res.logs[0].args.locker;
      const galtLocker = await GaltLocker.at(lockerAddress);

      // Deposit
      await galtToken.approve(galtLocker.address, amount, { from: delegateAddress });
      await galtLocker.deposit(amount, { from: delegateAddress });

      // Mint reputation at galtRA
      await galtLocker.approveMint(spaceRA.address, { from: delegateAddress });
      await galtRA.mint(lockerAddress, { from: delegateAddress });

      // Lock !all the minted amount! to the given multiSig
      await galtRA.lockReputation(msToLockTo, amount, { from: delegateAddress });
    },
    async addStakeReputationOracle(oracleAddress, oraclesContract, oracleStakeAccountingContract, amount) {
      log('Adding oracle', oracleAddress, 'with stake', amount);

      await oraclesContract.addOracle(oracleAddress, 'Foo', bytes32('Bar'), '', [], [FAKE_TYPE], {
        from: _oracleModifierAddress
      });

      await galtToken.transfer(oracleAddress, amount, { from: sponsorAddress });
      await galtToken.approve(oracleStakeAccountingContract.address, amount, { from: oracleAddress });
      await oracleStakeAccountingContract.stake(oracleAddress, FAKE_TYPE, amount, { from: oracleAddress });
    },
    async seedArbitration(
      factory,
      owner,
      spaceReputationDelegates,
      galtReputationDelegates,
      stakeReputationOracles,
      spaceReputationToLock = 0,
      galtReputationToLock = 0,
      oracleReputationToStake = 0
    ) {
      const pgg = await buildPGG(factory, _initialOwners, 2, 7, 10, 60, ether(1000), 240000, {}, {}, owner);

      if (spaceReputationToLock > 0) {
        await pIteration.forEach(spaceReputationDelegates, async function(delegate) {
          await Helpers.addSpaceReputationDelegate(delegate, pgg.config.address, spaceReputationToLock);
        });
      }

      if (galtReputationToLock > 0) {
        await pIteration.forEach(galtReputationDelegates, async function(delegate) {
          await Helpers.addGaltReputationDelegate(delegate, pgg.config.address, galtReputationToLock);
        });
      }

      if (oracleReputationToStake > 0) {
        await pIteration.forEach(stakeReputationOracles, async function(delegate) {
          await Helpers.addStakeReputationOracle(
            delegate,
            pgg.oracles,
            pgg.oracleStakeAccounting,
            oracleReputationToStake
          );
        });
      }

      return pgg;
    }
  };

  return Helpers;
}

module.exports = globalGovernanceHelpers;
