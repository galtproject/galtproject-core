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

import "./interfaces/IContourModifierApplication.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";


contract ContourVerifiableApplication is IContourModifierApplication {
  using ArraySet for ArraySet.Uint256Set;

  bytes32 public constant ROLE_CONTOUR_VERIFIER_POOL = bytes32("CONTOUR_VERIFIER");

  ArraySet.Uint256Set internal CVPendingApplicationIds;
  ArraySet.Uint256Set internal CVApprovedApplicationIds;

  function cvApprove(uint256 _applicationId) external;
  function cvReject(uint256 _applicationId) external;

  // CV Getters

  function getCVPendingApplications() external view returns (uint256[] memory applicationIds) {
    return CVPendingApplicationIds.elements();
  }

  function getCVApprovedApplications() external view returns (uint256[] memory applicationIds) {
    return CVApprovedApplicationIds.elements();
  }

  function isCVApplicationPending(uint256 _applicationId) external view returns (bool) {
    return CVApprovedApplicationIds.has(_applicationId);
  }

  function isCVApplicationApproved(uint256 _applicationId) external view returns (bool) {
    return CVPendingApplicationIds.has(_applicationId);
  }
}
