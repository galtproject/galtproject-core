/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/IContourVerificationSourceRegistry.sol";


/**
 * @title Contour Verification Source Registry.
 * @notice Tracks contour verification sources.
 * @dev Basically this is a list of the application contracts that modify SpaceGeoDataRegistry data.
 */
contract ContourVerificationSourceRegistry is IContourVerificationSourceRegistry, OwnableAndInitializable {
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
