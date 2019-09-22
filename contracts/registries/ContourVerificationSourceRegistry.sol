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

import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";


/**
 * @title Contour Verification Source Registry.
 * @notice Tracks contour verification sources.
 * @dev Basically this is a list of the application contracts that modify SpaceGeoDataRegistry data.
 */
contract ContourVerificationSourceRegistry is OwnableAndInitializable {
  using ArraySet for ArraySet.AddressSet;

  event AddSource(address indexed source);
  event RemoveSource(address indexed source);

  ArraySet.AddressSet internal sources;

  function initialize() public isInitializer {
  }

  function addSource(address _contract) external onlyOwner {
    sources.add(_contract);
    emit AddSource(_contract);
  }

  function removeSource(address _contract) external onlyOwner {
    sources.add(_contract);
    emit AddSource(_contract);
  }

  function all(address _contract) external view returns (address[] memory) {
    return sources.elements();
  }

  function hasSource(address _contract) external view returns (bool) {
    return sources.has(_contract);
  }

  function requireValid(address _contract) external view {
    require(sources.has(_contract), "CVSRegistry: source not in the list");
  }
}
