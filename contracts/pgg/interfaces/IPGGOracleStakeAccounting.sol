/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;


interface IPGGOracleStakeAccounting {
  function slash(address _oracle, bytes32 _oracleType, uint256 _amount) external;
  function slashMultiple(address[] calldata _oracles, bytes32[] calldata _oracleTypes, uint256[] calldata _amounts) external;
  function stake(address _oracle, bytes32 _oracleType, uint256 _amount) external;
  function balanceOf(address _oracle) external view returns (int256);
  function typeStakeOf(address _oracle, bytes32 _oracleType) external view returns (int256);
  function isOracleStakeActive(address _oracle, bytes32 _oracleType) external view returns (bool);
  function balanceOfAt(address _oracle, uint256 _blockNumber) external view returns (uint256);
  function totalSupplyAt(uint256 _blockNumber) external view returns (uint256);
}
