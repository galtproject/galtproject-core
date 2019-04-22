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

pragma solidity 0.5.3;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/IMultiSigRegistry.sol";
import "../multisig/interfaces/IArbitrationConfig.sol";
import "../multisig/interfaces/IArbitratorsMultiSig.sol";


contract MultiSigRegistry is IMultiSigRegistry, Ownable {
  using ArraySet for ArraySet.AddressSet;

  bytes32 public constant ROLE_MULTI_SIG_REGISTRAR = bytes32("MULTI_SIG_REGISTRAR");

  // MultiSig address => Details
  // TODO: need to be a private?
  mapping(address => MultiSig) public multiSigs;
  ArraySet.AddressSet private multiSigArray;
  ArraySet.AddressSet private configArray;

  struct MultiSig {
    bool active;
    IArbitrationConfig arbitrationConfig;
    address factoryAddress;
  }

  GaltGlobalRegistry private ggr;

  constructor (GaltGlobalRegistry _ggr) public {
    ggr = _ggr;
  }

  modifier onlyMultiSigRegistrar() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_MULTI_SIG_REGISTRAR),
      "Only MULTI_SIG_REGISTRAR role allowed"
    );

    _;
  }

  function addMultiSig(
    IArbitratorsMultiSig _abMultiSig,
    IArbitrationConfig _arbitrationConfig
  )
    external
    onlyMultiSigRegistrar
  {
    MultiSig storage ms = multiSigs[address(_abMultiSig)];

    ms.active = true;
    ms.arbitrationConfig = _arbitrationConfig;
    ms.factoryAddress = msg.sender;

    multiSigArray.add(address(_abMultiSig));
    configArray.add(address(_arbitrationConfig));
  }

  // REQUIRES

  function requireValidMultiSig(address _multiSig) external view {
    require(multiSigs[_multiSig].active == true, "MultiSig address is invalid");
  }

  // GETTERS

  function isMultiSigValid(address _multiSig) external view returns(bool) {
    return (multiSigs[_multiSig].active == true);
  }

  function getArbitrationConfig(address _multiSig) external view returns (IArbitrationConfig) {
    require(multiSigs[_multiSig].active == true, "MultiSig address is invalid");
    return multiSigs[_multiSig].arbitrationConfig;
  }

  function getMultiSigList() external view returns (address[] memory) {
    return multiSigArray.elements();
  }

  function getConfigList() external view returns (address[] memory) {
    return configArray.elements();
  }

  function getMultiSigCount() external view returns (uint256) {
    return multiSigArray.size();
  }
  // TODO: how to update Factory Address?
  // TODO: how to deactivate multiSig?
}
