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

pragma solidity 0.5.10;

import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../interfaces/ILocker.sol";
import "./interfaces/ILockerRegistry.sol";
import "./GaltGlobalRegistry.sol";


/**
 * @title Locker Registry.
 * @notice Tracks all the valid lockers of a given type.
 * @dev We use this contract in order to track both SpaceLockers and Galt Lockers.
 */
contract LockerRegistry is ILockerRegistry {
  using ArraySet for ArraySet.AddressSet;

  event AddLocker(address indexed locker, address indexed owner, address factory);

  struct Details {
    bool active;
    address factory;
  }

  GaltGlobalRegistry internal ggr;
  bytes32 public roleFactory;

  // Locker address => Details
  mapping(address => Details) public lockers;

  // Locker address => Details
  mapping(address => ArraySet.AddressSet) internal lockersByOwner;

  modifier onlyFactory() {
    require(
      ggr.getACL().hasRole(msg.sender, roleFactory),
      "Invalid registrar"
    );

    _;
  }

  constructor (GaltGlobalRegistry _ggr, bytes32 _roleFactory) public {
    ggr = _ggr;
    roleFactory = _roleFactory;
  }

  // EXTERNAL

  function addLocker(address _locker) external onlyFactory {
    Details storage locker = lockers[_locker];

    locker.active = true;
    locker.factory = msg.sender;

    lockersByOwner[ILocker(_locker).owner()].add(_locker);

    emit AddLocker(_locker, ILocker(_locker).owner(), locker.factory);
  }

  // REQUIRES

  function requireValidLocker(address _locker) external view {
    require(lockers[_locker].active, "Locker address is invalid");
  }

  // GETTERS

  function isValid(address _locker) external view returns (bool) {
    return lockers[_locker].active;
  }

  function getLockersListByOwner(address _owner) external view returns (address[] memory) {
    return lockersByOwner[_owner].elements();
  }

  function getLockersCountByOwner(address _owner) external view returns (uint256) {
    return lockersByOwner[_owner].size();
  }
}
