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

import "./AddressLinkedList.sol";
import "./VotingStore.sol";

library VotingLinkedList {

  function insertOrUpdate(AddressLinkedList.Data storage data, VotingStore.Data storage store, address newAddress, uint256 value) public returns (uint256) {
    if(store.votes[newAddress] > 0) {
      // find the more optimized way
      AddressLinkedList.remove(data, newAddress);
    }
    
    if(value == 0) {
      return;
    }
    
    address foundLeft = search(data, store, newAddress, true);
    
    int8 compareResult;
    if(store.votes[foundLeft] > store.votes[newAddress]) {
      compareResult = -1;
    } else {
      compareResult = store.votes[foundLeft] < store.votes[newAddress] ? int8(1) : int8(0);
    }

    AddressLinkedList.insertByFoundAndComparator(data, newAddress, foundLeft, compareResult);
  }

  //TODO: optimize
  function search(AddressLinkedList.Data storage data, VotingStore.Data storage store, address valueId, bool returnLeft) public returns (address) {
    // console.log('binarySearch begin', returnLeft, headId, nodesByIds);
    if (data.headId == 0) {
      return 0;
    }

    address curId = data.headId;
    // let prevId = null;
    //    uint256 i = 0;
    do {
      int8 compareResult;
      if(store.votes[curId] > store.votes[valueId]) {
        compareResult = -1;
      } else {
        compareResult = store.votes[curId] < store.votes[valueId] ? int8(1) : int8(0);
      }
      //      if(store.sweepById[curId].point[0] == 1210809247568000000 && store.sweepById[valueId].point[0] == 1210809247568000000) {
      //        emit CompareResult1(store.sweepById[curId].point);//, store.sweepById[curId].left, store.sweepById[curId].isSubject);
      //        emit CompareResult2(store.sweepById[valueId].point);//, store.sweepById[valueId].left, store.sweepById[valueId].isSubject);
      //        emit CompareResult3(compareResult);
      //      }
      //      emit SearchIteration(i, curId, data.nodesByIds[curId].prevId, data.nodesByIds[curId].nextId, compareResult);
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
      //      i++;
      //      if(i >= 10) {
      //        return curId;
      //      }
    }
    while (true);
  }
}
