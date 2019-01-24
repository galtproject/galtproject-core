pragma solidity 0.5.3;

import "../SplitMerge.sol";

contract SplitMergeSandbox is SplitMerge {

  constructor() public {}

  function initPackage(address spaceTokenOwner) public returns (uint256) {
    uint256 _packageTokenId = spaceToken.mint(spaceTokenOwner);

    emit PackageInit(bytes32(_packageTokenId), spaceTokenOwner);

    return _packageTokenId;
  }

  function setPackageContour(uint256 _spaceTokenId, uint256[] _geohashesContour) public {
    require(_geohashesContour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(
      _geohashesContour.length <= MAX_CONTOUR_GEOHASH_COUNT,
      "Number of contour elements should be equal or less than MAX_CONTOUR_GEOHASH_COUNT"
    );

    for (uint8 i = 0; i < _geohashesContour.length; i++) {
      require(_geohashesContour[i] > 0, "Contour element geohash should not be a zero");
      require(
        GeohashUtils.geohash5Precision(_geohashesContour[i]) >= MIN_CONTOUR_GEOHASH_PRECISION,
        "Contour element geohash should have at least MIN_CONTOUR_GEOHASH_PRECISION precision"
      );
    }

    packageToContour[_spaceTokenId] = _geohashesContour;
    emit SpaceTokenContourChange(bytes32(_spaceTokenId), _geohashesContour);
  }

  function setPackageHeights(uint256 _packageTokenId, int256[] _heightsList) public {
    require(_heightsList.length == getPackageContour(_packageTokenId).length, "Number of height elements should be equal contour length");

    packageToHeights[_packageTokenId] = _heightsList;
    emit SpaceTokenHeightsChange(bytes32(_packageTokenId), _heightsList);
  }

  function createPackage(address spaceTokenOwner, uint256[] _geohashesContour, int256[] _heightsList) public returns (uint256) {
    uint256 _spaceTokenId = initPackage(spaceTokenOwner);
    setPackageContour(_spaceTokenId, _geohashesContour);
    setPackageHeights(_spaceTokenId, _heightsList);
    return _spaceTokenId;
  }
}
