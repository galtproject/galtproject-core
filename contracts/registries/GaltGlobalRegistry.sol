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


/**
 * Global registry of Galt Project contracts.
 *
 * Getters with `address` suffix return contract instances,
 * the rest of them return just an `address` primitive.
 */
contract GaltGlobalRegistry is Ownable {
  address private ZERO_ADDRESS = address(0);

  // Tokens
  bytes32 public constant GALT_TOKEN = bytes32("galt_token");
  bytes32 public constant SPACE_TOKEN = bytes32("space_token");

  // Registries
  bytes32 public constant MULTI_SIG_REGISTRY = bytes32("multi_sig_registry");
  bytes32 public constant SPACE_CUSTODIAN_REGISTRY = bytes32("space_custodian_registry");

  // TODO: move to the arbitration level
  bytes32 public constant ORACLES = bytes32("oracles");
  // TODO: move to the application level
  bytes32 public constant CLAIM_MANAGER = bytes32("claim_manager");

  bytes32 public constant SPACE_REPUTATION_ACCOUNTING = bytes32("space_reputation_accounting");

  // Utils
  bytes32 public constant GEODESIC = bytes32("geodesic");
  bytes32 public constant SPLIT_MERGE = bytes32("split_merge");

  mapping(bytes32 => address) private contracts;

  function setContract(bytes32 _key, address _value) external onlyOwner {
    contracts[_key] = _value;
  }

  // GETTERS
  function getContract(bytes32 _key) external view returns (address) {
    return contracts[_key];
  }

  function getMultiSigRegistryAddress() external view returns (address) {
    require(contracts[MULTI_SIG_REGISTRY] != ZERO_ADDRESS, "GGR: MULTI_SIG_REGISTRY not set");
    return contracts[MULTI_SIG_REGISTRY];
  }

  function getSpaceCustodianRegistryAddress() external view returns (address) {
    require(contracts[SPACE_CUSTODIAN_REGISTRY] != ZERO_ADDRESS, "GGR: SPACE_CUSTODIAN_REGISTRY not set");
    return contracts[SPACE_CUSTODIAN_REGISTRY];
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

  function getSpaceReputationAccountingAddress() external view returns (address) {
    require(contracts[SPACE_REPUTATION_ACCOUNTING] != ZERO_ADDRESS, "GGR: SPACE_REPUTATION_ACCOUNTING not set");
    return contracts[SPACE_REPUTATION_ACCOUNTING];
  }

  function getSplitMergeAddress() external view returns (address) {
    require(contracts[SPLIT_MERGE] != ZERO_ADDRESS, "GGR: SPLIT_MERGE not set");
    return contracts[SPLIT_MERGE];
  }

  function getSpaceTokenAddress() external view returns (address) {
    require(contracts[SPACE_TOKEN] != ZERO_ADDRESS, "GGR: SPACE_TOKEN not set");
    return contracts[SPACE_TOKEN];
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
