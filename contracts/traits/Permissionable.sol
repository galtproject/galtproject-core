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

import "openzeppelin-solidity/contracts/ownership/rbac/Roles.sol";
pragma experimental "v0.5.0";

contract Permissionable {
  using Roles for Roles.Role;

  event RoleAdded(address indexed account, string role);
  event RoleRemoved(address indexed account, string role);

  mapping (string => Roles.Role) private roles;

  string public constant ROLE_MANAGER = "role_manager";

  modifier onlyRole(string _role) {
    require(roles[_role].has(msg.sender), "Invalid role");

    _;
  }

  function hasRole(address _account, string _role) public returns (bool) {
    require(roles[_role].has(_account), "Invalid role");
  }

  function addRoleTo(address _account, string _role) external onlyRole(ROLE_MANAGER) {
    roles[_role].add(_account);
    emit RoleAdded(_account, _role);
  }

  function addRoleFrom(address _account, string _role) external onlyRole(ROLE_MANAGER) {
    roles[_role].remove(_account);
    emit RoleRemoved(_account, _role);
  }
}