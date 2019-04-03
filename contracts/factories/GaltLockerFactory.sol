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
import "../GaltLocker.sol";

contract GaltLockerFactory is Ownable {
  event GaltLockerCreated(address owner, address locker);

  GaltGlobalRegistry ggr;

  uint256 public commission;

  constructor (
    GaltGlobalRegistry _ggr
  ) public {
    ggr = _ggr;

    commission = 10 ether;
  }

  function build() external returns (IGaltLocker) {
    ggr.getGaltToken().transferFrom(msg.sender, address(this), commission);

    IGaltLocker locker = new GaltLocker(ggr, msg.sender);

    ILockerRegistry(ggr.getGaltLockerRegistryAddress()).addLocker(address(locker));

    emit GaltLockerCreated(msg.sender, address(locker));

    return locker;
  }

  function setCommission(uint256 _commission) external onlyOwner {
    commission = _commission;
  }
}
