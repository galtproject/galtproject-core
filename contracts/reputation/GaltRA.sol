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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../multisig/ArbitratorVoting.sol";
import "../registries/interfaces/ILockerRegistry.sol";
import "../registries/interfaces/IMultiSigRegistry.sol";
import "../registries/GaltGlobalRegistry.sol";
import "./components/LiquidRA.sol";
import "./components/LockableRA.sol";
import "./components/GaltInputRA.sol";
import "./interfaces/IRA.sol";


contract GaltRA is IRA, LiquidRA, LockableRA, GaltInputRA {
  constructor(
    GaltGlobalRegistry _ggr
  )
    public
    LiquidRA(_ggr)
  {
  }
}
