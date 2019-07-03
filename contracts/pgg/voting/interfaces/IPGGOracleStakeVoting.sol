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


contract IPGGOracleStakeVoting {
  bytes32 public constant ROLE_ORACLE_STAKE_NOTIFIER = bytes32("oracle_stake_notifier");

  function vote(address _candidate) external;
  function onOracleStakeChanged(address _oracle, uint256 _newReputation)external;
  function getOracle(address _oracle) external view returns (address _currentCandidate, uint256 reputation);
  function totalSupply() external view returns (uint256);
  function candidateBalanceOf(address _candidate) external view returns (uint256);
  function oracleBalanceOf(address _oracle) external view returns (uint256);
  function candidateShareOf(address _candidate, uint256 _decimals) external view returns(uint256);
  function oracleShareOf(address _oracle, uint256 _decimals) external view returns(uint256);
}
