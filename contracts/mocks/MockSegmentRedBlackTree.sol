pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "../utils/SegmentUtils.sol";
import "../collections/RedBlackTree.sol";
import "../collections/SegmentRedBlackTree.sol";

contract MockSegmentRedBlackTree {
  using SegmentRedBlackTree for SegmentRedBlackTree.SegmentsTree;

  SegmentRedBlackTree.SegmentsTree private segmentsTree;
  
  event LogTreeItemId(uint id);
  event LogInsert(uint itemId, uint treeRootId, uint parent, uint left, uint right);
  event LogComparePoints(int8 result);
  
  constructor() public {

  }

  function insert(uint64 id, int256[2][2] value) public {
    segmentsTree.insert(id, value);
    RedBlackTree.Item memory item = segmentsTree.tree.items[id];
    emit LogInsert(id, segmentsTree.tree.root, item.parent, item.left, item.right);
  }

  function find(int256[2][2] value) public returns (uint) {
    uint id = segmentsTree.find(value);
    emit LogTreeItemId(id);
    return id;
  }

//  function remove(uint id) public {
//    segmentsTree.remove(id);
//  }

  function getRoot() public constant returns (uint) {
    return segmentsTree.tree.root;
  }

  function getItem(uint itemId) public constant returns (uint id, uint parent, uint left, uint right, int256[2][2] value, bool red) {
    RedBlackTree.Item memory item = segmentsTree.tree.items[itemId];
    return (
      itemId,
      item.parent,
      item.left,
      item.right,
      segmentsTree.values[itemId],
      item.red
    );
  }
}
