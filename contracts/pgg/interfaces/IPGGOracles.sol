/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

interface IPGGOracles {
  function addOracle(
    address _oracle,
    string calldata _name,
    bytes32 _position,
    string calldata _description,
    bytes32[] calldata _descriptionHashes,
    bytes32[] calldata _oracleTypes
  )
  external;

  function deactivateOracle(address _oracle) external;

  function requireOracleActive(address _oracle) external view;
  function requireOracleActiveWithAssignedActiveOracleType(address _oracle, bytes32 _oracleType) external view;
  function requireOracleActiveWithAssignedOracleType(address _oracle, bytes32 _oracleType) external view;

  function isOracleActive(address _oracle) external view returns (bool);
  function isOracleTypeAssigned(address _oracle, bytes32 _oracleType) external view returns (bool);

  function oraclesHasTypesAssigned(address[] calldata _oracles, bytes32[] calldata _oracleType) external view returns (bool);
}
