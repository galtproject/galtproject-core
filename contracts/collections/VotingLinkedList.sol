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

pragma solidity 0.5.10;

import "./AddressLinkedList.sol";


library VotingLinkedList {

  struct Data {
    mapping(address => uint) votes;
    uint256 maxCount;
  }

  event InsertOrUpdate(address newAddress, uint256 value);

  function insertOrUpdate(
    AddressLinkedList.Data storage votingList,
    Data storage votingData,
    address newAddress,
    uint256 value
  )
    internal
  {
    emit InsertOrUpdate(newAddress, value);

    if (isExists(votingList, newAddress)) {
      // TODO: find the more optimized way to rewrite newAddress
      AddressLinkedList.remove(votingList, newAddress);
    }

    if (votingData.maxCount == votingList.count && value <= votingData.votes[votingList.tail]) {
      votingData.votes[newAddress] = 0;
      return;
    }

    if (value == 0) {
      votingData.votes[newAddress] = 0;
      return;
    }

    votingData.votes[newAddress] = value;

    address foundLeft = search(votingList, votingData, newAddress, true);

    AddressLinkedList.insertByFoundAndComparator(votingList, newAddress, foundLeft, compare(votingData, foundLeft, newAddress));

    if (votingList.count > votingData.maxCount) {
      AddressLinkedList.remove(votingList, votingList.tail);
    }
  }

  function isExists(AddressLinkedList.Data storage votingList, address addr) internal view returns (bool) {
    /* solium-disable-next-line */
    return votingList.head == addr || votingList.tail == addr || votingList.nodes[addr].next != address(0) || votingList.nodes[addr].prev != address(0);
  }

  event CompareResult(int8 compareResult);

  function compare(Data storage votingData, address a, address b) internal returns (int8 compareResult) {
    if (votingData.votes[a] > votingData.votes[b]) {
      compareResult = - 1;
    } else {
      compareResult = votingData.votes[a] < votingData.votes[b] ? int8(1) : int8(0);
    }
    emit CompareResult(compareResult);
  }

  //TODO: optimize by binary search
  function search(
    AddressLinkedList.Data storage votingList,
    Data storage votingData,
    address valueAddress,
    bool returnLeft
  )
    internal
    returns (address)
  {
    if (votingList.head == address(0)) {
      return address(0);
    }

    address curAddress = votingList.head;

    do {
      int8 compareResult = compare(votingData, curAddress, valueAddress);
      if (compareResult == 0) {
        return curAddress;
      } else if (!returnLeft) {
        if (votingList.nodes[curAddress].next == address(0)) {
          return address(0);
        }
        curAddress = votingList.nodes[curAddress].next;
      } else {
        if (compareResult < 0 && votingList.nodes[curAddress].next != address(0)) {
          curAddress = votingList.nodes[curAddress].next;
        } else {
          return curAddress;
        }
      }
    }
    while (true);
  }
}
