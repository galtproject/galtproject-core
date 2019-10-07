/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;

import "../applications/interfaces/IContourModifierApplication.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../registries/GaltGlobalRegistry.sol";
import "./MockAddContourApplication.sol";


contract MockUpdateContourApplication is MockAddContourApplication {
  mapping(uint256 => uint256) public applicationIdToSpaceTokenId;

  constructor(GaltGlobalRegistry _ggr) public MockAddContourApplication(_ggr) {}

  function submit(
    uint256 _spaceTokenId,
    uint256[] memory _contour,
    int256 _highestPoint,
    ISpaceGeoDataRegistry.SpaceTokenType _spaceTokenType
  )
    public
    returns (uint256)
  {
    uint256 applicationId = MockAddContourApplication.submit(_contour, _highestPoint, _spaceTokenType);
    applicationIdToSpaceTokenId[applicationId] = _spaceTokenId;
    return applicationId;
  }

  function submit(
    uint256[] memory _contour,
    int256 _highestPoint,
    ISpaceGeoDataRegistry.SpaceTokenType _spaceTokenType
  )
    public
    returns (uint256)
  {
    revert("Specify token ID as a first argument");
  }

  function getCVData(
    uint256 _applicationId
  )
    external
    view
    returns (
      IContourModifierApplication.ContourModificationType contourModificationType,
      uint256 spaceTokenId,
      uint256[] memory contourToAdd
    )
  {
    contourModificationType = IContourModifierApplication.ContourModificationType.UPDATE;
    spaceTokenId = applicationIdToSpaceTokenId[_applicationId];
    contourToAdd = applications[_applicationId].contour;
  }
}
