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


library AddressLinkedList {
  struct Data {
    mapping(address => Node) nodes;
    address head;
    address tail;
    uint256 count;
    bool withTail;
  }

  struct Node {
    address prev;
    address next;
  }

  event SetHead(address head);

  function insertByFoundAndComparator(Data storage data, address newAddress, address foundAddress, int8 compareResult) internal {
    if (data.head == address(0)) {
      data.count += 1;

      data.head = newAddress;
      if (data.withTail) {
        data.tail = newAddress;
      }
      emit SetHead(newAddress);
      return;
    }

    if (compareResult == 0) {
      insertAfter(data, newAddress, foundAddress);
    } else if (compareResult < 0) {
      insertAfter(data, newAddress, foundAddress);
    } else {
      if (foundAddress == data.head) {
        data.count += 1;

        data.nodes[newAddress].next = data.head;

        data.nodes[data.head].prev = newAddress;
        data.head = newAddress;
        return;
      }

      insertAfter(data, newAddress, data.nodes[foundAddress].prev);
    }
  }

  event InsertAfter(address addr, address prev, uint count);

  function insertAfter(Data storage data, address newAddress, address prev) internal {
    data.count += 1;

    data.nodes[newAddress].next = data.nodes[prev].next;
    data.nodes[newAddress].prev = prev;

    data.nodes[prev].next = newAddress;
    if (data.nodes[newAddress].next == address(0)) {
      if (data.withTail) {
        data.tail = newAddress;
      }
    } else {
      data.nodes[data.nodes[newAddress].next].prev = newAddress;
    }
    emit InsertAfter(newAddress, prev, data.count);
  }

  event Remove(address addr, address prev, address next, address head, address tail, uint count);

  function remove(Data storage data, address addr) internal {
    if (addr == address(0)) {
      return;
    }
    Node storage node = data.nodes[addr];

    if (node.prev != address(0)) {
      data.nodes[node.prev].next = node.next;
    }
    if (node.next != address(0)) {
      data.nodes[node.next].prev = node.prev;
    }

    if (addr == data.head) {
      data.head = node.next;
    }

    if (data.withTail && addr == data.tail) {
      data.tail = node.prev;
    }

    data.count--;

    emit Remove(addr, node.prev, node.next, data.head, data.tail, data.count);

    delete data.nodes[addr];
  }

  function swap(Data storage data, address a, address b) internal {
    Node storage aNode = data.nodes[a];
    Node storage bNode = data.nodes[b];
    address aNodePrevId = aNode.prev;
    address aNodeNextId = aNode.next;
    address bNodePrevId = bNode.prev;
    address bNodeNextId = bNode.next;

    if (aNodePrevId == b) {
      aNode.prev = a;
      bNode.next = b;
    } else if (aNodeNextId == b) {
      aNode.next = a;
      bNode.prev = b;
    }

    if (aNodePrevId != address(0)) {
      data.nodes[aNodePrevId].next = b;
    }
    if (aNodeNextId != address(0)) {
      data.nodes[aNodeNextId].prev = b;
    }
    if (bNodePrevId != address(0)) {
      data.nodes[bNodePrevId].next = a;
    }
    if (bNodeNextId != address(0)) {
      data.nodes[bNodeNextId].prev = a;
    }

    data.nodes[a] = bNode;
    data.nodes[b] = aNode;

    if (data.nodes[a].prev == address(0)) {
      data.head = a;
    }
    if (data.nodes[b].prev == address(0)) {
      data.head = b;
    }

    if (data.withTail) {
      if (data.nodes[a].next == address(0)) {
        data.tail = a;
      }
      if (data.nodes[b].next == address(0)) {
        data.tail = b;
      }
    }
  }

  function getIndex(Data storage data, address addr) internal returns (uint256) {
    if (addr == address(0)) {
      require(false, "id not exists in LinkedList");
    }
    address curAddress = data.head;
    uint256 index = 0;
    do {
      if (curAddress == addr) {
        return index;
      }
      curAddress = data.nodes[curAddress].next;
      index++;
    }
    while (true);
  }

  event LogPop(address popAddress, address head, uint256 count);

  function pop(Data storage data) internal returns (address) {
    address popAddress = data.head;

    if (data.nodes[popAddress].next != address(0)) {
      data.nodes[data.nodes[popAddress].next].prev = address(0);
      data.head = data.nodes[popAddress].next;
    } else {
      data.head = address(0);
    }

    delete data.nodes[popAddress];

    return popAddress;
  }
}
