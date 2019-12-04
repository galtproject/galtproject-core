/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


interface ILockableRA {
  function revoke(address _from, uint256 _amount) external;
  function revokeLocked(address _delegate, address _pgg, uint256 _amount) external;
  function lockReputation(address _pgg, uint256 _amount) external;
  function unlockReputation(address _pgg, uint256 _amount) external;
  function lockedBalanceOf(address _owner) external view returns (uint256);
  function lockedPggBalance(address _pgg) external view returns (uint256);
  function lockedPggBalanceOf(address _owner, address _pgg) external view returns (uint256);
  function lockedPggBalances(address[] calldata _pggs) external view returns (uint256);
}
