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
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "../interfaces/IACL.sol";


/**
 * Global registry of Galt Project contracts.
 *
 * Getters with `address` suffix return contract instances,
 * the rest of them return just an `address` primitive.
 */
contract GaltGlobalRegistry is Ownable {
  address private ZERO_ADDRESS = address(0);

  bytes32 public constant FEE_COLLECTOR = bytes32("fee_collector");

  bytes32 public constant ACL = bytes32("ACL");

  // Tokens
  bytes32 public constant GALT_TOKEN = bytes32("galt_token");
  bytes32 public constant SPACE_TOKEN = bytes32("space_token");

  // Registries
  bytes32 public constant APPLICATION_REGISTRY = bytes32("application_registry");
  bytes32 public constant MULTI_SIG_REGISTRY = bytes32("multi_sig_registry");
  bytes32 public constant FEE_REGISTRY = bytes32("fee_registry");
  bytes32 public constant SPACE_CUSTODIAN_REGISTRY = bytes32("space_custodian_registry");
  bytes32 public constant SPACE_LOCKER_REGISTRY = bytes32("space_locker_registry");
  bytes32 public constant GALT_LOCKER_REGISTRY = bytes32("galt_locker_registry");

  // TODO: move to the arbitration level
  bytes32 public constant ORACLES = bytes32("oracles");
  // TODO: move to the application level
  bytes32 public constant CLAIM_MANAGER = bytes32("claim_manager");

  bytes32 public constant SPACE_RA = bytes32("space_ra");
  bytes32 public constant GALT_RA = bytes32("galt_ra");

  // Utils
  bytes32 public constant GEODESIC = bytes32("geodesic");
  bytes32 public constant SPLIT_MERGE = bytes32("split_merge");

  // Factories
  bytes32 public constant SPACE_SPLIT_OPERATION_FACTORY = bytes32("space_split_operation_factory");

  mapping(bytes32 => address) private contracts;

  function setContract(bytes32 _key, address _value) external onlyOwner {
    contracts[_key] = _value;
  }

  // GETTERS
  function getContract(bytes32 _key) external view returns (address) {
    return contracts[_key];
  }

  function getFeeCollectorAddress() external view returns (address) {
    require(contracts[FEE_COLLECTOR] != ZERO_ADDRESS, "GGR: FEE_COLLECTOR not set");
    return contracts[FEE_COLLECTOR];
  }

  // TODO: add Address suffix
  function getApplicationRegistry() external view returns (address) {
    require(contracts[APPLICATION_REGISTRY] != ZERO_ADDRESS, "GGR: APPLICATION_REGISTRY not set");
    return contracts[APPLICATION_REGISTRY];
  }

  function getFeeRegistryAddress() external view returns (address) {
    require(contracts[FEE_REGISTRY] != ZERO_ADDRESS, "GGR: FEE_REGISTRY not set");
    return contracts[FEE_REGISTRY];
  }

  function getMultiSigRegistryAddress() external view returns (address) {
    require(contracts[MULTI_SIG_REGISTRY] != ZERO_ADDRESS, "GGR: MULTI_SIG_REGISTRY not set");
    return contracts[MULTI_SIG_REGISTRY];
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

  function getOraclesAddress() external view returns (address) {
    require(contracts[ORACLES] != ZERO_ADDRESS, "GGR: ORACLES not set");
    return contracts[ORACLES];
  }

  // TODO: should be moved to the application level registry
  function getClaimManagerAddress() external view returns (address) {
    require(contracts[CLAIM_MANAGER] != ZERO_ADDRESS, "GGR: CLAIM_MANAGER not set");
    return contracts[CLAIM_MANAGER];
  }

  function getSpaceRAAddress() external view returns (address) {
    require(contracts[SPACE_RA] != ZERO_ADDRESS, "GGR: SPACE_RA not set");
    return contracts[SPACE_RA];
  }

  function getGaltRAAddress() external view returns (address) {
    require(contracts[GALT_RA] != ZERO_ADDRESS, "GGR: GALT_RA not set");
    return contracts[GALT_RA];
  }

  function getSplitMergeAddress() external view returns (address) {
    require(contracts[SPLIT_MERGE] != ZERO_ADDRESS, "GGR: SPLIT_MERGE not set");
    return contracts[SPLIT_MERGE];
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
