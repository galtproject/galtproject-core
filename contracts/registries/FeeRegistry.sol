/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster),
 * [Valery Litvin](https://github.com/litvintech) by
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and
 * Galt•Space Society Construction and Terraforming Company by
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

pragma solidity 0.5.3;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IFeeRegistry.sol";


contract FeeRegistry is IFeeRegistry, Ownable {

  mapping(bytes32 => uint256) private ethFees;
  mapping(bytes32 => uint256) private galtFees;
  mapping(bytes32 => PaymentMethod) private paymentMethods;

  function setEthFee(bytes32 _key, uint256 _amount) external onlyOwner {
    ethFees[_key] = _amount;
  }

  function setGaltFee(bytes32 _key, uint256 _amount) external onlyOwner {
    galtFees[_key] = _amount;
  }

  function setPaymentMethod(bytes32 _key, PaymentMethod _paymentMethod) external onlyOwner {
    paymentMethods[_key] = _paymentMethod;
  }

  // GETTERS

  function getEthFeeOrRevert(bytes32 _key) external view returns (uint256) {
    PaymentMethod method = paymentMethods[_key];

    require(
      (method == PaymentMethod.ETH_ONLY || method == PaymentMethod.ETH_AND_GALT),
      "ETH payment disabled"
    );

    return ethFees[_key];
  }

  function getGaltFeeOrRevert(bytes32 _key) external view returns (uint256) {
    PaymentMethod method = paymentMethods[_key];

    require(
      (method == PaymentMethod.GALT_ONLY || method == PaymentMethod.ETH_AND_GALT),
      "GALT payment disabled"
    );

    return galtFees[_key];
  }

  function getEthFee(bytes32 _key) external view returns (uint256) {
    return ethFees[_key];
  }

  function getGaltFee(bytes32 _key) external view returns (uint256) {
    return galtFees[_key];
  }
}
