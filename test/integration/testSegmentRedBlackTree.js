const MockSegmentRedBlackTree = artifacts.require('./mocks/MockSegmentRedBlackTree.sol');

const _ = require('lodash');
const pIteration = require('p-iteration');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, initHelperArtifacts, ether, getSegmentRedBlackTreeLib, clearLibCache } = require('../helpers');

const web3 = new Web3(MockSegmentRedBlackTree.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('SegmentRedBlackTree', ([coreTeam]) => {
  before(clearLibCache);
  beforeEach(async function() {
    this.segmentRedBlackTree = await getSegmentRedBlackTreeLib();
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
      // Helpers
      this.getSegmentId = function(segment) {
        return segment
          .map(point => point.map(coor => Math.abs(web3.utils.fromWei(coor, 'ether')).toString()).join(''))
          .join('');
      };

      this.insert = async function(segment) {
        const id = this.getSegmentId(segment);
        await this.mockSegmentRedBlackTree.insert(id, segment, {
          from: coreTeam
        });
      };

      this.find = async function(point) {
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
    it('should correctly handle real case 1', async function() {
      await this.mockSegmentRedBlackTree.insert(1, [
        [1194818755612000000, 104524910990149000000],
        [1195333572105000000, 104542420450598000000]
      ]);

      await this.mockSegmentRedBlackTree.insert(2, [
        [1194818755612000000, 104524910990149000000],
        [1232232553884000000, 104523194376379000000]
      ]);

      await this.mockSegmentRedBlackTree.insert(3, [
        [1195333572105000000, 104542420450598000000],
        [1231374414638000000, 104540703836828000000]
      ]);

      await this.mockSegmentRedBlackTree.remove(1);

      await this.mockSegmentRedBlackTree.insert(4, [
        [1200340250507000000, 104532680679113000000],
        [1201198389754000000, 104507961440831000000]
      ]);

      await this.mockSegmentRedBlackTree.insert(5, [
        [1200340250507000000, 104532680679113000000],
        [1209607785568000000, 104532165359706000000]
      ]);

      const prev = await this.mockSegmentRedBlackTree.prev(4);
      assert.equal(prev, 2);

      const next = await this.mockSegmentRedBlackTree.next(4);
      assert.equal(next, 2);

      await this.mockSegmentRedBlackTree.insert(6, [
        [1201198389754000000, 104507961440831000000],
        [1230889102444000000, 104508869033307000000]
      ]);

      await this.mockSegmentRedBlackTree.remove(4);

      await this.mockSegmentRedBlackTree.insert(7, [
        [1209607785568000000, 104532165359706000000],
        [1210809247568000000, 104518947433680000000]
      ]);

      await this.mockSegmentRedBlackTree.remove(5);

      await this.mockSegmentRedBlackTree.insert(8, [
        [1210809247568000000, 104518947433680000000],
        [1221278244630000000, 104517917465419000000]
      ]);

      await this.mockSegmentRedBlackTree.remove(7);

      await this.mockSegmentRedBlackTree.insert(9, [
        [1221278244630000000, 104517917465419000000],
        [1221964722499000000, 104533367324620000000]
      ]);

      await this.mockSegmentRedBlackTree.remove(8);

      await this.mockSegmentRedBlackTree.insert(10, [
        [1221964722499000000, 104533367324620000000],
        [1230030963197000000, 104534265864640000000]
      ]);

      await this.mockSegmentRedBlackTree.remove(9);

      await this.mockSegmentRedBlackTree.insert(11, [
        [1230030963197000000, 104534265864640000000],
        [1230889102444000000, 104508869033307000000]
      ]);

      await this.mockSegmentRedBlackTree.remove(6);
      await this.mockSegmentRedBlackTree.remove(11);

      await this.mockSegmentRedBlackTree.insert(12, [
        [1231374414638000000, 104540703836828000000],
        [1232232553884000000, 104523194376379000000]
      ]);

      await this.mockSegmentRedBlackTree.remove(3);
      await this.mockSegmentRedBlackTree.remove(2);
      await this.mockSegmentRedBlackTree.remove(12);
    });
  });
});
