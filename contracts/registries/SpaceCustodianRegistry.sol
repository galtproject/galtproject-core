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

import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/ISpaceCustodianRegistry.sol";
import "./GaltGlobalRegistry.sol";


contract SpaceCustodianRegistry is ISpaceCustodianRegistry {
  using ArraySet for ArraySet.AddressSet;
  using ArraySet for ArraySet.Uint256Set;

  bytes32 public constant ROLE_SPACE_CUSTODIAN_REGISTRAR = bytes32("SPACE_CUSTODIAN_REGISTRAR");

  // SpaceLocker address => Details
  mapping(uint256 => ArraySet.AddressSet) private assignedCustodians;
  mapping(address => ArraySet.Uint256Set) private spaceTokensOfCustodian;
  mapping(uint256 => bytes32[]) private assignedDocuments;

  GaltGlobalRegistry private ggr;

  constructor (GaltGlobalRegistry _ggr) public {
    ggr = _ggr;
  }

  modifier onlySpaceCustodianRegistrar() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_SPACE_CUSTODIAN_REGISTRAR),
      "Only SPACE_CUSTODIAN_REGISTRAR role allowed"
    );

    _;
  }

  function attach(
    uint256 _spaceTokenId,
    address[] calldata _custodians,
    bytes32[] calldata _documents
  )
    external
    onlySpaceCustodianRegistrar
  {
    for (uint256 i = 0; i < _custodians.length; i++) {
      assignedCustodians[_spaceTokenId].add(_custodians[i]);
      spaceTokensOfCustodian[_custodians[i]].add(_spaceTokenId);
    }
    assignedDocuments[_spaceTokenId] = _documents;
  }

  function detach(
    uint256 _spaceTokenId,
    address[] calldata _custodians,
    bytes32[] calldata _documents
  )
    external
    onlySpaceCustodianRegistrar
  {
    for (uint256 i = 0; i < _custodians.length; i++) {
      assignedCustodians[_spaceTokenId].remove(_custodians[i]);
      spaceTokensOfCustodian[_custodians[i]].remove(_spaceTokenId);
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
  
  function custodianTokens(address _custodian) external view returns (uint256[] memory) {
    return spaceTokensOfCustodian[_custodian].elements();
  }

  function custodianTokensCount(address _custodian) external view returns (uint256) {
    return spaceTokensOfCustodian[_custodian].size();
  }
}
