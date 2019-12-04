/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "./interfaces/IRA.sol";
import "./components/LiquidRA.sol";
import "./components/LockableRA.sol";
import "./components/GaltInputRA.sol";


contract GaltRA is IRA, LiquidRA, LockableRA, GaltInputRA {
  function onDelegateReputationChanged(address _pgg, address _delegate, uint256 _amount) internal {
    pggConfig(_pgg)
      .getDelegateGaltVoting()
      .onDelegateReputationChanged(_delegate, _amount);
  }
}
