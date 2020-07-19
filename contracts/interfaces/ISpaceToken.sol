/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


interface ISpaceToken {
  event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
  event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
  event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
  event NewSpaceToken(uint256 tokenId, address owner);

  function mint(address _to) external returns (uint256);
  function burn(uint256 _tokenId) external;

  function approve(address _to, uint256 _tokenId) external;
  function getApproved(uint256 tokenId) external view returns (address operator);
  function setApprovalForAll(address operator, bool _approved) external;
  function isApprovedForAll(address owner, address operator) external view returns (bool);

  function setTokenURI(uint256 _tokenId, string calldata _uri) external;
  function tokensOfOwner(address _owner) external view returns (uint256[] memory);
  function ownerOf(uint256 _tokenId) external view returns (address);
  function exists(uint256 _tokenId) external view returns (bool);

  function transferFrom(address from, address to, uint256 tokenId) external;
  function safeTransferFrom(address from, address to, uint256 tokenId) external;
}
