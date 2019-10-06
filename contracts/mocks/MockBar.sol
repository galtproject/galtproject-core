/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;


contract MockBar {
  event WithoutArguments();
  event WithArguments();

  function methodWithoutArguments() external {
    emit WithoutArguments();
  }

  function methodWithArguments(address _someAddress, bytes calldata _someData) external {
    emit WithArguments();
  }
}
