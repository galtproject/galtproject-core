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

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "bancor-contracts/solidity/contracts/token/EtherToken.sol";
import "bancor-contracts/solidity/contracts/token/SmartToken.sol";
import "bancor-contracts/solidity/contracts/utility/ContractRegistry.sol";
import "bancor-contracts/solidity/contracts/ContractIds.sol";
import "bancor-contracts/solidity/contracts/utility/ContractFeatures.sol";
import "bancor-contracts/solidity/contracts/converter/BancorGasPriceLimit.sol";
import "bancor-contracts/solidity/contracts/converter/BancorFormula.sol";
import "bancor-contracts/solidity/contracts/BancorNetwork.sol";
import "bancor-contracts/solidity/contracts/converter/BancorConverterFactory.sol";
import "bancor-contracts/solidity/contracts/converter/BancorConverterUpgrader.sol";

import "bancor-contracts/solidity/contracts/converter/BancorConverter.sol";
import "bancor-contracts/solidity/contracts/token/interfaces/ISmartToken.sol";
import "bancor-contracts/solidity/contracts/token/interfaces/IERC20Token.sol";
import "bancor-contracts/solidity/contracts/utility/interfaces/IContractRegistry.sol";

contract BancorGaltDex is BancorConverter {

  mapping(address => uint256) public feeForWithdraw;
  address feeFund;

  constructor(
    ISmartToken _token,
    IContractRegistry _registry,
    uint32 _maxConversionFee,
    IERC20Token _connectorToken,
    uint32 _connectorWeight
  )
  public
  BancorConverter(_token, _registry, _maxConversionFee, _connectorToken, _connectorWeight)
  {

  }

  /**
        @dev helper, dispatches the Conversion event

        @param _fromToken       ERC20 token to convert from
        @param _toToken         ERC20 token to convert to
        @param _amount          amount purchased/sold (in the source token)
        @param _returnAmount    amount returned (in the target token)
    */
  function dispatchConversionEvent(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _returnAmount, uint256 _feeAmount) private {
    // fee amount is converted to 255 bits -
    // negative amount means the fee is taken from the source token, positive amount means its taken from the target token
    // currently the fee is always taken from the target token
    // since we convert it to a signed number, we first ensure that it's capped at 255 bits to prevent overflow
    require(_feeAmount <= 2 ** 255, "_feeAmount <= 2 ** 255 failed");

    feeForWithdraw[_toToken] = safeAdd(feeForWithdraw[_toToken], _feeAmount);

    emit Conversion(_fromToken, _toToken, msg.sender, _amount, _returnAmount, int256(_feeAmount));
  }

  function setFeeFund(address _feeFund) public ownerOrManagerOnly {
    feeFund = _feeFund;
  }
  
  function claimFeeToFund(IERC20Token _connectorToken) public ownerOrManagerOnly {
    require(feeFund != address(0), "Fee fund not set");
    require(feeForWithdraw[_connectorToken] > 0, "No fee available for this token");

    _connectorToken.transfer(feeFund, feeForWithdraw[_connectorToken]);

    feeForWithdraw[_connectorToken] = 0;
  }
}
