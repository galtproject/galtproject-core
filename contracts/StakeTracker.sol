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

import "./registries/GaltGlobalRegistry.sol";
import "./registries/interfaces/IMultiSigRegistry.sol";
import "./interfaces/IStakeTracker.sol";


contract StakeTracker is IStakeTracker {

  GaltGlobalRegistry private ggr;
  uint256 private _totalSupply;

  // MultiSig => totalStaked
  mapping(address => uint256) private _multiSigStakes;

  bytes32 public constant MULTI_SIG_ROLE = bytes32("stake_tracker_notifier");

  constructor(
    GaltGlobalRegistry _ggr
  )
    public
  {
    ggr = _ggr;
  }

  modifier onlyValidOracleStakesAccounting(address _multiSig) {
    IMultiSigRegistry(ggr.getMultiSigRegistryAddress())
      .getArbitrationConfig(_multiSig)
      .hasExternalRole(MULTI_SIG_ROLE, msg.sender);

    _;
  }

  function onStake(address _multiSig, uint256 _amount) external onlyValidOracleStakesAccounting(_multiSig) {
    _totalSupply += _amount;
    _multiSigStakes[_multiSig] += _amount;
  }

  function onSlash(address _multiSig, uint256 _amount) external onlyValidOracleStakesAccounting(_multiSig) {
    _totalSupply -= _amount;
    _multiSigStakes[_multiSig] -= _amount;
  }

  // GETTERS

  function balancesOf(address[] calldata _multiSigs) external view returns(uint256) {
    uint256 len = _multiSigs.length;
    uint256 total = 0;

    for (uint256 i = 0; i < len; i++) {
      total += _multiSigStakes[_multiSigs[i]];
    }

    return total;
  }

  function balanceOf(address _multiSig) external view returns(uint256) {
    return _multiSigStakes[_multiSig];
  }

  function totalSupply() external view returns(uint256) {
    return _totalSupply;
  }
}
