/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
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
