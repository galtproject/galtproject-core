pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./SpaceToken.sol";
import "./PlotManager.sol";

contract SplitMerge is Initializable, Ownable {
  SpaceToken spaceToken;
  PlotManager plotManager;

  mapping(uint256 => uint256) geohashToPackage;
  mapping(uint256 => uint256[]) packageToContour;

  mapping(uint256 => uint256[]) packageToGeohashes;
  mapping(uint256 => uint256) packageToGeohashesCount;
  mapping(uint256 => bool) brokenPackages;

  uint256[] allPackages;

  constructor () public {

  }

  function initialize(SpaceToken _spaceToken) public isInitializer {
    owner = msg.sender;
    spaceToken = _spaceToken;
  }

  function setPlotManager(PlotManager _plotManager) public onlyOwner {
    plotManager = _plotManager;
  }

  modifier ownerOrPlotManager() {
    require(plotManager == msg.sender || owner == msg.sender, "No permissions to mint geohash");
    _;
  }

  function mintGeohash(uint256 _geohashToken) public ownerOrPlotManager {
    spaceToken.mint(address(this), _geohashToken);
  }

  function mintPackage() private returns (uint256) {
    uint256 packageToken = spaceToken.generatePackTokenId();
    spaceToken.mint(address(this), packageToken);
    allPackages.push(packageToken);
    return packageToken;
  }

  function initPackage(uint256 _firstGeohashToken) public {
    uint256 _packageToken = mintPackage();

    spaceToken.transferFrom(address(this), msg.sender, _packageToken);

    addGeohashToPackageUnsafe(_packageToken, _firstGeohashToken);
  }

  function setPackageContour(uint256 _packageToken, uint256[] _geohashesContour) public {
    require(spaceToken.ownerOf(_packageToken) == msg.sender, "Package owner is not msg.sender");

    packageToContour[_packageToken] = _geohashesContour;
  }

  function addGeohashToPackageUnsafe(uint256 _packageToken, uint256 _geohashToken) private {
    require(_geohashToken != 0, "Geohash is 0");
    require(spaceToken.ownerOf(_geohashToken) == msg.sender, "Geohash owner is not msg.sender");

    spaceToken.transferFrom(spaceToken.ownerOf(_geohashToken), address(this), _geohashToken);

    packageToGeohashes[_packageToken].push(_geohashToken);
    geohashToPackage[_geohashToken] = _packageToken;
  }

  function addGeohashesToPackage(uint256 _packageToken, uint256[] _geohashTokens, uint256[] _neighborsGeohashTokens, bytes2[] _directions) public {
    require(_packageToken != 0, "Missing package token");
    require(spaceToken.ownerOf(_packageToken) == msg.sender, "Package owner is not msg.sender");
    require(spaceToken != address(0), "SpaceToken address not set");

    for (uint256 i = 0; i < _geohashTokens.length; i++) {
      //TODO: add check for neighbor beside the geohash and the Neighbor belongs to package
      addGeohashToPackageUnsafe(_packageToken, _geohashTokens[i]);
    }

    packageToGeohashesCount[_packageToken] += _geohashTokens.length;
  }

  function removeGeohashFromPackageUnsafe(uint256 _packageToken, uint256 _geohashToken) public ownerOrPlotManager {
    require(_geohashToken != 0, "Geohash is 0");
    require(spaceToken.ownerOf(_geohashToken) == address(this), "Geohash owner is not SplitMerge");

    spaceToken.transferFrom(address(this), msg.sender, _geohashToken);
    geohashToPackage[_geohashToken] = 0;
  }

  function removeGeohashesFromPackage(uint256 _packageToken, uint256[] _geohashTokens, bytes2[] _directions1, bytes2[] _directions2) public {
    require(_packageToken != 0, "Missing package token");
    require(spaceToken.ownerOf(_packageToken) == msg.sender, "Package owner is not msg.sender");
    require(spaceToken != address(0), "SpaceToken address not set");

    for (uint256 i = 0; i < _geohashTokens.length; i++) {
      //TODO: add check for neighbor beside the geohash and the Neighbor belongs to package
      addGeohashToPackageUnsafe(_packageToken, _geohashTokens[i]);
    }

    packageToGeohashesCount[_packageToken] += _geohashTokens.length;
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