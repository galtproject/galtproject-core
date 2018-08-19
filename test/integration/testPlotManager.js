const PlotManager = artifacts.require('./PlotManager.sol');
const SpaceToken = artifacts.require('./SpaceToken.sol');
const SplitMerge = artifacts.require('./SplitMerge.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const galt = require('@galtproject/utils');
const { ether, assertRevert, zeroAddress } = require('../helpers');

const web3 = new Web3(PlotManager.web3.currentProvider);
const { BN } = Web3.utils;

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

const GEOHASH_MASK = new BN('0100000000000000000000000000000000000000000000000000000000000000', 16);
const ApplicationStatuses = {
  NOT_EXISTS: 0,
  NEW: 1,
  SUBMITTED: 2,
  CONSIDERATION: 3,
  APPROVED: 4,
  REJECTED: 5,
  REVERTED: 6,
  DISASSEMBLED: 7,
  REFUNDED: 8,
  COMPLETED: 9,
  CLOSED: 10
};

Object.freeze(ApplicationStatuses);

/**
 * Alice is an applicant
 * Bob is a validator
 */
contract('PlotManager', ([coreTeam, galtSpaceOrg, alice, bob, charlie]) => {
  beforeEach(async function() {
    this.initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
    this.initLedgerIdentifier = 'шц50023中222ائِيل';

    this.contour = this.initContour.map(galt.geohashToNumber);
    this.credentials = web3.utils.sha3(`Johnj$Galt$123456po`);
    this.ledgerIdentifier = web3.utils.utf8ToHex(this.initLedgerIdentifier);

    this.plotManager = await PlotManager.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    this.splitMerge = await SplitMerge.new({ from: coreTeam });

    this.spaceToken.initialize('SpaceToken', 'SPACE', { from: coreTeam });
    this.plotManager.initialize(ether(6), '24', galtSpaceOrg, this.spaceToken.address, this.splitMerge.address, {
      from: coreTeam
    });
    this.splitMerge.initialize(this.spaceToken.address, this.plotManager.address, { from: coreTeam });

    this.spaceToken.addRoleTo(this.plotManager.address, 'minter');
    this.spaceToken.addRoleTo(this.splitMerge.address, 'minter');
    this.spaceToken.addRoleTo(this.splitMerge.address, 'operator');

    this.plotManagerWeb3 = new web3.eth.Contract(this.plotManager.abi, this.plotManager.address);
    this.spaceTokenWeb3 = new web3.eth.Contract(this.spaceToken.abi, this.spaceToken.address);
  });

  it('should be initialized successfully', async function() {
    (await this.plotManager.applicationFeeInEth()).toString(10).should.be.a.bignumber.eq(ether(6));
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

  describe('#isValidator()', () => {
    it('return true if validator is active', async function() {
      assert(!(await this.plotManagerWeb3.methods.isValidator(alice).call()));
      await this.plotManager.addValidator(alice, 'Alice', 'IN', { from: coreTeam });
      assert(await this.plotManagerWeb3.methods.isValidator(alice).call());
      await this.plotManager.removeValidator(alice, { from: coreTeam });
      assert(!(await this.plotManagerWeb3.methods.isValidator(alice).call()));
    });
  });

  describe('application pipeline', () => {
    beforeEach(async function() {
      const res = await this.plotManager.applyForPlotOwnership(
        this.contour,
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
        const res3 = await this.splitMerge.getPackageContour(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );

        // assertions
        for (let i = 0; i < res3.length; i++) {
          galt.numberToGeohash(res3[i].toString(10)).should.be.equal(this.initContour[i]);
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
              this.contour,
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
              this.contour,
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
              this.contour,
              galt.geohashToGeohash5('sezu06'),
              this.credentials,
              this.ledgerIdentifier,
              web3.utils.asciiToHex('MN'),
              7,
              { from: alice, gas: 1000000, value: ether(6.5) }
            )
          );
        });

        it('should calculate correspondive validator and coreTeam rewards in Eth', async function() {
          const res = await this.plotManagerWeb3.methods.getApplicationFinanceById(this.aId).call();
          assert.equal(res.status, 1);
          res.validatorRewardEth.should.be.a.bignumber.eq(new BN('4560000000000000000'));
          res.galtSpaceRewardEth.should.be.a.bignumber.eq(new BN('1440000000000000000'));
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

      it('should add a list of geohashes if an application status is reverted', async function() {
        let geohashes1 = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes1 = geohashes1.split(' ').map(galt.geohashToGeohash5);
        const geohashes2 = ['sezu01', 'sezu02'].map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes1, [], [], { from: alice });

        assert.equal(await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashes1[0])), this.splitMerge.address);
        assert.equal(await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashes1[1])), this.splitMerge.address);

        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        await this.plotManager.revertApplication(this.aId, { from: bob });

        let res = await this.splitMerge.packageGeohashesCount(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );
        assert.equal(res, 9);

        await this.plotManager.addGeohashesToApplication(this.aId, geohashes2, [], [], { from: alice });
        res = await this.splitMerge.packageGeohashesCount(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );
        assert.equal(res, 11);
      });

      it('should throw if already existing geohashes are passed in', async function() {
        let geohashes1 = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes1 = geohashes1.split(' ').map(galt.geohashToGeohash5);
        const geohashes2 = ['sezu01', 'gbsuv7ztm'].map(galt.geohashToGeohash5);

        // TODO: pass neighbours and directions
        await this.plotManager.addGeohashesToApplication(this.aId, geohashes1, [], [], { from: alice });

        await assertRevert(this.plotManager.addGeohashesToApplication(this.aId, geohashes2, [], [], { from: alice }));
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

      it('should allow submit reverted application to the same validator who reverted it', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);

        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        await this.plotManager.revertApplication(this.aId, { from: bob });
        await this.plotManager.submitApplication(this.aId, { from: alice });

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
        assert.equal(res.validator.toLowerCase(), bob);
      });

      it('should reject if status is not new or rejected', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);

        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });

        await assertRevert(this.plotManager.submitApplication(this.aId, { from: alice }));

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.APPROVED);
      });

      it('should reject if another person tries to submit the application', async function() {
        let res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);

        await assertRevert(this.plotManager.submitApplication(this.aId, { from: bob }));

        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);
      });
    });

    describe('#lockApplicationForReview', () => {
      beforeEach(async function() {
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.addValidator(charlie, 'Charlie', 'ID', { from: coreTeam });
      });

      it('should allow a validator to lock a submitted application', async function() {
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
        assert.equal(res.validator.toLowerCase(), bob);
      });

      it('should deny validator to lock an application which is already on consideration', async function() {
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);

        await assertRevert(this.plotManager.lockApplicationForReview(this.aId, { from: charlie }));
      });

      it('should push an application id to the validators list for caching', async function() {
        // lock first
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });

        // submit second
        let res = await this.plotManager.applyForPlotOwnership(
          this.contour,
          galt.geohashToGeohash5('sezu07'),
          this.credentials,
          this.ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: alice, gas: 1000000, value: ether(6) }
        );
        const a2Id = res.logs[0].args.id;
        await this.plotManager.submitApplication(a2Id, { from: alice });

        // lock second
        await this.plotManager.lockApplicationForReview(a2Id, { from: bob });

        res = await this.plotManager.getApplicationsByValidator(bob);
        assert.equal(res.length, 2);
        assert.equal(res[0], this.aId);
        assert.equal(res[1], a2Id);
      });

      it('should deny validator to lock an application which is new', async function() {
        let res = await this.plotManager.applyForPlotOwnership(
          this.contour,
          galt.geohashToGeohash5('sezu05'),
          this.credentials,
          this.ledgerIdentifier,
          web3.utils.asciiToHex('MN'),
          7,
          { from: alice, gas: 1000000, value: ether(6) }
        );
        const a2Id = res.logs[0].args.id;
        await assertRevert(this.plotManager.lockApplicationForReview(a2Id, { from: charlie }));
        res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 1);
        assert.equal(res.validator.toLowerCase(), zeroAddress);
      });

      it('should deny non-validator to lock an application', async function() {
        await assertRevert(this.plotManager.lockApplicationForReview(this.aId, { from: coreTeam }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 2);
      });
    });

    describe('#unlockApplication', () => {
      beforeEach(async function() {
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
      });

      it('should should allow a contract owner to unlock an application under consideration', async function() {
        await this.plotManager.unlockApplication(this.aId, { from: coreTeam });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, 2);
        assert.equal(res.validator.toLowerCase(), zeroAddress);
      });

      it('should deny non-owner to unlock an application under consideration', async function() {
        await assertRevert(this.plotManager.unlockApplication(this.aId, { from: charlie }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
        assert.equal(res.validator.toLowerCase(), bob);
      });
    });

    describe('#approveApplication', () => {
      beforeEach(async function() {
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
      });

      it('should allow a validator approve application', async function() {
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.APPROVED);
      });

      it('should transfer package to an applicant', async function() {
        const packId = '0x0200000000000000000000000000000000000000000000000000000000000000';
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        const res = await this.spaceToken.ownerOf(packId);
        assert.equal(res, alice);
      });

      it('should deny a validator approve application if hash doesnt match', async function() {
        await assertRevert(this.plotManager.approveApplication(this.aId, `${this.credentials}_foo`, { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
      });

      it('should deny non-validator approve application', async function() {
        await assertRevert(this.plotManager.approveApplication(this.aId, this.credentials, { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
      });

      it('should deny validator approve an application with non-consideration status', async function() {
        await this.plotManager.unlockApplication(this.aId, { from: coreTeam });
        await assertRevert(this.plotManager.approveApplication(this.aId, this.credentials, { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.SUBMITTED);
      });
    });

    describe('#revertApplication()', () => {
      beforeEach(async function() {
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
      });

      it('should allow a validator revert application', async function() {
        await this.plotManager.revertApplication(this.aId, { from: bob });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.REVERTED);
      });

      it('should deny non-validator revert application', async function() {
        await assertRevert(this.plotManager.revertApplication(this.aId, { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
      });

      it('should deny validator revert an application with non-consideration status', async function() {
        await this.plotManager.unlockApplication(this.aId, { from: coreTeam });
        await assertRevert(this.plotManager.revertApplication(this.aId, { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.SUBMITTED);
      });
    });

    describe('#rejectApplication()', () => {
      beforeEach(async function() {
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
      });

      it('should allow a validator reject application', async function() {
        await this.plotManager.rejectApplication(this.aId, { from: bob });
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.REJECTED);
      });

      it('should deny non-validator reject application', async function() {
        await assertRevert(this.plotManager.rejectApplication(this.aId, { from: alice }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.CONSIDERATION);
      });

      it('should deny validator revert an application with non-consideration status', async function() {
        await this.plotManager.unlockApplication(this.aId, { from: coreTeam });
        await assertRevert(this.plotManager.rejectApplication(this.aId, { from: bob }));
        const res = await this.plotManagerWeb3.methods.getApplicationById(this.aId).call();
        assert.equal(res.status, ApplicationStatuses.SUBMITTED);
      });
    });

    describe('#removeGeohashFromApplication()', () => {
      beforeEach(async function() {
        let geohashes = `gbsuv7ztt gbsuv7ztw gbsuv7ztx gbsuv7ztm gbsuv7ztq gbsuv7ztr gbsuv7ztj gbsuv7ztn`;
        geohashes += ` gbsuv7zq gbsuv7zw gbsuv7zy gbsuv7zm gbsuv7zt gbsuv7zv gbsuv7zk gbsuv7zs gbsuv7zu`;
        this.geohashes = geohashes.split(' ').map(galt.geohashToGeohash5);

        await this.plotManager.addGeohashesToApplication(this.aId, this.geohashes, [], [], { from: alice });
      });

      it('should allow owner partially remove geohashes from an application', async function() {
        const geohashesToRemove = this.geohashes.slice(0, 2);
        let res = await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashesToRemove[0]));
        assert.equal(res, this.splitMerge.address);
        res = await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashesToRemove[1]));
        assert.equal(res, this.splitMerge.address);

        res = await this.splitMerge.packageGeohashesCount(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );
        assert.equal(res, 18);

        await this.plotManager.removeGeohashesFromApplication(this.aId, geohashesToRemove, [], [], {
          from: alice
        });

        res = await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashesToRemove[0]));
        assert.equal(res, this.plotManager.address);
        res = await this.spaceToken.ownerOf(galt.geohashToTokenId(geohashesToRemove[1]));
        assert.equal(res, this.plotManager.address);

        res = await this.splitMerge.packageGeohashesCount(
          '0x0200000000000000000000000000000000000000000000000000000000000000'
        );
        assert.equal(res, 16);
      });
    });

    describe('#claimValidatorRewardEth()', () => {
      beforeEach(async function() {
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
      });

      it('should allow validator claim reward', async function() {
        const bobsInitialBalance = new BN(await web3.eth.getBalance(bob));
        await this.plotManager.claimValidatorRewardEth(this.aId, { from: bob });
        const bobsFinalBalance = new BN(await web3.eth.getBalance(bob));

        // bobs fee is around (100 - 24) / 100 * 6 ether = 4560000000000000000 wei
        // assume that the commission paid by bob isn't greater than 0.1 ether
        assert(
          bobsInitialBalance
            .add(new BN('4560000000000000000'))
            .sub(new BN(ether(0.1)))
            .lt(bobsFinalBalance)
        );
        assert(
          bobsInitialBalance
            .add(new BN('4560000000000000000'))
            .add(new BN(ether(0.1)))
            .gt(bobsFinalBalance)
        );
      });
    });

    describe('#claimGaltSpaceRewardEth()', () => {
      beforeEach(async function() {
        await this.plotManager.submitApplication(this.aId, { from: alice });
        await this.plotManager.addValidator(bob, 'Bob', 'ID', { from: coreTeam });
        await this.plotManager.lockApplicationForReview(this.aId, { from: bob });
        await this.plotManager.approveApplication(this.aId, this.credentials, { from: bob });
        await this.plotManager.claimValidatorRewardEth(this.aId, { from: bob });
      });

      it('should allow validator claim reward', async function() {
        const plotManagerInitialBalance = new BN(await web3.eth.getBalance(this.plotManager.address));
        const galtSpaceOrgInitialBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));
        await this.plotManager.claimGaltSpaceRewardEth(this.aId, { from: galtSpaceOrg });
        const galtSpaceOrgFinalBalance = new BN(await web3.eth.getBalance(galtSpaceOrg));
        const plotManagerFinalBalance = new BN(await web3.eth.getBalance(this.plotManager.address));

        // galtSpaceOrg fee is around 24 / 100 * 6 ether = 1440000000000000000 wei
        // assume that the commission paid by bob isn't greater than 0.1 ether
        assert(
          galtSpaceOrgInitialBalance
            .add(new BN('1440000000000000000'))
            .sub(new BN(ether(0.1)))
            .lt(galtSpaceOrgFinalBalance)
        );
        assert(
          galtSpaceOrgInitialBalance
            .add(new BN('1440000000000000000'))
            .add(new BN(ether(0.1)))
            .gt(galtSpaceOrgFinalBalance)
        );
        assert(plotManagerInitialBalance.eq(new BN('1440000000000000000')));
        assert(plotManagerFinalBalance.eq(new BN('0')));
      });
    });
  });
});
