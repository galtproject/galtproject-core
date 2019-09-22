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
