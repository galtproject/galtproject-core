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

import "./collections/ArraySet.sol";
import "./multisig/ArbitratorsMultiSig.sol";
import "./traits/Permissionable.sol";

contract ArbitratorsMultiSigRegistry {
  using ArraySet for ArraySet.AddressSet;

  event NewMultiSig(uint256 id, address addr);

  ArraySet.AddressSet private multiSigs;

  constructor() public {}

  // MODIFIERS
  function createMultiSig(address[] _initialOwners, uint256 _required) external returns(uint256 id) {
    uint256 id = multiSigs.size();
    address ms = new ArbitratorsMultiSig(_initialOwners, _required);

    multiSigs.add(ms);
    emit NewMultiSig(id, ms);

    return id;
  }

  // GETTERS
  function getMultiSig(uint256 _id) external returns (address) {
    return multiSigs.elements()[_id];
  }
  
  function getMultiSigList() external returns (address[]) {
    return multiSigs.elements();
  }

  function getMultiSigCount() external returns (uint256) {
    return multiSigs.size();
  }
}
