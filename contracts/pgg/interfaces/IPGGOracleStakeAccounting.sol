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
