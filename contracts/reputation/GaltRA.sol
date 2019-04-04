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

import "./interfaces/IRA.sol";
import "./components/LiquidRA.sol";
import "./components/LockableRA.sol";
import "./components/GaltInputRA.sol";


contract GaltRA is IRA, LiquidRA, LockableRA, GaltInputRA {
  constructor(
    GaltGlobalRegistry _ggr
  )
    public
    LiquidRA(_ggr)
  {
  }

  function onDelegateReputationChanged(address _multiSig, address _delegate, uint256 _amount) internal {
    arbitrationConfig(_multiSig)
      .getDelegateGaltVoting()
      .onDelegateReputationChanged(_delegate, _amount);
  }
}
