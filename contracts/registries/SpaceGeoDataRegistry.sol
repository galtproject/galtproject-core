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
import "../SpaceToken.sol";


contract SpaceGeoDataRegistry is ISpaceGeoDataRegistry, Initializable {
  using SafeMath for uint256;

  // TODO: set MIN_CONTOUR_GEOHASH_PRECISION 12
  uint256 public constant MIN_CONTOUR_GEOHASH_PRECISION = 1;
  uint256 public constant MAX_CONTOUR_GEOHASH_COUNT = 100;

  bytes32 public constant ROLE_GEO_DATA_MANAGER = bytes32("GEO_DATA_MANAGER");

  GaltGlobalRegistry internal ggr;

  event SetSpaceTokenType(uint256 indexed spaceTokenId, SpaceTokenType spaceTokenType);
  event SetSpaceTokenContour(uint256 indexed spaceTokenId, uint256[] contour);
  event SetSpaceTokenHighestPoint(uint256 indexed spaceTokenId, int256 highestPoint);
  event SetSpaceTokenHumanAddress(uint256 indexed spaceTokenId, string humanAddress);
  event SetSpaceTokenDataLink(uint256 indexed spaceTokenId, string dataLink);
  event SetSpaceTokenLedgerIdentifier(uint256 indexed spaceTokenId, bytes32 ledgerIdentifier);
  event SetSpaceTokenVertexRootHash(uint256 indexed spaceTokenId, bytes32 ledgerIdentifier);
  event SetSpaceTokenVertexStorageLink(uint256 indexed spaceTokenId, string vertexStorageLink);
  event SetSpaceTokenArea(uint256 indexed spaceTokenId, uint256 area, AreaSource areaSource);
  event DeleteSpaceTokenGeoData(uint256 indexed spaceTokenId, address indexed operator);

  struct SpaceToken {
    // Type cannot be changed after token creation
    SpaceTokenType spaceTokenType;
    // Geohash5z (x,y,z)
    uint256[] contour;
    // Meters above the sea (z)
    int256 highestPoint;

    // USER_INPUT or CONTRACT
    AreaSource areaSource;
    // Calculated either by contract (for land plots and buildings) or by manual input
    uint256 area;

    bytes32 ledgerIdentifier;
    string humanAddress;
    string dataLink;

    bytes32 vertexRootHash;
    string vertexStorageLink;
  }

  mapping(uint256 => SpaceToken) internal spaceTokens;

  modifier onlyGeoDataManager() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_GEO_DATA_MANAGER),
      "Only GEO_DATA_MANAGER role allowed"
    );

    _;
  }

  function initialize(GaltGlobalRegistry _ggr) public isInitializer {
    ggr = _ggr;
  }

  // SETTERS

  function setSpaceTokenType(uint256 _spaceTokenId, SpaceTokenType _spaceTokenType) external onlyGeoDataManager {
    require(spaceTokens[_spaceTokenId].spaceTokenType == SpaceTokenType.NULL, "Token type already set");

    spaceTokens[_spaceTokenId].spaceTokenType = _spaceTokenType;

    emit SetSpaceTokenType(_spaceTokenId, _spaceTokenType);
  }

  function setSpaceTokenContour(uint256 _spaceTokenId, uint256[] calldata _contour) external onlyGeoDataManager {
    require(_contour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(
      _contour.length <= MAX_CONTOUR_GEOHASH_COUNT,
      "Number of contour elements should be equal or less than MAX_CONTOUR_GEOHASH_COUNT"
    );

    for (uint256 i = 0; i < _contour.length; i++) {
      require(_contour[i] > 0, "Contour element geohash should not be a zero");
      require(
        GeohashUtils.geohash5Precision(_contour[i]) >= MIN_CONTOUR_GEOHASH_PRECISION,
        "Contour element geohash should have at least MIN_CONTOUR_GEOHASH_PRECISION precision"
      );
    }

    spaceTokens[_spaceTokenId].contour = _contour;

    emit SetSpaceTokenContour(_spaceTokenId, _contour);
  }

  function setSpaceTokenHighestPoint(uint256 _spaceTokenId, int256 _highestPoint) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].highestPoint = _highestPoint;

    emit SetSpaceTokenHighestPoint(_spaceTokenId, _highestPoint);
  }

  function setSpaceTokenHumanAddress(uint256 _spaceTokenId, string calldata _humanAddress) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].humanAddress = _humanAddress;

    emit SetSpaceTokenHumanAddress(_spaceTokenId, _humanAddress);
  }

  function setSpaceTokenArea(uint256 _spaceTokenId, uint256 _area, AreaSource _areaSource) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].area = _area;
    spaceTokens[_spaceTokenId].areaSource = _areaSource;

    emit SetSpaceTokenArea(_spaceTokenId, _area, _areaSource);
  }

  function setSpaceTokenLedgerIdentifier(uint256 _spaceTokenId, bytes32 _ledgerIdentifier) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].ledgerIdentifier = _ledgerIdentifier;

    emit SetSpaceTokenLedgerIdentifier(_spaceTokenId, _ledgerIdentifier);
  }

  function setSpaceTokenDataLink(uint256 _spaceTokenId, string calldata _dataLink) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].dataLink = _dataLink;

    emit SetSpaceTokenDataLink(_spaceTokenId, _dataLink);
  }

  function setSpaceTokenVertexRootHash(uint256 _spaceTokenId, bytes32 _vertexRootHash) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].vertexRootHash = _vertexRootHash;

    emit SetSpaceTokenVertexRootHash(_spaceTokenId, _vertexRootHash);
  }

  function setSpaceTokenVertexStorageLink(uint256 _spaceTokenId, string calldata _vertexStorageLink) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].vertexStorageLink = _vertexStorageLink;

    emit SetSpaceTokenVertexStorageLink(_spaceTokenId, _vertexStorageLink);
  }

  function deleteSpaceTokenGeoData(uint256 _spaceTokenId) external onlyGeoDataManager {
    // TODO: test contour data emptied and wouldn't appear when token enabled again
    delete spaceTokens[_spaceTokenId];

    emit DeleteSpaceTokenGeoData(_spaceTokenId, msg.sender);
  }

  // INTERNAL

  function spaceToken() internal view returns (ISpaceToken) {
    return ISpaceToken(ggr.getSpaceTokenAddress());
  }

  // GETTERS

  function getSpaceTokenType(uint256 _spaceTokenId) external view returns (SpaceTokenType) {
    return spaceTokens[_spaceTokenId].spaceTokenType;
  }

  function getSpaceTokenContour(uint256 _spaceTokenId) external view returns (uint256[] memory) {
    return spaceTokens[_spaceTokenId].contour;
  }

  function getSpaceTokenHighestPoint(uint256 _spaceTokenId) external view returns (int256) {
    return spaceTokens[_spaceTokenId].highestPoint;
  }

  function getSpaceTokenHumanAddress(uint256 _spaceTokenId) external view returns (string memory) {
    return spaceTokens[_spaceTokenId].humanAddress;
  }

  function getSpaceTokenArea(uint256 _spaceTokenId) external view returns (uint256) {
    return spaceTokens[_spaceTokenId].area;
  }

  function getSpaceTokenAreaSource(uint256 _spaceTokenId) external view returns (ISpaceGeoDataRegistry.AreaSource) {
    return spaceTokens[_spaceTokenId].areaSource;
  }

  function getSpaceTokenLedgerIdentifier(uint256 _spaceTokenId) external view returns (bytes32) {
    return spaceTokens[_spaceTokenId].ledgerIdentifier;
  }

  function getSpaceTokenDataLink(uint256 _spaceTokenId) external view returns (string memory) {
    return spaceTokens[_spaceTokenId].dataLink;
  }

  function getSpaceTokenVertexRootHash(uint256 _spaceTokenId) external view returns (bytes32) {
    return spaceTokens[_spaceTokenId].vertexRootHash;
  }

  function getSpaceTokenVertexStorageLink(uint256 _spaceTokenId) external view returns (string memory) {
    return spaceTokens[_spaceTokenId].vertexStorageLink;
  }

  function getSpaceTokenContourLength(uint256 _spaceTokenId) external view returns (uint256) {
    return spaceTokens[_spaceTokenId].contour.length;
  }

  function getSpaceTokenDetails(uint256 _spaceTokenId) external view returns (
    SpaceTokenType spaceTokenType,
    uint256[] memory contour,
    int256 highestPoint,
    AreaSource areaSource,
    uint256 area,
    bytes32 ledgerIdentifier,
    string memory humanAddress,
    string memory dataLink,
    bytes32 vertexRootHash,
    string memory vertexStorageLink
  )
  {
    SpaceToken storage s = spaceTokens[_spaceTokenId];

    return (
      s.spaceTokenType,
      s.contour,
      s.highestPoint,
      s.areaSource,
      s.area,
      s.ledgerIdentifier,
      s.humanAddress,
      s.dataLink,
      s.vertexRootHash,
      s.vertexStorageLink
    );
  }
}
