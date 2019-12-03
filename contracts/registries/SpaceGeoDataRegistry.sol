/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@galtproject/geodesic/contracts/utils/GeohashUtils.sol";
import "@galtproject/libs/contracts/traits/Initializable.sol";
import "../interfaces/ISpaceToken.sol";
import "./GaltGlobalRegistry.sol";
import "./interfaces/ISpaceGeoDataRegistry.sol";


/**
 * @title Space Geo Data Registry.
 * @notice Tracks geospatial information for SpaceTokens.
 */
contract SpaceGeoDataRegistry is ISpaceGeoDataRegistry, Initializable {
  using SafeMath for uint256;

  uint256 public constant CONTOUR_GEOHASH_PRECISION = 12;

  bytes32 public constant ROLE_GEO_DATA_MANAGER = bytes32("GEO_DATA_MANAGER");

  event SetType(uint256 indexed spaceTokenId, SpaceTokenType spaceTokenType);
  event SetContour(uint256 indexed spaceTokenId, uint256[] contour);
  event SetHighestPoint(uint256 indexed spaceTokenId, int256 highestPoint);
  event SetHumanAddress(uint256 indexed spaceTokenId, string humanAddress);
  event SetDataLink(uint256 indexed spaceTokenId, string dataLink);
  event SetLedgerIdentifier(uint256 indexed spaceTokenId, bytes32 ledgerIdentifier);
  event SetVertexRootHash(uint256 indexed spaceTokenId, bytes32 ledgerIdentifier);
  event SetVertexStorageLink(uint256 indexed spaceTokenId, string vertexStorageLink);
  event SetArea(uint256 indexed spaceTokenId, uint256 area, AreaSource areaSource);
  event SetDetails(uint256 indexed spaceTokenId);
  event DeleteGeoData(uint256 indexed spaceTokenId, address indexed operator);

  struct SpaceToken {
    // (LAND_PLOT,BUILDING,ROOM) Type cannot be changed after token creation
    SpaceTokenType spaceTokenType;
    // Geohash5z (x,y,z)
    uint256[] contour;
    // Meters above the sea
    int256 highestPoint;

    // USER_INPUT or CONTRACT
    AreaSource areaSource;
    // Calculated either by contract (for land plots and buildings) or by manual input
    uint256 area;

    bytes32 ledgerIdentifier;
    string humanAddress;
    string dataLink;

    // Reserved for future use
    bytes32 vertexRootHash;
    string vertexStorageLink;
  }

  GaltGlobalRegistry internal ggr;

  // Mapping (spaceTokenId => spaceTokenDetails)
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

  /**
   * @notice Sets Space Token type.
   * @param _spaceTokenId the same ID used in SpaceToken contract
   * @param _spaceTokenType LAND_PLOT, BUILDING, or ROOM
   */
  function setType(uint256 _spaceTokenId, SpaceTokenType _spaceTokenType) external onlyGeoDataManager {
    require(spaceTokens[_spaceTokenId].spaceTokenType == SpaceTokenType.NULL, "Token type already set");

    spaceTokens[_spaceTokenId].spaceTokenType = _spaceTokenType;

    emit SetType(_spaceTokenId, _spaceTokenType);
  }

  /**
   * @notice Sets Space Token contour.
   * @dev Contours with large length could not be processed by SplitMerge operations. There also could be problems
   *      with calculating their are on-chain.
   * @param _spaceTokenId the same ID used in SpaceToken contract
   * @param _contour geohash5z encoded bottom level contour (3 <= length)
   */
  function setContour(uint256 _spaceTokenId, uint256[] calldata _contour) external onlyGeoDataManager {
    require(_contour.length >= 3, "Number of contour elements should be equal or greater than 3");

    for (uint256 i = 0; i < _contour.length; i++) {
      require(_contour[i] > 0, "Contour element geohash should not be a zero");

      require(
        GeohashUtils.geohash5Precision(GeohashUtils.geohash5zToGeohash5(_contour[i])) == CONTOUR_GEOHASH_PRECISION,
        "Contour element geohash should has precision of 12"
      );
    }

    spaceTokens[_spaceTokenId].contour = _contour;

    emit SetContour(_spaceTokenId, _contour);
  }

  /**
   * @notice Sets Space Token highest point.
   * @param _spaceTokenId the same ID used in SpaceToken contract
   * @param _highestPoint int256 in centimeters above the sea level
   */
  function setHighestPoint(uint256 _spaceTokenId, int256 _highestPoint) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].highestPoint = _highestPoint;

    emit SetHighestPoint(_spaceTokenId, _highestPoint);
  }

  /**
   * @notice Sets Space Token human readable address.
   * @param _spaceTokenId the same ID used in SpaceToken contract
   * @param _humanAddress string like city, street, building number an so on
   */
  function setHumanAddress(uint256 _spaceTokenId, string calldata _humanAddress) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].humanAddress = _humanAddress;

    emit SetHumanAddress(_spaceTokenId, _humanAddress);
  }

  /**
   * @notice Sets Space Token area.
   * @param _spaceTokenId the same ID used in SpaceToken contract.
   * @param _area uint256 in sq. meters (1 sq. meter == 1 eth)
   * @param _areaSource USER_INPUT for manual inputs and CONTRACT for on-chain calculated area
   */
  function setArea(uint256 _spaceTokenId, uint256 _area, AreaSource _areaSource) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].area = _area;
    spaceTokens[_spaceTokenId].areaSource = _areaSource;

    emit SetArea(_spaceTokenId, _area, _areaSource);
  }

  /**
   * @notice Sets Space Token ledger identifier.
   * @param _spaceTokenId the same ID used in SpaceToken contract.
   * @param _ledgerIdentifier cadastral ID
   */
  function setLedgerIdentifier(uint256 _spaceTokenId, bytes32 _ledgerIdentifier) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].ledgerIdentifier = _ledgerIdentifier;

    emit SetLedgerIdentifier(_spaceTokenId, _ledgerIdentifier);
  }

  /**
   * @notice Sets Space Token data link.
   * @param _spaceTokenId the same ID used in SpaceToken contract.
   * @param _dataLink IPLD data address
   */
  function setDataLink(uint256 _spaceTokenId, string calldata _dataLink) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].dataLink = _dataLink;

    emit SetDataLink(_spaceTokenId, _dataLink);
  }

  function setVertexRootHash(uint256 _spaceTokenId, bytes32 _vertexRootHash) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].vertexRootHash = _vertexRootHash;

    emit SetVertexRootHash(_spaceTokenId, _vertexRootHash);
  }

  function setVertexStorageLink(uint256 _spaceTokenId, string calldata _vertexStorageLink) external onlyGeoDataManager {
    spaceTokens[_spaceTokenId].vertexStorageLink = _vertexStorageLink;

    emit SetVertexStorageLink(_spaceTokenId, _vertexStorageLink);
  }

  function setDetails(
    uint256 _spaceTokenId,
    SpaceTokenType _tokenType,
    AreaSource _areaSource,
    uint256 _area,
    bytes32 _ledgerIdentifier,
    string calldata _humanAddress,
    string calldata _dataLink
  )
    external
    onlyGeoDataManager
  {
    SpaceToken storage p = spaceTokens[_spaceTokenId];

    p.spaceTokenType = _tokenType;
    p.areaSource = _areaSource;
    p.area = _area;
    p.ledgerIdentifier = _ledgerIdentifier;
    p.humanAddress = _humanAddress;
    p.dataLink = _dataLink;

    emit SetDetails(_spaceTokenId);
  }

  /**
   * @notice Deletes a Space Token data if the token doesn't exist (for ex. when the token was burned).
   * Permissionless method.
   * @param _spaceTokenId the same ID used in SpaceToken contract.
   */
  function deleteGeoData(uint256 _spaceTokenId) external {
    require(ISpaceToken(ggr.getSpaceTokenAddress()).exists(_spaceTokenId) == false, "Token exists");

    delete spaceTokens[_spaceTokenId];

    emit DeleteGeoData(_spaceTokenId, msg.sender);
  }

  // INTERNAL

  function spaceToken() internal view returns (ISpaceToken) {
    return ISpaceToken(ggr.getSpaceTokenAddress());
  }

  // GETTERS

  function getType(uint256 _spaceTokenId) external view returns (SpaceTokenType) {
    return spaceTokens[_spaceTokenId].spaceTokenType;
  }

  function getContour(uint256 _spaceTokenId) external view returns (uint256[] memory) {
    return spaceTokens[_spaceTokenId].contour;
  }

  function getHighestPoint(uint256 _spaceTokenId) external view returns (int256) {
    return spaceTokens[_spaceTokenId].highestPoint;
  }

  function getHumanAddress(uint256 _spaceTokenId) external view returns (string memory) {
    return spaceTokens[_spaceTokenId].humanAddress;
  }

  function getArea(uint256 _spaceTokenId) external view returns (uint256) {
    return spaceTokens[_spaceTokenId].area;
  }

  function getAreaSource(uint256 _spaceTokenId) external view returns (ISpaceGeoDataRegistry.AreaSource) {
    return spaceTokens[_spaceTokenId].areaSource;
  }

  function getLedgerIdentifier(uint256 _spaceTokenId) external view returns (bytes32) {
    return spaceTokens[_spaceTokenId].ledgerIdentifier;
  }

  function getDataLink(uint256 _spaceTokenId) external view returns (string memory) {
    return spaceTokens[_spaceTokenId].dataLink;
  }

  function getVertexRootHash(uint256 _spaceTokenId) external view returns (bytes32) {
    return spaceTokens[_spaceTokenId].vertexRootHash;
  }

  function getVertexStorageLink(uint256 _spaceTokenId) external view returns (string memory) {
    return spaceTokens[_spaceTokenId].vertexStorageLink;
  }

  function getContourLength(uint256 _spaceTokenId) external view returns (uint256) {
    return spaceTokens[_spaceTokenId].contour.length;
  }

  function getDetails(uint256 _spaceTokenId) external view returns (
    SpaceTokenType tokenType,
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
