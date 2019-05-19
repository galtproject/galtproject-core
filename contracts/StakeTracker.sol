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
import "./registries/GaltGlobalRegistry.sol";
import "./registries/interfaces/IPGGRegistry.sol";
import "./interfaces/IStakeTracker.sol";


contract StakeTracker is IStakeTracker, OwnableAndInitializable {

  GaltGlobalRegistry internal ggr;
  uint256 internal _totalSupply;

  // MultiSig => totalStaked
  mapping(address => uint256) internal _pggStakes;

  bytes32 public constant MULTI_SIG_ROLE = bytes32("stake_tracker_notifier");

  function initialize(
    GaltGlobalRegistry _ggr
  )
    public
    isInitializer
  {
    ggr = _ggr;
  }

  modifier onlyValidOracleStakeAccounting(address _multiSig) {
    IPGGRegistry(ggr.getPggRegistryAddress())
      .getPggConfig(_multiSig)
      .hasExternalRole(MULTI_SIG_ROLE, msg.sender);

    _;
  }

  function onStake(address _multiSig, uint256 _amount) external onlyValidOracleStakeAccounting(_multiSig) {
    _totalSupply += _amount;
    _pggStakes[_multiSig] += _amount;
  }

  function onSlash(address _multiSig, uint256 _amount) external onlyValidOracleStakeAccounting(_multiSig) {
    _totalSupply -= _amount;
    _pggStakes[_multiSig] -= _amount;
  }

  // GETTERS

  function balancesOf(address[] calldata _multiSigs) external view returns(uint256) {
    uint256 len = _multiSigs.length;
    uint256 total = 0;

    for (uint256 i = 0; i < len; i++) {
      total += _pggStakes[_multiSigs[i]];
    }

    return total;
  }

  function balanceOf(address _multiSig) external view returns(uint256) {
    return _pggStakes[_multiSig];
  }

  function totalSupply() external view returns(uint256) {
    return _totalSupply;
  }
}
