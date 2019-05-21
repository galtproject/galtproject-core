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

pragma solidity 0.5.7;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/traits/Initializable.sol";
import "../registries/interfaces/IPGGRegistry.sol";
import "../registries/interfaces/IFeeRegistry.sol";
import "../registries/GaltGlobalRegistry.sol";
import "../pgg/interfaces/IPGGConfig.sol";



contract AbstractApplication is Initializable {
  GaltGlobalRegistry internal ggr;

  uint256 public protocolFeesEth;
  uint256 public protocolFeesGalt;

  bytes32[] internal applicationsArray;
  mapping(address => bytes32[]) public applicationsByApplicant;

  enum Currency {
    ETH,
    GALT
  }

  enum PaymentMethod {
    NONE,
    ETH_ONLY,
    GALT_ONLY,
    ETH_AND_GALT
  }

  constructor() public {}

  modifier onlyFeeCollector() {
    require(msg.sender == ggr.getFeeCollectorAddress(), "Only FeeMixer allowed");
    _;
  }

  function paymentMethod(address _pgg) public view returns (PaymentMethod);

  function claimGaltProtocolFeeEth() external onlyFeeCollector {
    require(address(this).balance >= protocolFeesEth, "Insufficient balance");
    msg.sender.transfer(protocolFeesEth);
    protocolFeesEth = 0;
  }

  function claimGaltProtocolFeeGalt() external onlyFeeCollector {
    require(ggr.getGaltToken().balanceOf(address(this)) >= protocolFeesEth, "Insufficient balance");
    ggr.getGaltToken().transfer(msg.sender, protocolFeesGalt);
    protocolFeesGalt = 0;
  }

  function getProtocolShares() internal view returns(uint256 ethFee, uint256 galtFee) {
    return IFeeRegistry(ggr.getFeeRegistryAddress()).getProtocolApplicationShares();
  }

  function pggRegistry() internal view returns(IPGGRegistry) {
    return IPGGRegistry(ggr.getPggRegistryAddress());
  }

  function pggConfig(address _pgg) internal view returns (IPGGConfig) {
    pggRegistry().requireValidPgg(_pgg);

    return IPGGConfig(_pgg);
  }

  function pggConfigValue(address _pgg, bytes32 _key) internal view returns (bytes32) {
    return pggConfig(_pgg).applicationConfig(_key);
  }

  function getAllApplications() external view returns (bytes32[] memory) {
    return applicationsArray;
  }

  function getApplicationsByApplicant(address _applicant) external view returns (bytes32[] memory) {
    return applicationsByApplicant[_applicant];
  }
}
