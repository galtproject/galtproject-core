/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;


interface IPGGDelegateReputationVoting {
  function grantReputation(address _candidate, uint256 _amount) external;
  function revokeReputation(address _candidate, uint256 _amount) external;
  function onDelegateReputationChanged(address _delegate, uint256 _newLocked) external;
  function totalSupply() external view returns(uint256);
  function balanceOf(address _candidate) external view returns(uint256);
  function balanceOfDelegate(address _delegate) external view returns(uint256);
  function shareOf(address _candidate, uint256 _decimals) external view returns(uint256);
  function shareOfDelegate(address _delegate, uint256 _decimals) external view returns(uint256);
  function balanceOfDelegateAt(address _delegate, uint256 _blockNumber) external view returns (uint256);
  function totalDelegateSupplyAt(uint256 _blockNumber) external view returns (uint256);
}
