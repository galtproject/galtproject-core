/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;


interface IPGGMultiSigCandidateTop {
  function recalculate(address _candidate) external;
  function pushArbitrators() external;
  function ignoreMe(bool _value) external;
  function getCandidatesWithStakes() external view returns (address[] memory);
  function getCandidateWeight(address _candidate) external view returns (uint256);
  function getHolderWeight(address _candidate) external view returns (uint256);
  function getHolderWeights(address[] calldata _candidates) external view returns (uint256);
  function isCandidateInList(address _candidate) external view returns (bool);
  function isIgnored(address _candidate) external view returns (bool);
  function getSize() external view returns (uint256 size);
}
