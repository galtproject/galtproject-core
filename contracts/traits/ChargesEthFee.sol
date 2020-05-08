/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "../interfaces/IEthFeeRegistry.sol";


contract ChargesEthFee {
  address payable public feeRegistry;

  event SetFeeRegistry(address feeRegistry);

  modifier onlyFeeRegistryManager() {
    IEthFeeRegistry(feeRegistry).requireRegistryManager(msg.sender);
    _;
  }

  constructor() public {}

  // SETTERS

  function setFeeRegistry(address _addr) external onlyFeeRegistryManager {
    feeRegistry = address(uint160(_addr));

    emit SetFeeRegistry(_addr);
  }

  // INTERNAL

  function _acceptPayment(bytes32 _key) internal {
    require(msg.value == IEthFeeRegistry(feeRegistry).ethFeeByKey(_key), "Fee and msg.value not equal");
    feeRegistry.transfer(msg.value);
  }
}
