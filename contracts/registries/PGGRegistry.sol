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

import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/IPGGRegistry.sol";
import "../pgg/interfaces/IPGGConfig.sol";
import "../pgg/interfaces/IPGGMultiSig.sol";


contract PGGRegistry is IPGGRegistry, OwnableAndInitializable {
  using ArraySet for ArraySet.AddressSet;

  bytes32 public constant ROLE_MULTI_SIG_REGISTRAR = bytes32("MULTI_SIG_REGISTRAR");

  // MultiSig address => Details
  // TODO: need to be a private?
  mapping(address => ProtocolGovernanceGroup) public groups;
  ArraySet.AddressSet private multiSigArray;
  ArraySet.AddressSet private configArray;

  struct ProtocolGovernanceGroup {
    bool active;
    IPGGConfig pggConfig;
    address factoryAddress;
  }

  GaltGlobalRegistry internal ggr;

  function initialize(GaltGlobalRegistry _ggr) public isInitializer {
    ggr = _ggr;
  }

  modifier onlyMultiSigRegistrar() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_MULTI_SIG_REGISTRAR),
      "Only MULTI_SIG_REGISTRAR role allowed"
    );

    _;
  }

  function addPgg(
    IPGGMultiSig _pggMultiSig,
    IPGGConfig _pggConfig
  )
    external
    onlyMultiSigRegistrar
  {
    ProtocolGovernanceGroup storage pgg = groups[address(_pggMultiSig)];

    pgg.active = true;
    pgg.pggConfig = _pggConfig;
    pgg.factoryAddress = msg.sender;

    multiSigArray.add(address(_pggMultiSig));
    configArray.add(address(_pggConfig));
  }

  // REQUIRES

  function requireValidPggMultiSig(address _multiSig) external view {
    require(groups[_multiSig].active == true, "MultiSig address is invalid");
  }

  // GETTERS

  function isMultiSigValid(address _multiSig) external view returns(bool) {
    return (groups[_multiSig].active == true);
  }

  function getPggConfig(address _multiSig) external view returns (IPGGConfig) {
    require(groups[_multiSig].active == true, "MultiSig address is invalid");
    return groups[_multiSig].pggConfig;
  }

  function getPggMultiSigList() external view returns (address[] memory) {
    return multiSigArray.elements();
  }

  function getPggConfigList() external view returns (address[] memory) {
    return configArray.elements();
  }

  function getPggCount() external view returns (uint256) {
    return multiSigArray.size();
  }
  // TODO: how to update Factory Address?
  // TODO: how to deactivate multiSig?
}
