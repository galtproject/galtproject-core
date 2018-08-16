const PlotManager = artifacts.require('./PlotManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const { ether, assertRevert } = require('../helpers');

const web3 = new Web3(PlotManager.web3.currentProvider);
const { BN } = Web3.utils;

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

const GEOHASH_MASK = new BN('0100000000000000000000000000000000000000000000000000000000000000', 16);

/**
 * Alice is an applicant
 * Bob is a validator
 */
contract('PlotManager', ([coreTeam, alice, bob, charlie]) => {
  beforeEach(async function() {
    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.splitMerge = await SplitMerge.new({ from: coreTeam });

    this.spaceToken.initialize('SpaceToken', 'SPACE', { from: coreTeam });
    this.plotManager.initialize(ether(6), '24', this.spaceToken.address, this.splitMerge.address, { from: coreTeam });
    this.splitMerge.initialize(this.spaceToken.address, { from: coreTeam });

    this.spaceToken.addRoleTo(this.plotManager.address, 'minter');
    this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  it('should be initialized successfully', async function() {
    (await this.plotManager.validationFeeInEth()).toString(10).should.be.a.bignumber.eq(ether(6));
  });

  describe('#addValidator()', () => {
    it('should allow an ower to assign validators', async function() {
      await this.plotManager.addValidator(alice, 'Alice', 'IN', { from: coreTeam });
    });

    it('should deny any other person than owner to assign validators', async function() {
      await assertRevert(this.plotManager.addValidator(alice, 'Alice', 'IN', { from: alice }));
    });
  });

  describe('#removeValidator()', () => {
    it('should allow an ower to remove validators', async function() {
      await this.plotManager.removeValidator(alice, { from: coreTeam });
    });

    it('should deny any other person than owner to remove validators', async function() {
      await assertRevert(this.plotManager.removeValidator(alice, { from: alice }));
    });
  });

  describe('application pipeline', () => {
    beforeEach(async function() {
      this.initVertices = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
      this.initLedgerIdentifier = 'шц50023中222ائِيل';

      this.vertices = this.initVertices.map(galt.geohashToNumber);
      this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
      this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);
      const res = await this.plotManager.applyForPlotOwnership(
        this.vertices,
        galt.geohashToGeohash5('sezu06'),
        this.credentials,
        this.ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        7,
        { from: alice, gas: 1000000, value: ether(6) }
      );

      this.aId = res.logs[0].args.id;
    });

    describe('#applyForPlotOwnership()', () => {
      it('should provide methods to create and read an application', async function() {
        const res2 = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();

        // assertions
        for (let i = 0; i < res2.vertices.length; i++) {
          galt.numberToGeohash(res2.vertices[i]).should.be.equal(this.initVertices[i]);
        }

        assert.equal(res2.status, 1);
        assert.equal(res2.precision, 7);
        assert.equal(res2.applicant.toLowerCase(), alice);
        assert.equal(web3.utils.hexToAscii(res2.country), 'MN');
        assert.equal(web3.utils.hexToUtf8(res2.ledgerIdentifier), this.initLedgerIdentifier);
      });

      // eslint-disable-next-line
      it('should mint a pack, geohash, swap the geohash into the pack and keep it at PlotManager addres', async function() {
        let res = await this.spaceToken.totalSupply();
        assert.equal(res.toString(), 2);
        res = await this.spaceToken.balanceOf(this.plotManager.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.balanceOf(this.splitMerge.address);
        assert.equal(res.toString(), 1);
        res = await this.spaceToken.ownerOf('0x0100000000000000000000000000000000000000000000000000000030dfe806');
        assert.equal(res, this.splitMerge.address);
        res = await this.spaceToken.ownerOf('0x0200000000000000000000000000000000000000000000000000000000000000');
        assert.equal(res, this.plotManager.address);
        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert(res, 1);
      });

      describe('payable', () => {
        it('should reject applications without payment', async function() {
          await assertRevert(
            this.plotManager.applyForPlotOwnership(
              this.vertices,
              galt.geohashToGeohash5('sezu06'),
              this.credentials,
              this.ledgerIdentifier,
              web3.utils.asciiToHex('MN'),
              7,
              { from: alice, gas: 1000000 }
            )
          );
        });

        it('should reject applications with payment less than required', async function() {
          await assertRevert(
            this.plotManager.applyForPlotOwnership(
              this.vertices,
              galt.geohashToGeohash5('sezu06'),
              this.credentials,
              this.ledgerIdentifier,
              web3.utils.asciiToHex('MN'),
              7,
              { from: alice, gas: 1000000, value: ether(3) }
            )
          );
        });

        it('should reject applications with payment greater than required', async function() {
          await assertRevert(
            this.plotManager.applyForPlotOwnership(
              this.vertices,
              galt.geohashToGeohash5('sezu06'),
              this.credentials,
              this.ledgerIdentifier,
              web3.utils.asciiToHex('MN'),
              7,
              { from: alice, gas: 1000000, value: ether(6.5) }
            )
          );
        });
      });
    });

    describe('#addGeohashesToApplication', () => {
      it('should add a list of geohashes', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes += ` gbsuv7zq gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });
      });

      it('should re-use geohash space tokens if they belong to PlotManager', async function() {
        const tokenId = galt.geohashToNumber('sezu05');
        let res = await this.spaceToken.mintGeohash(this.plotManager.address, tokenId.toString(10), {
          from: coreTeam
        });

        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);
        geohashes.push(tokenId.toString());
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });

        res = await this.spaceToken.ownerOf(tokenId.xor(GEOHASH_MASK).toString());
        assert.equal(res, this.splitMerge.address);
      });

      it('should reject if already minted token doesnt belong to PlotManager', async function() {
        const tokenId = galt.geohashToNumber('sezu05');
        let res = await this.spaceToken.mintGeohash(bob, tokenId.toString(10), {
          from: coreTeam
        });

        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);
        geohashes.push(tokenId.toString());
        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice }));

        res = await this.spaceToken.ownerOf(tokenId.xor(GEOHASH_MASK).toString());
        assert.equal(res, bob);
      });

      // TODO: unskip after application dissably implementation
      it.skip('should add a list of geohashes if an application status is rejected', async function() {
        const geohashes = ['sezu01', 'sezu02'].map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.validateApplication(this.aId, false, { from: bob });
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice });
      });

      it('should reject push from non-owner', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: coreTeam }));
      });

      it('should reject push when status is not new or rejected', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        await this.plotManager.submitApplication(this.aId, { from: alice });
        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice }));
      });

      // TODO: add check for non allowed symbols on geohash token minting
      it.skip('should reject push if geohash array contains an empty element', async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);
        geohashes.push('');

        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes, [], [], { from: alice }));
      });
    });

    describe('#submitApplication', () => {
      it('should change status of an application from from new to submitted', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);

        await this.plotManager.submitApplication(this.aId, { from: alice });

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 2);
      });

      it('should change status of an application from from rejected to submitted');

      it('should reject if status is not new or rejected', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);

        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.validateApplication(this.aId, true, { from: bob });

        await assertRevert(this.plotManager.submitApplication(this.aId, { from: alice }));

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 3);
      });

      it('should reject if another person tries to submit the application', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);

        await assertRevert(this.plotManager.submitApplication(this.aId, { from: bob }));

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);
      });
    });
  });

  describe.skip('contract', () => {
    it('should mint package-token to SplitMerge contract', async function() {
      this.timeout(40000);
      const initVertices = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
      const initLedgerIdentifier = 'шц50023中222ائِيل';

      const vertices = initVertices.map(galt.geohashToNumber);
      const credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
      const ledgerIdentifier = web3.utils.utf8ToHex(initLedgerIdentifier);
      let res = await this.plotManager.applyForPlotOwnership(
        vertices,
        credentials,
        ledgerIdentifier,
        web3.utils.asciiToHex('MN'),
        7,
        { from: alice, gas: 500000 }
      );

      const aId = res.logs[0].args.id;
      // console.log('Application ID:', aId);

      await this.plotManager.mintPack(aId, { from: alice });

      let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
      geohashes += ` gbsuv7zq gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
      geohashes = geohashes.split(' ').map(galt.geohashToNumber);
      await this.plotManager.pushGeohashes(aId, geohashes, { from: alice });

      geohashes = `sezu7zht sezu7zhv sezu7zjj sezu7zhs sezu7zhu sezu7zjh sezu7zhe sezu7zhg sezu7zj5`;
      geohashes = geohashes.split(' ').map(galt.geohashToNumber);
      await this.plotManager.pushGeohashes(aId, geohashes, { from: alice });

      // Verify pre-swap state
      res = await this.plotManagerWeb3.methods.getPlotApplication(aId).call({ from: alice });

      let { packageToken, geohashTokens, status } = res;

      assert.equal(status, 1);

      res = await this.spaceToken.ownerOf.call(packageToken);
      assert.equal(res, this.splitMerge.address);

      let tasks = [];
      for (let i = 0; i < geohashTokens.length; i++) {
        tasks.push(this.spaceToken.ownerOf.call(geohashTokens[i]));
      }

      let results = await Promise.all(tasks);
      for (let i = 0; i < results.length; i++) {
        assert.equal(results[i], this.plotManager.address);
      }

      // Swap
      await this.plotManager.swapTokens(aId, { from: alice });

      // Verify after-swap state
      res = await this.plotManagerWeb3.methods.getPlotApplication(aId).call({ from: alice });

      ({ packageToken, geohashTokens, status } = res);

      assert.equal(status, 2);

      res = await this.spaceToken.ownerOf.call(res.packageToken);
      assert.equal(res, this.plotManager.address);

      tasks = [];
      for (let i = 0; i < geohashTokens.length; i++) {
        tasks.push(this.spaceToken.ownerOf.call(geohashTokens[i]));
      }

      results = await Promise.all(tasks);
      for (let i = 0; i < results.length; i++) {
        assert.equal(results[i], this.splitMerge.address);
      }

      // Submit
      await this.plotManager.submitApplication(aId, { from: alice, value: ether(6) });

      // Add Bob as a validator
      await this.plotManager.addValidator(bob, web3.utils.utf8ToHex('Bob'), web3.utils.utf8ToHex('ID'), {
        from: coreTeam
      });

      // Bob validates the application from Alice
      await this.plotManager.validateApplication(aId, true, { from: bob });

      res = await this.plotManagerWeb3.methods.getPlotApplication(aId).call({ from: charlie });
      assert.equal(res.status, 4);

      res = await this.spaceToken.totalSupply();
      assert.equal(res, 27);
    });

    describe('actions on new applications', () => {
      beforeEach(async function() {
        const initVertices = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
        const initLedgerIdentifier = 'шц50023中222ائِيل';

        const vertices = initVertices.map(galt.geohashToNumber);
        this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
        const ledgerIdentifier = web3.utils.utf8ToHex(initLedgerIdentifier);
        const res = await this.plotManager.applyForPlotOwnership(
          vertices,
          this.credentials,
          ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: alice, gas: 500000 }
        );

        this.aId = res.logs[0].args.id;
      });

      it('should provide an option to verify applicants credentials', async function() {
        const res = await this.plotManager.isCredentialsHashValid(this.aId, this.credentials);
        assert(res);
      });
    });

    describe('actions on approved applications', () => {
      beforeEach(async function() {
        this.fee = ether(6);
        const initVertices = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
        const initLedgerIdentifier = 'шц50023中222ائِيل';

        const vertices = initVertices.map(galt.geohashToNumber);
        this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
        const ledgerIdentifier = web3.utils.utf8ToHex(initLedgerIdentifier);
        const res = await this.plotManager.applyForPlotOwnership(
          vertices,
          this.credentials,
          ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: alice, gas: 500000 }
        );

        this.aId = res.logs[0].args.id;

        // mint
        await this.plotManager.mintPack(this.aId, { from: alice });

        // push
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes = geohashes.split(' ').map(galt.geohashToNumber);
        await this.plotManager.pushGeohashes(this.aId, geohashes, { from: alice });

        // Swap
        await this.plotManager.swapTokens(this.aId, { from: alice });

        // Submit
        await this.plotManager.submitApplication(this.aId, { from: alice, value: this.fee });

        await this.plotManager.addValidator(bob, web3.utils.utf8ToHex('Bob'), web3.utils.utf8ToHex('ID'), {
          from: coreTeam
        });

        // Bob validates the application from Alice
        await this.plotManager.validateApplication(this.aId, true, { from: bob });
      });

      it('should provide validator an option to claim his earnings', async function() {
        const initialBalance = await web3.eth.getBalance(bob);

        await this.plotManager.claimFee(this.aId, { from: bob });

        const currentBalance = await web3.eth.getBalance(bob);
        const diff = currentBalance - initialBalance;

        assert(web3.utils.fromWei(diff.toString(), 'ether') < 6);
        assert(web3.utils.fromWei(diff.toString(), 'ether') > 5);
      });
    });
  });
});
