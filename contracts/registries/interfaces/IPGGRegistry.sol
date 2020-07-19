/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "../../pgg/interfaces/IPGGConfig.sol";
import "../../pgg/interfaces/IPGGMultiSig.sol";


interface IPGGRegistry {
  function addPgg(IPGGConfig _pggConfig) external;
  function requireValidPgg(address _pgg) external view;
  function isPggValid(address _pgg) external view returns(bool);
  function getPggConfig(address _pgg) external view returns(IPGGConfig);
  function getPggList() external view returns (address[] memory);
  function getPggCount() external view returns (uint256);
}
