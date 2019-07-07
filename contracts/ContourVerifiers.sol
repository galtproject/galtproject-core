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

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "./registries/GaltGlobalRegistry.sol";


contract ContourVerifiers is OwnableAndInitializable {
  using SafeMath for uint256;

  event SetRequiredDeposit(uint256 deposit);
  event Deposit(address indexed verifier, uint256 _amount, uint256 _totalDeposit);
  event Withdrawal(address indexed verifier, uint256 _amount, uint256 _totalDeposit);
  event SetOperator(address indexed verifier, address operator);

  struct Verifier {
    uint256 deposit;
    address operator;
  }

  GaltGlobalRegistry internal ggr;
  uint256 public requiredDeposit;

  mapping(address => Verifier) public verifiers;

  function initialize(GaltGlobalRegistry _ggr, uint256 _requiredDeposit) external isInitializer {
    ggr = _ggr;
    requiredDeposit = _requiredDeposit;
    emit SetRequiredDeposit(_requiredDeposit);
  }

  // OWNER INTERFACE

  function setRequiredDeposit(uint256 _requiredDeposit) external onlyOwner {
    requiredDeposit = _requiredDeposit;
    emit SetRequiredDeposit(_requiredDeposit);
  }

  // USER INTERFACE

  function deposit(uint256 _amount) external {
    Verifier storage v = verifiers[msg.sender];

    v.deposit = v.deposit.add(_amount);

    ggr.getGaltToken().transferFrom(msg.sender, address(this), _amount);

    emit Deposit(msg.sender, _amount, v.deposit);
  }

  function withdraw(uint256 _amount) external {
    Verifier storage v = verifiers[msg.sender];

    require(_amount <= v.deposit, "Not enough funds for withdrawal");

    v.deposit = v.deposit.sub(_amount);

    ggr.getGaltToken().transfer(address(this), _amount);

    emit Deposit(msg.sender, _amount, v.deposit);
  }

  function setOperator(address _operator) external {
    verifiers[msg.sender].operator = _operator;

    emit SetOperator(msg.sender, _operator);
  }

  // GETTERS

  function isVerifierValid(address _verifier, address _operator) external view returns(bool) {
    Verifier storage v = verifiers[_verifier];

    if (v.operator != _operator) {
      return false;
    }

    if (v.deposit < requiredDeposit) {
      return false;
    }

    return true;
  }
}
