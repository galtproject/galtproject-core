pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./SpaceToken.sol";
import "./PlotManager.sol";

contract SplitMerge is Initializable, Ownable {
  SpaceToken spaceToken;
  PlotManager plotManager;

  event PackageInit(bytes32 id, address owner);

  mapping(uint256 => uint256) geohashToPackage;
  mapping(uint256 => uint256[]) packageToContour;

  mapping(uint256 => uint256[]) public packageToGeohashes;
  mapping(uint256 => uint256) public packageGeohashesCount;
  mapping(uint256 => bool) brokenPackages;

  uint256[] allPackages;

  constructor () public {

  }

  function initialize(SpaceToken _spaceToken, PlotManager _plotManager) public isInitializer {
    owner = msg.sender;
    spaceToken = _spaceToken;
    plotManager = _plotManager;
  }

  modifier ownerOrPlotManager() {
    require(plotManager == msg.sender || owner == msg.sender, "No permissions to mint geohash");
    _;
  }

  function initPackage(uint256 _firstGeohashTokenId) public returns (uint256) {
    uint256 _packageTokenId = spaceToken.mintPack(msg.sender);
    allPackages.push(_packageTokenId);

    addGeohashToPackageUnsafe(_packageTokenId, _firstGeohashTokenId);

    packageGeohashesCount[_packageTokenId] = 1;

    emit PackageInit(bytes32(_packageTokenId), spaceToken.ownerOf(_packageTokenId));

    return _packageTokenId;
  }

  function setPackageContour(uint256 _packageTokenId, uint256[] _geohashesContour) public {
    require(spaceToken.ownerOf(_packageTokenId) == msg.sender, "Package owner is not msg.sender");
    require(_geohashesContour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(_geohashesContour.length < 51, "Number of contour elements should be equal or less than 50");

    for (uint8 i = 0; i < _geohashesContour.length; i++) {
      require(_geohashesContour[i] > 0, "Countour element geohash should not be a zero");
    }

    packageToContour[_packageTokenId] = _geohashesContour;
  }

  function getPackageContour(uint256 _packageTokenId) public view returns (uint256[]) {
    return packageToContour[_packageTokenId];
  }

  function addGeohashToPackageUnsafe(
    uint256 _packageToken,
    uint256 _geohashToken
  )
    private
  {
    require(_geohashToken != 0, "Geohash is 0");
    require(spaceToken.ownerOf(_geohashToken) == msg.sender, "Geohash owner is not msg.sender");

    spaceToken.transferFrom(msg.sender, address(this), _geohashToken);

    packageToGeohashes[_packageToken].push(_geohashToken);
    geohashToPackage[_geohashToken] = _packageToken;
  }

  function addGeohashesToPackage(
    uint256 _packageToken,
    uint256[] _geohashTokens,
    uint256[] _neighborsGeohashTokens,
    bytes2[] _directions
  )
    public
  {
    require(_packageToken != 0, "Missing package token");
    require(spaceToken.ownerOf(_packageToken) == msg.sender, "Package owner is not msg.sender");
    require(spaceToken != address(0), "SpaceToken address not set");

    for (uint256 i = 0; i < _geohashTokens.length; i++) {
      //TODO: add check for neighbor beside the geohash and the Neighbor belongs to package
      addGeohashToPackageUnsafe(_packageToken, _geohashTokens[i]);
    }

    packageGeohashesCount[_packageToken] += _geohashTokens.length;
  }

  function removeGeohashFromPackageUnsafe(
    uint256 _packageToken,
    uint256 _geohashToken
  )
    private
  {
    require(_geohashToken != 0, "Geohash is 0");
    require(spaceToken.ownerOf(_geohashToken) == address(this), "Geohash owner is not SplitMerge");
    require(geohashToPackage[_geohashToken] == _packageToken, "Geohash dont belongs to package");

    spaceToken.transferFrom(address(this), msg.sender, _geohashToken);
    geohashToPackage[_geohashToken] = 0;
  }

  function removeGeohashesFromPackage(
    uint256 _packageToken,
    uint256[] _geohashTokens,
    bytes2[] _directions1,
    bytes2[] _directions2
  )
    public
  {
    require(_packageToken != 0, "Missing package token");
    require(spaceToken.ownerOf(_packageToken) == msg.sender, "Package owner is not msg.sender");
    require(spaceToken != address(0), "SpaceToken address not set");

    for (uint256 i = 0; i < _geohashTokens.length; i++) {
      //TODO: add check for neighbor beside the geohash and the Neighbor belongs to package
      removeGeohashFromPackageUnsafe(_packageToken, _geohashTokens[i]);
    }

    packageGeohashesCount[_packageToken] -= _geohashTokens.length;
  }

  function getPackageGeohashes(uint256 _packageToken) public view returns (uint256[]) {
    return packageToGeohashes[_packageToken];
  }

  function packageOfGeohash(uint256 _geohashToken) public view returns (uint256) {
    return geohashToPackage[_geohashToken];
  }

  // TODO: implement in future
//  function splitGeohash(uint256 _geohashToken) public {
//
//  }

  // TODO: implement in future
//  function mergeGeohash(uint256[] _geohashToken) public {
//
//  }
}