/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;


interface IPGGMultiSig {
  function proposeTransaction(address destination, uint value, bytes calldata data) external returns (uint256 transactionId);
  function setArbitrators(address[] calldata descArbitrators) external;
  function revokeArbitrators() external;
  function isOwner(address _owner) external view returns(bool);
  function transactions(uint256) external view returns(address destination, uint value, bytes memory data, bool executed);
  function checkGaltLimitsExternal(bytes calldata data) external;
  function getArbitrators() external view returns (address[] memory);
}
