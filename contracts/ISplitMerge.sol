pragma solidity 0.4.24;
pragma experimental "v0.5.0";


contract ISplitMerge {
  function packageGeohashesCount(uint256) external view returns (uint256);
  function initPackage(uint256 _firstGeohashTokenId) public returns (uint256);
  function setPackageContour(uint256 _packageTokenId, uint256[] _geohashesContour) public;
  function getPackageContour(uint256 _packageTokenId) public view returns (uint256[]);
  function getPackageGeohashes(uint256 _packageToken) public view returns (uint256[]);
  function addGeohashesToPackage(
    uint256 _packageToken,
    uint256[] _geohashTokens,
    uint256[] _neighborsGeohashTokens,
    bytes2[] _directions
  ) public;

  function removeGeohashesFromPackage(
    uint256 _packageToken,
    uint256[] _geohashTokens,
    bytes2[] _directions1,
    bytes2[] _directions2) public;
}