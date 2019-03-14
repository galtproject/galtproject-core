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


interface ISpaceToken {
  function mint(address _to) external returns (uint256);
  function burn(uint256 _tokenId) external;
  function approve(address _to, uint256 _tokenId) external;
  function setTokenURI(uint256 _tokenId, string calldata _uri) external;
  function tokensOfOwner(address _owner) external view returns (uint256[] memory);
  function ownerOf(uint256 _tokenId) external view returns (address);
  function exists(uint256 _tokenId) external view returns (bool);
  function transferFrom(address from, address to, uint256 tokenId) external;
  function safeTransferFrom(address from, address to, uint256 tokenId) external;
}
