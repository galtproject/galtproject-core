const PointRedBlackTree = artifacts.require('./collections/PointRedBlackTree.sol');
const SegmentRedBlackTree = artifacts.require('./collections/SegmentRedBlackTree.sol');
const BentleyOttman = artifacts.require('./utils/BentleyOttman.sol');
const MockBentleyOttman = artifacts.require('./mocks/MockBentleyOttman.sol');

// const pIteration = require('p-iteration');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, ether } = require('../helpers');

const web3 = new Web3(MockBentleyOttman.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract.only('BentleyOttman', ([coreTeam]) => {
  beforeEach(async function() {
    this.pointRedBlackTree = await PointRedBlackTree.new({ from: coreTeam });
    BentleyOttman.link('PointRedBlackTree', this.pointRedBlackTree.address);

    this.segmentRedBlackTree = await SegmentRedBlackTree.new({ from: coreTeam });
    BentleyOttman.link('SegmentRedBlackTree', this.segmentRedBlackTree.address);

    this.bentleyOttman = await BentleyOttman.new({ from: coreTeam });
    MockBentleyOttman.link('BentleyOttman', this.bentleyOttman.address);

    this.mockBentleyOttman = await MockBentleyOttman.new({ from: coreTeam });

    this.mockBentleyOttmanWeb3 = new web3.eth.Contract(this.mockBentleyOttman.abi, this.mockBentleyOttman.address);

    this.points = [
      [200, 12],
      [612, 401],
      [375, 486],
      [581, 21],
      [680, 25],
      [106, 414],
      [135, 478],
      [333, 51],
      [120, 74],
      [590, 473]
    ];

    this.segments = [];
    this.points.forEach((d, i) => {
      if (i % 2) this.segments.push(_.sortBy([d, this.points[i - 1]], 'y'));
    });
    this.etherSegments = this.segments.map(segment => segment.map(point => point.map(coor => ether(coor))));
  });

  describe('#setSegments()', () => {
    it('should correctly setSegments', async function() {
      await this.mockBentleyOttman.setSegments(this.etherSegments);
      await this.mockBentleyOttman.handleQueuePoints();
      assert.equal(true, false);
    });
  });
});
