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


interface IFeeRegistry {

  enum PaymentMethod {
    NONE,
    ETH_ONLY,
    GALT_ONLY,
    ETH_AND_GALT
  }

  function setEthFee(bytes32 _key, uint256 _amount) external;
  function setGaltFee(bytes32 _key, uint256 _amount) external;
  function setPaymentMethod(bytes32 _key, PaymentMethod _paymentMethod) external;
  function getEthFeeOrRevert(bytes32 _key) external view returns (uint256);
  function getGaltFeeOrRevert(bytes32 _key) external view returns (uint256);
  function getEthFee(bytes32 _key) external view returns (uint256);
  function getGaltFee(bytes32 _key) external view returns (uint256);
  function getProtocolApplicationShares() external view returns (uint256 ethFee, uint256 galtFee);
}
