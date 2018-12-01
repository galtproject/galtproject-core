pragma solidity ^0.4.24;

import "../collections/ArraySet.sol";

contract MockArraySetBytes32 {
  using ArraySet for ArraySet.Bytes32Set;
  ArraySet.Bytes32Set set;

  // MODIFIERS
  function add(bytes32 _v) {
    set.add(_v);
  }

  function remove(bytes32 _v) {
    set.remove(_v);
  }

  function clear() {
    set.clear();
  }

  // GETTERS
  function has(bytes32 _v) external view returns (bool) {
    return set.has(_v);
  }

  function elements() external view returns (bytes32[]) {
    return set.elements();
  }

  function size() external view returns (uint256) {
    return set.size();
  }

  function isEmpty() external view returns (bool) {
    return set.isEmpty();
  }
}