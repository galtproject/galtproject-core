/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


interface IPGGOracleStakeVoting {
  function vote(address _candidate) external;
  function onOracleStakeChanged(address _oracle, uint256 _newReputation)external;
  function getOracle(address _oracle) external view returns (address _currentCandidate, uint256 reputation);
  function totalSupply() external view returns (uint256);
  function candidateBalanceOf(address _candidate) external view returns (uint256);
  function oracleBalanceOf(address _oracle) external view returns (uint256);
  function candidateShareOf(address _candidate, uint256 _decimals) external view returns(uint256);
  function oracleShareOf(address _oracle, uint256 _decimals) external view returns(uint256);
}
