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

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../registries/interfaces/ILockerRegistry.sol";
import "../interfaces/ISpaceToken.sol";
import "../interfaces/ISplitMerge.sol";
import "./interfaces/ISpaceLockerFactory.sol";
import "../SpaceLocker.sol";

contract SpaceLockerFactory is Ownable, ISpaceLockerFactory {
  event SpaceLockerCreated(address owner, address locker);

  GaltGlobalRegistry ggr;

  uint256 public commission;

  constructor (
    GaltGlobalRegistry _ggr
  ) public {
    ggr = _ggr;

    commission = 10 ether;
  }

  function build() external returns (ISpaceLocker) {
    ggr.getGaltToken().transferFrom(msg.sender, address(this), commission);

    ISpaceLocker locker = new SpaceLocker(ggr, msg.sender);

    ILockerRegistry(ggr.getSpaceLockerRegistryAddress()).addLocker(address(locker));

    emit SpaceLockerCreated(msg.sender, address(locker));

    return ISpaceLocker(locker);
  }

  function setCommission(uint256 _commission) external onlyOwner {
    commission = _commission;
  }
}
