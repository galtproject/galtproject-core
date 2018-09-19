const PlotManager = artifacts.require('./PlotManager');
const PlotValuation = artifacts.require('./PlotValuation');
const GaltDex = artifacts.require('./GaltDex');
const Validators = artifacts.require('./Validators');
const Web3 = require('web3');
// const AdminUpgradeabilityProxy = artifacts.require('zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol');

const web3 = new Web3(PlotManager.web3.currentProvider);

const fs = require('fs');
const _ = require('lodash');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  const coreTeam = accounts[0];

  deployer.then(async () => {
    const data = JSON.parse(fs.readFileSync(`${__dirname}/../deployed/${network}.json`).toString());
    const plotManager = await PlotManager.at(data.plotManagerAddress);
    const plotValuation = await PlotValuation.at(data.plotValuationAddress);
    const galtDex = await GaltDex.at(data.galtDexAddress);
    const validators = await Validators.at(data.validatorsAddress);

    const users = {
      Jonybang: '0xf0430bbb78c3c359c22d4913484081a563b86170',
      Jonybang2: '0x7DB143B5B2Ef089992c89a27B015Ab47391cdfFE',
      Nikita: '0x8d362af4c86b05d6F256147A6E76b9d7aF205A24',
      Igor: '0x06dba6eb6a1044b8cbcaa0033ea3897bf37e6671',
      Igor2: '0x8052C9fc345dB9c1A70Afc0A81416029F23E5f76',
      Nik: '0x486129f16423bb74786abc99eab06897f73310f5',
      Nik2: '0x83d61498cc955c4201042f12bd34e818f781b90b',
      NickUser: '0x7184e0fF3c8D6FC24B986177c131290A0a7A9B28',
      NickValidator: '0x82a79ccdDFf049bE2715621c3CD17a6A4BaFC099',
      NickAdmin: '0x8EE35beC646E131e07ece099c2Eb2697d0a588D5'
    };

    const adminsList = ['Jonybang', 'Nikita', 'Igor', 'Nik', 'Nik2', 'NickAdmin'];
    const validatorsList = ['Jonybang', 'Jonybang2', 'Nikita', 'Igor', 'Igor2', 'Nik', 'Nik2', 'NickValidator'];

    const rewarder = accounts[3] || accounts[2] || accounts[1] || accounts[0];

    const sendEthByNetwork = {
      local: 1000,
      testnet56: 1000,
      testnet57: 1000,
      development: 20,
      ganache: 20,
      production: 0
    };

    const PLOT_MANAGER_APPLICATION_TYPE = await plotManager.APPLICATION_TYPE.call();
    await validators.setApplicationTypeRoles(
      PLOT_MANAGER_APPLICATION_TYPE,
      ['pm_cadastral', 'pm_auditor'],
      [75, 25],
      ['', ''],
      {
        from: coreTeam
      }
    );

    const PLOT_VALUATION_APPLICATION_TYPE = await plotValuation.APPLICATION_TYPE.call();
    await validators.setApplicationTypeRoles(
      PLOT_VALUATION_APPLICATION_TYPE,
      ['pv_appraiser', 'pv_appraiser2', 'pv_auditor'],
      [35, 35, 30],
      ['', '', ''],
      {
        from: coreTeam
      }
    );

    const promises = [];
    _.forEach(users, (address, name) => {
      if (_.includes(validatorsList, name)) {
        promises.push(
          validators.addValidator(
            address,
            name,
            'MN',
            [],
            ['pm_cadastral', 'pm_auditor', 'pv_appraiser', 'pv_appraiser2', 'pv_auditor'],
            { from: coreTeam }
          )
        );
      }

      if (_.includes(adminsList, name)) {
        promises.push(galtDex.addRoleTo(address, 'fee_manager', { from: coreTeam }));
        promises.push(validators.addRoleTo(address, 'validator_manager', { from: coreTeam }));
        promises.push(validators.addRoleTo(address, 'application_type_manager', { from: coreTeam }));
        // TODO: make plotManager rolable too
        // promises.push(plotManager.addRoleTo(address, 'fee_manager', { from: coreTeam }));
        promises.push(plotManager.setFeeManager(address, true, { from: coreTeam }));
        promises.push(plotValuation.setFeeManager(address, true, { from: coreTeam }));
      }

      if (!sendEthByNetwork[network]) {
        return;
      }

      const sendWei = web3.utils.toWei(sendEthByNetwork[network].toString(), 'ether').toString(10);
      promises.push(web3.eth.sendTransaction({ from: rewarder, to: address, value: sendWei }).catch(() => {}));
    });

    await Promise.all(promises);
  });
};
