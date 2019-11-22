/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;


interface IContourVerificationSourceRegistry {
  function addSource(address _contract) external;
  function removeSource(address _contract) external;
  function all() external view returns (address[] memory);
  function hasSource(address _contract) external view returns (bool);
  function requireValid(address _contract) external view;
}
