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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@galtproject/geodesic/contracts/interfaces/IGeodesic.sol";
import "@galtproject/geodesic/contracts/utils/GeohashUtils.sol";
import "@galtproject/libs/contracts/traits/Initializable.sol";
import "../interfaces/ISpaceToken.sol";
import "./GaltGlobalRegistry.sol";
import "./interfaces/ISpaceGeoDataRegistry.sol";


contract SpaceGeoDataRegistry is ISpaceGeoDataRegistry, Initializable {
  using SafeMath for uint256;

  // TODO: set MIN_CONTOUR_GEOHASH_PRECISION 12
  uint256 public constant MIN_CONTOUR_GEOHASH_PRECISION = 1;
  uint256 public constant MAX_CONTOUR_GEOHASH_COUNT = 100;

  bytes32 public constant ROLE_GEO_DATA_MANAGER = bytes32("GEO_DATA_MANAGER");

  GaltGlobalRegistry internal ggr;

  event SetSpaceTokenHeights(uint256 indexed spaceTokenId, int256[] heights);
  event SetSpaceTokenContour(uint256 indexed spaceTokenId, uint256[] contour);
  event SetSpaceTokenLevel(uint256 indexed spaceTokenId, int256 level);
  event SetSpaceTokenArea(uint256 indexed spaceTokenId, uint256 area, AreaSource areaSource);
  event SetSpaceTokenInfo(uint256 indexed spaceTokenId);
  event DeleteSpaceTokenGeoData(uint256 indexed spaceTokenId, address indexed operator);

  struct SpaceToken {
    uint256[] contour;
    int256[] heights;
    int256 level;
    uint256 area;
    AreaSource areaSource;
    bytes32 ledgerIdentifier;
    string description;
  }

  mapping(uint256 => SpaceToken) internal spaceTokens;

  function initialize(GaltGlobalRegistry _ggr) public isInitializer {
    ggr = _ggr;
  }

  modifier onlySpaceTokenOwner(uint256 _spaceTokenId) {
    address ownerOfToken = spaceToken().ownerOf(_spaceTokenId);

    require(
    /* solium-disable-next-line */
      ownerOfToken == msg.sender ||
      spaceToken().isApprovedForAll(ownerOfToken, msg.sender) ||
      spaceToken().getApproved(_spaceTokenId) == msg.sender,
      "This action not permitted");
    _;
  }

  modifier onlyGeoDataManager() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_GEO_DATA_MANAGER),
      "Only GEO_DATA_MANAGER role allowed"
    );

    _;
  }

  function setSpaceTokenContour(uint256 _spaceTokenId, uint256[] memory _geohashesContour) public onlyGeoDataManager() {
    require(_geohashesContour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(
      _geohashesContour.length <= MAX_CONTOUR_GEOHASH_COUNT,
      "Number of contour elements should be equal or less than MAX_CONTOUR_GEOHASH_COUNT"
    );

    for (uint256 i = 0; i < _geohashesContour.length; i++) {
      require(_geohashesContour[i] > 0, "Contour element geohash should not be a zero");
      require(
        GeohashUtils.geohash5Precision(_geohashesContour[i]) >= MIN_CONTOUR_GEOHASH_PRECISION,
        "Contour element geohash should have at least MIN_CONTOUR_GEOHASH_PRECISION precision"
      );
    }

    spaceTokens[_spaceTokenId].contour = _geohashesContour;

    emit SetSpaceTokenContour(_spaceTokenId, _geohashesContour);
  }

  function setSpaceTokenHeights(uint256 _spaceTokenId, int256[] memory _heightsList) public onlyGeoDataManager() {
    require(_heightsList.length == getSpaceTokenContour(_spaceTokenId).length, "Number of height elements should be equal contour length");

    spaceTokens[_spaceTokenId].heights = _heightsList;

    emit SetSpaceTokenHeights(_spaceTokenId, _heightsList);
  }

  function setSpaceTokenLevel(uint256 _spaceTokenId, int256 _level) public onlyGeoDataManager() {
    spaceTokens[_spaceTokenId].level = _level;

    emit SetSpaceTokenLevel(_spaceTokenId, _level);
  }

  function setSpaceTokenArea(uint256 _spaceTokenId, uint256 _area, AreaSource _areaSource) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].area = _area;
    spaceTokens[_spaceTokenId].areaSource = _areaSource;

    emit SetSpaceTokenArea(_spaceTokenId, _area, _areaSource);
  }

  function setSpaceTokenInfo(uint256 _spaceTokenId, bytes32 _ledgerIdentifier, string calldata _description) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].ledgerIdentifier = _ledgerIdentifier;
    spaceTokens[_spaceTokenId].description = _description;

    emit SetSpaceTokenInfo(_spaceTokenId);
  }

  function deleteSpaceTokenGeoData(uint256 _spaceTokenId) external onlyGeoDataManager {
    delete spaceTokens[_spaceTokenId];

    emit DeleteSpaceTokenGeoData(_spaceTokenId, msg.sender);
  }

  function spaceToken() internal view returns (ISpaceToken) {
    return ISpaceToken(ggr.getSpaceTokenAddress());
  }

  // GETTERS

  function getSpaceTokenContour(uint256 _spaceTokenId) public view returns (uint256[] memory) {
    return spaceTokens[_spaceTokenId].contour;
  }

  function getSpaceTokenHeights(uint256 _spaceTokenId) public view returns (int256[] memory) {
    return spaceTokens[_spaceTokenId].heights;
  }

  function getSpaceTokenLevel(uint256 _spaceTokenId) public view returns (int256) {
    return spaceTokens[_spaceTokenId].level;
  }

  function getSpaceTokenArea(uint256 _spaceTokenId) external view returns (uint256) {
    return spaceTokens[_spaceTokenId].area;
  }

  function getSpaceTokenAreaSource(uint256 _spaceTokenId) external view returns (ISpaceGeoDataRegistry.AreaSource) {
    return spaceTokens[_spaceTokenId].areaSource;
  }

  function getSpaceTokenVertexCount(uint256 _spaceTokenId) external view returns (uint256) {
    return spaceTokens[_spaceTokenId].contour.length;
  }

  function getSpaceTokenGeoData(uint256 _spaceTokenId) public view returns (
    uint256[] memory contour,
    int256[] memory heights,
    int256 level,
    uint256 area,
    AreaSource areaSource,
    bytes32 ledgerIdentifier,
    string memory description
  )
  {
    SpaceToken storage s = spaceTokens[_spaceTokenId];

    return (
      s.contour,
      s.heights,
      s.level,
      s.area,
      s.areaSource,
      s.ledgerIdentifier,
      s.description
    );
  }
}
