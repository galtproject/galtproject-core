pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";


contract ISpaceToken is ERC721 {
  function mintPack(address _to) public returns (uint256);
  function mintGeohash(address _to, uint256 _geohash5) public returns (uint256);
  function burn(uint256 _tokenId) public;
  function setTokenURI(uint256 _tokenId, string _uri) public;
  function tokensOfOwner(address _owner) public view returns (uint256[]);
  function geohashToTokenId(uint256 _geohash) public pure returns (uint256);
  function tokenIdToGeohash(uint256 _tokenId) public pure returns (uint256);
  function geohashStringToGeohash5(bytes input) public view returns (uint256);
  function geohash5ToGeohashString(uint256 _input) public pure returns (bytes32);
  function isGeohash(bytes32 id) public pure returns (bool);
  function isPack(bytes32 id) public pure returns (bool);
  function addRoleTo(address _operator, string _role) public;
  function removeRoleFrom(address _operator, string _role) public;
}