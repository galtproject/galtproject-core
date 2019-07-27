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

pragma solidity ^0.5.10;

import "../applications/interfaces/IContourModifierApplication.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../registries/GaltGlobalRegistry.sol";


contract MockApplication is IContourModifierApplication {
  using ArraySet for ArraySet.Bytes32Set;

  bytes32 public constant ROLE_CONTOUR_VERIFIER_POOL = bytes32("CONTOUR_VERIFIER");

  event NewApplication(bytes32 indexed applicationId);

  enum ApplicationStatus {
    NOT_EXISTS,
    CONTOUR_VERIFICATION,
    SUBMITTED,
    APPROVED,
    REJECTED,
    REVERTED,
    CLOSED
  }

  ArraySet.Bytes32Set internal CVPendingApplicationIds;
  ArraySet.Bytes32Set internal CVApprovedApplicationIds;

  struct Application {
    uint256[] contour;
    ApplicationStatus status;
  }

  GaltGlobalRegistry public ggr;

  constructor(GaltGlobalRegistry _ggr) public {
    ggr = _ggr;
  }

  mapping(bytes32 => Application) internal applications;

  modifier onlyCVM() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_CONTOUR_VERIFIER_POOL),
      "Invalid verifier contract"
    );

    _;
  }

  function submit(uint256[] calldata _contour) external {
    bytes32 id = keccak256(abi.encode(_contour));
    Application storage a = applications[id];
    require(a.status == ApplicationStatus.NOT_EXISTS, "Already exists");

    a.contour = _contour;
    a.status = ApplicationStatus.CONTOUR_VERIFICATION;
    CVPendingApplicationIds.add(id);

    emit NewApplication(id);
  }

  function cvApprove(bytes32 _applicationId) external onlyCVM {
    Application storage a = applications[_applicationId];

    require(a.status == ApplicationStatus.CONTOUR_VERIFICATION, "Expect CONTOUR_VERIFICATION status");

    a.status = ApplicationStatus.SUBMITTED;

    CVPendingApplicationIds.remove(_applicationId);
    CVApprovedApplicationIds.add(_applicationId);
  }

  // TODO: what to do with a payment?
  function cvReject(bytes32 _applicationId) external onlyCVM {
    Application storage a = applications[_applicationId];

    require(a.status == ApplicationStatus.CONTOUR_VERIFICATION, "Expect CONTOUR_VERIFICATION status");

    a.status = ApplicationStatus.REJECTED;

    CVPendingApplicationIds.remove(_applicationId);
  }

  // GETTERS
  function getApplicationStatus(bytes32 _applicationId) external view returns(ApplicationStatus) {
    return applications[_applicationId].status;
  }

  // CV GETTERS
  function getCVPendingApplications() external view returns(bytes32[] memory) {
    return CVPendingApplicationIds.elements();
  }

  function getCVApprovedApplications() external view returns(bytes32[] memory) {
    return CVApprovedApplicationIds.elements();
  }

  function getCVContour(bytes32 _applicationId) external view returns (uint256[] memory) {
    return applications[_applicationId].contour;
  }

  function getCVData(
    bytes32 _applicationId
  )
    external
    view
    returns (
      ContourModificationType contourModificationType,
      uint256 spaceTokenId,
      uint256[] memory contour
    )
  {
    return (
      ContourModificationType.ADD,
      0,
      applications[_applicationId].contour
    );
  }

  function isCVApplicationPending(bytes32 _applicationId) public view returns (bool) {
    return CVPendingApplicationIds.has(_applicationId);
  }

  function isCVApplicationApproved(bytes32 _applicationId) public view returns (bool) {
    return CVApprovedApplicationIds.has(_applicationId);
  }
}
