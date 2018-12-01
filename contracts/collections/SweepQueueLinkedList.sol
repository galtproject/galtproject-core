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
pragma experimental "v0.5.0";

import "./LinkedList.sol";
import "../structs/SweepEvent.sol";
import "../utils/SweepEventUtils.sol";

library SweepQueueLinkedList {

  function insert(LinkedList.Data storage data, SweepEvent.Store storage store, uint256 newId) public returns (uint256) {
    uint256 foundLeft = search(data, store, newId, true);
    // console.log('foundLeft', foundLeft);

    int8 compareResult = SweepEventUtils.compareEvents(store, store.sweepById[foundLeft], store.sweepById[newId]);

    LinkedList.insertByFoundAndComparator(data, newId, foundLeft, compareResult);
  }

  function search(LinkedList.Data storage data, SweepEvent.Store storage store, uint256 valueId, bool returnLeft) public returns (uint256) {
    // console.log('binarySearch begin', returnLeft, headId, nodesByIds);
    if (data.headId == 0) {
      return 0;
    }

    uint256 curId = data.headId;
    // let prevId = null;

    do {
      int8 compareResult = SweepEventUtils.compareEvents(store, store.sweepById[curId], store.sweepById[valueId]);
      // console.log('compareResult', compareResult, shortLine(valuesByIds[curId]));

      if (compareResult == 0) {
        return curId;
      } else if (!returnLeft) {
        if (data.nodesByIds[curId].nextId == 0) {
          return 0;
        }
        curId = data.nodesByIds[curId].nextId;
      } else {
        if (compareResult < 0 && data.nodesByIds[curId].nextId != 0) {
          curId = data.nodesByIds[curId].nextId;
        } else {
          return curId;
        }
      }
    }
    while (true);
  }
}
