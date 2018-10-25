const PlotManager = artifacts.require('./PlotManager');
const PlotValuation = artifacts.require('./PlotValuation');
const PlotCustodian = artifacts.require('./PlotCustodianManager');
const GaltToken = artifacts.require('./GaltToken');
const GaltDex = artifacts.require('./GaltDex');
const SpaceDex = artifacts.require('./SpaceDex');
const Validators = artifacts.require('./Validators');
const ValidatorStakes = artifacts.require('./ValidatorStakes');
const ClaimManager = artifacts.require('./ClaimManager');
const Web3 = require('web3');
// const AdminUpgradeabilityProxy = artifacts.require('zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol');

const web3 = new Web3(PlotManager.web3.currentProvider);

const fs = require('fs');
const _ = require('lodash');

function ether(value) {
  return Web3.utils.toWei(value.toString(10), 'ether');
}

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
    const plotCustodian = await PlotCustodian.at(data.plotCustodianAddress);
    const galtToken = await GaltToken.at(data.galtTokenAddress);
    const galtDex = await GaltDex.at(data.galtDexAddress);
    const spaceDex = await SpaceDex.at(data.spaceDexAddress);
    const validators = await Validators.at(data.validatorsAddress);
    const validatorStakes = await ValidatorStakes.at(data.validatorStakesAddress);
    const claimManager = await ClaimManager.at(data.claimManagerAddress);

    const rewarder = accounts[3] || accounts[2] || accounts[1] || accounts[0];

    const sendEthByNetwork = {
      local: 1000,
      testnet56: 1000,
      testnet57: 1000,
      development: 20,
      ganache: 20,
      production: 0
    };

    const PM_CADASTRAL_ROLE = 'pm_cadastral';
    const PM_AUDITOR_ROLE = 'pm_auditor';

    const PLOT_MANAGER_APPLICATION_TYPE = await plotManager.APPLICATION_TYPE.call();
    await validators.setApplicationTypeRoles(
      PLOT_MANAGER_APPLICATION_TYPE,
      [PM_CADASTRAL_ROLE, PM_AUDITOR_ROLE],
      [75, 25],
      ['', ''],
      {
        from: coreTeam
      }
    );

    const PV_APPRAISER_ROLE = await plotValuation.PV_APPRAISER_ROLE.call();
    const PV_APPRAISER2_ROLE = await plotValuation.PV_APPRAISER2_ROLE.call();
    const PV_AUDITOR_ROLE = await plotValuation.PV_AUDITOR_ROLE.call();

    const PLOT_VALUATION_APPLICATION_TYPE = await plotValuation.APPLICATION_TYPE.call();
    await validators.setApplicationTypeRoles(
      PLOT_VALUATION_APPLICATION_TYPE,
      [PV_APPRAISER_ROLE, PV_APPRAISER2_ROLE, PV_AUDITOR_ROLE],
      [35, 35, 30],
      ['', '', ''],
      {
        from: coreTeam
      }
    );

    const PC_CUSTODIAN_ROLE = await plotCustodian.PC_CUSTODIAN_ROLE.call();
    const PC_AUDITOR_ROLE = await plotCustodian.PC_AUDITOR_ROLE.call();

    const PLOT_CUSTODIAN_APPLICATION_TYPE = await plotCustodian.APPLICATION_TYPE.call();
    await validators.setApplicationTypeRoles(
      PLOT_CUSTODIAN_APPLICATION_TYPE,
      [PC_CUSTODIAN_ROLE, PC_AUDITOR_ROLE],
      [75, 25],
      ['', ''],
      {
        from: coreTeam
      }
    );

    const CM_AUDITOR_ROLE = await claimManager.CM_AUDITOR.call();
    const CLAIM_MANAGER_APPLICATION_TYPE = await claimManager.APPLICATION_TYPE.call();
    await validators.setApplicationTypeRoles(CLAIM_MANAGER_APPLICATION_TYPE, [CM_AUDITOR_ROLE], [100], [''], {
      from: coreTeam
    });

    const users = {
      Jonybang: '0xf0430bbb78c3c359c22d4913484081a563b86170',
      Jonybang2: '0x7DB143B5B2Ef089992c89a27B015Ab47391cdfFE',
      Jonybang3: '0x029001F6C2dc2C8B28Ff201C3a451714637Af4E3',
      Nikita: '0x8d362af4c86b05d6F256147A6E76b9d7aF205A24',
      Igor: '0x06dba6eb6a1044b8cbcaa0033ea3897bf37e6671',
      Igor2: '0x8052C9fc345dB9c1A70Afc0A81416029F23E5f76',
      Igor3: '0xF6310635508a46ba66AaBdf28486744c715d6bcC',
      Nik: '0x486129f16423bb74786abc99eab06897f73310f5',
      Nik2: '0x83d61498cc955c4201042f12bd34e818f781b90b',
      Nik3: '0x8b54b27EB527E670BE5f46dD3aC134d1a629A3F7',
      Nik4: '0x3b79ca864e2349fe869D009F9F3CBB5064B630Da',
      Nik5: '0xa583ac4bD05794a9BBCc64Aa3c853529A0eCA996',
      NickUser: '0x7184e0fF3c8D6FC24B986177c131290A0a7A9B28',
      NickValidator: '0x82a79ccdDFf049bE2715621c3CD17a6A4BaFC099',
      NickAdmin: '0x8EE35beC646E131e07ece099c2Eb2697d0a588D5'
    };

    const adminsList = ['Jonybang', 'Nikita', 'Igor', 'Nik', 'Nik2', 'NickAdmin'];

    const allRoles = [
      PM_CADASTRAL_ROLE,
      PM_AUDITOR_ROLE,
      PV_APPRAISER_ROLE,
      PV_APPRAISER2_ROLE,
      PV_AUDITOR_ROLE,
      PC_CUSTODIAN_ROLE,
      PC_AUDITOR_ROLE,
      CM_AUDITOR_ROLE
    ];

    const validatorsSpecificRoles = {
      Jonybang: allRoles,
      Jonybang2: allRoles,
      Jonybang3: allRoles,
      Nikita: allRoles,
      Igor: allRoles,
      Igor2: allRoles,
      Igor3: allRoles,
      Nik: allRoles,
      Nik2: allRoles,
      NickValidator: allRoles,
      Nik3: [PV_APPRAISER_ROLE],
      Nik4: [PV_APPRAISER2_ROLE],
      Nik5: [PV_AUDITOR_ROLE]
    };

    const minDepositForValidator = 500; // 10k $
    const minDepositForAuditor = 2500; // 50k $

    const minDepositGalt = {};
    minDepositGalt[PM_CADASTRAL_ROLE] = minDepositForValidator;
    minDepositGalt[PM_AUDITOR_ROLE] = minDepositForValidator;
    minDepositGalt[PV_APPRAISER_ROLE] = minDepositForValidator;
    minDepositGalt[PV_APPRAISER2_ROLE] = minDepositForValidator;
    minDepositGalt[PV_AUDITOR_ROLE] = minDepositForAuditor;
    minDepositGalt[PC_CUSTODIAN_ROLE] = minDepositForAuditor;
    minDepositGalt[PC_AUDITOR_ROLE] = minDepositForAuditor;
    minDepositGalt[CM_AUDITOR_ROLE] = minDepositForAuditor;

    let needGaltForDeposits = 0;
    _.forEach(validatorsSpecificRoles, validatorRoles => {
      validatorRoles.forEach(role => {
        needGaltForDeposits += minDepositGalt[role];
      });
    });

    console.log('needGaltForDeposits', needGaltForDeposits);

    await galtDex.exchangeEthToGalt({ from: coreTeam, value: ether(needGaltForDeposits) });

    await galtToken.approve(validatorStakes.address, ether(needGaltForDeposits), { from: coreTeam });

    const rolesPromises = [];
    _.forEach(allRoles, roleName => {
      const minDeposit = ether(minDepositGalt[roleName]);
      rolesPromises.push(validators.setRoleMinimalDeposit(roleName, minDeposit, { from: coreTeam }));
    });
    await Promise.all(rolesPromises);

    const promises = [];
    _.forEach(users, async (address, name) => {
      if (validatorsSpecificRoles[name]) {
        promises.push(
          new Promise(async resolve => {
            await validators.addValidator(address, name, 'MN', [], validatorsSpecificRoles[name], { from: coreTeam });

            const validatorPromises = validatorsSpecificRoles[name].map(roleName =>
              validatorStakes.stake(address, roleName, ether(minDepositGalt[roleName]), { from: coreTeam })
            );

            Promise.all(validatorPromises).then(resolve);
          })
        );
      }

      if (_.includes(adminsList, name)) {
        promises.push(galtDex.addRoleTo(address, 'fee_manager', { from: coreTeam }));
        promises.push(spaceDex.addRoleTo(address, 'fee_manager', { from: coreTeam }));
        promises.push(validators.addRoleTo(address, 'validator_manager', { from: coreTeam }));
        promises.push(validators.addRoleTo(address, 'application_type_manager', { from: coreTeam }));
        // TODO: make plotManager rolable too
        // promises.push(plotManager.addRoleTo(address, 'fee_manager', { from: coreTeam }));
        promises.push(plotManager.setFeeManager(address, true, { from: coreTeam }));
        promises.push(plotValuation.setFeeManager(address, true, { from: coreTeam }));
        promises.push(plotCustodian.setFeeManager(address, true, { from: coreTeam }));
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
