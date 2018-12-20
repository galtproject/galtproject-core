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
  
}
