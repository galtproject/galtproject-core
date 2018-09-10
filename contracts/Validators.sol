pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


contract Validators is Ownable {
  using SafeMath for uint256;

  event LogValidatorRoleAdded(bytes32 role, uint8 share);
  event LogValidatorRoleRemoved(bytes32 role);
  event LogValidatorRoleEnabled(bytes32 role);
  event LogValidatorRoleDisabled(bytes32 role);
  event LogReadyForApplications();
  event LogNotReadyForApplications(uint256 total);

  uint256 public constant ROLES_LIMIT = 50;

  bytes32 public constant ROLE_NOT_EXISTS = 0x0;

  // ApplicationType => RoleName. Currently required roles for
  // the given type of an application.
  mapping(bytes32 => bytes32[]) public applicationTypeRoles;

  // RoleName => RoleDetails
  mapping(bytes32 => ValidatorRole) public roles;

  // Validator Role details
  mapping(address => Validator) public validators;

  struct Validator {
    bytes32 name;
    bytes32[] descriptionHashes;
    bytes32[] rolesList;
    mapping(bytes32 => bool) roles;
    bytes32 position;
    bool active;
  }

  struct ValidatorRole {
    uint8 index;
    uint8 rewardShare;
    // role exists if applicationType != ROLE_NOT_EXISTS
    bytes32 applicationType;
    bytes32 descriptionHash;
  }

  bytes32[] public validatorRolesIndex;
  mapping(bytes32 => ValidatorRole) public validatorRolesMap;
  bool public readyForApplications;

  // WARNING: we do not remove validators from validatorsArray,
  // so do not rely on this variable to verify whether validator
  // exists or not.
  address[] public validatorsArray;

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
    onlyOwner
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
        descriptionHash: _descriptions[i]
      });
      applicationTypeRoles[_applicationType].push(role);
      totalShares = totalShares + _shares[i];
    }

    require(totalShares == 100, "Total shares not 100");
  }

  function deleteApplicationType(
    bytes32 _applicationType
  )
    external
    onlyOwner
  {
    bytes32[] memory aRoles = applicationTypeRoles[_applicationType];
    uint8 len = uint8(aRoles.length);

    for (uint8 i = 0; i < len; i++) {
      delete roles[aRoles[i]];
    }

    delete applicationTypeRoles[_applicationType];
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
    onlyOwner
  {
    require(_validator != address(0), "Validator address is empty");
    require(_position != 0x0, "Missing position");
    require(_roles.length <= ROLES_LIMIT, "Roles count should be <= 50");

    validators[_validator] = Validator({
      name: _name,
      descriptionHashes: _descriptionHashes,
      rolesList: _roles,
      position: _position,
      active: true
    });

    for (uint8 i = 0; i < _roles.length; i++) {
      bytes32 role = _roles[i];
      require(roles[role].applicationType != 0x0, "Role doesn't exist");
      validators[_validator].roles[role] = true;
    }

    validatorsArray.push(_validator);
  }

  function removeValidator(address _validator) external onlyOwner {
    require(_validator != address(0), "Missing validator");
    // TODO: use index to remove validator
    validators[_validator].active = false;
  }

  function ensureValidatorActive(address _validator) external view returns (bool) {
    require(validators[_validator].active == true, "Validator is not active");
  }

  function isValidatorActive(address _validator) external view returns (bool) {
    return validators[_validator].active == true;
  }

  function hasRole(address _validator, bytes32 _role) external view returns (bool) {
    return validators[_validator].roles[_role] == true;
  }

  function getValidator(
    address validator
  )
    external
    view
    returns (
      bytes32 name,
      bytes32 position,
      bytes32[] roles,
      bool active
    )
  {
    Validator storage v = validators[validator];

    return (
    v.name,
    v.position,
    v.rolesList,
    v.active
    );
  }

  function getValidatorRoles() external view returns (bytes32[]) {
    return validatorRolesIndex;
  }
}
