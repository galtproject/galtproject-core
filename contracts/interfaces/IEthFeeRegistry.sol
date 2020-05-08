/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


interface IEthFeeRegistry {
  event SetFee(bytes32 indexed key, uint256 value);

  function ethFeeByKey(bytes32 _key) external view returns(uint256);

  function requireFeeManager(address _sender) external view;

  function requireFeeCollector(address _sender) external view;
}
