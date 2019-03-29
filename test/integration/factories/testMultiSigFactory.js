const ArbitratorsMultiSig = artifacts.require('./ArbitratorsMultiSig.sol');
const ArbitratorVoting = artifacts.require('./ArbitratorVoting.sol');
const MultiSigRegistry = artifacts.require('./MultiSigRegistry.sol');
const ClaimManager = artifacts.require('./ClaimManager.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const Oracles = artifacts.require('./Oracles.sol');

const Web3 = require('web3');
const { initHelperWeb3, ether, assertRevert } = require('../../helpers');
const { deployMultiSigFactory } = require('../../deploymentHelpers');

const web3 = new Web3(ClaimManager.web3.currentProvider);

initHelperWeb3(web3);

// eslint-disable-next-line
contract.skip("MultiSigFactory", (accounts) => {
  const [coreTeam, claimManagerAddress, spaceReputationAccounting, alice, bob, charlie, dan, eve, frank] = accounts;

  beforeEach(async function() {
    this.claimManager = await ClaimManager.new({ from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.oracles = await Oracles.new({ from: coreTeam });

    this.multiSigRegistry = await MultiSigRegistry.new({ from: coreTeam });
    this.multiSigFactory = await deployMultiSigFactory(
      this.galtToken.address,
      this.oracles,
      claimManagerAddress,
      this.multiSigRegistry,
      spaceRA,
      coreTeam
    );

    await this.galtToken.mint(alice, ether(1000), { from: coreTeam });
  });

  it('should build contracts with commission paid in galts', async function() {
    await this.galtToken.approve(this.multiSigFactory.address, ether(20), { from: alice });

    const members = [bob, charlie, dan, eve, frank];

    const res = await this.multiSigFactory.build(members, 3, { from: alice });
    const abMultiSigX = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);
    const abVotingX = await ArbitratorVoting.at(res.logs[0].args.arbitratorVoting);

    assert.sameMembers(await abMultiSigX.getArbitrators(), members);
    await assertRevert(abVotingX.pushArbitrators());
  });

  it('should build contracts without commission', async function() {
    await this.multiSigFactory.setCommission(0, { from: coreTeam });

    const members = [bob, charlie, dan, eve, frank];

    const res = await this.multiSigFactory.build(members, 3, { from: alice });
    const abMultiSigX = await ArbitratorsMultiSig.at(res.logs[0].args.arbitratorMultiSig);

    assert.sameMembers(await abMultiSigX.getArbitrators(), members);
  });
});
