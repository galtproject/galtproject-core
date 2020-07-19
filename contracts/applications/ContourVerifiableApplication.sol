/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

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
