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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../collections/ArraySet.sol";
import "../traits/Permissionable.sol";

contract FundStorage is Permissionable {
  using ArraySet for ArraySet.AddressSet;

  // TODO: crud config
  // TODO: crud contract whitelist
  // TODO: crud fines
  string public constant CONTRACT_WHITELIST_MANAGER = "wl_manager";
  string public constant CONTRACT_CONFIG_MANAGER = "wl_manager";

  bytes32 public constant MANAGE_WL_THRESHOLD = bytes32("manage_wl_threshold");
  bytes32 public constant MODIFY_CONFIG_THRESHOLD = bytes32("modify_config_threshold");
  bytes32 public constant NEW_MEMBER_THRESHOLD = bytes32("new_member_threshold");
  bytes32 public constant EXPEL_MEMBER_THRESHOLD = bytes32("expel_member_threshold");
  bytes32 public constant FINE_MEMBER_THRESHOLD = bytes32("fine_member_threshold");
  bytes32 public constant IS_PRIVATE = bytes32("is_private");

  ArraySet.AddressSet private whiteListedContracts;
  mapping(bytes32 => bytes32) private config;

  constructor (
    bool _isPrivate,
    uint256 _manageWhiteListThreshold,
    uint256 _modifyConfigThreshold,
    uint256 _newMemberThreshold,
    uint256 _expelMemberThreshold,
    uint256 _fineMemberThreshold
  ) public {
    config[IS_PRIVATE] = bytes32(_isPrivate ? 1 : 0);
    config[MANAGE_WL_THRESHOLD] = bytes32(_manageWhiteListThreshold);
    config[MODIFY_CONFIG_THRESHOLD] = bytes32(_modifyConfigThreshold);
    config[NEW_MEMBER_THRESHOLD] = bytes32(_newMemberThreshold);
    config[EXPEL_MEMBER_THRESHOLD] = bytes32(_expelMemberThreshold);
    config[FINE_MEMBER_THRESHOLD] = bytes32(_fineMemberThreshold);
  }

  function setConfigValue(bytes32 _key, bytes32 _value) external onlyRole(CONTRACT_CONFIG_MANAGER) {
    config[_key] = _value;
  }

  function addWhiteListedContract(address _contract) external onlyRole(CONTRACT_WHITELIST_MANAGER) {
    whiteListedContracts.add(_contract);
  }

  function removeWhiteListedContract(address _contract) external onlyRole(CONTRACT_WHITELIST_MANAGER) {
    whiteListedContracts.add(_contract);
  }

  // GETTERS
  function getConfigValue(bytes32 _key) external view returns(bytes32) {
    return config[_key];
  }

  function getWhiteListedContracts() external view returns(address[]) {
    return whiteListedContracts.elements();
  }
}
