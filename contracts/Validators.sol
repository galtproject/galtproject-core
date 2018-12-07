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

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/rbac/RBAC.sol";
import "./collections/ArraySet.sol";


contract Validators is Ownable, RBAC {
  using SafeMath for uint256;
  using ArraySet for ArraySet.Bytes32Set;

  event LogValidatorRoleAdded(bytes32 role, uint8 share);
  event LogValidatorRoleRemoved(bytes32 role);
  event LogValidatorRoleEnabled(bytes32 role);
  event LogValidatorRoleDisabled(bytes32 role);
  event LogReadyForApplications();
  event LogNotReadyForApplications(uint256 total);


  string public constant ROLE_VALIDATOR_MANAGER = "validator_manager";
  string public constant ROLE_AUDITOR_MANAGER = "auditor_manager";
  string public constant ROLE_APPLICATION_TYPE_MANAGER = "application_type_manager";
  string public constant ROLE_VALIDATOR_STAKES = "validator_stakes";

  bytes32 public constant CLAIM_MANAGER_APPLICATION_TYPE = 0x6cdf6ab5991983536f64f626597a53b1a46773aa1473467b6d9d9a305b0a03ef;
  bytes32 public constant CM_AUDITOR = 0x434d5f41554449544f5200000000000000000000000000000000000000000000;

  uint256 public constant ROLES_LIMIT = 50;
  bytes32 public constant ROLE_NOT_EXISTS = 0x0;

  // ApplicationType => RoleName. Currently required roles for
  // the given type of an application.
  mapping(bytes32 => bytes32[]) public applicationTypeRoles;

  // RoleName => RoleDetails
  mapping(bytes32 => ValidatorRole) public roles;

  // Validator Role details
  mapping(address => Validator) validators;

  struct Validator {
    bytes32 name;
    bytes32[] descriptionHashes;
    ArraySet.Bytes32Set assignedRoles;
    ArraySet.Bytes32Set activeRoles;
    bytes32 position;
    bool active;
  }

  struct ValidatorRole {
    uint8 index;
    uint8 rewardShare;
    // role exists if applicationType != ROLE_NOT_EXISTS
    bytes32 applicationType;
    uint256 minimalDeposit;
    bytes32 descriptionHash;
  }

  bytes32[] public validatorRolesIndex;
  mapping(bytes32 => ValidatorRole) public validatorRolesMap;
  bool public readyForApplications;

  // WARNING: we do not remove validators from validatorsArray and validatorsByRoles,
  // so do not rely on this variable to verify whether validator
  // exists or not.
  address[] public validatorsArray;
  mapping(bytes32 => address[]) public validatorsByRoles;

  modifier onlyValidatorManager() {
    require(hasRole(msg.sender, ROLE_VALIDATOR_MANAGER), "No permissions for validator management");
    _;
  }

  modifier onlyApplicationTypeManager() {
    require(hasRole(msg.sender, ROLE_APPLICATION_TYPE_MANAGER), "No permissions for application type management");
    _;
  }

  modifier onlyValidatorStakes() {
    require(hasRole(msg.sender, ROLE_VALIDATOR_STAKES), "No permissions for this action");

    _;
  }

  modifier onlyAuditorManager() {
    require(hasRole(msg.sender, ROLE_AUDITOR_MANAGER), "No permissions for this action");

    _;
  }

  // >>> Roles management
  /**
   * Set roles for a given type.
   * Total of _shares should be 100
   * Expecting no more than 15 roles per ApplicationType
   * DANGER: existing roles from other application types could
   * be easily overwritten
   * DANGER: once the role was set, it could not be reassigned
   * to another ApplicationType
   * DANGER: roles could be assigned to any application type,
   * not only to those ones from ApplicationType enum
   */
  function setApplicationTypeRoles(
    bytes32 _applicationType,
    bytes32[] _roles,
    uint8[] _shares,
    bytes32[] _descriptions
  )
    external
    onlyApplicationTypeManager
  {
    uint8 len = uint8(_roles.length);
    require(len == uint8(_shares.length), "Roles and shares array lenghts don't match");
    require(len == uint8(_descriptions.length), "Roles and descriptions array lenghts don't match");
    require(_applicationType != ROLE_NOT_EXISTS, "Could not assign to role NOT_EXISTS");
    require(applicationTypeRoles[_applicationType].length == 0, "Role already exists");

    uint8 totalShares = 0;
    delete applicationTypeRoles[_applicationType];
    for (uint8 i = 0; i < _roles.length; i++) {
      require(_shares[i] >= 0, "Role share should be greater or equal to 1");
      require(_shares[i] <= 100, "Role share should be less or equal to 100");

      bytes32 role = _roles[i];
      require(roles[role].applicationType != _applicationType, "Role belong to other application type");
      roles[role] = ValidatorRole({
        index: i,
        rewardShare: _shares[i],
        applicationType: _applicationType,
        minimalDeposit: 0,
        descriptionHash: _descriptions[i]
      });
      applicationTypeRoles[_applicationType].push(role);
      totalShares = totalShares + _shares[i];
    }

    require(totalShares == 100, "Total shares not 100");
  }

  function setRoleMinimalDeposit(
    bytes32 _role,
    uint256 _newMinimalDeposit
  )
    external
    onlyApplicationTypeManager
  {
    roles[_role].minimalDeposit = _newMinimalDeposit;
  }

  function getRoleMinimalDeposit(bytes32 _role) external view returns (uint256) {
    return roles[_role].minimalDeposit;
  }

  function deleteApplicationType(
    bytes32 _applicationType
  )
    external
    onlyApplicationTypeManager
  {
    bytes32[] memory aRoles = applicationTypeRoles[_applicationType];
    uint8 len = uint8(aRoles.length);

    for (uint8 i = 0; i < len; i++) {
      delete roles[aRoles[i]];
    }

    delete applicationTypeRoles[_applicationType];
  }

  function setAuditors(
    address[] _auditors,
    uint256 _limit
  )
    external
    onlyAuditorManager
  {
    for (uint256 i = 0; i < _limit; i++) {
      Validator storage a = validators[_auditors[i]];
      require(a.active, "Validator not active");

      a.assignedRoles.addSilent(CM_AUDITOR);

      validatorsByRoles[CM_AUDITOR].push(_auditors[i]);
    }
  }

  function isApplicationTypeReady(bytes32 _applicationType) external view returns (bool) {
    return applicationTypeRoles[_applicationType].length > 0;
  }

  function getApplicationTypeRoles(
    bytes32 _applicationType
  )
    external
    view
    returns (bytes32[])
  {
    return applicationTypeRoles[_applicationType];
  }

  function getApplicationTypeRolesCount(
    bytes32 _applicationType
  )
    external
    view
    returns (uint256)
  {
    uint256 count = applicationTypeRoles[_applicationType].length;
    assert(count < ROLES_LIMIT);
    return count;
  }

  function getRoleRewardShare(bytes32 _role) external view returns (uint8) {
    return roles[_role].rewardShare;
  }

  function getRoleApplicationType(bytes32 _role) external view returns (bytes32) {
    return roles[_role].applicationType;
  }

  // >>> Validators management
  function addValidator(
    address _validator,
    bytes32 _name,
    bytes32 _position,
    bytes32[] _descriptionHashes,
    bytes32[] _roles
  )
    external
    onlyValidatorManager
  {
    require(_validator != address(0), "Validator address is empty");
    require(_position != 0x0, "Missing position");
    require(_roles.length <= ROLES_LIMIT, "Roles count should be <= 50");

    Validator memory v;

    v.name = _name;
    v.descriptionHashes = _descriptionHashes;
    v.position = _position;
    v.active = true;

    validators[_validator] = v;
    validators[_validator].assignedRoles.clear();

    for (uint8 i = 0; i < _roles.length; i++) {
      bytes32 role = _roles[i];
//      require(role != CM_AUDITOR, "Can't assign CM_AUDITOR role");
      require(roles[role].applicationType != 0x0, "Role doesn't exist");
      validators[_validator].assignedRoles.addSilent(role);
      validatorsByRoles[role].push(_validator);
    }

    validatorsArray.push(_validator);
  }

  function removeValidator(address _validator) external onlyValidatorManager {
    require(_validator != address(0), "Missing validator");
    // TODO: use index (Set) to remove validator
    validators[_validator].active = false;
  }

  function requireValidatorActive(address _validator) external view {
    Validator storage v = validators[_validator];
    require(v.active == true, "Validator is not active");
  }

  /**
   * @dev Require the following conditions:
   *
   * - validator is active
   * - validator role is assigned
   * - validator role is active
   */
  function requireValidatorActiveWithAssignedActiveRole(address _validator, bytes32 _role) external view {
    Validator storage v = validators[_validator];

    require(v.active == true, "Validator is not active");
    require(v.assignedRoles.has(_role), "Validator role not assigned");
    require(v.activeRoles.has(_role), "Validator role not active");
  }

  function requireValidatorActiveWithAssignedRole(address _validator, bytes32 _role) external view {
    Validator storage v = validators[_validator];

    require(v.active == true, "Validator is not active");
    require(v.assignedRoles.has(_role), "Validator role not assigned");
  }

  function isValidatorActive(address _validator) external view returns (bool) {
    Validator storage v = validators[_validator];
    return v.active == true;
  }

  function isValidatorRoleAssigned(address _validator, bytes32 _role) external view returns (bool) {
    return validators[_validator].assignedRoles.has(_role) == true;
  }

  function isValidatorRoleActive(address _validator, bytes32 _role) external view returns (bool) {
    return validators[_validator].activeRoles.has(_role) == true;
  }

  /**
   * @dev Multiple assigned validator roles check
   * @return true if all given validator-role pairs are exist
   */
  function validatorsHaveRolesAssigned(address[] _validators, bytes32[] _roles) external view returns (bool) {
    for (uint256 i = 0; i < _validators.length; i++) {
      if (validators[_validators[i]].assignedRoles.has(_roles[i]) == false) {
        return false;
      }
    }

    return true;
  }

  // TODO: array support
  function onStakeChanged(
    address _validator,
    bytes32 _role,
    int256 _newDepositValue
  )
    external
    onlyValidatorStakes
  {
    if (_newDepositValue >= int256(roles[_role].minimalDeposit)) {
      validators[_validator].activeRoles.addSilent(_role);
    } else {
      validators[_validator].activeRoles.removeSilent(_role);
    }
  }

  function getValidator(
    address validator
  )
    external
    view
    returns (
      bytes32 name,
      bytes32 position,
      bytes32[] descriptionHashes,
      bytes32[] activeRoles,
      bytes32[] assignedRoles,
      bool active
    )
  {
    Validator storage v = validators[validator];

    return (
      v.name,
      v.position,
      v.descriptionHashes,
      v.activeRoles.elements(),
      v.assignedRoles.elements(),
      v.active
    );
  }

  function getValidatorRoles() external view returns (bytes32[]) {
    return validatorRolesIndex;
  }

  function getValidators() external view returns (address[]) {
    return validatorsArray;
  }

  function getValidatorsByRole(bytes32 role) external view returns (address[]) {
    return validatorsByRoles[role];
  }


  function addRoleTo(address _operator, string _role) external onlyOwner {
    super.addRole(_operator, _role);
  }

  function removeRoleFrom(address _operator, string _role) external onlyOwner {
    super.removeRole(_operator, _role);
  }
}
