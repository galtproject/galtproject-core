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

import "../traits/Permissionable.sol";
import "../multisig/ArbitratorsMultiSig.sol";
import "../multisig/ArbitratorVoting.sol";
import "../multisig/OracleStakesAccounting.sol";
import "../SpaceLocker.sol";


contract SpaceCustodianRegistry is Permissionable {
  using ArraySet for ArraySet.AddressSet;

  string public constant ROLE_APPLICATION = "application";

  // SpaceLocker address => Details
  mapping(uint256 => ArraySet.AddressSet) private assignedCustodians;


  function attach(
    uint256 _spaceTokenId,
    address[] _custodians
  )
    external
    onlyRole(ROLE_APPLICATION)
  {
    for (uint256 i = 0; i < _custodians.length; i++) {
      assignedCustodians[_spaceTokenId].add(_custodians[i]);
    }
  }

  function detach(
    uint256 _spaceTokenId,
    address[] _custodians
  )
    external
    onlyRole(ROLE_APPLICATION)
  {
    for (uint256 i = 0; i < _custodians.length; i++) {
      assignedCustodians[_spaceTokenId].remove(_custodians[i]);
    }
  }

  // REQUIRES

  function spaceCustodians(uint256 _spaceTokenId) external view returns (address[]) {
    return assignedCustodians[_spaceTokenId].elements();
  }

  function spaceCustodianCount(uint256 _spaceTokenId) external view returns (uint256) {
    return assignedCustodians[_spaceTokenId].size();
  }
}
