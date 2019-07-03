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

  function setSpaceTokenContour(uint256 _spaceTokenId, uint256[] calldata _geohasheContours) external;
  function setSpaceTokenHeights(uint256 _spaceTokenId, int256[] calldata _heightsList) external;
  function setSpaceTokenLevel(uint256 _spaceTokenId, int256 _level) external;
  function setSpaceTokenArea(uint256 _spaceTokenId, uint256 _area, AreaSource _areaSource) external;
  function setSpaceTokenInfo(uint256 _spaceTokenId, bytes32 _ledgerIdentifier, string calldata _description) external;
  function getSpaceTokenArea(uint256 _tokenId) external view returns (uint256);
  function getSpaceTokenContour(uint256 _tokenId) external view returns (uint256[] memory);
}
