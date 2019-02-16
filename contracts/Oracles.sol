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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";


contract Oracles is Permissionable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;
  using ArraySet for ArraySet.Bytes32Set;

  event LogOracleTypeAdded(bytes32 oracleType, uint256 share);
  event LogOracleTypeRemoved(bytes32 oracleType);
  event LogOracleTypeEnabled(bytes32 oracleType);
  event LogOracleTypeDisabled(bytes32 oracleType);

  string public constant ROLE_APPLICATION_TYPE_MANAGER = "application_type_manager";
  string public constant ROLE_ORACLE_TYPE_MANAGER= "oracle_type_manager";
  string public constant ROLE_ORACLE_MANAGER = "oracle_manager";

  string public constant ROLE_GALT_SHARE_MANAGER = "galt_share_manager";
  string public constant ROLE_ORACLE_STAKES_MANAGER = "oracle_stakes_manager";
  string public constant ROLE_ORACLE_STAKES_NOTIFIER = "oracle_stakes_notifier";
  string public constant ROLE_ORACLE_STAKES_NOTIFIER_MANAGER = "oracle_stakes_notifier_manager";

  uint256 public constant ORACLE_TYPES_LIMIT = 50;
  bytes32 public constant ORACLE_TYPE_NOT_EXISTS = 0x0;

  // ApplicationType => OracleType. Currently required oracle types for
  // the given type of an application.
  mapping(bytes32 => bytes32[]) public applicationTypeOracleTypes;

  // OracleTypeName => OracleType details
  mapping(bytes32 => OracleType) public oracleTypes;

  // Oracle details
  mapping(address => Oracle) oracles;

  struct Oracle {
    bytes32 name;
    address multiSig;
    bytes32[] descriptionHashes;
    ArraySet.Bytes32Set assignedOracleTypes;
    ArraySet.Bytes32Set activeOracleTypes;
    bytes32 position;
    bool active;
  }

  struct OracleType {
    uint256 index;
    uint256 rewardShare;
    // oracle type exists if applicationType != ORACLE_TYPE_NOT_EXISTS
    bytes32 applicationType;
    uint256 minimalDeposit;
    bytes32 descriptionHash;
  }

  bytes32[] public oracleTypesIndex;
  mapping(bytes32 => OracleType) public oracleTypesMap;
  bool public readyForApplications;

  // WARNING: we do not remove oracles from oraclesArray and oraclesByType,
  // so do not rely on this variable to verify whether oracle
  // exists or not.
  address[] public oraclesArray;
  mapping(bytes32 => address[]) public oraclesByType;

  // MODIFIERS

  modifier onlyApplicationTypeManager() {
    require(hasRole(msg.sender, ROLE_APPLICATION_TYPE_MANAGER), "No permissions for application type management");
    _;
  }

  modifier onlyOracleTypeManager() {
    require(hasRole(msg.sender, ROLE_ORACLE_TYPE_MANAGER), "No permissions for oracle type management");
    _;
  }

  modifier onlyOracleManager() {
    require(hasRole(msg.sender, ROLE_ORACLE_MANAGER), "No permissions for oracle management");
    _;
  }

  modifier onlyOracleStakesManager() {
    require(hasRole(msg.sender, ROLE_ORACLE_STAKES_MANAGER), "No permissions for oracle stake management");

    _;
  }

  modifier onlyOracleStakesNotifier() {
    require(hasRole(msg.sender, ROLE_ORACLE_STAKES_NOTIFIER), "No permissions for notifications");

    _;
  }

  modifier onlyOracleStakesNotifierManager() {
    require(hasRole(msg.sender, ROLE_ORACLE_STAKES_NOTIFIER_MANAGER), "No permissions for stake notifiers management");

    _;
  }

  // CHANGERS

  // >>> OracleTypes Management
  /**
   * Set OracleType for a given ApplicationType.
   * Total of _shares should be 100
   * Expecting no more than 15 OracleTypes per ApplicationType
   * DANGER: existing OracleTypes from other ApplicationType could
   * be easily overwritten
   * DANGER: once the OracleType was set, it could not be reassigned
   * to another ApplicationType
   * DANGER: OracleType could be assigned to any application type,
   * not only to those ones from ApplicationType enum
   */
  function setApplicationTypeOracleTypes(
    bytes32 _applicationType,
    bytes32[] calldata _oracleTypes,
    uint256[] calldata _shares,
    bytes32[] calldata _descriptions
  )
    external
    onlyApplicationTypeManager
  {
    // TODO: migrate to uint256
    uint256 len = _oracleTypes.length;
    require(len == _shares.length, "Oracle Types and shares array lengths don't match");
    require(len == _descriptions.length, "Oracle Types and descriptions array lengths don't match");
    require(_applicationType != ORACLE_TYPE_NOT_EXISTS, "Could not assign to oracle type NOT_EXISTS");
    require(applicationTypeOracleTypes[_applicationType].length == 0, "Oracle Types already exists");

    uint256 totalShares = 0;
    delete applicationTypeOracleTypes[_applicationType];
    for (uint256 i = 0; i < _oracleTypes.length; i++) {
      require(_shares[i] >= 0, "Oracle Types share should be greater or equal to 1");
      require(_shares[i] <= 100, "Oracle Types share should be less or equal to 100");

      bytes32 oracleType = _oracleTypes[i];
      require(oracleTypes[oracleType].applicationType != _applicationType, "Oracle Type belong to other application type");
      oracleTypes[oracleType] = OracleType({
        index: i,
        rewardShare: _shares[i],
        applicationType: _applicationType,
        minimalDeposit: 0,
        descriptionHash: _descriptions[i]
      });
      applicationTypeOracleTypes[_applicationType].push(oracleType);
      totalShares = totalShares + _shares[i];
    }

    require(totalShares == 100, "Total shares not 100");
  }

  function setOracleTypeMinimalDeposit(
    bytes32 _oracleType,
    uint256 _newMinimalDeposit
  )
    external
    onlyApplicationTypeManager
  {
    oracleTypes[_oracleType].minimalDeposit = _newMinimalDeposit;
  }

  function deleteApplicationType(
    bytes32 _applicationType
  )
    external
    onlyApplicationTypeManager
  {
    bytes32[] memory aOracleTypes = applicationTypeOracleTypes[_applicationType];
    uint256 len = aOracleTypes.length;

    for (uint256 i = 0; i < len; i++) {
      delete oracleTypes[aOracleTypes[i]];
    }

    delete applicationTypeOracleTypes[_applicationType];
  }

  // >>> Oracles management
  // TODO: add to a specific multisig
  function addOracle(
    address _multiSig,
    address _oracle,
    bytes32 _name,
    bytes32 _position,
    bytes32[] calldata _descriptionHashes,
    bytes32[] calldata _oracleTypes
  )
    external
    onlyOracleManager
  {
    require(_oracle != address(0), "Oracle address is empty");
    require(_position != 0x0, "Missing position");
    require(_oracleTypes.length <= ORACLE_TYPES_LIMIT, "Oracle Types count should be <= 50");
    // TODO: check registry multiSig is valid

    Oracle storage o = oracles[_oracle];

    o.name = _name;
    o.descriptionHashes = _descriptionHashes;
    o.position = _position;
    o.active = true;
    o.multiSig = _multiSig;

    o.assignedOracleTypes.clear();

    for (uint256 i = 0; i < _oracleTypes.length; i++) {
      bytes32 _oracleType = _oracleTypes[i];
      require(oracleTypes[_oracleType].applicationType != 0x0, "Oracle Type doesn't exist");
      o.assignedOracleTypes.add(_oracleType);
      oraclesByType[_oracleType].push(_oracle);
    }

    oraclesArray.push(_oracle);
  }

  function addOracleNotifierRoleTo(address _manager) external onlyOracleStakesNotifierManager {
    _addRoleTo(_manager, ROLE_ORACLE_STAKES_NOTIFIER);
  }

  // TODO: only specific multisig allowed
  function removeOracle(address _oracle) external onlyOracleManager {
    require(_oracle != address(0), "Missing oracle");
    // TODO: use index (Set) to remove oracle
    oracles[_oracle].active = false;
  }

  // NOTIFIERS

  // TODO: array support
  // TODO: allow only one multisig per address
  function onOracleStakeChanged(
    address _oracle,
    bytes32 _oracleType,
    int256 _newDepositValue
  )
    external
    onlyOracleStakesNotifier
  {
    if (_newDepositValue >= int256(oracleTypes[_oracleType].minimalDeposit)) {
      oracles[_oracle].activeOracleTypes.addSilent(_oracleType);
    } else {
      oracles[_oracle].activeOracleTypes.removeSilent(_oracleType);
    }
  }

  // REQUIRES

  function requireOracleActive(address _oracle) external view {
    Oracle storage o = oracles[_oracle];
    require(o.active == true, "Oracle is not active");
  }

  /**
   * @dev Require the following conditions:
   *
   * - oracle is active
   * - oracle type is assigned
   * - oracle type is active
   */
  function requireOracleActiveWithAssignedActiveOracleType(address _oracle, bytes32 _oracleType) external view {
    Oracle storage o = oracles[_oracle];

    require(o.active == true, "Oracle is not active");
    require(o.assignedOracleTypes.has(_oracleType), "Oracle type not assigned");
    require(o.activeOracleTypes.has(_oracleType), "Oracle type not active");
  }

  function requireOracleActiveWithAssignedOracleType(address _oracle, bytes32 _oracleType) external view {
    Oracle storage o = oracles[_oracle];

    require(o.active == true, "Oracle is not active");
    require(o.assignedOracleTypes.has(_oracleType), "Oracle Type not assigned");
  }

  // CHECKERS

  function isApplicationTypeReady(bytes32 _applicationType) external view returns (bool) {
    return applicationTypeOracleTypes[_applicationType].length > 0;
  }

  function isOracleActive(address _oracle) external view returns (bool) {
    Oracle storage o = oracles[_oracle];
    return o.active == true;
  }

  function isOracleTypeAssigned(address _oracle, bytes32 _oracleType) external view returns (bool) {
    return oracles[_oracle].assignedOracleTypes.has(_oracleType) == true;
  }

  function isOracleTypeActive(address _oracle, bytes32 _oracleType) external view returns (bool) {
    return oracles[_oracle].activeOracleTypes.has(_oracleType) == true;
  }

  // GETTERS

  /**
   * @dev Multiple assigned oracle types check
   * @return true if all given oracle-type pairs are exist
   */
  function oraclesHasTypesAssigned(address[] calldata _oracles, bytes32[] calldata _oracleType) external view returns (bool) {
    for (uint256 i = 0; i < _oracles.length; i++) {
      if (oracles[_oracles[i]].assignedOracleTypes.has(_oracleType[i]) == false) {
        return false;
      }
    }

    return true;
  }

  function getApplicationTypeOracleTypes(
    bytes32 _applicationType
  )
    external
    view
    returns (bytes32[] memory)
  {
    return applicationTypeOracleTypes[_applicationType];
  }

  function getApplicationTypeOracleTypesCount(
    bytes32 _applicationType
  )
    external
    view
    returns (uint256)
  {
    uint256 count = applicationTypeOracleTypes[_applicationType].length;
    assert(count < ORACLE_TYPES_LIMIT);
    return count;
  }

  function getOracleTypeMinimalDeposit(bytes32 _oracleType) external view returns (uint256) {
    return oracleTypes[_oracleType].minimalDeposit;
  }


  function getOracleTypeRewardShare(bytes32 _oracleType) external view returns (uint256) {
    return oracleTypes[_oracleType].rewardShare;
  }

  function getOracleTypeApplicationType(bytes32 _oracleType) external view returns (bytes32) {
    return oracleTypes[_oracleType].applicationType;
  }

  function getOracleTypes() external view returns (bytes32[] memory) {
    return oracleTypesIndex;
  }

  function getOracles() external view returns (address[] memory) {
    return oraclesArray;
  }

  function getOraclesByOracleType(bytes32 _oracleType) external view returns (address[] memory) {
    return oraclesByType[_oracleType];
  }

  function getOracle(
    address oracle
  )
    external
    view
    returns (
      bytes32 name,
      bytes32 position,
      bytes32[] memory descriptionHashes,
      bytes32[] memory activeOracleTypes,
      bytes32[] memory assignedOracleTypes,
      bool active
    )
  {
    Oracle storage o = oracles[oracle];

    return (
    o.name,
    o.position,
    o.descriptionHashes,
    o.activeOracleTypes.elements(),
    o.assignedOracleTypes.elements(),
    o.active
    );
  }

}
