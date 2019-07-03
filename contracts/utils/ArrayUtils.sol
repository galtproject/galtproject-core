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


library ArrayUtils {
  function uintSome(uint[] memory arr, uint el) internal view returns (bool) {
    for (uint j = 0; j < arr.length; j++) {
      if (el == arr[j]) {
        return true;
      }
    }
    return false;
  }

  function uintFind(uint[] memory arr, uint el) internal view returns (int) {
    for (uint j = 0; j < arr.length; j++) {
      if (el == arr[j]) {
        return int(j);
      }
    }
    return - 1;
  }

  function intEqual(int[] memory arr1, int[] memory arr2) internal view returns (bool) {
    for (uint i = 0; i < arr1.length; i++) {
      if (arr1[i] != arr2[i]) {
        return false;
      }
    }
    return true;
  }
}
