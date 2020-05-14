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
  address internal _feeRegistry;

  constructor() public {}

  function feeRegistry() public view returns(address) {
    return _feeRegistry;
  }

  // INTERNAL

  function _acceptPayment(bytes32 _key) internal {
    address feeRegistryAddress = feeRegistry();
    if (feeRegistryAddress == address(0)) {
      return;
    }

    require(msg.value == IEthFeeRegistry(feeRegistryAddress).getEthFeeByKey(_key), "Fee and msg.value not equal");
    address payable feeReceiver = address(uint160(IEthFeeRegistry(feeRegistryAddress).feeReceiver()));
    feeReceiver.transfer(msg.value);
  }
}
