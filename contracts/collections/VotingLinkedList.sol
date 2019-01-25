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

library VotingLinkedList {

  struct Data {
    mapping(address => uint) votes;
    uint256 maxCount;
  }

  event InsertOrUpdate(address newAddress, uint256 value);

  function insertOrUpdate(AddressLinkedList.Data storage listData, Data storage votingData, address newAddress, uint256 value) public returns (uint256) {
    emit InsertOrUpdate(newAddress, value);

    if (isExists(listData, newAddress)) {
      // TODO: find the more optimized way to rewrite newAddress
      AddressLinkedList.remove(listData, newAddress);
    }

    if (votingData.maxCount == listData.count && value <= votingData.votes[listData.tail]) {
      votingData.votes[newAddress] = 0;
      return;
    }

    if (value == 0) {
      votingData.votes[newAddress] = 0;
      return;
    }

    votingData.votes[newAddress] = value;

    address foundLeft = search(listData, votingData, newAddress, true);

    AddressLinkedList.insertByFoundAndComparator(listData, newAddress, foundLeft, compare(votingData, foundLeft, newAddress));

    if (listData.count > votingData.maxCount) {
      AddressLinkedList.remove(listData, listData.tail);
    }
  }
  
  function isExists(AddressLinkedList.Data storage listData, address addr) public view returns (bool) {
    return listData.head == addr || listData.tail == addr || listData.nodes[addr].next != address(0) || listData.nodes[addr].prev != address(0);
  }

  event CompareResult(int8 compareResult);

  function compare(Data storage votingData, address a, address b) public returns (int8 compareResult) {
    if (votingData.votes[a] > votingData.votes[b]) {
      compareResult = - 1;
    } else {
      compareResult = votingData.votes[a] < votingData.votes[b] ? int8(1) : int8(0);
    }
    emit CompareResult(compareResult);
  }

  //TODO: optimize by binary search
  function search(AddressLinkedList.Data storage listData, Data storage votingData, address valueAddress, bool returnLeft) public returns (address) {
    if (listData.head == 0) {
      return 0;
    }

    address curAddress = listData.head;
    do {
      int8 compareResult = compare(votingData, curAddress, valueAddress);
      if (compareResult == 0) {
        return curAddress;
      } else if (!returnLeft) {
        if (listData.nodes[curAddress].next == 0) {
          return 0;
        }
        curAddress = listData.nodes[curAddress].next;
      } else {
        if (compareResult < 0 && listData.nodes[curAddress].next != 0) {
          curAddress = listData.nodes[curAddress].next;
        } else {
          return curAddress;
        }
      }
    }
    while (true);
  }
}
