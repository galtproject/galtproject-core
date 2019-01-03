const GaltToken = artifacts.require('./GaltToken.sol');
const MockGaltGenesis = artifacts.require('./MockGaltGenesis.sol');
const EtherToken = artifacts.require('bancor-contracts/solidity/contracts/token/EtherToken.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, initHelperArtifacts, ether, szabo, assertRevert, clearLibCache } = require('../helpers');

const web3 = new Web3(GaltToken.web3.currentProvider);
initHelperWeb3(web3);
initHelperArtifacts(artifacts);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract.only('GaltGenesis', ([coreTeam, galtDexAddress, alice, bob, dan, eve, nana]) => {
  before(clearLibCache);

  beforeEach(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.etherToken = await EtherToken.new({ from: coreTeam });
    this.galtGenesis = await MockGaltGenesis.new(this.galtToken.address, galtDexAddress, this.etherToken.address, {
      from: coreTeam
    });
  });

  it('should be started successfully', async function() {
    await assertRevert(this.galtGenesis.finish());

    await this.galtToken.mint(this.galtGenesis.address, ether(100));
    await this.galtGenesis.start(3600);
    const openingTime = await this.galtGenesis.openingTime();
    const closingTime = await this.galtGenesis.closingTime();
    (closingTime - openingTime).toString(10).should.be.eq('3600');
  });

  it('should be failed on start without GALT', async function() {
    await assertRevert(this.galtGenesis.start(3600));
  });

  describe('#pay() and #claim()', async () => {
    beforeEach(async function() {
      await this.galtToken.mint(this.galtGenesis.address, ether(100));
    });

    it('should allow to pay in process of GaltGenesis and reject after end', async function() {
      await this.galtGenesis.start(5);

      await this.galtGenesis.pay({ from: alice, value: ether(1) });
      await this.galtGenesis.pay({ from: bob, value: ether(2) });

      await this.galtGenesis.hackClose();
      await assertRevert(this.galtGenesis.pay({ from: alice, value: ether(1) }));
      await assertRevert(this.galtGenesis.pay({ from: dan, value: ether(1) }));
    });

    it('should allow to claim if paid and finished and reject if not', async function() {
      await this.galtGenesis.start(5);

      await this.galtGenesis.pay({ from: alice, value: ether(1) });
      await this.galtGenesis.pay({ from: bob, value: ether(2) });
      await this.galtGenesis.pay({ from: dan, value: ether(3) });
      await this.galtGenesis.pay({ from: eve, value: ether(4) });

      await assertRevert(this.galtGenesis.claim({ from: alice }));

      await this.galtGenesis.hackClose();

      await assertRevert(this.galtGenesis.claim({ from: alice }));

      await this.galtGenesis.finish({ from: eve });

      assert.equal((await this.etherToken.balanceOf(galtDexAddress)).toString(), ether(1 + 2 + 3 + 4).toString());

      let res = await this.galtGenesis.claim({ from: alice });
      const aliceClaimedAmount = res.logs[0].args.galtValue;
      res = await this.galtGenesis.claim({ from: bob });
      const bobClaimedAmount = res.logs[0].args.galtValue;
      res = await this.galtGenesis.claim({ from: dan });
      const danClaimedAmount = res.logs[0].args.galtValue;
      res = await this.galtGenesis.claim({ from: eve });
      const eveClaimedAmount = res.logs[0].args.galtValue;

      assert.equal((await this.galtToken.balanceOf(this.galtGenesis.address)).toString(), '0');
      assert.equal((await this.galtToken.balanceOf(alice)).toString(), ether(100 / (1 + 2 + 3 + 4)).toString());

      await assertRevert(this.galtGenesis.claim({ from: nana }));
      await assertRevert(this.galtGenesis.claim({ from: alice }));

      assert.equal(bobClaimedAmount.div(aliceClaimedAmount).toString(), '2');
      assert.equal(danClaimedAmount.div(aliceClaimedAmount).toString(), '3');
      assert.equal(eveClaimedAmount.div(aliceClaimedAmount).toString(), '4');
    });
  });
});
