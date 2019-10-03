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

import "@galtproject/geodesic/contracts/utils/GeohashUtils.sol";
import "@galtproject/geodesic/contracts/utils/SegmentUtils.sol";
import "@galtproject/geodesic/contracts/utils/LandUtils.sol";
import "@galtproject/geodesic/contracts/utils/PolygonUtils.sol";
import "../registries/ContourVerificationSourceRegistry.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "./interfaces/IContourModifierApplication.sol";
import "./ContourVerificationManager.sol";
import "../registries/GaltGlobalRegistry.sol";


library ContourVerificationManagerLib {

  // e-is-h
  function denyWithExistingContourIntersectionProof(
    GaltGlobalRegistry _ggr,
    ContourVerificationManager.Application storage a,
    address _reporter,
    uint256 _existingTokenId,
    uint256 _existingContourSegmentFirstPointIndex,
    uint256 _existingContourSegmentFirstPoint,
    uint256 _existingContourSegmentSecondPoint,
    uint256 _verifyingContourSegmentFirstPointIndex,
    uint256 _verifyingContourSegmentFirstPoint,
    uint256 _verifyingContourSegmentSecondPoint
  )
    external
  {
    require(isSelfUpdateCase(a, _existingTokenId) == false, "Can't reject self-update action");

    ISpaceGeoDataRegistry geoDataRegistry = ISpaceGeoDataRegistry(_ggr.getSpaceGeoDataRegistryAddress());

    uint256[] memory existingTokenContour = geoDataRegistry.getSpaceTokenContour(_existingTokenId);
    ISpaceGeoDataRegistry.SpaceTokenType existingSpaceTokenType = geoDataRegistry.getSpaceTokenType(_existingTokenId);

    _requireSameTokenType(a, existingSpaceTokenType);

    bool intersects = _checkContourSegmentsIntersects(
      a,
      existingTokenContour,
      _existingContourSegmentFirstPointIndex,
      _existingContourSegmentFirstPoint,
      _existingContourSegmentSecondPoint,
      _verifyingContourSegmentFirstPointIndex,
      _verifyingContourSegmentFirstPoint,
      _verifyingContourSegmentSecondPoint
    );

    if (intersects == true) {
      if (existingSpaceTokenType == ISpaceGeoDataRegistry.SpaceTokenType.ROOM) {
        int256 existingTokenHighestPoint = geoDataRegistry.getSpaceTokenHighestPoint(_existingTokenId);
        require(
          checkForRoomVerticalIntersection(a, existingTokenContour, existingTokenHighestPoint) == true,
          "No intersection neither among contours nor among heights"
        );
      }
    } else {
      revert("Contours don't intersect");
    }
  }

  // e-in-h
  function denyWithExistingPointInclusionProof(
    GaltGlobalRegistry _ggr,
    ContourVerificationManager.Application storage a,
    ContourVerificationManager.Inclusion _inclusion,
    address _reporter,
    uint256 _existingTokenId,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
  {
    require(isSelfUpdateCase(a, _existingTokenId) == false, "Can't reject self-update action");

    ISpaceGeoDataRegistry geoDataRegistry = ISpaceGeoDataRegistry(_ggr.getSpaceGeoDataRegistryAddress());

    uint256[] memory existingTokenContour = geoDataRegistry.getSpaceTokenContour(_existingTokenId);
    ISpaceGeoDataRegistry.SpaceTokenType existingSpaceTokenType = geoDataRegistry.getSpaceTokenType(_existingTokenId);

    _requireSameTokenType(a, existingSpaceTokenType);

    bool isInside = _checkPointInsideContour(
      a,
      _inclusion,
      existingTokenContour,
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );
    if (isInside == true) {
      if (existingSpaceTokenType == ISpaceGeoDataRegistry.SpaceTokenType.ROOM) {
        int256 existingTokenHighestPoint = geoDataRegistry.getSpaceTokenHighestPoint(_existingTokenId);
        require(
          checkForRoomVerticalIntersection(a, existingTokenContour, existingTokenHighestPoint) == true,
          "Contour inclusion/height intersection not found"
        );
      }
    } else {
      revert("Existing contour doesn't include verifying");
    }
  }

  // aa-is-h
  function denyWithApplicationApprovedContourIntersectionProof(
    GaltGlobalRegistry _ggr,
    ContourVerificationManager.Application storage a,
    address _reporter,
    address _applicationContract,
    uint256 _externalApplicationId,
    uint256 _existingContourSegmentFirstPointIndex,
    uint256 _existingContourSegmentFirstPoint,
    uint256 _existingContourSegmentSecondPoint,
    uint256 _verifyingContourSegmentFirstPointIndex,
    uint256 _verifyingContourSegmentFirstPoint,
    uint256 _verifyingContourSegmentSecondPoint
  )
    external
  {
    ContourVerificationSourceRegistry(_ggr.getContourVerificationSourceRegistryAddress()).requireValid(_applicationContract);
    IContourModifierApplication applicationContract = IContourModifierApplication(_applicationContract);
    require(applicationContract.isCVApplicationApproved(_externalApplicationId), "Not in CVApplicationApproved list");

    _requireSameTokenType(a, applicationContract.getCVSpaceTokenType(_externalApplicationId));

    uint256[] memory existingContour = applicationContract.getCVContour(_externalApplicationId);

    if (_checkContourSegmentsIntersects(
      a,
      existingContour,
      _existingContourSegmentFirstPointIndex,
      _existingContourSegmentFirstPoint,
      _existingContourSegmentSecondPoint,
      _verifyingContourSegmentFirstPointIndex,
      _verifyingContourSegmentFirstPoint,
      _verifyingContourSegmentSecondPoint
    ) == true) {
      if (applicationContract.getCVSpaceTokenType(_externalApplicationId) == ISpaceGeoDataRegistry.SpaceTokenType.ROOM) {
        require(
          checkForRoomVerticalIntersection(
            a,
            existingContour,
            applicationContract.getCVHighestPoint(_externalApplicationId)
          ) == true,
          "No intersection neither among contours nor among heights"
        );
      }
    } else {
      revert("Contours don't intersect");
    }
  }

  // aa-in-h
  function denyWithApplicationApprovedPointInclusionProof(
    GaltGlobalRegistry _ggr,
    ContourVerificationManager.Application storage a,
    ContourVerificationManager.Inclusion _inclusion,
    address _reporter,
    address _applicationContract,
    uint256 _externalApplicationId,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
  {
    ContourVerificationSourceRegistry(_ggr.getContourVerificationSourceRegistryAddress()).requireValid(_applicationContract);
    IContourModifierApplication applicationContract = IContourModifierApplication(_applicationContract);
    require(applicationContract.isCVApplicationApproved(_externalApplicationId), "Not in CVApplicationApproved list");

    ISpaceGeoDataRegistry.SpaceTokenType existingSpaceTokenType = applicationContract.getCVSpaceTokenType(_externalApplicationId);

    _requireSameTokenType(a, existingSpaceTokenType);

    bool isInside = _checkPointInsideContour(
      a,
      _inclusion,
      applicationContract.getCVContour(_externalApplicationId),
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );

    if (isInside == true) {
      if (existingSpaceTokenType == ISpaceGeoDataRegistry.SpaceTokenType.ROOM) {
        require(
          checkForRoomVerticalIntersection(
            a,
            applicationContract.getCVContour(_externalApplicationId),
            applicationContract.getCVHighestPoint(_externalApplicationId)
          ) == true,
          "No inclusion neither among contours nor among heights"
        );
      }
    } else {
      revert("Existing contour doesn't include verifying");
    }
  }

  // at-in-h
  function denyInvalidApprovalWithApplicationApprovedTimeoutPointInclusionProof(
    ContourVerificationManager.Application storage a,
    ContourVerificationManager.Application storage existingA,
    ContourVerificationManager.Inclusion _inclusion,
    address _reporter,
    uint256 _existingCVApplicationId,
    uint256 _verifyingContourPointIndex,
    uint256 _verifyingContourPoint
  )
    external
  {
    require(
      existingA.status == ContourVerificationManager.Status.APPROVAL_TIMEOUT,
      "Expect APPROVAL_TIMEOUT status for existing application"
    );

    IContourModifierApplication existingApplicationContract = IContourModifierApplication(existingA.applicationContract);
    ISpaceGeoDataRegistry.SpaceTokenType existingSpaceTokenType = existingApplicationContract
      .getCVSpaceTokenType(existingA.externalApplicationId);

    _requireSameTokenType(a, existingSpaceTokenType);

    bool isInside = _checkPointInsideContour(
      a,
      _inclusion,
      IContourModifierApplication(existingA.applicationContract).getCVContour(existingA.externalApplicationId),
      _verifyingContourPointIndex,
      _verifyingContourPoint
    );

    if (isInside == true) {
      if (existingSpaceTokenType == ISpaceGeoDataRegistry.SpaceTokenType.ROOM) {
        require(
          checkForRoomVerticalIntersection(
            a,
            existingApplicationContract.getCVContour(existingA.externalApplicationId),
            existingApplicationContract.getCVHighestPoint(existingA.externalApplicationId)
          ) == true,
          "No inclusion neither among contours nor among heights"
        );
      }
    } else {
      revert("Existing contour doesn't include verifying");
    }
  }

  // at-is-h
  function denyWithApplicationApprovedTimeoutContourIntersectionProof(
    ContourVerificationManager.Application storage a,
    ContourVerificationManager.Application storage existingA,
    address _reporter,
    uint256 _existingCVApplicationId,
    uint256 _existingContourSegmentFirstPointIndex,
    uint256 _existingContourSegmentFirstPoint,
    uint256 _existingContourSegmentSecondPoint,
    uint256 _verifyingContourSegmentFirstPointIndex,
    uint256 _verifyingContourSegmentFirstPoint,
    uint256 _verifyingContourSegmentSecondPoint
  )
    external
  {

    require(
      existingA.status == ContourVerificationManager.Status.APPROVAL_TIMEOUT,
      "Expect APPROVAL_TIMEOUT status for existing application"
    );

    IContourModifierApplication existingApplicationContract = IContourModifierApplication(existingA.applicationContract);

    _requireSameTokenType(a, existingApplicationContract.getCVSpaceTokenType(existingA.externalApplicationId));

    uint256[] memory existingContour = existingApplicationContract.getCVContour(existingA.externalApplicationId);

    if (_checkContourSegmentsIntersects(
      a,
      existingContour,
      _existingContourSegmentFirstPointIndex,
      _existingContourSegmentFirstPoint,
      _existingContourSegmentSecondPoint,
      _verifyingContourSegmentFirstPointIndex,
      _verifyingContourSegmentFirstPoint,
      _verifyingContourSegmentSecondPoint
    ) == true) {
      if (existingApplicationContract.getCVSpaceTokenType(existingA.externalApplicationId) == ISpaceGeoDataRegistry.SpaceTokenType.ROOM) {
        require(
          checkForRoomVerticalIntersection(
            a,
            existingContour,
            existingApplicationContract.getCVHighestPoint(existingA.externalApplicationId)
          ) == true,
          "No intersection neither among contours nor among heights"
        );
      }
    } else {
      revert("Contours don't intersect");
    }
  }

  // INTERNAL

  function _checkContourSegmentsIntersects(
    ContourVerificationManager.Application storage a,
    uint256[] memory _existingTokenContour,
    uint256 _existingContourSegmentFirstPointIndex,
    uint256 _existingContourSegmentFirstPoint,
    uint256 _existingContourSegmentSecondPoint,
    uint256 _verifyingContourSegmentFirstPointIndex,
    uint256 _verifyingContourSegmentFirstPoint,
    uint256 _verifyingContourSegmentSecondPoint
  )
    internal
    returns (bool)
  {
    require(
      segments5zAreCollinear(
        _existingContourSegmentFirstPoint,
        _existingContourSegmentSecondPoint,
        _verifyingContourSegmentFirstPoint,
        _verifyingContourSegmentSecondPoint
      ) == false,
      "Segments are collinear"
    );

    // Existing Token
    require(
      _contourHasSegment(
        _existingContourSegmentFirstPointIndex,
        _existingContourSegmentFirstPoint,
        _existingContourSegmentSecondPoint,
        _existingTokenContour
      ) == true,
      "Invalid segment for existing token"
    );

    // Verifying Token
    IContourModifierApplication applicationContract = IContourModifierApplication(a.applicationContract);

    applicationContract.isCVApplicationPending(a.externalApplicationId);
    uint256[] memory verifyingTokenContour = applicationContract.getCVContour(a.externalApplicationId);

    require(
      _contourHasSegment(
        _verifyingContourSegmentFirstPointIndex,
        _verifyingContourSegmentFirstPoint,
        _verifyingContourSegmentSecondPoint,
        verifyingTokenContour
      ) == true,
      "Invalid segment for verifying token"
    );

    return SegmentUtils.segmentsIntersect(
      getLatLonSegment(
        GeohashUtils.geohash5zToGeohash5(_existingContourSegmentFirstPoint),
        GeohashUtils.geohash5zToGeohash5(_existingContourSegmentSecondPoint)
      ),
      getLatLonSegment(
        GeohashUtils.geohash5zToGeohash5(_verifyingContourSegmentFirstPoint),
        GeohashUtils.geohash5zToGeohash5(_verifyingContourSegmentSecondPoint)
      )
    );
  }

  function _checkPointInsideContour(
    ContourVerificationManager.Application storage a,
    ContourVerificationManager.Inclusion _inclusion,
    uint256[] memory _existingTokenContour,
    uint256 _contourPointIndex,
    uint256 _contourPoint
  )
    internal
    returns (bool)
  {
    // Verifying Token
    IContourModifierApplication applicationContract = IContourModifierApplication(a.applicationContract);

    applicationContract.isCVApplicationPending(a.externalApplicationId);
    uint256[] memory verifyingTokenContour = applicationContract.getCVContour(a.externalApplicationId);

    if (_inclusion == ContourVerificationManager.Inclusion.EXISTING_INSIDE_VERIFYING) {
      require(
        _existingTokenContour[_contourPointIndex] == _contourPoint,
        "Invalid point of verifying token"
      );

      return PolygonUtils.isInsideWithoutCache(
        GeohashUtils.geohash5zToGeohash5(_contourPoint),
        filterHeight(verifyingTokenContour)
      );

    } else {
      require(
        verifyingTokenContour[_contourPointIndex] == _contourPoint,
        "Invalid point of verifying token"
      );

      return PolygonUtils.isInsideWithoutCache(
        GeohashUtils.geohash5zToGeohash5(_contourPoint),
        filterHeight(_existingTokenContour)
      );
    }
  }

  function _contourHasSegment(
    uint256 _firstPointIndex,
    uint256 _firstPoint,
    uint256 _secondPoint,
    uint256[] memory _contour
  )
    internal
    returns (bool)
  {
    uint256 len = _contour.length;
    require(len > 0, "Empty contour");
    require(_firstPointIndex < len, "Invalid existing coord index");

    if (_contour[_firstPointIndex] != _firstPoint) {
      return false;
    }

    uint256 secondPointIndex = _firstPointIndex + 1;
    if (secondPointIndex == len) {
      secondPointIndex = 0;
    }

    if (_contour[secondPointIndex] != _secondPoint) {
      return false;
    }

    return true;
  }

  function _requireSameTokenType(
    ContourVerificationManager.Application storage a,
    ISpaceGeoDataRegistry.SpaceTokenType _existingSpaceTokenType
  )
    internal
  {
    ISpaceGeoDataRegistry.SpaceTokenType verifyingSpaceTokenType = IContourModifierApplication(a.applicationContract)
    .getCVSpaceTokenType(a.externalApplicationId);
    require(_existingSpaceTokenType == verifyingSpaceTokenType, "Existing/Verifying space token types mismatch");
  }

  // PUBLIC

  function getLatLonPoint(
    uint256 _geohash
  )
    public
    pure
    returns (int256[2] memory)
  {
    (int256 lat1, int256 lon1) = LandUtils.geohash5ToLatLon(_geohash);
    return int256[2]([lat1, lon1]);
  }

  function getLatLonSegment(
    uint256 _firstPointGeohash,
    uint256 _secondPointGeohash
  )
    public
    pure
    returns (int256[2][2] memory)
  {
    return int256[2][2]([
      getLatLonPoint(_firstPointGeohash),
      getLatLonPoint(_secondPointGeohash)
    ]);
  }

  function isSelfUpdateCase(
    ContourVerificationManager.Application storage a,
    uint256 _existingTokenId
  )
    public
    view
    returns (bool)
  {
    (
    IContourModifierApplication.ContourModificationType modificationType,
    uint256 spaceTokenId,
    ) = IContourModifierApplication(a.applicationContract).getCVData(a.externalApplicationId);

    if (modificationType == IContourModifierApplication.ContourModificationType.UPDATE) {
      return (spaceTokenId == _existingTokenId);
    }

    return false;
  }

  function segments5zAreCollinear(
    uint256 _a1g,
    uint256 _b1g,
    uint256 _a2g,
    uint256 _b2g
  )
    public
    pure
    returns (bool)
  {
    int256[2] memory a1 = getLatLonPoint(GeohashUtils.geohash5zToGeohash5(_a1g));
    int256[2] memory b1 = getLatLonPoint(GeohashUtils.geohash5zToGeohash5(_b1g));
    int256[2] memory a2 = getLatLonPoint(GeohashUtils.geohash5zToGeohash5(_a2g));
    int256[2] memory b2 = getLatLonPoint(GeohashUtils.geohash5zToGeohash5(_b2g));

    return SegmentUtils.pointOnSegment(a2, a1, b1) && SegmentUtils.pointOnSegment(b2, a1, b1);
  }

  function filterHeight(uint256[] memory _geohash5zContour)
    public
    pure
    returns (uint256[] memory)
  {
    uint256 len = _geohash5zContour.length;
    uint256[] memory geohash5Contour = new uint256[](len);

    for (uint256 i = 0; i < len; i++) {
      geohash5Contour[i] = GeohashUtils.geohash5zToGeohash5(_geohash5zContour[i]);
    }

    return geohash5Contour;
  }

  function checkForRoomVerticalIntersection(
    ContourVerificationManager.Application storage a,
    uint256[] memory existingContour,
    int256 eHP
  )
    public
    view
    returns (bool)
  {
    IContourModifierApplication applicationContract = IContourModifierApplication(a.applicationContract);
    uint256[] memory verifyingTokenContour = applicationContract.getCVContour(a.externalApplicationId);
    int256 vHP = applicationContract.getCVHighestPoint(a.externalApplicationId);

    int256 vLP = getLowestElevation(verifyingTokenContour);
    int256 eLP = getLowestElevation(existingContour);

    return checkVerticalIntersection(eHP, eLP, vHP, vLP);
  }

  function checkVerticalIntersection(int256 eHP, int256 eLP, int256 vHP, int256 vLP) public pure returns (bool) {
    if (eHP < vHP && eHP > vLP) {
      return true;
    }

    if (vHP < eHP && vHP > eLP) {
      return true;
    }

    if (eLP < vHP && eLP > vLP) {
      return true;
    }

    if (vLP < eHP && vLP > eLP) {
      return true;
    }

    return false;
  }

  function getLowestElevation(
    uint256[] memory _contour
  )
    public
    pure
    returns (int256)
  {
    uint256 len = _contour.length;
    require(len > 2, "Empty contour passed in");

    int256 theLowest = GeohashUtils.geohash5zToHeight(_contour[0]);

    for (uint256 i = 1; i < len; i++) {
      int256 elevation = GeohashUtils.geohash5zToHeight(_contour[i]);
      if (elevation < theLowest) {
        theLowest = elevation;
      }
    }

    return theLowest;
  }
}
