/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


interface ISpaceGeoDataRegistry {
  enum AreaSource {
    USER_INPUT,
    CONTRACT
  }

  enum SpaceTokenType {
    NULL,
    LAND_PLOT,
    BUILDING,
    ROOM
  }

  function setType(uint256 _spaceTokenId, SpaceTokenType _spaceTokenType) external;
  function setContour(uint256 _spaceTokenId, uint256[] calldata _contour) external;
  function setHighestPoint(uint256 _spaceTokenId, int256 _highestPoint) external;
  function setHumanAddress(uint256 _spaceTokenId, string calldata _humanAddress) external;
  function setArea(uint256 _spaceTokenId, uint256 _area, AreaSource _areaSource) external;
  function setLedgerIdentifier(uint256 _spaceTokenId, bytes32 _ledgerIdentifier) external;
  function setDataLink(uint256 _spaceTokenId, string calldata _dataLink) external;
  function setVertexRootHash(uint256 _spaceTokenId, bytes32 _vertexRootHash) external;
  function setVertexStorageLink(uint256 _spaceTokenId, string calldata _vertexStorageLink) external;
  function setDetails(
    uint256 _spaceTokenId,
    SpaceTokenType _tokenType,
    AreaSource _areaSource,
    uint256 _area,
    bytes32 _ledgerIdentifier,
    string calldata _humanAddress,
    string calldata _dataLink
  )
    external;

  function deleteGeoData(uint256 _spaceTokenId) external;

  function getType(uint256 _spaceTokenId) external view returns (SpaceTokenType);
  function getContour(uint256 _tokenId) external view returns (uint256[] memory);
  function getContourLength(uint256 _spaceTokenId) external view returns (uint256);
  function getHighestPoint(uint256 _spaceTokenId) external view returns (int256);
  function getHumanAddress(uint256 _spaceTokenId) external view returns (string memory);
  function getArea(uint256 _spaceTokenId) external view returns (uint256);
  function getAreaSource(uint256 _spaceTokenId) external view returns (ISpaceGeoDataRegistry.AreaSource);
  function getLedgerIdentifier(uint256 _spaceTokenId) external view returns (bytes32);
  function getDataLink(uint256 _spaceTokenId) external view returns (string memory);
  function getVertexRootHash(uint256 _spaceTokenId) external view returns (bytes32);
  function getVertexStorageLink(uint256 _spaceTokenId) external view returns (string memory);
}
