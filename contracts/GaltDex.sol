pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./GaltToken.sol";

contract GaltDex is Initializable, Ownable {
  using SafeMath for uint256;

  GaltToken galtToken;

  uint256 public constant feePrecision = 1 szabo;

  uint256 public baseExchangeRate;

  uint256 public galtToEthSum;
  uint256 public ethToGaltSum;

  uint256 public galtFee;
  uint256 public ethFee;

  uint256 public galtFeePayout;
  uint256 public ethFeePayout;

  uint256 public galtFeeTotalPayout;
  uint256 public ethFeeTotalPayout;

  event LogExchangeEthToGalt(address sender, uint256 ethAmount, uint256 galtToSend, uint256 ethFee, uint256 galtBalance);
  event LogExchangeGaltToEth(address sender, uint256 galtAmount, uint256 ethToSend, uint256 galtFee, uint256 ethBalance);

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

  function exchangeEthToGalt() public payable {
    require(msg.value > 0, "Ether amount cant be null");

    uint256 ethFeeForAmount = getEthFeeForAmount(msg.value);
    uint256 galtToSend = getExchangeEthAmountForGaltWithFee(msg.value, ethFeeForAmount);

    ethFeePayout = ethFeePayout.add(ethFeeForAmount);
    ethFeeTotalPayout = ethFeeTotalPayout.add(ethFeeForAmount);

    ethToGaltSum = ethToGaltSum.add(msg.value);

    galtToken.transfer(msg.sender, galtToSend);

    emit LogExchangeEthToGalt(msg.sender, msg.value, galtToSend, ethFeeForAmount, galtToken.balanceOf(address(this)));
  }

  function getExchangeEthAmountForGaltWithFee(uint256 ethAmount, uint256 ethFeeForAmount) private view returns(uint256) {
    return  (
              ethAmount.sub(ethFeeForAmount)
            )
            .mul(exchangeRate()).div(feePrecision);
  }

  function getExchangeEthAmountForGalt(uint256 ethAmount) public view returns(uint256) {
    uint256 ethFeeForAmount = getEthFeeForAmount(ethAmount);
    return getExchangeEthAmountForGaltWithFee(ethAmount, ethFeeForAmount);
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

    uint256 galtFeeForAmount = getGaltFeeForAmount(galtAmount);
    uint256 ethToSend = getExchangeGaltAmountForEthWithFee(galtAmount, galtFeeForAmount);

    galtFeePayout = galtFeePayout.add(galtFeeForAmount);
    galtFeeTotalPayout = galtFeeTotalPayout.add(galtFeeForAmount);

    galtToken.transferFrom(msg.sender, address(this), galtAmount);
    msg.sender.transfer(ethToSend);

    galtToEthSum = galtToEthSum.add(galtAmount);

    emit LogExchangeGaltToEth(msg.sender, galtAmount, ethToSend, galtFee, address(this).balance);
  }

  function getExchangeGaltAmountForEthWithFee(uint256 galtAmount, uint256 galtFeeForAmount) private view returns(uint256) {
    return  (
              galtAmount.sub(galtFeeForAmount)
            )
            .div(exchangeRate()).mul(feePrecision);
  }

  function getExchangeGaltAmountForEth(uint256 galtAmount) public view returns(uint256) {
    uint256 galtFeeForAmount = getGaltFeeForAmount(galtAmount);
    return getExchangeGaltAmountForEthWithFee(galtAmount, galtFeeForAmount);
  }

  function getGaltFeeForAmount(uint256 galtAmount) public view returns(uint256) {
    if(galtFee > 0) {
      return galtAmount.div(100).mul(galtFee);
    } else {
      return galtAmount;
    }
  }

  function exchangeRate() public view returns(uint256) {
    if(ethToGaltSum > 0 && address(this).balance > 0) {
      // TODO: is galtFeeTotalPayout and ethFeeTotalPayout should be used?
      return (
              galtToken.totalSupply()
                .sub(galtToken.balanceOf(address(this)))
//                .add(galtFeeTotalPayout)
            )
            .mul(feePrecision)
            .div(
              address(this).balance
//                .add(ethFeeTotalPayout)
            );
    } else {
      return baseExchangeRate;
    }
  }

  function setEthFee(uint256 _ethFee) public onlyOwner {
    ethFee = _ethFee;
    emit LogSetEthFee(msg.sender, _ethFee);
  }

  function setGaltFee(uint256 _galtFee) public onlyOwner {
    galtFee = _galtFee;
    emit LogSetGaltFee(msg.sender, _galtFee);
  }

  function withdrawEthFee() public onlyOwner {
    msg.sender.transfer(ethFeePayout);
    ethFeePayout = 0;
  }

  function withdrawGaltFee() public onlyOwner {
    galtToken.transfer(msg.sender, galtFeePayout);
    galtFeePayout = 0;
  }
}
