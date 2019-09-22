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


contract MockAddContourApplication is IContourModifierApplication {
  using ArraySet for ArraySet.Uint256Set;

  bytes32 public constant ROLE_CONTOUR_VERIFIER_POOL = bytes32("CONTOUR_VERIFIER");

  event NewApplication(uint256 indexed applicationId);

  enum ApplicationStatus {
    NOT_EXISTS,
    CONTOUR_VERIFICATION,
    SUBMITTED,
    APPROVED,
    REJECTED,
    REVERTED,
    CLOSED
  }

  ArraySet.Uint256Set internal CVPendingApplicationIds;
  ArraySet.Uint256Set internal CVApprovedApplicationIds;

  struct Application {
    uint256[] contour;
    int256 highestPoint;
    ISpaceGeoDataRegistry.SpaceTokenType spaceTokenType;
    ApplicationStatus status;
  }

  GaltGlobalRegistry public ggr;

  uint256 internal idCounter = 1;

  constructor(GaltGlobalRegistry _ggr) public {
    ggr = _ggr;
  }

  mapping(uint256 => Application) internal applications;

  modifier onlyCVM() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_CONTOUR_VERIFIER_POOL),
      "Invalid verifier contract"
    );

    _;
  }

  function submit(
    uint256[] memory _contour,
    int256 _highestPoint,
    ISpaceGeoDataRegistry.SpaceTokenType _spaceTokenType
  )
    public
    returns (uint256)
  {
    uint256 id = idCounter;
    idCounter++;
    Application storage a = applications[id];
    require(a.status == ApplicationStatus.NOT_EXISTS, "Already exists");

    a.contour = _contour;
    a.highestPoint = _highestPoint;
    a.spaceTokenType = _spaceTokenType;
    a.status = ApplicationStatus.CONTOUR_VERIFICATION;
    CVPendingApplicationIds.add(id);

    emit NewApplication(id);

    return id;
  }

  function cvApprove(uint256 _applicationId) external onlyCVM {
    Application storage a = applications[_applicationId];

    require(a.status == ApplicationStatus.CONTOUR_VERIFICATION, "Expect CONTOUR_VERIFICATION status");

    a.status = ApplicationStatus.SUBMITTED;

    CVPendingApplicationIds.remove(_applicationId);
    CVApprovedApplicationIds.add(_applicationId);
  }

  // TODO: what to do with a payment?
  function cvReject(uint256 _applicationId) external onlyCVM {
    Application storage a = applications[_applicationId];

    require(a.status == ApplicationStatus.CONTOUR_VERIFICATION, "Expect CONTOUR_VERIFICATION status");

    a.status = ApplicationStatus.REJECTED;

    CVPendingApplicationIds.remove(_applicationId);
  }

  // GETTERS
  function getApplicationStatus(uint256 _applicationId) external view returns(ApplicationStatus) {
    return applications[_applicationId].status;
  }

  // CV GETTERS
  function getCVPendingApplications() external view returns(uint256[] memory) {
    return CVPendingApplicationIds.elements();
  }

  function getCVApprovedApplications() external view returns(uint256[] memory) {
    return CVApprovedApplicationIds.elements();
  }

  function getCVContour(uint256 _applicationId) external view returns (uint256[] memory) {
    return applications[_applicationId].contour;
  }

  function getCVHighestPoint(uint256 _applicationId) external view returns (int256) {
    return applications[_applicationId].highestPoint;
  }

  function getCVSpaceTokenType(uint256 _applicationId) external view returns (ISpaceGeoDataRegistry.SpaceTokenType) {
    return applications[_applicationId].spaceTokenType;
  }

  function getCVData(
    uint256 _applicationId
  )
    external
    view
    returns (
      IContourModifierApplication.ContourModificationType contourModificationType,
      uint256 spaceTokenId,
      uint256[] memory contour
    )
  {
    contourModificationType = IContourModifierApplication.ContourModificationType.ADD;
    contour = applications[_applicationId].contour;
  }

  function isCVApplicationPending(uint256 _applicationId) public view returns (bool) {
    return CVPendingApplicationIds.has(_applicationId);
  }

  function isCVApplicationApproved(uint256 _applicationId) public view returns (bool) {
    return CVApprovedApplicationIds.has(_applicationId);
  }
}
