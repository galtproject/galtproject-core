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

pragma solidity 0.5.3;

interface ISplitMerge {
  function setPackageContour(uint256 _spaceTokenId, uint256[] calldata _geohashesContour) external;
  function setPackageHeights(uint256 _spaceTokenId, int256[] calldata _heightsList) external;
  function setPackageLevel(uint256 _spaceTokenId, int256 _level) external;
  function setTokenArea(uint256 _spaceTokenId, uint256 _area) external;
  function setContourArea(uint256 _tokenId, uint256 _amount) external view returns (uint256);
  function initPackage(address _owner) external returns (uint256);
  function getContourArea(uint256 _tokenId) external view returns (uint256);
  function geodesic() external view returns (address);
  function getPackageContour(uint256 _tokenId) external view returns (uint256[] memory);
}
