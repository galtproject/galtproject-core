pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./SpaceToken.sol";


contract SplitMerge is Initializable, Ownable {
  using SafeMath for uint256;

  SpaceToken spaceToken;
  address plotManager;

  event PackageInit(bytes32 id, address owner);

  mapping(uint256 => uint256) public geohashToPackage;
  mapping(uint256 => uint256[]) public packageToContour;

  mapping(uint256 => uint256[]) public packageToGeohashes;
  mapping(uint256 => uint256) internal packageToGeohashesIndex;
  mapping(uint256 => bool) brokenPackages;

  uint256[] allPackages;

  function initialize(SpaceToken _spaceToken, address _plotManager) public isInitializer {
    owner = msg.sender;
    spaceToken = _spaceToken;
    plotManager = _plotManager;
  }

  modifier ownerOrPlotManager() {
    require(plotManager == msg.sender || owner == msg.sender, "No permissions to mint geohash");
    _;
  }

  modifier onlySpaceTokenOwner(uint256 _spaceTokenId) {
    address ownerOfToken = spaceToken.ownerOf(_spaceTokenId);

    require(
      /* solium-disable-next-line */
      ownerOfToken == msg.sender || 
      spaceToken.isApprovedForAll(ownerOfToken, msg.sender) || 
      spaceToken.getApproved(_spaceTokenId) == msg.sender,
      "This action not permitted for msg.sender");
    _;
  }

  function initPackage(uint256 _firstGeohashTokenId) public returns (uint256) {
    uint256 _packageTokenId = spaceToken.mintPack(spaceToken.ownerOf(_firstGeohashTokenId));
    allPackages.push(_packageTokenId);

    addGeohashToPackageUnsafe(_packageTokenId, _firstGeohashTokenId);

    emit PackageInit(bytes32(_packageTokenId), msg.sender);

    return _packageTokenId;
  }

  function setPackageContour(uint256 _packageTokenId, uint256[] _geohashesContour) public onlySpaceTokenOwner(_packageTokenId) {
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
    onlySpaceTokenOwner(_geohashToken)
  {
    require(_geohashToken != 0, "Geohash is 0");

    spaceToken.transferFrom(spaceToken.ownerOf(_packageToken), address(this), _geohashToken);

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
    onlySpaceTokenOwner(_packageToken)
  {
    require(_packageToken != 0, "Missing package token");
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

    spaceToken.transferFrom(address(this), spaceToken.ownerOf(_packageToken), _geohashToken);
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
    onlySpaceTokenOwner(_packageToken)
  {
    require(_packageToken != 0, "Missing package token");
    require(spaceToken != address(0), "SpaceToken address not set");

    for (uint256 i = 0; i < _geohashTokens.length; i++) {
      //TODO: add check for neighbor beside the geohash and the Neighbor belongs to package
      removeGeohashFromPackageUnsafe(_packageToken, _geohashTokens[i]);
    }

    if (getPackageGeohashesCount(_packageToken) == 0) {
      spaceToken.transferFrom(spaceToken.ownerOf(_packageToken), address(this), _packageToken);
//      setPackageContour(_packageToken, uint256[]);
    }
  }

  function getPackageGeohashes(uint256 _packageToken) public view returns (uint256[]) {
    return packageToGeohashes[_packageToken];
  }

  function getPackageGeohashesCount(uint256 _packageToken) public view returns (uint256) {
    return packageToGeohashes[_packageToken].length;
  }

  function splitGeohash(uint256 _parentGeohashToken) public returns (uint256[32]) {
    address tokenOwner = spaceToken.ownerOf(_parentGeohashToken);
    require(tokenOwner == msg.sender, "Geohash owner is not msg.sender");

    uint256 geohash5 = spaceToken.tokenIdToGeohash(_parentGeohashToken);

    uint256[32] memory childrenTokensIds;
    for (uint8 i = 0; i < 32; i++) {
      bytes32 childSymbol = bytes32(i);
      bytes32 childHex = bytes32(geohash5 << 5) ^ childSymbol;
      uint256 childGeohash5 = uint256(childHex);
      uint256 childGeohashTokenId = spaceToken.geohashToTokenId(childGeohash5);
      childrenTokensIds[i] = childGeohashTokenId;

      bool childTokenExists = spaceToken.exists(childGeohashTokenId);

      if (childTokenExists) {
        if (spaceToken.ownerOf(childGeohashTokenId) == address(this)) {
          spaceToken.transferFrom(address(this), tokenOwner, childGeohashTokenId);
        } else {
          require(false, "Child tokens must be not exists or owned by msg.sender or SplitMerge contract");
        }
      } else {
        spaceToken.mintGeohash(tokenOwner, childGeohash5);
      }
    }

    spaceToken.transferFrom(tokenOwner, address(this), _parentGeohashToken);

    return childrenTokensIds;
  }

  function mergeGeohash(uint256 _parentGeohashToken) public {
    require(
      !spaceToken.exists(_parentGeohashToken) || spaceToken.ownerOf(_parentGeohashToken) == address(this),
      "Geohash parent must be not exits or owner should be SplitMerge");

    uint256 geohash5 = spaceToken.tokenIdToGeohash(_parentGeohashToken);
    address tokenOwner;

    for (uint8 i = 0; i < 32; i++) {
      bytes32 childSymbol = bytes32(i);
      bytes32 childHex = bytes32(geohash5 << 5) ^ childSymbol;
      uint256 childGeohash5 = uint256(childHex);
      uint256 childGeohashTokenId = spaceToken.geohashToTokenId(childGeohash5);

      if (tokenOwner == address(0)) {
        tokenOwner = spaceToken.ownerOf(childGeohashTokenId);
      }

      require(spaceToken.ownerOf(childGeohashTokenId) == msg.sender, "Geohash children must be owned by msg.sender");

      spaceToken.transferFrom(tokenOwner, address(this), childGeohashTokenId);
    }

    if (spaceToken.exists(_parentGeohashToken)) {
      spaceToken.transferFrom(address(this), tokenOwner, _parentGeohashToken);
    } else {
      spaceToken.mintGeohash(tokenOwner, geohash5);
    }
  }
}