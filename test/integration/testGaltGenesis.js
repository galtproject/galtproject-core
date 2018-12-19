const GaltToken = artifacts.require('./GaltToken.sol');
const GaltDex = artifacts.require('./GaltDex.sol');
const GaltGenesis = artifacts.require('./GaltGenesis.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, initHelperArtifacts, ether, assertRevert, clearLibCache } = require('../helpers');

const web3 = new Web3(GaltToken.web3.currentProvider);
initHelperWeb3(web3);
initHelperArtifacts(artifacts);
const { BN } = Web3.utils;

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract.only('GaltGenesis', ([coreTeam, alice, bob, dan, eve, nana]) => {
  before(clearLibCache);

  beforeEach(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.galtDex = await GaltDex.new({ from: coreTeam });
    this.galtGenesis = await GaltGenesis.new(this.galtToken.address, this.galtDex.address, { from: coreTeam });
  });

  it('should be started successfully', async function() {
    await this.galtToken.mint(this.galtGenesis.address, ether(100));
    await this.galtGenesis.start(3600);
    const openingTime = await this.galtGenesis.openingTime();
    const closingTime = await this.galtGenesis.closingTime();
    (closingTime - openingTime).toString(10).should.be.eq('3600');
  });

  it('should be failed on start without GALT', async function() {
    assertRevert(this.galtGenesis.start(3600));
  });

  describe('#pay()', async () => {
    beforeEach(async function() {
      await this.galtToken.mint(this.galtGenesis.address, ether(100));
    });

    it('should allow to pay in process of GaltGenesis and reject after end', async function() {
      await this.galtGenesis.start(5);

      await this.galtGenesis.pay({ from: alice, value: ether(1) });
      await this.galtGenesis.pay({ from: bob, value: ether(2) });

      await waitSeconds(5);
      assertRevert(this.galtGenesis.pay({ from: alice, value: ether(1) }));
      assertRevert(this.galtGenesis.pay({ from: dan, value: ether(1) }));
    });

    it.only('should allow to claim if paid and finished and reject if not', async function() {
      await this.galtGenesis.start(5);

      await this.galtGenesis.pay({ from: alice, value: ether(1) });
      await this.galtGenesis.pay({ from: bob, value: ether(2) });
      await this.galtGenesis.pay({ from: dan, value: ether(3) });
      await this.galtGenesis.pay({ from: eve, value: ether(4) });

      assertRevert(this.galtGenesis.claim({ from: alice }));

      await waitSeconds(5);

      assertRevert(this.galtGenesis.claim({ from: alice }));

      await this.galtGenesis.finish({ from: eve });

      await this.galtGenesis.claim({ from: alice });
      await this.galtGenesis.claim({ from: bob });
      await this.galtGenesis.claim({ from: dan });
      await this.galtGenesis.claim({ from: eve });
      assert.equal(true, false);

      assertRevert(this.galtGenesis.claim({ from: nana }));
    });
  });
});

function waitSeconds(seconds) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, seconds * 1000);
  });
}
