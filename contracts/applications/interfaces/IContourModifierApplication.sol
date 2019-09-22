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
