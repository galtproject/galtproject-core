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
import "./ValidatorStakesMultiSig.sol";

contract Auditors is RBAC {
  using ArraySet for ArraySet.AddressSet;

  string public constant ROLE_MANAGER= "role_manager";
  string public constant ROLE_AUDITOR_MANAGER= "auditor_manager";

  ArraySet.AddressSet auditors;
  mapping(address => uint256) public auditorWeight;

  uint256 public n;
  uint256 public m;

  ValidatorStakesMultiSig validatorStakesMultiSig;

  constructor(
    address _roleManager,
    ValidatorStakesMultiSig _validatorStakesMultiSig
  )
    public
  {
    super.addRole(_roleManager, ROLE_MANAGER);
    validatorStakesMultiSig = _validatorStakesMultiSig;
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

  function setNofM(
    uint256 _n,
    uint256 _m
  )
    external
    onlyRole(ROLE_AUDITOR_MANAGER)
  {
    require(2 <= _n, "Should satisfy `2 <= n`");
    require(_n <= _m, "Should satisfy `n <= m`");

    n = _n;
    m = _m;
  }

  function pushAuditors(address[] descSortedAuditors) external {
    require(descSortedAuditors.length == auditors.size(), "Sorted auditors list should be equal to the stored one");

    uint256 len = descSortedAuditors.length;
    uint256 previousWeight = auditorWeight[descSortedAuditors[0]];
    require(previousWeight > 0, "Could not accept auditors with 0 weight");

    for (uint256 i = 0; i < len; i++) {
      uint256 currentWeight = auditorWeight[descSortedAuditors[i]];
      require(currentWeight > 0, "Could not accept auditors with 0 weight");

      require(currentWeight <= previousWeight, "Invalid sorting");
      previousWeight = currentWeight;
    }

    validatorStakesMultiSig.setOwners(n, m, descSortedAuditors);
    // TODO: push top to validators
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
