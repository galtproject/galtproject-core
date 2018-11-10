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

import "openzeppelin-solidity/contracts/ownership/rbac/RBAC.sol";
import "./collections/ArraySet.sol";

contract Auditors is RBAC {
  using ArraySet for ArraySet.AddressSet;

  string public constant ROLE_MANAGER= "role_manager";
  string public constant ROLE_AUDITOR_MANAGER= "auditor_manager";

  ArraySet.AddressSet auditors;
  mapping(address => uint256) public auditorWeight;

  constructor(address _roleManager) public {
    super.addRole(_roleManager, ROLE_MANAGER);
  }

  function addAuditor(
    address _auditor,
    uint256 _weight
  )
    external
    onlyRole(ROLE_AUDITOR_MANAGER)
  {
    auditors.add(_auditor);
    auditorWeight[_auditor] = _weight;
  }

  function removeAuditor(
    address _auditor
  )
    external
    onlyRole(ROLE_AUDITOR_MANAGER)
  {
    auditors.remove(_auditor);
    auditorWeight[_auditor] = 0;
  }

  function setAuditorWeight(
    address _auditor,
    uint256 _weight
  )
    external
    onlyRole(ROLE_AUDITOR_MANAGER)
  {
    require(auditors.has(_auditor), "Auditor doesn't exist");

    auditorWeight[_auditor] = _weight;
  }

  function addRoleTo(
    address _operator,
    string _role
  )
    public
    onlyRole(ROLE_MANAGER)
  {
    super.addRole(_operator, _role);
  }

  function removeRoleFrom(
    address _operator,
    string _role
  )
    public
    onlyRole(ROLE_MANAGER)
  {
    super.removeRole(_operator, _role);
  }

  // Getters
  function getAuditors() public view returns (address[]) {
    return auditors.elements();
  }

  function getSize() public view returns (uint256 size) {
    return auditors.size();
  }
}
