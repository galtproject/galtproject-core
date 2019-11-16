/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "./interfaces/IRA.sol";
import "./components/LiquidRA.sol";
import "./components/LockableRA.sol";
import "./components/SpaceInputRA.sol";

// LiquidRA - base class
// SpaceInputRA - space input
// GaltInputRA - galt input
// LockableRA - lockable output
// SharableRA - share calculation output
// FundRA - LiquidRA + SpaceInputRA + SharableRA


contract SpaceRA is IRA, LiquidRA, LockableRA, SpaceInputRA {
  function onDelegateReputationChanged(address _pgg, address _delegate, uint256 _amount) internal {
    pggConfig(_pgg)
      .getDelegateSpaceVoting()
      .onDelegateReputationChanged(_delegate, _amount);
  }
}
