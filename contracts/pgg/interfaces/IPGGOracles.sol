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
