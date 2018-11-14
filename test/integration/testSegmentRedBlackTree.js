const SegmentRedBlackTree = artifacts.require('./collections/SegmentRedBlackTree.sol');
const MockSegmentRedBlackTree = artifacts.require('./mocks/MockSegmentRedBlackTree.sol');
const SegmentUtils = artifacts.require('./utils/SegmentUtils.sol');

const _ = require('lodash');
const pIteration = require('p-iteration');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, ether } = require('../helpers');

const web3 = new Web3(MockSegmentRedBlackTree.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SegmentRedBlackTree', ([coreTeam]) => {
  beforeEach(async function() {
    this.segmentUtils = await SegmentUtils.new({ from: coreTeam });
    SegmentRedBlackTree.link('SegmentUtils', this.segmentUtils.address);

    this.segmentRedBlackTree = await SegmentRedBlackTree.new({ from: coreTeam });
    MockSegmentRedBlackTree.link('SegmentRedBlackTree', this.segmentRedBlackTree.address);

    this.mockSegmentRedBlackTree = await MockSegmentRedBlackTree.new({ from: coreTeam });

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

  describe('#insert() and find()', () => {
    it('should correctly insert and find points', async function() {
      let number = 1;

      // Helpers
      this.getSegmentId = function(segment) {
        return segment
          .map(point => point.map(coor => Math.abs(web3.utils.fromWei(coor, 'ether')).toString()).join(''))
          .join('');
      };

      this.insert = async function(segment) {
        console.log('      SegmentRedBlackTree.insert() number', number);
        const id = this.getSegmentId(segment);
        await this.mockSegmentRedBlackTree.insert(id, segment, {
          from: coreTeam
        });

        number += 1;
      };

      this.find = async function(point) {
        console.log('      SegmentRedBlackTree.find() on number of segments:', number - 1);
        const expectedId = this.getSegmentId(point);
        const res = await this.mockSegmentRedBlackTree.find(point, {
          from: coreTeam
        });
        const itemId = res.logs[0].args.id.toString(10);
        assert.equal(expectedId.toString(10), itemId.toString(10));
      };
      // Helpers end

      await pIteration.forEachSeries(this.etherSegments, async segment => {
        await this.insert(segment);
      });

      await pIteration.forEachSeries(this.etherSegments, async segment => {
        await this.find(segment);
      });
    });
  });
});
