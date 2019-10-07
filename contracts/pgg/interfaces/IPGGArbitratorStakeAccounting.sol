/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
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
