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

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../GaltToken.sol";
import "../registries/SpaceLockerRegistry.sol";
import "../SpaceLocker.sol";
import "../SplitMerge.sol";


contract SpaceLockerFactory is Ownable {
  event SpaceLockerCreated(address owner, address locker);

  SpaceLockerRegistry spaceLockerRegistry;
  GaltToken galtToken;
  SpaceToken spaceToken;
  SplitMerge splitMerge;

  uint256 commission;

  constructor (
    SpaceLockerRegistry _spaceLockerRegistry,
    GaltToken _galtToken,
    SpaceToken _spaceToken,
    SplitMerge _splitMerge
  ) public {
    commission = 10 ether;

    spaceLockerRegistry = _spaceLockerRegistry;
    galtToken = _galtToken;
    spaceToken = _spaceToken;
    splitMerge = _splitMerge;
  }

  function build() external returns (SpaceLocker) {
    galtToken.transferFrom(msg.sender, address(this), commission);

    SpaceLocker locker = new SpaceLocker(spaceToken, splitMerge, msg.sender);

    spaceLockerRegistry.addSpaceLocker(locker);

    emit SpaceLockerCreated(msg.sender, address(locker));

    return locker;
  }

  function setCommission(uint256 _commission) external onlyOwner {
    commission = _commission;
  }
}
