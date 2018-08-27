pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./SpaceToken.sol";
import "./PlotManager.sol";

contract SplitMerge is Initializable, Ownable {
  using SafeMath for uint256;

  SpaceToken spaceToken;
  PlotManager plotManager;

  event PackageInit(bytes32 id, address owner);

  mapping(uint256 => uint256) public geohashToPackage;
  mapping(uint256 => uint256[]) public packageToContour;

  mapping(uint256 => uint256[]) public packageToGeohashes;
  mapping(uint256 => uint256) internal packageToGeohashesIndex;
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

    emit PackageInit(bytes32(_packageTokenId), spaceToken.ownerOf(_packageTokenId));

    return _packageTokenId;
  }

  function setPackageContour(uint256 _packageTokenId, uint256[] _geohashesContour) public {
    require(spaceToken.ownerOf(_packageTokenId) == msg.sender, "Package owner is not msg.sender");
    require(_geohashesContour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(_geohashesContour.length <= 50, "Number of contour elements should be equal or less than 50");

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

    uint256 length = packageToGeohashes[_packageToken].length;
    packageToGeohashes[_packageToken].push(_geohashToken);
    packageToGeohashesIndex[_geohashToken] = length;

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


    uint256 tokenIndex = packageToGeohashesIndex[_geohashToken];
    uint256 lastTokenIndex = packageToGeohashes[_packageToken].length.sub(1);
    uint256 lastToken = packageToGeohashes[_packageToken][lastTokenIndex];

    packageToGeohashes[_packageToken][tokenIndex] = lastToken;
    packageToGeohashes[_packageToken][lastTokenIndex] = 0;
    // Note that this will handle single-element arrays. In that case, both tokenIndex and lastTokenIndex are going to
    // be zero. Then we can make sure that we will remove _tokenId from the ownedTokens list since we are first swapping
    // the lastToken to the first position, and then dropping the element placed in the last position of the list

    packageToGeohashes[_packageToken].length--;
    packageToGeohashesIndex[_geohashToken] = 0;
    packageToGeohashesIndex[lastToken] = tokenIndex;
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

    if(getPackageGeohashesCount(_packageToken) == 0) {
      spaceToken.transferFrom(msg.sender, address(this), _packageToken);
    }
  }

  function getPackageGeohashes(uint256 _packageToken) public view returns (uint256[]) {
    return packageToGeohashes[_packageToken];
  }

  function getPackageGeohashesCount(uint256 _packageToken) public view returns (uint256) {
    return packageToGeohashes[_packageToken].length;
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