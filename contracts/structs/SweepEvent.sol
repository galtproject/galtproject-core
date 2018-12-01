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

pragma solidity 0.4.24;

import "../collections/RedBlackTree.sol";
pragma experimental "v0.5.0";

library SweepEvent {
  enum Type {
    NORMAL,
    SAME_TRANSITION,
    DIFFERENT_TRANSITION,
    NON_CONTRIBUTING
  }

  struct Item {
    uint256 id;
    uint256 otherEvent;
    
    int256 pos;

//    uint256 qId; // Id of SweepQueueRedBlackTree
//    uint256 lId; // Id of SweepLineRedBlackTree
    
    uint256 contourId;
    
    int256[2] point;
    bool left;
    bool isSubject;
    Type eventType;
    bool inOut;
    uint prevInResult;
    bool inResult;
    bool resultInOut; // possibly no needed
    bool otherInOut;
    bool isExteriorRing;
  }

  struct Tree {
    RedBlackTree.Tree tree;
//    mapping(uint => bool) exists;
  }
  
  struct Store {
    mapping(uint => SweepEvent.Item) sweepById;
  }
}
