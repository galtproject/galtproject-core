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

pragma solidity 0.5.7;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "./interfaces/ISpaceToken.sol";
import "./registries/GaltGlobalRegistry.sol";


contract SpaceToken is ISpaceToken, ERC721Full {
  event NewSpaceToken(uint256 tokenId, address owner);

  bytes32 public constant ROLE_SPACE_MINTER = bytes32("SPACE_MINTER");
  bytes32 public constant ROLE_SPACE_BURNER = bytes32("SPACE_BURNER");

  GaltGlobalRegistry internal ggr;
  uint256 internal packTokenIdCounter;

  modifier onlyMinter() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_SPACE_MINTER),
      "Only SPACE_MINTER role allowed"
    );

    _;
  }

  modifier onlyBurner() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_SPACE_BURNER),
      "Only SPACE_MINTER role allowed"
    );

    _;
  }

  modifier onlyOwnerOf(uint256 _tokenId) {
    require(ownerOf(_tokenId) == msg.sender, "Only owner of Space token");
    _;
  }

  constructor(
    GaltGlobalRegistry _ggr,
    string memory _name,
    string memory _symbol
  )
    public
    ERC721Full(_name, _symbol)
  {
    ggr = _ggr;
  }

  // MODIFIERS

  function mint(
    address _to
  )
    external
    onlyMinter
    returns (uint256)
  {
    uint256 _tokenId = _generateTokenId();
    super._mint(_to, _tokenId);

    emit NewSpaceToken(_tokenId, _to);

    return _tokenId;
  }

  function burn(uint256 _tokenId) external {
    require(
      ownerOf(_tokenId) == msg.sender || ggr.getACL().hasRole(msg.sender, ROLE_SPACE_BURNER),
      "Either owner or burner role allowed"
    );

    super._burn(ownerOf(_tokenId), _tokenId);
  }

  function setTokenURI(
    uint256 _tokenId,
    string calldata _uri
  )
    external
    onlyOwnerOf(_tokenId)
  {
    super._setTokenURI(_tokenId, _uri);
  }

  function tokensOfOwner(address _owner) external view returns (uint256[] memory) {
    return _tokensOfOwner(_owner);
  }

  function _generateTokenId() internal returns (uint256) {
    return packTokenIdCounter++;
  }

  // GETTERS

  function exists(uint256 _tokenId) external view returns (bool) {
    return _exists(_tokenId);
  }
}
