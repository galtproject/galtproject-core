const GaltToken = artifacts.require('./GaltToken');
const SpaceToken = artifacts.require('./SpaceToken');
const ArrayUtils = artifacts.require('./utils/ArrayUtils');
const LandUtils = artifacts.require('./utils/LandUtils');
const PolygonUtils = artifacts.require('./utils/PolygonUtils');
const SegmentUtils = artifacts.require('./utils/SegmentUtils');
const LinkedList = artifacts.require('./collections/LinkedList');
const SweepQueueLinkedList = artifacts.require('./collections/SweepQueueLinkedList');
const RedBlackTree = artifacts.require('./collections/RedBlackTree');
const SweepLineRedBlackTree = artifacts.require('./collections/SweepLineRedBlackTree');
const MartinezRueda = artifacts.require('./utils/MartinezRueda');
const WeilerAtherton = artifacts.require('./utils/WeilerAtherton');
const PlotManagerLib = artifacts.require('./PlotManagerLib');
const PlotManager = artifacts.require('./PlotManager');
const PlotClarificationManager = artifacts.require('./PlotClarificationManager');
const PlotEscrowLib = artifacts.require('./PlotEscrowLib');
const PlotEscrow = artifacts.require('./PlotEscrow');
const PlotValuation = artifacts.require('./PlotValuation');
const PlotCustodian = artifacts.require('./PlotCustodianManager');
const ClaimManager = artifacts.require('./ClaimManager');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const MultiSigFactory = artifacts.require('./MultiSigFactory.sol');
const ArbitratorsMultiSigFactory = artifacts.require('./ArbitratorsMultiSigFactory.sol');
const ArbitratorVotingFactory = artifacts.require('./ArbitratorVotingFactory.sol');
const OracleStakesAccountingFactory = artifacts.require('./OracleStakesAccountingFactory.sol');
const SpaceReputationAccounting = artifacts.require('./SpaceReputationAccounting.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const ArbitratorVoting = artifacts.require('./ArbitratorVoting.sol');
const SpaceLockerRegistry = artifacts.require('./SpaceLockerRegistry.sol');
const SpaceLockerFactory = artifacts.require('./SpaceLockerFactory.sol');
const SplitMerge = artifacts.require('./SplitMerge');
const SpaceSplitOperationFactory = artifacts.require('./SpaceSplitOperationFactory');
const SplitMergeLib = artifacts.require('./SplitMergeLib');
const SpaceSplitOperation = artifacts.require('./SpaceSplitOperation');
const GaltDex = artifacts.require('./GaltDex');
const Oracles = artifacts.require('./Oracles');
const Web3 = require('web3');

const fs = require('fs');
const packageVersion = require('../package.json').version;

// const AdminUpgradeabilityProxy = artifacts.require('zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol');

const web3 = new Web3(GaltToken.web3.currentProvider);

function ether(number) {
  return web3.utils.toWei(number.toString(), 'ether');
}

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  deployer.then(async () => {
    const coreTeam = accounts[0];
    const unauthorized = accounts[1];
    // const proxiesAdmin = accounts[1];

    // Deploy contracts...
    console.log('Create contract instances...');
    const galtToken = await GaltToken.new({ from: coreTeam });
    const spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    const spaceTokenSandbox = await SpaceToken.new('Space Token Sandbox', 'SPACE-S', { from: coreTeam });

    const landUtils = await LandUtils.new({ from: coreTeam });
    const arrayUtils = await ArrayUtils.new({ from: coreTeam });
    PolygonUtils.link('LandUtils', landUtils.address);
    SplitMerge.link('LandUtils', landUtils.address);
    SplitMerge.link('ArrayUtils', arrayUtils.address);

    const linkedList = await LinkedList.new({ from: coreTeam });
    SweepQueueLinkedList.link('LinkedList', linkedList.address);
    const sweepQueueLinkedList = await SweepQueueLinkedList.new({ from: coreTeam });

    const redBlackTree = await RedBlackTree.new({ from: coreTeam });
    SweepLineRedBlackTree.link('RedBlackTree', redBlackTree.address);
    const sweepLineRedBlackTree = await SweepLineRedBlackTree.new({ from: coreTeam });

    MartinezRueda.link('LinkedList', linkedList.address);
    MartinezRueda.link('RedBlackTree', redBlackTree.address);
    MartinezRueda.link('SweepQueueLinkedList', sweepQueueLinkedList.address);
    MartinezRueda.link('SweepLineRedBlackTree', sweepLineRedBlackTree.address);
    const martinezRueda = await MartinezRueda.new({ from: coreTeam });

    const polygonUtils = await PolygonUtils.new({ from: coreTeam });
    WeilerAtherton.link('LinkedList', linkedList.address);
    WeilerAtherton.link('SweepQueueLinkedList', sweepQueueLinkedList.address);
    WeilerAtherton.link('MartinezRueda', martinezRueda.address);
    WeilerAtherton.link('PolygonUtils', polygonUtils.address);
    const weilerAtherton = await WeilerAtherton.new({ from: coreTeam });

    SplitMergeLib.link('ArrayUtils', arrayUtils.address);
    const splitMergeLib = await SplitMergeLib.new({ from: coreTeam });

    const segmentUtils = await SegmentUtils.new({ from: coreTeam });
    SplitMerge.link('LandUtils', landUtils.address);
    SplitMerge.link('PolygonUtils', polygonUtils.address);
    SplitMerge.link('WeilerAtherton', weilerAtherton.address);
    SplitMerge.link('SegmentUtils', segmentUtils.address);
    SplitMerge.link('SplitMergeLib', splitMergeLib.address);
    const splitMerge = await SplitMerge.new({ from: coreTeam });
    const splitMergeSandbox = await SplitMerge.new({ from: coreTeam });

    SpaceSplitOperationFactory.link('PolygonUtils', polygonUtils.address);
    SpaceSplitOperationFactory.link('WeilerAtherton', weilerAtherton.address);

    const splitOperationFactory = await SpaceSplitOperationFactory.new(spaceToken.address, splitMerge.address);
    await splitMerge.setSplitOperationFactory(splitOperationFactory.address);

    const splitOperationSandboxFactory = await SpaceSplitOperationFactory.new(spaceToken.address, splitMerge.address);
    await splitMergeSandbox.setSplitOperationFactory(splitOperationSandboxFactory.address);

    const galtDex = await GaltDex.new({ from: coreTeam });

    const oracles = await Oracles.new({ from: coreTeam });

    PlotManagerLib.link('LandUtils', landUtils.address);

    const plotManagerLib = await PlotManagerLib.new({ from: coreTeam });
    PlotManager.link('PlotManagerLib', plotManagerLib.address);

    const plotManager = await PlotManager.new({ from: coreTeam });
    const plotValuation = await PlotValuation.new({ from: coreTeam });
    const plotCustodian = await PlotCustodian.new({ from: coreTeam });

    const plotEscrowLib = await PlotEscrowLib.new({ from: coreTeam });
    PlotEscrow.link('PlotEscrowLib', plotEscrowLib.address);

    const plotEscrow = await PlotEscrow.new({ from: coreTeam });

    const claimManager = await ClaimManager.new({ from: coreTeam });
    const plotClarification = await PlotClarificationManager.new({ from: coreTeam });

    const spaceLockerRegistry = await SpaceLockerRegistry.new({ from: coreTeam });
    const spaceLockerFactory = await SpaceLockerFactory.new(
      spaceLockerRegistry.address,
      galtToken.address,
      spaceToken.address,
      splitMerge.address,
      { from: coreTeam }
    );

    // MultiSigFactories
    const multiSigContractFactory = await ArbitratorsMultiSigFactory.new({ from: coreTeam });
    const votingContractFactory = await ArbitratorVotingFactory.new({ from: coreTeam });
    const oracleStakesAccountingFactory = await OracleStakesAccountingFactory.new({ from: coreTeam });
    const multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    const spaceReputationAccounting = await SpaceReputationAccounting.new(
      spaceToken.address,
      multiSigRegistry.address,
      spaceLockerRegistry.address,
      { from: coreTeam }
    );

    const multiSigFactory = await MultiSigFactory.new(
      multiSigRegistry.address,
      galtToken.address,
      oracles.address,
      claimManager.address,
      spaceReputationAccounting.address,
      multiSigContractFactory.address,
      votingContractFactory.address,
      oracleStakesAccountingFactory.address,
      { from: coreTeam }
    );

    await multiSigRegistry.addRoleTo(multiSigFactory.address, await multiSigRegistry.ROLE_FACTORY(), {
      from: coreTeam
    });
    await spaceLockerRegistry.addRoleTo(spaceLockerFactory.address, await spaceLockerRegistry.ROLE_FACTORY(), {
      from: coreTeam
    });
    await oracles.addRoleTo(multiSigFactory.address, await oracles.ROLE_ORACLE_STAKES_NOTIFIER_MANAGER(), {
      from: coreTeam
    });

    await multiSigFactory.setCommission(0, { from: coreTeam });

    // Deploy multiSig X

    let res = await multiSigFactory.build(
      [
        '0x84131ce9f499667c6fd7ec9e0860d8dfaba63ed9',
        '0xafc0fd8153bd835fa6e57e8b5c5b3210c44c5069',
        '0xef7751e98c135d28af63d1353cb02dc502b72ee6'
      ],
      2,
      { from: unauthorized }
    );
    const abMultiSigX = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);
    const abVotingX = await ArbitratorVoting.at(res.logs[0].args.arbitratorVoting);
    const oracleStakesAccountingX = await OracleStakesAccounting.at(res.logs[0].args.oracleStakesAccounting);

    // Deploy multiSig Y
    res = await multiSigFactory.build(
      [
        '0xef7751e98c135d28af63d1353cb02dc502b72ee6',
        '0x02ffe5da61fbf31d46b1d8468487b86109e41943',
        '0xc953e56acd698e1e7a1c2eb930eb7f53c2153d31'
      ],
      2,
      { from: unauthorized }
    );
    const abMultiSigY = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);
    const abVotingY = await ArbitratorVoting.at(res.logs[0].args.arbitratorVoting);
    const oracleStakesAccountingY = await OracleStakesAccounting.at(res.logs[0].args.oracleStakesAccounting);

    await multiSigFactory.setCommission(ether(100), { from: coreTeam });

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

    await splitMerge.initialize(spaceToken.address, { from: coreTeam });
    await splitMergeSandbox.initialize(spaceToken.address, { from: coreTeam });

    await plotManager.initialize(spaceToken.address, splitMerge.address, oracles.address, galtToken.address, coreTeam, {
      from: coreTeam
    });

    await plotClarification.initialize(
      spaceToken.address,
      splitMerge.address,
      oracles.address,
      galtToken.address,
      coreTeam,
      {
        from: coreTeam
      }
    );

    await plotValuation.initialize(
      spaceToken.address,
      splitMerge.address,
      oracles.address,
      galtToken.address,
      coreTeam,
      {
        from: coreTeam
      }
    );

    await plotCustodian.initialize(
      spaceToken.address,
      splitMerge.address,
      oracles.address,
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
      oracles.address,
      galtToken.address,
      coreTeam,
      {
        from: coreTeam
      }
    );

    await galtDex.initialize(
      Web3.utils.toWei('10', 'szabo'),
      Web3.utils.toWei('1', 'szabo'),
      Web3.utils.toWei('1', 'szabo'),
      galtToken.address,
      { from: coreTeam }
    );

    await claimManager.initialize(oracles.address, galtToken.address, multiSigRegistry.address, coreTeam, {
      from: coreTeam
    });

    console.log('Mint GALT to dex contracts..');
    await galtToken.mint(galtDex.address, Web3.utils.toWei('10000000', 'ether'));

    console.log('Set roles of contracts...');
    await splitMerge.addRoleTo(coreTeam, 'geo_data_manager', { from: coreTeam });
    await splitMerge.addRoleTo(plotManager.address, 'geo_data_manager', { from: coreTeam });
    await splitMerge.addRoleTo(plotClarification.address, 'geo_data_manager', { from: coreTeam });

    await galtDex.addRoleTo(coreTeam, 'fee_manager', { from: coreTeam });
    await spaceToken.addRoleTo(coreTeam, 'minter', { from: coreTeam });

    await spaceToken.addRoleTo(plotManager.address, 'minter', { from: coreTeam });
    await spaceToken.addRoleTo(splitMerge.address, 'minter', { from: coreTeam });
    await spaceToken.addRoleTo(splitMerge.address, 'burner', { from: coreTeam });
    await spaceToken.addRoleTo(splitMerge.address, 'operator', { from: coreTeam });

    await oracles.addRoleTo(coreTeam, await oracles.ROLE_APPLICATION_TYPE_MANAGER(), { from: coreTeam });
    await oracles.addRoleTo(coreTeam, await oracles.ROLE_ORACLE_TYPE_MANAGER(), { from: coreTeam });
    await oracles.addRoleTo(coreTeam, await oracles.ROLE_ORACLE_MANAGER(), { from: coreTeam });
    await oracles.addRoleTo(coreTeam, await oracles.ROLE_ORACLE_STAKES_MANAGER(), { from: coreTeam });

    await spaceTokenSandbox.addRoleTo(splitMergeSandbox.address, 'minter', { from: coreTeam });
    await spaceTokenSandbox.addRoleTo(splitMergeSandbox.address, 'burner', { from: coreTeam });
    await spaceTokenSandbox.addRoleTo(splitMergeSandbox.address, 'operator', { from: coreTeam });

    await plotManager.addRoleTo(coreTeam, 'fee_manager', { from: coreTeam });
    await plotValuation.addRoleTo(coreTeam, 'fee_manager', { from: coreTeam });
    await plotCustodian.addRoleTo(coreTeam, 'fee_manager', { from: coreTeam });
    await claimManager.addRoleTo(coreTeam, 'fee_manager', { from: coreTeam });
    await plotClarification.addRoleTo(coreTeam, 'fee_manager', { from: coreTeam });
    await plotEscrow.addRoleTo(coreTeam, 'fee_manager', { from: coreTeam });
    await claimManager.addRoleTo(coreTeam, 'galt_space', { from: coreTeam });

    console.log('Set fees of contracts...');
    await plotManager.setSubmissionFeeRate(Web3.utils.toWei('776.6', 'gwei'), Web3.utils.toWei('38830', 'gwei'), {
      from: coreTeam
    });

    await plotClarification.setGaltSpaceEthShare(33, { from: coreTeam });
    await plotClarification.setGaltSpaceGaltShare(13, { from: coreTeam });

    await plotValuation.setMinimalApplicationFeeInEth(Web3.utils.toWei('0.1', 'ether'), { from: coreTeam });
    await plotCustodian.setMinimalApplicationFeeInEth(Web3.utils.toWei('0.1', 'ether'), { from: coreTeam });
    await plotClarification.setMinimalApplicationFeeInEth(Web3.utils.toWei('0.1', 'ether'), { from: coreTeam });
    await plotEscrow.setMinimalApplicationFeeInEth(Web3.utils.toWei('0.01', 'ether'), { from: coreTeam });

    await plotValuation.setMinimalApplicationFeeInGalt(Web3.utils.toWei('0.5', 'ether'), { from: coreTeam });
    await plotCustodian.setMinimalApplicationFeeInGalt(Web3.utils.toWei('0.5', 'ether'), { from: coreTeam });
    await plotClarification.setMinimalApplicationFeeInGalt(Web3.utils.toWei('0.5', 'ether'), { from: coreTeam });
    await plotEscrow.setMinimalApplicationFeeInGalt(Web3.utils.toWei('0.05', 'ether'), { from: coreTeam });

    await claimManager.setMinimalApplicationFeeInEth(Web3.utils.toWei('6', 'ether'), { from: coreTeam });
    await claimManager.setMinimalApplicationFeeInGalt(Web3.utils.toWei('45', 'ether'), { from: coreTeam });
    await claimManager.setGaltSpaceEthShare(33, { from: coreTeam });
    await claimManager.setGaltSpaceGaltShare(13, { from: coreTeam });
    await claimManager.setMofN(2, 3, { from: coreTeam });

    console.log('Save addresses and abi to deployed folder...');

    const blockNumber = await web3.eth.getBlockNumber();
    const networkId = await web3.eth.net.getId();

    let commit;
    // eslint-disable-next-line
    const rev = fs.readFileSync('.git/HEAD').toString().replace('\n', '');
    if (rev.indexOf(':') === -1) {
      commit = rev;
    } else {
      // eslint-disable-next-line
      commit = fs.readFileSync(`.git/${rev.substring(5)}`).toString().replace('\n', '');
    }

    await new Promise(resolve => {
      const deployDirectory = `${__dirname}/../deployed`;
      if (!fs.existsSync(deployDirectory)) {
        fs.mkdirSync(deployDirectory);
      }

      const deployFile = `${deployDirectory}/${networkId}.json`;
      console.log(`saved to ${deployFile}`);

      fs.writeFile(
        deployFile,
        JSON.stringify(
          {
            packageVersion,
            commit,
            networkId,
            blockNumber,
            galtTokenAddress: galtToken.address,
            galtTokenAbi: galtToken.abi,
            spaceTokenAddress: spaceToken.address,
            spaceTokenAbi: spaceToken.abi,
            splitMergeAddress: splitMerge.address,
            splitMergeAbi: splitMerge.abi,
            // eslint-disable-next-line
            spaceSplitOperationAbi: SpaceSplitOperation._json.abi,
            plotManagerAddress: plotManager.address,
            plotManagerAbi: plotManager.abi,
            plotClarificationAddress: plotClarification.address,
            plotClarificationAbi: plotClarification.abi,
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
            claimManagerAddress: claimManager.address,
            claimManagerAbi: claimManager.abi,
            oraclesAddress: oracles.address,
            oraclesAbi: oracles.abi,
            spaceTokenSandboxAddress: spaceTokenSandbox.address,
            spaceTokenSandboxAbi: spaceTokenSandbox.abi,
            splitMergeSandboxAddress: splitMergeSandbox.address,
            splitMergeSandboxAbi: splitMergeSandbox.abi,
            // multisigs
            oracleStakesAccountingAbi: oracleStakesAccountingX.abi,
            oracleStakesAccountingXAddress: oracleStakesAccountingX.address,
            oracleStakesAccountingYAddress: oracleStakesAccountingY.address,
            spaceReputationAccountingAddress: spaceReputationAccounting.address,
            spaceReputationAccountingAbi: spaceReputationAccounting.abi,
            spaceLockerRegistryAddress: spaceLockerRegistry.address,
            spaceLockerRegistryAbi: spaceLockerRegistry.abi,
            multiSigRegistryAddress: multiSigRegistry.address,
            multiSigRegistryAbi: multiSigRegistry.abi,
            arbitratorsMultiSigXAddress: abMultiSigX.address,
            arbitratorsMultiSigYAddress: abMultiSigY.address,
            arbitratorsMultiSigAbi: abMultiSigX.abi,
            arbitratorVotingXAddress: abVotingX.address,
            arbitratorVotingYAddress: abVotingY.address,
            arbitratorVotingAbi: abVotingX.abi
          },
          null,
          2
        ),
        resolve
      );
    });
  });
};
