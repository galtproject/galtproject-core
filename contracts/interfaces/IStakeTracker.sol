/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


contract IStakeTracker {
  function onChange(address _pgg, uint256 _amount) external;
  function balancesOf(address[] calldata _pggs) external view returns(uint256);
  function balanceOf(address _pgg) external view returns(uint256);
  function totalSupply() external view returns(uint256);
}
