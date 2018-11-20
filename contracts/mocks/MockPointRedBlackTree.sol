pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "../utils/PointUtils.sol";
import "../collections/RedBlackTree.sol";
import "../collections/PointRedBlackTree.sol";

contract MockPointRedBlackTree {
  using PointRedBlackTree for PointRedBlackTree.PointsTree;

  PointRedBlackTree.PointsTree private pointsTree;
  
  event LogTreeItemId(uint id);
  event LogInsert(uint itemId, uint treeRootId, uint parent, uint left, uint right);
  event LogComparePoints(int8 result);
  
  constructor() public {

  }

  function insert(uint64 id, int256[2] value) public {
    pointsTree.insert(id, value);
    RedBlackTree.Item memory item = pointsTree.tree.items[id];
    emit LogInsert(id, pointsTree.tree.root, item.parent, item.left, item.right);
  }

  function find(int256[2] value) public returns (uint) {
    uint id = pointsTree.find(value);
    emit LogTreeItemId(id);
    return id;
  }

//  function remove(uint id) public {
//    pointsTree.remove(id);
//  }

  function getRoot() public constant returns (uint) {
    return pointsTree.tree.root;
  }

  function getItem(uint itemId) public constant returns (uint id, uint parent, uint left, uint right, int256[2] value, bool red) {
    RedBlackTree.Item memory item = pointsTree.tree.items[itemId];
    return (
      itemId,
      item.parent,
      item.left,
      item.right,
      pointsTree.values[itemId],
      item.red
    );
  }
  
  function comparePoints(int256[2] point1, int256[2] point2) public returns (int8) {
    int8 result = PointUtils.comparePoints(point1, point2);
    emit LogComparePoints(result);
    return result;
  }
}
