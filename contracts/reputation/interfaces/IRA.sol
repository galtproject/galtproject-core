/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;


interface IRA {
  // ERC20 compatible
  function balanceOf(address owner) external view returns (uint256);

  // ERC20 compatible
  function totalSupply() external view returns (uint256);

  // Ping-Pong Handshake
  function ping() external pure returns (bytes32);
}
