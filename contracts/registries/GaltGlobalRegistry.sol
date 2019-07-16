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
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "../interfaces/IACL.sol";


/**
 * Global registry of Galt Project contracts.
 *
 * Getters with `address` suffix return contract instances,
 * the rest of them return just an `address` primitive.
 */
contract GaltGlobalRegistry is OwnableAndInitializable {
  // solium-disable-next-line mixedcase
  address internal ZERO_ADDRESS = address(0);

  bytes32 public constant ACL = bytes32("ACL");

  bytes32 public constant GLOBAL_GOVERNANCE = bytes32("global_governance");

  // Tokens
  bytes32 public constant GALT_TOKEN = bytes32("galt_token");
  bytes32 public constant SPACE_TOKEN = bytes32("space_token");

  // Registries
  bytes32 public constant APPLICATION_REGISTRY = bytes32("application_registry");
  bytes32 public constant PGG_REGISTRY = bytes32("pgg_registry");
  bytes32 public constant FEE_REGISTRY = bytes32("fee_registry");
  bytes32 public constant SPACE_CUSTODIAN_REGISTRY = bytes32("space_custodian_registry");
  bytes32 public constant SPACE_LOCKER_REGISTRY = bytes32("space_locker_registry");
  bytes32 public constant GALT_LOCKER_REGISTRY = bytes32("galt_locker_registry");
  bytes32 public constant SPACE_GEO_DATA_REGISTRY = bytes32("space_geo_data_registry");

  bytes32 public constant SPACE_RA = bytes32("space_ra");
  bytes32 public constant GALT_RA = bytes32("galt_ra");
  bytes32 public constant STAKE_TRACKER = bytes32("stake_tracker");

  bytes32 public constant SPLIT_MERGE = bytes32("split_merge");

  // Utils
  bytes32 public constant GEODESIC = bytes32("geodesic");

  // Factories
  bytes32 public constant SPACE_SPLIT_OPERATION_FACTORY = bytes32("space_split_operation_factory");

  event SetContract(bytes32 indexed key, address addr);

  mapping(bytes32 => address) internal contracts;

  function initialize() public isInitializer {
  }

  function setContract(bytes32 _key, address _value) external onlyOwner {
    contracts[_key] = _value;

    emit SetContract(_key, _value);
  }

  // GETTERS
  function getContract(bytes32 _key) external view returns (address) {
    return contracts[_key];
  }

  function getGlobalGovernanceAddress() external view returns (address) {
    require(contracts[GLOBAL_GOVERNANCE] != ZERO_ADDRESS, "GGR: GLOBAL_GOVERNANCE not set");
    return contracts[GLOBAL_GOVERNANCE];
  }

  function getFeeRegistryAddress() external view returns (address) {
    require(contracts[FEE_REGISTRY] != ZERO_ADDRESS, "GGR: FEE_REGISTRY not set");
    return contracts[FEE_REGISTRY];
  }

  function getPggRegistryAddress() external view returns (address) {
    require(contracts[PGG_REGISTRY] != ZERO_ADDRESS, "GGR: PGG_REGISTRY not set");
    return contracts[PGG_REGISTRY];
  }

  function getSpaceCustodianRegistryAddress() external view returns (address) {
    require(contracts[SPACE_CUSTODIAN_REGISTRY] != ZERO_ADDRESS, "GGR: SPACE_CUSTODIAN_REGISTRY not set");
    return contracts[SPACE_CUSTODIAN_REGISTRY];
  }

  function getSpaceLockerRegistryAddress() external view returns (address) {
    require(contracts[SPACE_LOCKER_REGISTRY] != ZERO_ADDRESS, "GGR: SPACE_LOCKER_REGISTRY not set");
    return contracts[SPACE_LOCKER_REGISTRY];
  }

  function getGaltLockerRegistryAddress() external view returns (address) {
    require(contracts[GALT_LOCKER_REGISTRY] != ZERO_ADDRESS, "GGR: GALT_LOCKER_REGISTRY not set");
    return contracts[GALT_LOCKER_REGISTRY];
  }

  function getGeodesicAddress() external view returns (address) {
    require(contracts[GEODESIC] != ZERO_ADDRESS, "GGR: GEODESIC not set");
    return contracts[GEODESIC];
  }

  function getSplitMergeAddress() external view returns (address) {
    require(contracts[SPLIT_MERGE] != ZERO_ADDRESS, "GGR: SPLIT_MERGE not set");
    return contracts[SPLIT_MERGE];
  }

  function getSpaceRAAddress() external view returns (address) {
    require(contracts[SPACE_RA] != ZERO_ADDRESS, "GGR: SPACE_RA not set");
    return contracts[SPACE_RA];
  }

  function getGaltRAAddress() external view returns (address) {
    require(contracts[GALT_RA] != ZERO_ADDRESS, "GGR: GALT_RA not set");
    return contracts[GALT_RA];
  }

  function getStakeTrackerAddress() external view returns (address) {
    require(contracts[STAKE_TRACKER] != ZERO_ADDRESS, "GGR: STAKE_TRACKER not set");
    return contracts[STAKE_TRACKER];
  }

  function getSpaceGeoDataRegistryAddress() external view returns (address) {
    require(contracts[SPACE_GEO_DATA_REGISTRY] != ZERO_ADDRESS, "GGR: SPACE_GEO_DATA_REGISTRY not set");
    return contracts[SPACE_GEO_DATA_REGISTRY];
  }

  function getSpaceSplitOperationFactoryAddress() external view returns (address) {
    require(contracts[SPACE_SPLIT_OPERATION_FACTORY] != ZERO_ADDRESS, "GGR: SPACE_SPLIT_OPERATION_FACTORY not set");
    return contracts[SPACE_SPLIT_OPERATION_FACTORY];
  }

  function getGaltTokenAddress() external view returns (address) {
    require(contracts[GALT_TOKEN] != ZERO_ADDRESS, "GGR: GALT_TOKEN not set");
    return contracts[GALT_TOKEN];
  }

  function getSpaceTokenAddress() external view returns (address) {
    require(contracts[SPACE_TOKEN] != ZERO_ADDRESS, "GGR: SPACE_TOKEN not set");
    return contracts[SPACE_TOKEN];
  }

  function getACL() external view returns (IACL) {
    require(contracts[ACL] != ZERO_ADDRESS, "GGR: ACL not set");
    return IACL(contracts[ACL]);
  }

  function getGaltToken() external view returns (IERC20) {
    require(contracts[GALT_TOKEN] != ZERO_ADDRESS, "GGR: GALT_TOKEN not set");
    return IERC20(contracts[GALT_TOKEN]);
  }

  function getSpaceToken() external view returns (IERC721) {
    require(contracts[SPACE_TOKEN] != ZERO_ADDRESS, "GGR: SPACE_TOKEN not set");
    return IERC721(contracts[SPACE_TOKEN]);
  }
}
