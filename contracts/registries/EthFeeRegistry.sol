/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "../interfaces/IEthFeeRegistry.sol";


/**
 * @title Eth Fee Registry.
 * @notice Tracks all fees.
 */
contract EthFeeRegistry is IEthFeeRegistry, OwnableAndInitializable {

  uint256 public constant VERSION = 1;

  mapping(bytes32 => uint256) public ethFeeByKey;
  mapping(address => mapping(bytes32 => uint256)) public contractEthFeeByKey;

  address public feeManager;
  address public feeCollector;

  modifier onlyFeeManager() {
    requireFeeManager(msg.sender);
    _;
  }

  modifier onlyFeeCollector() {
    requireFeeCollector(msg.sender);
    _;
  }

  function initialize(
    address _feeManager,
    address _feeCollector,
    bytes32[] calldata _feeKeys,
    uint256[] calldata _feeValues
  ) external isInitializer {
    feeManager = _feeManager;
    feeCollector = _feeCollector;
    _setEthFeeKeysAndValues(_feeKeys, _feeValues);
  }

  // GETTERS

  function getEthFeeByKey(bytes32 _key) external view returns (uint256) {
    return contractEthFeeByKey[msg.sender][_key] > 0 ? contractEthFeeByKey[msg.sender][_key] : ethFeeByKey[_key];
  }

  // FEE MANAGER INTERFACE

  function setEthFeeKeysAndValues(bytes32[] calldata _feeKeys, uint256[] calldata _feeValues) external onlyFeeManager {
    _setEthFeeKeysAndValues(_feeKeys, _feeValues);
  }

  function setContractEthFeeKeysAndValues(
    address _contractAddr,
    bytes32[] calldata _feeKeys,
    uint256[] calldata _feeValues
  ) external onlyFeeManager {
    _setContractEthFeeKeysAndValues(_contractAddr, _feeKeys, _feeValues);
  }

  // FEE COLLECTOR INTERFACE

  function withdrawEth(address payable _to) external onlyFeeCollector {
    uint256 balance = address(this).balance;

    _to.transfer(balance);

    emit WithdrawFee(_to, balance);
  }

  // OWNER INTERFACE

  function setFeeManager(address _feeManager) external onlyOwner {
    feeManager = _feeManager;
  }

  function setFeeCollector(address _feeCollector) external onlyOwner {
    feeCollector = _feeCollector;
  }

  function () external payable {}

  // INTERNAL

  function _setEthFeeKeysAndValues(bytes32[] memory _feeKeys, uint256[] memory _feeValues) internal {
    uint256 feeKeysLen = _feeKeys.length;

    require(feeKeysLen == _feeValues.length, "Keys and values length does not match");

    for (uint256 i = 0; i < feeKeysLen; i++) {
      ethFeeByKey[_feeKeys[i]] = _feeValues[i];
      emit SetFee(_feeKeys[i], _feeValues[i]);
    }
  }

  function _setContractEthFeeKeysAndValues(
    address _contractAddr,
    bytes32[] memory _feeKeys,
    uint256[] memory _feeValues
  ) internal {
    uint256 feeKeysLen = _feeKeys.length;

    require(feeKeysLen == _feeValues.length, "Keys and values length does not match");

    for (uint256 i = 0; i < feeKeysLen; i++) {
      contractEthFeeByKey[_contractAddr][_feeKeys[i]] = _feeValues[i];
      emit SetContractFee(_contractAddr, _feeKeys[i], _feeValues[i]);
    }
  }

  // REQUIRES

  function requireFeeManager(address _sender) public view {
    require(_sender == feeManager, "EthFeeRegistry: caller is not the feeManager");
  }

  function requireFeeCollector(address _sender) public view {
    require(_sender == feeCollector, "EthFeeRegistry: caller is not the feeCollector");
  }
}
