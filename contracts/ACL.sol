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

import "./interfaces/IACL.sol";
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";


/**
 * @title Access Control List.
 * @notice Tracks global-level permissions.
 */
contract ACL is IACL, OwnableAndInitializable {
  event SetRole(bytes32 indexed role, address indexed candidate, bool allowed);

  // Mapping (roleName => (address => isAllowed))
  mapping(bytes32 => mapping(address => bool)) _roles;

  function initialize() external isInitializer {
  }

  /**
   * @notice Sets role permissions.
   *
   * @param _role bytes32 encoded role name
   * @param _candidate address
   * @param _allow true to enable, false to disable
   */
  function setRole(bytes32 _role, address _candidate, bool _allow) external onlyOwner {
    _roles[_role][_candidate] = _allow;
    emit SetRole(_role, _candidate, _allow);
  }

  /**
   * @notice Checks if a candidate has a role.
   *
   * @param _candidate address
   * @param _role bytes32 encoded role name
   * @return bool whether a user has the role assigned or not
   */
  function hasRole(address _candidate, bytes32 _role) external view returns (bool) {
    return _roles[_role][_candidate];
  }
}
