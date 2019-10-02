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
import "./registries/interfaces/IFeeRegistry.sol";
import "./interfaces/IContourVerifiers.sol";


contract ContourVerifiers is IContourVerifiers, OwnableAndInitializable {
  using SafeMath for uint256;

  bytes32 public constant ROLE_CV_SLASHER = bytes32("CV_SLASHER");
  bytes32 public constant ROLE_FEE_COLLECTOR = bytes32("FEE_COLLECTOR");

  event SetRequiredDeposit(uint256 deposit);
  event Deposit(address indexed verifier, uint256 _amount, uint256 _totalDeposit);
  event Withdrawal(address indexed verifier, uint256 _amount, uint256 _totalDeposit);
  event SetOperator(address indexed verifier, address operator);
  event ClaimSlashedReward(address indexed verifier, uint256 amount);
  event ClaimSlashedProtocolReward(address indexed claimer, uint256 amount);
  event Slash(address indexed slasher, address indexed verifier, uint256 amount);
  event SlashDistribution(
    address indexed slasher,
    address indexed beneficiary,
    uint256 beneficiaryReward,
    uint256 galtProtocolReward
  );

  struct Verifier {
    uint256 deposit;
    address operator;
  }

  GaltGlobalRegistry internal ggr;
  uint256 public requiredDeposit;
  uint256 public slashedProtocolReward;

  mapping(address => Verifier) public verifiers;
  mapping(address => uint256) public slashedRewards;

  modifier onlySlasher() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_CV_SLASHER),
      "Only CV_SLASHER role allowed"
    );

    _;
  }

  modifier onlyFeeCollector() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_FEE_COLLECTOR),
      "Only FEE_COLLECTOR role allowed"
    );
    _;
  }

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

  // SLASHER INTERFACE

  function slash(address[] calldata _verifiers, address _beneficiary) external onlySlasher {
    uint256 len = _verifiers.length;
    uint256 total;

    for (uint256 i = 0; i < len; i++) {
      total = total.add(_slash(_verifiers[i]));
    }

    (, uint256 galtFee) = IFeeRegistry(ggr.getFeeRegistryAddress()).getProtocolApplicationShares();
    uint256 galtProtocolReward = total.mul(galtFee).div(100);
    uint256 beneficiaryReward = total.sub(galtProtocolReward);

    slashedRewards[_beneficiary] = slashedRewards[_beneficiary].add(beneficiaryReward);
    slashedProtocolReward = slashedProtocolReward.add(galtProtocolReward);

    emit SlashDistribution(msg.sender, _beneficiary, beneficiaryReward, galtFee);
  }

  function _slash(address _verifier) internal returns (uint256) {
    Verifier storage v = verifiers[_verifier];
    uint256 amount = v.deposit;

    v.deposit = 0;

    emit Slash(msg.sender, _verifier, amount);

    return amount;
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

    ggr.getGaltToken().transfer(msg.sender, _amount);

    emit Deposit(msg.sender, _amount, v.deposit);
  }

  function setOperator(address _operator) external {
    verifiers[msg.sender].operator = _operator;

    emit SetOperator(msg.sender, _operator);
  }

  function claimSlashedReward() external {
    uint256 amount = slashedRewards[msg.sender];
    slashedRewards[msg.sender] = 0;

    ggr.getGaltToken().transfer(msg.sender, amount);

    emit ClaimSlashedReward(msg.sender, amount);
  }

  function claimSlashedProtocolReward() external onlyFeeCollector {
    uint256 amount = slashedProtocolReward;
    slashedProtocolReward = 0;

    ggr.getGaltToken().transfer(msg.sender, amount);

    emit ClaimSlashedProtocolReward(msg.sender, amount);
  }

  // GETTERS

  function isVerifierValid(address _verifier, address _operator) external view returns (bool) {
    Verifier storage v = verifiers[_verifier];

    if (v.operator != _operator && _verifier != _operator) {
      return false;
    }

    if (v.deposit < requiredDeposit) {
      return false;
    }

    return true;
  }
}
