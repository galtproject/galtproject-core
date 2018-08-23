pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/ownership/rbac/RBAC.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./GaltToken.sol";

contract GaltDex is Initializable, Ownable, RBAC {
  using SafeMath for uint256;

  string public constant FEE_MANAGER = "fee_manager";

  GaltToken galtToken;

  uint256 public constant exchangeRatePrecision = 1 szabo;

  uint256 public baseExchangeRate;

  uint256 public galtToEthSum;
  uint256 public ethToGaltSum;

  // TODO: set galtFee as ether
  uint256 public galtFee;
  uint256 public ethFee;

  uint256 public galtFeePayout;
  uint256 public ethFeePayout;

  uint256 public galtFeeTotalPayout;
  uint256 public ethFeeTotalPayout;

  event LogExchangeEthToGalt(address sender, uint256 ethAmount, uint256 galtToSend, uint256 ethFee, uint256 galtBalance, uint256 exchangeRate);
  event LogExchangeGaltToEth(address sender, uint256 galtAmount, uint256 ethToSend, uint256 galtFee, uint256 ethBalance, uint256 exchangeRate);

  event LogSetEthFee(address sender, uint256 ethFee);
  event LogSetGaltFee(address sender, uint256 galtFee);

  event LogEthTakenFee(uint256 ethAmount, uint256 takenFee, uint256 ethResult);

  constructor () public {}

  function initialize(
    uint256 _baseExchangeRate,
    uint256 _galtFee,
    uint256 _ethFee,
    GaltToken _galtToken
  )
  public
  isInitializer
  {
    owner = msg.sender;
    galtToken = _galtToken;
    baseExchangeRate = _baseExchangeRate;
    galtFee = _galtFee;
    ethFee = _ethFee;
  }

  modifier onlyFeeManager() {
    checkRole(msg.sender, FEE_MANAGER);
    _;
  }

  function exchangeEthToGalt() public payable {
    require(msg.value > 0, "Ether amount cant be null");

    uint256 _exchangeRate = exchangeRate(msg.value);
    uint256 galtToSend = getExchangeEthAmountForGalt(msg.value);

    uint256 ethFeeForAmount = getEthFeeForAmount(msg.value);
    ethFeePayout = ethFeePayout.add(ethFeeForAmount);
    ethFeeTotalPayout = ethFeeTotalPayout.add(ethFeeForAmount);

    ethToGaltSum = ethToGaltSum.add(msg.value);

    galtToken.transfer(msg.sender, galtToSend);

    emit LogExchangeEthToGalt(msg.sender, msg.value, galtToSend, ethFeeForAmount, galtToken.balanceOf(address(this)), _exchangeRate);
  }

  function getExchangeEthAmountForGalt(uint256 ethAmount) public view returns(uint256) {
    return ethAmount.mul(exchangeRate(ethAmount)).div(exchangeRatePrecision);
  }

  function getEthFeeForAmount(uint256 ethAmount) public view returns(uint256) {
    if(ethFee > 0) {
      return ethAmount.div(100).mul(ethFee);
    } else {
      return ethAmount;
    }
  }

  function exchangeGaltToEth(uint256 galtAmount) public {
    require(galtToken.allowance(msg.sender, address(this)) >= galtAmount, "Not enough galt allowance");

    uint256 _exchangeRate = exchangeRate(0);
    uint256 ethToSend = getExchangeGaltAmountForEth(galtAmount);

    uint256 galtFeeForAmount = getGaltFeeForAmount(galtAmount);
    galtFeePayout = galtFeePayout.add(galtFeeForAmount);
    galtFeeTotalPayout = galtFeeTotalPayout.add(galtFeeForAmount);

    galtToken.transferFrom(msg.sender, address(this), galtAmount);
    msg.sender.transfer(ethToSend);

    galtToEthSum = galtToEthSum.add(galtAmount);

    emit LogExchangeGaltToEth(msg.sender, galtAmount, ethToSend, galtFee, address(this).balance, _exchangeRate);
  }

  function getExchangeGaltAmountForEth(uint256 galtAmount) public view returns(uint256) {
    return galtAmount.div(exchangeRate(0)).mul(exchangeRatePrecision);
  }

  function getGaltFeeForAmount(uint256 galtAmount) public view returns(uint256) {
    if(galtFee > 0) {
      return galtAmount.div(100).mul(galtFee);
    } else {
      return galtAmount;
    }
  }

  function exchangeRate(uint256 minusBalance) public view returns(uint256) {
    if(ethToGaltSum > 0 && address(this).balance > 0) {
      // TODO: is galtFeeTotalPayout and ethFeeTotalPayout should be used?
      return (
        galtToken.totalSupply()
          .sub(galtToken.balanceOf(address(this)))
          .add(galtFeePayout)
      )
      .mul(exchangeRatePrecision)
      .div(
        address(this).balance
          .sub(ethFeePayout)
          .sub(minusBalance)
      );
    } else {
      return baseExchangeRate;
    }
  }

  function setEthFee(uint256 _ethFee) public onlyFeeManager {
    ethFee = _ethFee;
    emit LogSetEthFee(msg.sender, _ethFee);
  }

  function setGaltFee(uint256 _galtFee) public onlyFeeManager {
    galtFee = _galtFee;
    emit LogSetGaltFee(msg.sender, _galtFee);
  }

  function withdrawEthFee() public onlyFeeManager {
    msg.sender.transfer(ethFeePayout);
    ethFeePayout = 0;
  }

  function withdrawGaltFee() public onlyFeeManager {
    galtToken.transfer(msg.sender, galtFeePayout);
    galtFeePayout = 0;
  }

  function addRoleTo(address _operator, string _role) public onlyOwner {
    super.addRole(_operator, _role);
  }

  function removeRoleFrom(address _operator, string _role) public onlyOwner {
    super.removeRole(_operator, _role);
  }
}
