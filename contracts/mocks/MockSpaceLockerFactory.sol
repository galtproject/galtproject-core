pragma solidity 0.5.10;

import "../factories/SpaceLockerFactory.sol";
import "./MockSpaceLocker.sol";


contract MockSpaceLockerFactory is SpaceLockerFactory {
  constructor (GaltGlobalRegistry _ggr) public SpaceLockerFactory(_ggr) { }

  function buildMock(address _owner) external payable returns (ISpaceLocker) {
    ISpaceLocker locker = new MockSpaceLocker(ggr, _owner);

    ILockerRegistry(ggr.getSpaceLockerRegistryAddress()).addLocker(address(locker));

    emit NewSpaceLocker(_owner, address(locker));

    return ISpaceLocker(locker);
  }
}
