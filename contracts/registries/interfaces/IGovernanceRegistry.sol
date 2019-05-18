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

pragma solidity 0.5.7;

import "../../governance/interfaces/IGovernanceConfig.sol";
import "../../governance/interfaces/IGovernanceMultiSig.sol";


interface IGovernanceRegistry {
  function addMultiSig(
    IGovernanceMultiSig _abMultiSig,
    IGovernanceConfig _arbitrationConfig
  ) external;
  function requireValidGovernanceMultiSig(address _multiSig) external view;
  function isGovernanceMultiSigValid(address _multiSig) external view returns(bool);
  function getGovernanceConfig(address _multiSig) external view returns (IGovernanceConfig);
  function getGovernanceMultiSigList() external view returns (address[] memory);
  function getGovernnanceConfigList() external view returns (address[] memory);
  function getGovernanceCount() external view returns (uint256);
}
