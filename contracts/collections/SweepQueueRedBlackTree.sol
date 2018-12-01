/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster),
 * [Valery Litvin](https://github.com/litvintech) by
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and
 * Galt•Space Society Construction and Terraforming Company by
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

import "../utils/SegmentUtils.sol";
import "./RedBlackTree.sol";
import "../utils/SweepEventUtils.sol";
import "../structs/SweepEvent.sol";

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

library SweepQueueRedBlackTree {
  using RedBlackTree for RedBlackTree.Tree;
  
  uint internal constant ZERO = 0;

//  function find(SweepEvent.Tree storage sweepEvents, SweepEvent.Store storage store, SweepEvent.Item value) public returns (uint) {
//    uint _key = sweepEvents.tree.root;
//    while (_key != ZERO) {
//      int8 compareResult = SweepEventUtils.compareEvents(store, value, sweepEvents.values[_key]);
//      if (compareResult == 0) {
//        return _key;
//      }
//      if (compareResult < 0) {
//        _key = sweepEvents.tree.items[_key].left;
//      } else {
//        _key = sweepEvents.tree.items[_key].right;
//      }
//    }
//    return ZERO;
//  }

  event LogCompareEvents(int256[2] point1, int256[2] point2, int8 compareResult);
  
  function insert(SweepEvent.Tree storage sweepEvents, SweepEvent.Store storage store, uint key) internal {
    uint y = ZERO;
    uint x = sweepEvents.tree.root;
    while (x != ZERO) {
      y = x;
      int8 compareResult = SweepEventUtils.compareEvents(store, store.sweepById[key], store.sweepById[x]);
      
//      emit LogCompareEvents(store.sweepById[key].point, store.sweepById[x].point, compareResult);
      
      if (compareResult < 0) {
        x = sweepEvents.tree.items[x].left;
      } else {
        if (compareResult == 0) {
          return;
        }
        x = sweepEvents.tree.items[x].right;
      }
    }
    sweepEvents.tree.items[key] = RedBlackTree.Item(y, ZERO, ZERO, true);
//    sweepEvents.values[key] = value;

    if (y == ZERO) {
      sweepEvents.tree.root = key;
    } else if (SweepEventUtils.compareEvents(store, store.sweepById[key], store.sweepById[y]) < 0) {
      sweepEvents.tree.items[y].left = key;
    } else {
      sweepEvents.tree.items[y].right = key;
    }
    sweepEvents.tree.insertFixup(key);
    sweepEvents.tree.inserted++;
  }

  function getNewId(SweepEvent.Tree storage sweepEvents) public returns(uint256) {
    return sweepEvents.tree.inserted + 1;
  }
}
