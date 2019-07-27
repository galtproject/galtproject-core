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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/IPGGOracles.sol";
import "./interfaces/IPGGConfig.sol";


contract PGGOracles is IPGGOracles {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;
  using ArraySet for ArraySet.Bytes32Set;

  bytes32 public constant ROLE_ORACLE_MODIFIER = bytes32("ORACLE_MODIFIER");

  event SetOracleType(address indexed oracle, bytes32 indexed oracleType);
  event ClearOracleTypes(address indexed oracle, bytes32[] indexed oracleTypes);
  event DeactivateOracle(address indexed oracle);

  struct Oracle {
    string name;
    bytes32 position;
    string description;
    bytes32[] descriptionHashes;
    // the role was assigned by arbitrators
    ArraySet.Bytes32Set assignedOracleTypes;
    bool active;
  }

  IPGGConfig internal pggConfig;

  ArraySet.AddressSet private oracles;
  ArraySet.Bytes32Set private oracleTypes;

  mapping(address => Oracle) private oracleDetails;

  // WARNING: we do not remove oracles from oraclesByTypeCache,
  // so do not rely on this variable to verify whether oracle
  // exists or not.
  mapping(bytes32 => ArraySet.AddressSet) internal oraclesByTypeCache;

  constructor(IPGGConfig _pggConfig) public {
    pggConfig = _pggConfig;
  }

  // MODIFIERS

  modifier onlyOracleModifier() {
    require(
      pggConfig.ggr().getACL().hasRole(msg.sender, ROLE_ORACLE_MODIFIER),
      "Only ORACLE_MODIFIER role allowed"
    );

    _;
  }

  // >>> Oracles management
  function addOracle(
    address _oracle,
    string calldata _name,
    bytes32 _position,
    string calldata _description,
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
    o.description = _description;
    o.position = _position;
    o.active = true;

    emit ClearOracleTypes(_oracle, o.assignedOracleTypes.elements());
    o.assignedOracleTypes.clear();

    for (uint256 i = 0; i < _oracleTypes.length; i++) {
      bytes32 _oracleType = _oracleTypes[i];
      o.assignedOracleTypes.add(_oracleType);
      oraclesByTypeCache[_oracleType].addSilent(_oracle);

      emit SetOracleType(_oracle, _oracleType);
    }

    oracles.addSilent(_oracle);
  }

  function deactivateOracle(address _oracle) external onlyOracleModifier {
    require(_oracle != address(0), "Missing oracle");
    oracleDetails[_oracle].active = false;
    oracles.remove(_oracle);
    emit DeactivateOracle(_oracle);
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
      pggConfig.getOracleStakes().isOracleStakeActive(_oracle, _oracleType) == true,
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
    return oraclesByTypeCache[_oracleType].elements();
  }

  function getOracle(
    address oracle
  )
    external
    view
    returns (
      bytes32 position,
      string memory name,
      string memory description,
      bytes32[] memory descriptionHashes,
      bytes32[] memory assignedOracleTypes,
      bool active
    )
  {
    Oracle storage o = oracleDetails[oracle];

    return (
      o.position,
      o.name,
      o.description,
      o.descriptionHashes,
      o.assignedOracleTypes.elements(),
      o.active
    );
  }
}
