/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


contract ChargesEthFee {
  event SetFeeManager(address addr);
  event SetFeeCollector(address addr);
  event SetEthFee(uint256 ethFee);
  event WithdrawEth(address indexed to, uint256 amount);

  uint256 public ethFee;

  address public feeManager;
  address public feeCollector;

  modifier onlyFeeManager() {
    require(msg.sender == feeManager, "ChargesEthFee: caller is not the feeManager");
    _;
  }

  modifier onlyFeeCollector() {
    require(msg.sender == feeCollector, "ChargesEthFee: caller is not the feeCollector");
    _;
  }

  constructor() public {

  }

  // SETTERS

  function setFeeManager(address _addr) external onlyFeeManager {
    feeManager = _addr;

    emit SetFeeManager(_addr);
  }

  function setFeeCollector(address _addr) external onlyFeeManager {
    feeCollector = _addr;

    emit SetFeeCollector(_addr);
  }

  function setEthFee(uint256 _ethFee) external onlyFeeManager {
    ethFee = _ethFee;

    emit SetEthFee(_ethFee);
  }

  // WITHDRAWERS

  function withdrawEth(address payable _to) external onlyFeeCollector {
    uint256 balance = address(this).balance;

    _to.transfer(balance);

    emit WithdrawEth(_to, balance);
  }

  // INTERNAL

  function _acceptPayment() internal {
    require(msg.value == ethFee, "Fee and msg.value not equal");
  }
}
