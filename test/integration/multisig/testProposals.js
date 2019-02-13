const GaltToken = artifacts.require('./GaltToken.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const ArbitratorStakeAccounting = artifacts.require('./MockArbitratorStakeAccounting.sol');
const AddressLinkedList = artifacts.require('./AddressLinkedList.sol');
const VotingLinkedList = artifacts.require('./VotingLinkedList.sol');
const OracleStakesAccounting = artifacts.require('./OracleStakesAccounting.sol');
const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const ArbitratorVoting = artifacts.require('./ArbitratorVoting.sol');
const ArbitrationConfig = artifacts.require('./ArbitrationConfig.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const Oracles = artifacts.require('./Oracles.sol');
const ClaimManager = artifacts.require('./ClaimManager.sol');
const MockSRA = artifacts.require('./MockSRA.sol');
const SpaceLockerRegistry = artifacts.require('./SpaceLockerRegistry.sol');

const Web3 = require('web3');
const galt = require('@galtproject/utils');

const { assertRevert, ether, initHelperWeb3 } = require('../../helpers');
const { deployMultiSigFactory } = require('../../deploymentHelpers');

const { utf8ToHex, hexToUtf8 } = Web3.utils;
const bytes32 = utf8ToHex;
const web3 = new Web3(GaltToken.web3.currentProvider);

initHelperWeb3(web3);

// eslint-disable-next-line no-underscore-dangle
const _ES = bytes32('');
const MN = bytes32('MN');
const BOB = bytes32('Bob');
const CHARLIE = bytes32('Charlie');

const NICK = bytes32('Nick');
const MIKE = bytes32('Mike');
const OLIVER = bytes32('Oliver');

const PC_CUSTODIAN_ORACLE_TYPE = bytes32('PC_CUSTODIAN_ORACLE_TYPE');
const PC_AUDITOR_ORACLE_TYPE = bytes32('PC_AUDITOR_ORACLE_TYPE');

const MY_APPLICATION = '0x70042f08921e5b7de231736485f834c3bda2cd3587936c6a668d44c1ccdeddf0';

const ClaimApplicationStatus = {
  NOT_EXISTS: 0,
  SUBMITTED: 1,
  APPROVED: 2,
  REJECTED: 3,
  REVERTED: 4
};

contract('Arbitrator Stake Slashing', accounts => {
  const [
    coreTeam,
    slashManager,
    feeManager,
    applicationTypeManager,
    oracleManager,
    sraAddress,
    galtSpaceOrg,

    // initial arbitrators
    a1,
    a2,
    a3,

    // arbitrators
    alice,
    bob,
    charlie,
    dan,
    eve,

    // oracles
    mike,
    nick,
    oliver,

    // claimer
    zack,

    // unauthorized
    unauthorized
  ] = accounts;

  beforeEach(async function() {
    this.attachedDocuments = [
      'QmYNQJoKGNHTpPxCBPh9KkDpaExgd2duMa3aF6ytMpHdao',
      'QmeveuwF5wWBSgUXLG6p1oxF3GKkgjEnhA6AAwHUoVsx6E',
      'QmSrPmbaUKA3ZodhzPWZnpFgcPMFWF4QsxXbkWfEptTBJd'
    ];

    // Setup Galt token
    await (async () => {
      this.galtToken = await GaltToken.new({ from: coreTeam });

      await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(charlie, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(dan, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(eve, ether(10000000), { from: coreTeam });

      await this.galtToken.mint(mike, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(nick, ether(10000000), { from: coreTeam });
      await this.galtToken.mint(oliver, ether(10000000), { from: coreTeam });

      await this.galtToken.mint(zack, ether(10000000), { from: coreTeam });
    })();

    // Create and initialize contracts
    await (async () => {
      this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
      this.oracles = await Oracles.new({ from: coreTeam });
      this.claimManager = await ClaimManager.new({ from: coreTeam });

      this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
      this.spaceLockerRegistry = await SpaceLockerRegistry.new({ from: coreTeam });

      this.sra = await MockSRA.new(
        this.spaceToken.address,
        this.multiSigRegistry.address,
        this.spaceLockerRegistry.address,
        { from: coreTeam }
      );

      this.multiSigFactory = await deployMultiSigFactory(
        this.galtToken.address,
        this.oracles,
        this.claimManager.address,
        this.multiSigRegistry,
        this.sra.address,
        coreTeam
      );

      await this.claimManager.initialize(
        this.oracles.address,
        this.galtToken.address,
        this.multiSigRegistry.address,
        galtSpaceOrg,
        {
          from: coreTeam
        }
      );
    })();

    // Setup multiSig
    await (async () => {
      await this.galtToken.approve(this.multiSigFactory.address, ether(20), { from: alice });

      let res = await this.multiSigFactory.buildFirstStep([a1, a2, a3], 2, 7, 10, ether(1000), [80, 80, 70, 90], {
        from: alice
      });
      console.log('step 1', res.receipt.gasUsed);
      this.abMultiSigX = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);
      this.oracleStakesAccountingX = await OracleStakesAccounting.at(res.logs[0].args.oracleStakesAccounting);
      this.multiSigXGroupId = res.logs[0].args.groupId;

      res = await this.multiSigFactory.buildSecondStep(this.multiSigXGroupId, 60, { from: alice });
      console.log('step 2', res.receipt.gasUsed);
      this.abVotingX = await ArbitratorVoting.at(res.logs[0].args.arbitratorVoting);
      this.arbitratorStakeAccountingX = await ArbitratorStakeAccounting.at(res.logs[0].args.arbitratorStakeAccounting);
      // TODO: build all further multisigs
      // - revokeArbitrators
      // - modifyThreshold
      // - minimalArbitratorStake
      // - contractAddress

      this.mX = this.abMultiSigX.address;
      console.log('mX', this.mX);
    })();


    // Mint and distribute SRA reputation using mock
    await (async () => {
      await this.sra.mintAll([alice, bob, charlie, dan, eve], 500);
      assert.equal(await this.sra.balanceOf(alice), 500);
      await this.sra.lockReputation(this.mX, 500, { from: alice });
      return;
      await this.sra.lockReputation(this.mX, 500, { from: bob });
      await this.sra.delegate(charlie, dan, 500, { from: dan });
      await this.sra.lockReputation(this.mX, 1000, { from: charlie });
      await this.sra.lockReputation(this.mX, 500, { from: eve });
    })();
  });

  describe('ModifyThreshold Proposals', () => {
    it.only('should change corresponding values', async function() {
      // TODO: create proposal
    });
  });
});
