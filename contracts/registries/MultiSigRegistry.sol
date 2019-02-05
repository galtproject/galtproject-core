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

import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../multisig/ArbitratorsMultiSig.sol";
import "../multisig/ArbitratorVoting.sol";
import "../multisig/ArbitratorStakeAccounting.sol";
import "../multisig/OracleStakesAccounting.sol";


contract MultiSigRegistry is Permissionable {
  using ArraySet for ArraySet.AddressSet;

  string public constant ROLE_FACTORY = "space_token";

  // MultiSig address => Details
  // TODO: need to be a private?
  mapping(address => MultiSig) public multiSigs;
  ArraySet.AddressSet private multiSigArray;

  struct MultiSig {
    bool active;
    ArbitratorVoting voting;
    OracleStakesAccounting oracleStakesAccounting;
    ArbitratorStakeAccounting arbitratorStakeAccounting;
    address factoryAddress;
  }

  function addMultiSig(
    ArbitratorsMultiSig _abMultiSig,
    ArbitratorVoting _abVoting,
    ArbitratorStakeAccounting _arbitratorStakeAccounting,
    OracleStakesAccounting _oracleStakesAccounting
  )
    external
    onlyRole(ROLE_FACTORY)
  {
    MultiSig storage ms = multiSigs[address(_abMultiSig)];

    ms.active = true;
    ms.voting = _abVoting;
    ms.oracleStakesAccounting = _oracleStakesAccounting;
    ms.arbitratorStakeAccounting = _arbitratorStakeAccounting;
    ms.factoryAddress = msg.sender;

    multiSigArray.add(address(_abMultiSig));
  }

  // REQUIRES

  function requireValidMultiSig(address _multiSig) external view {
    require(multiSigs[_multiSig].active, "MultiSig address is invalid");
  }

  // GETTERS

  function getArbitratorVoting(address _multiSig) external view returns (ArbitratorVoting) {
    return multiSigs[_multiSig].voting;
  }

  function getArbitratorStakeAccounting(address _multiSig) external view returns (ArbitratorStakeAccounting) {
    return multiSigs[_multiSig].arbitratorStakeAccounting;
  }

  function getOracleStakesAccounting(address _multiSig) external view returns (OracleStakesAccounting) {
    return multiSigs[_multiSig].oracleStakesAccounting;
  }

  function getMultiSigList() external returns (address[] memory) {
    return multiSigArray.elements();
  }

  function getMultiSigCount() external returns (uint256) {
    return multiSigArray.size();
  }
  // TODO: how to update Factory Address?
  // TODO: how to deactivate multiSig?
}
