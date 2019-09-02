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

  function setSpaceTokenType(uint256 _spaceTokenId, SpaceTokenType _spaceTokenType) external;
  function setSpaceTokenContour(uint256 _spaceTokenId, uint256[] calldata _contour) external;
  function setSpaceTokenHighestPoint(uint256 _spaceTokenId, int256 _highestPoint) external;
  function setSpaceTokenHumanAddress(uint256 _spaceTokenId, string calldata _humanAddress) external;
  function setSpaceTokenArea(uint256 _spaceTokenId, uint256 _area, AreaSource _areaSource) external;
  function setSpaceTokenLedgerIdentifier(uint256 _spaceTokenId, bytes32 _ledgerIdentifier) external;
  function setSpaceTokenDataLink(uint256 _spaceTokenId, string calldata _dataLink) external;
  function setSpaceTokenVertexRootHash(uint256 _spaceTokenId, bytes32 _vertexRootHash) external;
  function setSpaceTokenVertexStorageLink(uint256 _spaceTokenId, string calldata _vertexStorageLink) external;

  function deleteSpaceTokenGeoData(uint256 _spaceTokenId) external;

  function getSpaceTokenType(uint256 _spaceTokenId) external view returns (SpaceTokenType);
  function getSpaceTokenContour(uint256 _tokenId) external view returns (uint256[] memory);
  function getSpaceTokenContourLength(uint256 _spaceTokenId) external view returns (uint256);
  function getSpaceTokenHighestPoint(uint256 _spaceTokenId) external view returns (int256);
  function getSpaceTokenHumanAddress(uint256 _spaceTokenId) external view returns (string memory);
  function getSpaceTokenArea(uint256 _spaceTokenId) external view returns (uint256);
  function getSpaceTokenAreaSource(uint256 _spaceTokenId) external view returns (ISpaceGeoDataRegistry.AreaSource);
  function getSpaceTokenLedgerIdentifier(uint256 _spaceTokenId) external view returns (bytes32);
  function getSpaceTokenDataLink(uint256 _spaceTokenId) external view returns (string memory);
  function getSpaceTokenVertexRootHash(uint256 _spaceTokenId) external view returns (bytes32);
  function getSpaceTokenVertexStorageLink(uint256 _spaceTokenId) external view returns (string memory);
}
