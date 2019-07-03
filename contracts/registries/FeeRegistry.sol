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

pragma solidity 0.5.10;

import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "./interfaces/IFeeRegistry.sol";


contract FeeRegistry is IFeeRegistry, OwnableAndInitializable {
  event SetEthFee(bytes32 indexed key, uint256 amount);
  event SetGaltFee(bytes32 indexed key, uint256 amount);
  event SetPaymentMethod(bytes32 indexed key, PaymentMethod paymentMethod);
  event SetProtocolEthShare(uint256 share);
  event SetProtocolGaltShare(uint256 share);

  uint256 internal protocolApplicationEthShare;
  uint256 internal protocolApplicationGaltShare;

  mapping(bytes32 => uint256) internal protocolEthShare;
  mapping(bytes32 => uint256) internal ethFees;
  mapping(bytes32 => uint256) internal galtFees;
  mapping(bytes32 => PaymentMethod) internal paymentMethods;

  function initialize() public isInitializer {
  }

  function setEthFee(bytes32 _key, uint256 _amount) external onlyOwner {
    ethFees[_key] = _amount;

    emit SetEthFee(_key, _amount);
  }

  function setGaltFee(bytes32 _key, uint256 _amount) external onlyOwner {
    galtFees[_key] = _amount;

    emit SetGaltFee(_key, _amount);
  }

  function setPaymentMethod(bytes32 _key, PaymentMethod _paymentMethod) external onlyOwner {
    paymentMethods[_key] = _paymentMethod;

    emit SetPaymentMethod(_key, _paymentMethod);
  }

  function setProtocolEthShare(uint256 _ethShare) external onlyOwner {
    require(_ethShare > 0, "Expect share to be > 0");
    require(_ethShare <= 100, "Expect share to be <= 100");

    protocolApplicationEthShare = _ethShare;

    emit SetProtocolEthShare(_ethShare);
  }

  function setProtocolGaltShare(uint256 _galtShare) external onlyOwner {
    require(_galtShare > 0, "Expect share to be > 0");
    require(_galtShare <= 100, "Expect share to be <= 100");

    protocolApplicationGaltShare = _galtShare;

    emit SetProtocolGaltShare(_galtShare);
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

  function getPaymentMethod(bytes32 _key) external view returns (PaymentMethod) {
    return paymentMethods[_key];
  }

  function getProtocolApplicationEthShare() external view returns (uint256) {
    return protocolApplicationEthShare;
  }

  function getProtocolApplicationGaltShare() external view returns (uint256) {
    return protocolApplicationGaltShare;
  }

  function getProtocolApplicationShares() external view returns (uint256 ethShare, uint256 galtShare) {
    return (protocolApplicationEthShare, protocolApplicationGaltShare);
  }
}
