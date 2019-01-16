/* eslint-disable */
const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const SpaceLockerRegistry = artifacts.require('./SpaceLockerRegistry.sol');
const SpaceReputationAccounting = artifacts.require('./SpaceReputationAccounting.sol');
const NewMemberProposalManagerFactory = artifacts.require('./NewMemberProposalManagerFactory.sol');
const MockModifyConfigProposalManagerFactory = artifacts.require('./MockModifyConfigProposalManagerFactory.sol');
const MockModifyConfigProposalManager = artifacts.require('./MockModifyConfigProposalManager.sol');
const FundStorageFactory = artifacts.require('./FundStorageFactory.sol');
const MockRSRA = artifacts.require('./MockRSRA.sol');
const MockRSRAFactory = artifacts.require('./MockRSRAFactory.sol');
const FundFactory = artifacts.require('./FundFactory.sol');
const FundStorage = artifacts.require('./FundStorage.sol');
const _ = require('lodash');

const Web3 = require('web3');
const { initHelperWeb3, initHelperArtifacts, ether } = require('../test/helpers');

const web3 = new Web3(SpaceToken.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

module.exports = async function(done) {
  // TODO: fix
  done();
  return;
  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];
  const spaceLockerRegistryAddress = accounts[3];
  this.spaceToken = await SpaceToken.new('Name', 'Symbol', { from: coreTeam });
  this.galtToken = await GaltToken.new({ from: coreTeam });
  this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
  this.spaceLockerRegistry = await SpaceLockerRegistry.new({ from: coreTeam });
  this.spaceReputationAccounting = await SpaceReputationAccounting.new(
    this.spaceToken.address,
    this.multiSigRegistry.address,
    spaceLockerRegistryAddress,
    { from: coreTeam }
  );

  // fund factory contracts

  this.newMemberProposalManagerFactory = await NewMemberProposalManagerFactory.new();
  this.modifyConfigProposalManagerFactory = await MockModifyConfigProposalManagerFactory.new();
  this.rsraFactory = await MockRSRAFactory.new();
  this.fundStorageFactory = await FundStorageFactory.new();

  this.fundFactory = await FundFactory.new(
    this.galtToken.address,
    this.spaceToken.address,
    this.spaceLockerRegistry.address,
    this.rsraFactory.address,
    this.fundStorageFactory.address,
    this.newMemberProposalManagerFactory.address,
    this.modifyConfigProposalManagerFactory.address,
    { from: coreTeam }
  );

  // assign roles
  await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

  console.log('Building fund..');
  // build fund
  await this.galtToken.approve(this.fundFactory.address, ether(100), { from: alice });
  let res = await this.fundFactory.build(false, 60, 50, 60, 60, 60, { from: alice });
  this.rsraX = await MockRSRA.at(res.logs[0].args.rsra);
  this.fundStorageX = await FundStorage.at(res.logs[0].args.fundStorage);
  this.modifyConfigProposalManagerX = await MockModifyConfigProposalManager.at(
    res.logs[0].args.modifyConfigProposalManager
  );

  this.rsraXWeb3 = new web3.eth.Contract(this.rsraX.abi, this.rsraX.address);
  this.modifyConfigProposalManagerXWeb3 = new web3.eth.Contract(
    this.modifyConfigProposalManagerX.abi,
    this.modifyConfigProposalManagerX.address
  );
  console.log('Generating beneficiaries...');

  const beneficiaries = [];
  const count = 400;

  for (let i = 0; i < count; i++) {
    beneficiaries.push(web3.utils.randomHex(20));
  }

  const beneficiariesChunked40 = _.chunk(beneficiaries, 35);

  console.log('Populating #mintAndLock() chunks...');

  for (let i = 0; i < beneficiariesChunked40.length; i++) {
    console.log(`...await #${i} of ${beneficiariesChunked40.length}`);
    // eslint-disable-next-line
    await this.rsraX.mintAndLockHack(beneficiariesChunked40[i], 300, { from: alice });
  }

  console.log('Awaiting #mintAndLock() for bob');
  await this.rsraX.mintAndLockHack([bob], 200, { from: alice });

  res = await this.rsraXWeb3.methods.totalLockedSupply().call();
  console.log('TotalLockedSupply:', res);

  try {
    res = await this.modifyConfigProposalManagerX.propose(
      'modify_config_threshold',
      '0x000000000000000000000000000000000000000000000000000000000000002a',
      // '123123',
      'blah',
      {
        from: bob
      }
    );
  } catch (e) {
    console.log(e);
  }

  console.log('res', res.logs);
  const proposalId = res.logs[0].args.proposalId.toString(10);
  console.log('proposalId', proposalId);

  const beneficiariesAye = beneficiaries.slice(0, beneficiaries.length - 40);
  const beneficiariesAyeChunks = _.chunk(beneficiariesAye, 30);

  const promises = [];

  console.log('Populating #ayeAllHack() chunks...');

  for (let i = 0; i < beneficiariesAyeChunks.length; i++) {
    promises.push(
      this.modifyConfigProposalManagerX.ayeAllHack(web3.utils.numberToHex(proposalId), beneficiariesAyeChunks[i])
    );
  }

  console.log('Joining #ayeAllHack() chunks...');

  await Promise.all(promises);

  console.log('Calling #triggerApprove()');

  res = await this.modifyConfigProposalManagerX.triggerApprove(web3.utils.numberToHex(proposalId));

  console.log('#triggerApprove():');
  console.log('ayeShare', res.logs[0].args.ayeShare.toString(10));
  console.log('threshold', res.logs[0].args.threshold.toString(10));
  console.log('gas used', res.receipt.gasUsed);
  console.log('done');
  done();
};
