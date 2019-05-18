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

pragma solidity 0.5.7;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/IGovernanceOracles.sol";
import "./interfaces/IGovernanceConfig.sol";


contract GovernanceOracles is IGovernanceOracles, Permissionable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;
  using ArraySet for ArraySet.Bytes32Set;

  event LogOracleTypeAdded(bytes32 oracleType, uint256 share);
  event LogOracleTypeRemoved(bytes32 oracleType);
  event LogOracleTypeEnabled(bytes32 oracleType);
  event LogOracleTypeDisabled(bytes32 oracleType);

  bytes32 public constant ROLE_ORACLE_MODIFIER = bytes32("ORACLE_MODIFIER");

  // Oracle list
  ArraySet.AddressSet private oracles;

  // OracleType list
  ArraySet.Bytes32Set private oracleTypes;

  // OracleAddress => Oracle details
  mapping(address => Oracle) private oracleDetails;

  // OracleTypeName => OracleType details
  mapping(bytes32 => OracleType) public oracleTypeDetails;


  struct Oracle {
    string name;
    bytes32 position;
    string description;
    bytes32[] descriptionHashes;
    // the role was assigned by arbitrators
    ArraySet.Bytes32Set assignedOracleTypes;
    bool active;
  }

  struct OracleType {
    bytes32 descriptionHash;
  }

  // WARNING: we do not remove oracles from oraclesArray and oraclesByType,
  // so do not rely on this variable to verify whether oracle
  // exists or not.
  mapping(bytes32 => ArraySet.AddressSet) private oraclesByType;
  IGovernanceConfig private governanceConfig;

  constructor(IGovernanceConfig _governanceConfig) public {
    governanceConfig = _governanceConfig;
  }

  // MODIFIERS

  modifier onlyOracleModifier() {
    require(
      governanceConfig.ggr().getACL().hasRole(msg.sender, ROLE_ORACLE_MODIFIER),
      "Only ORACLE_MODIFIER role allowed"
    );

    _;
  }

  // >>> Oracles management
  function addOracle(
    address _oracle,
    string calldata _name,
    bytes32 _position,
    bytes32[] calldata _descriptionHashes,
    bytes32[] calldata _oracleTypes
  )
    external
    onlyOracleModifier
  {
    require(_oracle != address(0), "Oracle address is empty");
    require(_position != 0x0, "Missing position");

    Oracle storage o = oracleDetails[_oracle];

    o.name = _name;
    o.descriptionHashes = _descriptionHashes;
    o.position = _position;
    o.active = true;

    o.assignedOracleTypes.clear();

    for (uint256 i = 0; i < _oracleTypes.length; i++) {
      bytes32 _oracleType = _oracleTypes[i];
      // TODO: check governanceConfig for roleShare > 0
      o.assignedOracleTypes.add(_oracleType);
      oraclesByType[_oracleType].addSilent(_oracle);
    }

    oracles.addSilent(_oracle);
  }

  function deactivateOracle(address _oracle) external onlyOracleModifier {
    require(_oracle != address(0), "Missing oracle");
    oracleDetails[_oracle].active = false;
    oracles.remove(_oracle);
  }

  // REQUIRES

  function requireOracleActive(address _oracle) external view {
    require(oracleDetails[_oracle].active == true, "Oracle is not active");
  }

  /**
   * @dev Require the following conditions:
   *
   * - oracle is active
   * - oracle type is assigned
   * - oracle type is active
   */
  function requireOracleActiveWithAssignedActiveOracleType(address _oracle, bytes32 _oracleType) external view {
    Oracle storage o = oracleDetails[_oracle];

    require(o.active == true, "Oracle is not active");
    require(o.assignedOracleTypes.has(_oracleType), "Oracle type not assigned");
    require(
      governanceConfig.getOracleStakes().isOracleStakeActive(_oracle, _oracleType) == true,
      "Oracle type not active"
    );
  }

  function requireOracleActiveWithAssignedOracleType(address _oracle, bytes32 _oracleType) external view {
    Oracle storage o = oracleDetails[_oracle];

    require(o.active == true, "Oracle is not active");
    require(o.assignedOracleTypes.has(_oracleType), "Oracle Type not assigned");
  }

  // CHECKERS

  function isOracleActive(address _oracle) external view returns (bool) {
    return oracleDetails[_oracle].active == true;
  }

  function isOracleTypeAssigned(address _oracle, bytes32 _oracleType) external view returns (bool) {
    return oracleDetails[_oracle].assignedOracleTypes.has(_oracleType) == true;
  }

  // GETTERS

  /**
   * @dev Multiple assigned oracle types check
   * @return true if all given oracle-type pairs are exist
   */
  function oraclesHasTypesAssigned(address[] calldata _oracles, bytes32[] calldata _oracleType) external view returns (bool) {
    for (uint256 i = 0; i < _oracles.length; i++) {
      if (oracleDetails[_oracles[i]].assignedOracleTypes.has(_oracleType[i]) == false) {
        return false;
      }
    }

    return true;
  }

  function getOracleTypes() external view returns (bytes32[] memory) {
    return oracleTypes.elements();
  }

  function getOracles() external view returns (address[] memory) {
    return oracles.elements();
  }

  function getOraclesByOracleType(bytes32 _oracleType) external view returns (address[] memory) {
    return oraclesByType[_oracleType].elements();
  }

  function getOracle(
    address oracle
  )
    external
    view
    returns (
      bytes32 position,
      string memory name,
      bytes32[] memory descriptionHashes,
      bytes32[] memory assignedOracleTypes,
      bool active
    )
  {
    Oracle storage o = oracleDetails[oracle];

    return (
      o.position,
      o.name,
      o.descriptionHashes,
      o.assignedOracleTypes.elements(),
      o.active
    );
  }
}
