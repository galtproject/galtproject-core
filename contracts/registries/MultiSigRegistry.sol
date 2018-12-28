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

import "../traits/Permissionable.sol";
import "../multisig/ArbitratorsMultiSig.sol";
import "../multisig/ArbitratorVoting.sol";
import "../multisig/OracleStakesAccounting.sol";


contract MultiSigRegistry is Permissionable {
  string public constant ROLE_FACTORY = "space_token";

  // MultiSig address => Details
  mapping(address => MultiSig) private multiSigs;
  ArraySet.AddressSet private multiSigsArray;

  struct MultiSig {
    bool active;
    ArbitratorVoting voting;
    OracleStakesAccounting oracleStakesAccounting;
    address factoryAddress;
  }

  function addMultiSig(
    ArbitratorsMultiSig _abMultiSig,
    ArbitratorVoting _abVoting,
    OracleStakesAccounting _oracleStakesAccounting
  )
    external
    onlyRole(ROLE_FACTORY)
  {
    MultiSig storage ms = multiSigs[_abMultiSig];

    ms.active = true;
    ms.voting = _abVoting;
    ms.oracleStakesAccounting = _oracleStakesAccounting;
    ms.factoryAddress = msg.sender;
    
    multiSigs.add(ms);
  }

  // REQUIRES

  function requireValidMultiSig(address _multiSig) external view {
    require(multiSigs[_multiSig].active, "MultiSig address is invalid");
  }

  // GETTERS

  function getArbitratorVoting(address _multiSig) external view returns (ArbitratorVoting) {
    return multiSigs[_multiSig].voting;
  }

  function getOracleStakesAccounting(address _multiSig) external view returns (OracleStakesAccounting) {
    return multiSigs[_multiSig].oracleStakesAccounting;
  }
  // TODO: how to update Factory Address?
  // TODO: how to deactivate multiSig?
}
