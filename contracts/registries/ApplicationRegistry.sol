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


contract ApplicationRegistry is OwnableAndInitializable {
  using ArraySet for ArraySet.AddressSet;

  event SetActiveApplication(bytes32 indexed key, address addr);
  event AddToValidApplications(bytes32 indexed key, address addr);
  event RemoveFromValidApplications(bytes32 indexed key, address addr);

  // Oracle managed applications
  bytes32 public constant PLOT_MANAGER = bytes32("plot_manager");
  bytes32 public constant PLOT_CLARIFICATION_MANAGER = bytes32("plot_clarification_manager");
  bytes32 public constant PLOT_CUSTODIAN_MANAGER = bytes32("plot_custodian_manager");
  bytes32 public constant PLOT_VALUATION = bytes32("plot_valuation");
  bytes32 public constant PLOT_ESCROW = bytes32("plot_escrow");

  // Arbitrator managed applications
  bytes32 public constant NEW_ORACLE_MANAGER = bytes32("new_oracle_manager");
  bytes32 public constant UPDATE_ORACLE_MANAGER = bytes32("update_oracle_manager");
  bytes32 public constant CLAIM_MANAGER = bytes32("claim_manager");

  mapping(bytes32 => address) internal _currentApplications;
  mapping(bytes32 => ArraySet.AddressSet) internal _validApplications;

  function initialize() public isInitializer {
  }

  function setActiveApplication(bytes32 _key, address _current) external onlyOwner {
    _currentApplications[_key] = _current;

    emit SetActiveApplication(_key, _current);
  }

  function addToValidApplications(bytes32 _key, address _current) external onlyOwner {
    _validApplications[_key].add(_current);

    emit AddToValidApplications(_key, _current);
  }

  function removeFromValidApplications(bytes32 _key, address _current) external onlyOwner {
    _validApplications[_key].remove(_current);

    emit RemoveFromValidApplications(_key, _current);
  }
}
