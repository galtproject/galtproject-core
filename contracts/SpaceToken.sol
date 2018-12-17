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

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./traits/Permissionable.sol";
import "./traits/Initializable.sol";
import "./SpaceReputationAccounting.sol";


/*
 * SpaceToken contract
 */
contract SpaceToken is ERC721Full, Ownable, Permissionable {
  string public constant ROLE_MINTER = "minter";
  string public constant ROLE_BURNER = "burner";

  event NewSpaceToken(uint256 tokenId, address owner);

  SpaceReputationAccounting public spaceReputationAccounting;

  uint256 packTokenIdCounter;

  modifier onlyMinter() {
    require(hasRole(msg.sender, ROLE_MINTER), "Only minter allowed");
    _;
  }

  modifier onlyBurner() {
    require(hasRole(msg.sender, ROLE_BURNER), "Only burner allowed");
    _;
  }

  modifier onlyOwnerOf(uint256 _tokenId) {
    require(ownerOf(_tokenId) == msg.sender);
    _;
  }

  modifier onlyUnstaked(uint256 _tokenId) {
    if (address(spaceReputationAccounting) != address(0)) {
      spaceReputationAccounting.requireUnstaked(_tokenId);
    }
    _;
  }

  constructor(
    string name,
    string symbol
  )
    public
    ERC721Full(name, symbol)
  {
  }

  // OVERRIDDEN METHODS
  function approve(address to, uint256 tokenId) public onlyUnstaked(tokenId) {
    super.approve(to, tokenId);
  }

  function setApprovalForAll(address to, bool approved) public onlyUnstaked(packTokenIdCounter) {
    super.setApprovalForAll(to, approved);
  }

  function transferFrom(
    address from,
    address to,
    uint256 tokenId
  )
    public
    onlyUnstaked(tokenId)
  {
    super.transferFrom(from, to, tokenId);
  }

  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId
  )
    public
    onlyUnstaked(tokenId)
  {
    super.safeTransferFrom(from, to, tokenId);
  }

  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId,
    bytes _data
  )
    public
    onlyUnstaked(tokenId)
  {
    super.safeTransferFrom(from, to, tokenId, _data);
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

  function burn(uint256 _tokenId) external onlyBurner {
    super._burn(ownerOf(_tokenId), _tokenId);
  }

  function setTokenURI(
    uint256 _tokenId,
    string _uri
  )
    external
    onlyOwnerOf(_tokenId)
  {
    super._setTokenURI(_tokenId, _uri);
  }

  function setSpaceReputationAccounting(SpaceReputationAccounting _address) external onlyRole(ROLE_ROLE_MANAGER) {
    spaceReputationAccounting = _address;
  }

  // https://github.com/OpenZeppelin/openzeppelin-solidity/issues/1512
//  function tokensOfOwner(address _owner) external view returns (uint256[]) {
//    return _ownedTokens[_owner];
//  }

  function _generateTokenId() internal returns (uint256) {
    return packTokenIdCounter++;
  }


  // GETTERS

  function exists(uint256 _tokenId) external view returns (bool) {
    return _exists(_tokenId);
  }

}