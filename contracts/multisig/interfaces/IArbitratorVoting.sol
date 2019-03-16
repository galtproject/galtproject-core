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


interface IArbitratorVoting {
  function recalculate(address _candidate) external;
  function voteWithOracleStake(address _candidate) external;
  function grantReputation(address _candidate, uint256 _amount) external;
  function revokeReputation(address _candidate, uint256 _amount) external;
  function onDelegateReputationChanged(address _delegate, uint256 _newLocked) external;
  function onOracleStakeChanged(address _oracle, uint256 _newWeight) external;
  function pushArbitrators() external;
  function ignoreMe(bool _value) external;
  function getCandidatesWithStakes() external view returns (address[] memory);
  function getOracleShare(address _oracle) external view returns (uint256);
  function getDelegateShare(address _delegate) external view returns (uint256);
  function getOracleStakes(address _oracle) external view returns (uint256);
  function getSpaceReputation(address _delegate) external view returns (uint256);
  function getShare(address[] calldata _addresses) external view returns (uint256);
  function getWeight(address _candidate) external view returns (uint256);
  function isCandidateInList(address _candidate) external view returns (bool);
  function isIgnored(address _candidate) external view returns (bool);
  function getSize() external view returns (uint256 size);
}
