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

pragma solidity 0.5.3;

import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";


contract SpaceCustodianRegistry is Permissionable {
  using ArraySet for ArraySet.AddressSet;

  string public constant ROLE_APPLICATION = "application";

  // SpaceLocker address => Details
  mapping(uint256 => ArraySet.AddressSet) private assignedCustodians;
  mapping(uint256 => bytes32[]) private assignedDocuments;


  function attach(
    uint256 _spaceTokenId,
    address[] calldata _custodians,
    bytes32[] calldata _documents
  )
    external
    onlyRole(ROLE_APPLICATION)
  {
    for (uint256 i = 0; i < _custodians.length; i++) {
      assignedCustodians[_spaceTokenId].add(_custodians[i]);
    }
    assignedDocuments[_spaceTokenId] = _documents;
  }

  function detach(
    uint256 _spaceTokenId,
    address[] calldata _custodians,
    bytes32[] calldata _documents
  )
    external
    onlyRole(ROLE_APPLICATION)
  {
    for (uint256 i = 0; i < _custodians.length; i++) {
      assignedCustodians[_spaceTokenId].remove(_custodians[i]);
    }
    assignedDocuments[_spaceTokenId] = _documents;
  }

  function spaceCustodianAssigned(uint256 _spaceTokenId, address _custodian) external view returns (bool) {
    return assignedCustodians[_spaceTokenId].has(_custodian);
  }

  function spaceCustodians(uint256 _spaceTokenId) external view returns (address[] memory) {
    return assignedCustodians[_spaceTokenId].elements();
  }

  function spaceCustodianCount(uint256 _spaceTokenId) external view returns (uint256) {
    return assignedCustodians[_spaceTokenId].size();
  }

  function spaceDocuments(uint256 _spaceTokenId) external view returns (bytes32[] memory) {
    return assignedDocuments[_spaceTokenId];
  }
}
