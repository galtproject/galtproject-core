pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Token.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "zos-lib/contracts/migrations/Initializable.sol";

// Just keep it here to make it loaded in tests
import "zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol";


contract SpaceToken is ERC721Token, Ownable, Initializable {
  bytes4 private constant InterfaceId_ERC721Enumerable = 0x780e9d63;
  bytes4 private constant InterfaceId_ERC721Metadata = 0x5b5e139f;

  constructor(
    string name,
    string symbol
  )
    public
    ERC721Token(name, symbol)
  {
  }

  function initialize(string _name, string _symbol) isInitializer public {
    // TODO: figure out how to call constructor
    // For now all parent constructors code is copied here
    owner = msg.sender;
    name_ = _name;
    symbol_ = _symbol;

    // register the supported interfaces to conform to ERC721 via ERC165
    _registerInterface(InterfaceId_ERC721Enumerable);
    _registerInterface(InterfaceId_ERC721Metadata);
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