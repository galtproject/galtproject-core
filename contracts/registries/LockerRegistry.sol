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


contract LockerRegistry is ILockerRegistry {
  using ArraySet for ArraySet.AddressSet;

  struct Details {
    bool active;
    address factory;
  }

  event AddLocker(address indexed locker, address indexed owner, address factory);

  // Locker address => Details
  mapping(address => Details) public lockers;

  // Locker address => Details
  mapping(address => ArraySet.AddressSet) internal lockersByOwner;

  GaltGlobalRegistry internal ggr;
  bytes32 public roleFactory;

  constructor (GaltGlobalRegistry _ggr, bytes32 _roleFactory) public {
    ggr = _ggr;
    roleFactory = _roleFactory;
  }

  modifier onlyFactory() {
    require(
      ggr.getACL().hasRole(msg.sender, roleFactory),
      "Invalid registrar"
    );

    _;
  }

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

  function isValid(address _locker) external view returns (bool) {
    return lockers[_locker].active;
  }

  // GETTERS
  function getLockersListByOwner(address _owner) external view returns (address[] memory) {
    return lockersByOwner[_owner].elements();
  }

  function getLockersCountByOwner(address _owner) external view returns (uint256) {
    return lockersByOwner[_owner].size();
  }
}
