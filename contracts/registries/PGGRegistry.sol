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

import "@galtproject/libs/contracts/traits/Initializable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/IPGGRegistry.sol";
import "../pgg/interfaces/IPGGConfig.sol";
import "../pgg/interfaces/IPGGMultiSig.sol";


contract PGGRegistry is IPGGRegistry, Initializable {
  using ArraySet for ArraySet.AddressSet;

  bytes32 public constant ROLE_PGG_REGISTRAR = bytes32("PGG_REGISTRAR");

  // TODO: need to be a private?
  mapping(address => ProtocolGovernanceGroup) public pggDetails;
  ArraySet.AddressSet internal _pggs;

  struct ProtocolGovernanceGroup {
    bool active;
    IPGGConfig pggConfig;
    address factoryAddress;
  }

  GaltGlobalRegistry internal ggr;

  function initialize(GaltGlobalRegistry _ggr) public isInitializer {
    ggr = _ggr;
  }

  modifier onlyPggRegistrar() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_PGG_REGISTRAR),
      "Only PGG_REGISTRAR role allowed"
    );

    _;
  }

  function addPgg(
    IPGGConfig _pggConfig
  )
    external
    onlyPggRegistrar
  {
    ProtocolGovernanceGroup storage pgg = pggDetails[address(_pggConfig)];

    pgg.active = true;
    pgg.pggConfig = _pggConfig;
    pgg.factoryAddress = msg.sender;

    _pggs.add(address(_pggConfig));
  }

  // REQUIRES

  function requireValidPgg(address _pgg) public view {
    require(pggDetails[_pgg].active == true, "PGG address is invalid");
  }

  // GETTERS

  function isPggValid(address _pgg) external view returns(bool) {
    return (pggDetails[_pgg].active == true);
  }

  function getPggConfig(address _pgg) external view returns(IPGGConfig) {
    requireValidPgg(_pgg);

    return IPGGConfig(_pgg);
  }

  function getPggList() external view returns (address[] memory) {
    return _pggs.elements();
  }

  function getPggCount() external view returns (uint256) {
    return _pggs.size();
  }
  // TODO: how to update Factory Address?
  // TODO: how to deactivate multiSig?
}
