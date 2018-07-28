pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Token.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract SpaceToken is ERC721Token, Ownable {
  constructor(
    string name,
    string symbol
  )
    public
    ERC721Token(name, symbol)
  {
  }

  function mint(
    address _to,
    address _toFund,
    uint256 _tokenId,
    uint256 _amount
  )
    public
  {
    super._mint(_to, _tokenId);
  }

  function burn(uint256 _tokenId) public {
    super._burn(ownerOf(_tokenId), _tokenId);
  }

  function setTokenURI(uint256 _tokenId, string _uri) public {
    super._setTokenURI(_tokenId, _uri);
  }
}