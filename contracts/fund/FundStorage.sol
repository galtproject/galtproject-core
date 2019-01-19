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

  string public constant CONTRACT_WHITELIST_MANAGER = "wl_manager";
  string public constant CONTRACT_CONFIG_MANAGER = "config_manager";
  string public constant CONTRACT_NEW_MEMBER_MANAGER = "new_member_manager";
  string public constant CONTRACT_FINE_MEMBER_INCREMENT_MANAGER = "fine_member_increment_manager";
  string public constant CONTRACT_FINE_MEMBER_DECREMENT_MANAGER = "fine_member_decrement_manager";

  bytes32 public constant MANAGE_WL_THRESHOLD = bytes32("manage_wl_threshold");
  bytes32 public constant MODIFY_CONFIG_THRESHOLD = bytes32("modify_config_threshold");
  bytes32 public constant NEW_MEMBER_THRESHOLD = bytes32("new_member_threshold");
  bytes32 public constant EXPEL_MEMBER_THRESHOLD = bytes32("expel_member_threshold");
  bytes32 public constant FINE_MEMBER_THRESHOLD = bytes32("fine_member_threshold");
  bytes32 public constant IS_PRIVATE = bytes32("is_private");

  ArraySet.AddressSet private whiteListedContracts;
  mapping(bytes32 => bytes32) private _config;
  mapping(uint256 => bool) private _mintApprovals;
  // spaceTokenId => amount
  mapping(uint256 => uint256) private _fines;

  constructor (
    bool _isPrivate,
    uint256 _manageWhiteListThreshold,
    uint256 _modifyConfigThreshold,
    uint256 _newMemberThreshold,
    uint256 _expelMemberThreshold,
    uint256 _fineMemberThreshold
  ) public {
    _config[IS_PRIVATE] = bytes32(_isPrivate ? 1 : 0);
    _config[MANAGE_WL_THRESHOLD] = bytes32(_manageWhiteListThreshold);
    _config[MODIFY_CONFIG_THRESHOLD] = bytes32(_modifyConfigThreshold);
    _config[NEW_MEMBER_THRESHOLD] = bytes32(_newMemberThreshold);
    _config[EXPEL_MEMBER_THRESHOLD] = bytes32(_expelMemberThreshold);
    _config[FINE_MEMBER_THRESHOLD] = bytes32(_fineMemberThreshold);
  }

  function setConfigValue(bytes32 _key, bytes32 _value) external onlyRole(CONTRACT_CONFIG_MANAGER) {
    _config[_key] = _value;
  }

  function approveMint(uint256 _spaceTokenId) external onlyRole(CONTRACT_NEW_MEMBER_MANAGER) {
    _mintApprovals[_spaceTokenId] = true;
  }

  function incrementFine(uint256 _spaceTokenId, uint256 _amount) external onlyRole(CONTRACT_FINE_MEMBER_INCREMENT_MANAGER) {
    _fines[_spaceTokenId] += _amount;
  }

  function decrementFine(uint256 _spaceTokenId, uint256 _amount) external onlyRole(CONTRACT_FINE_MEMBER_DECREMENT_MANAGER) {
    _fines[_spaceTokenId] -= _amount;
  }

  function addWhiteListedContract(address _contract) external onlyRole(CONTRACT_WHITELIST_MANAGER) {
    whiteListedContracts.add(_contract);
  }

  function removeWhiteListedContract(address _contract) external onlyRole(CONTRACT_WHITELIST_MANAGER) {
    whiteListedContracts.add(_contract);
  }

  // GETTERS
  function getConfigValue(bytes32 _key) external view returns(bytes32) {
    return _config[_key];
  }

  function getFineAmount(uint256 _spaceTokenId) external view returns (uint256) {
    return _fines[_spaceTokenId];
  }

  function getWhiteListedContracts() external view returns(address[]) {
    return whiteListedContracts.elements();
  }

  function isMintApproved(uint256 _spaceTokenId) external view returns(bool) {
    if (_config[IS_PRIVATE] == 1) {
      return _mintApprovals[_spaceTokenId];
    } else {
      return true;
    }
  }
}
