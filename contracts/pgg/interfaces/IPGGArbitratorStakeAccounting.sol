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


interface IPGGArbitratorStakeAccounting {
  function slash(address _arbitrator, uint256 _amount) external;
  function slashMultiple(address[] calldata _arbitrators, uint256[] calldata _amounts) external;
  function stake(address _arbitrator, uint256 _amount) external;
  function getCurrentPeriodAndTotalSupply() external view returns (uint256, uint256);
  function getCurrentPeriod() external view returns (uint256);
  function balanceOf(address _arbitrator) external view returns (uint256);
  function getInitialTimestamp() external view returns (uint256);
}
