/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "../../registries/interfaces/ISpaceGeoDataRegistry.sol";


// CVActive - the application was approved by Contour Verifiers and the decision can't be changed
interface IContourModifierApplication {
  enum ContourModificationType {
    ADD,
    UPDATE
  }

  function cvApprove(uint256 _applicationId) external;
  function cvReject(uint256 _applicationId) external;

  function getCVPendingApplications() external view returns (uint256[] memory applicationIds);
  function getCVApprovedApplications() external view returns (uint256[] memory applicationIds);
  function getCVContour(uint256 _applicationId) external view returns (uint256[] memory);
  function getCVHighestPoint(uint256 _applicationId) external view returns (int256);
  function getCVSpaceTokenType(uint256 _applicationId) external view returns (ISpaceGeoDataRegistry.SpaceTokenType);
  function getCVData(uint256 _applicationId) external view returns (
    IContourModifierApplication.ContourModificationType contourModificationType,
    uint256 spaceTokenId,
    uint256[] memory contour
  );
  function isCVApplicationPending(uint256 _applicationId) external view returns (bool);
  function isCVApplicationApproved(uint256 _applicationId) external view returns (bool);
}
