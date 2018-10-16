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

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Token.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/ownership/rbac/RBAC.sol";
import "zos-lib/contracts/migrations/Initializable.sol";

// Just keep it here to make it loaded in tests
import "zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol";


/*
 * SpaceToken contract
 */
contract SpaceToken is ERC721Token, Ownable, RBAC, Initializable {
  // solium-disable-next-line uppercase
  bytes4 private constant InterfaceId_ERC721Enumerable = 0x780e9d63;

  // solium-disable-next-line uppercase
  bytes4 private constant InterfaceId_ERC721Metadata = 0x5b5e139f;

  string public constant ROLE_MINTER = "minter";
  string public constant ROLE_BURNER = "burner";
  string public constant ROLE_OPERATOR = "operator";

  event NewSpaceToken(uint256 tokenId, address owner);

  uint256 packTokenIdCounter;

  modifier canTransfer(uint256 _tokenId) {
    require(isApprovedOrOwner(msg.sender, _tokenId) || hasRole(msg.sender, ROLE_OPERATOR), "No permissions to transfer tokens");
    _;
  }

  modifier onlyMinter() {
    checkRole(msg.sender, ROLE_MINTER);
    _;
  }

  modifier onlyBurner() {
    checkRole(msg.sender, ROLE_BURNER);
    _;
  }

  constructor(
    string name,
    string symbol
  )
    public
    ERC721Token(name, symbol)
  {
  }

  function initialize(string _name, string _symbol) public isInitializer {
    // TODO: figure out how to call constructor
    // For now all parent constructors code is copied here
    owner = msg.sender;
    name_ = _name;
    symbol_ = _symbol;

    addRole(msg.sender, ROLE_MINTER);
    addRole(msg.sender, ROLE_BURNER);
    addRole(msg.sender, ROLE_OPERATOR);

    packTokenIdCounter = 0;

    // register the supported interfaces to conform to ERC721 via ERC165
    _registerInterface(InterfaceId_ERC721Enumerable);
    _registerInterface(InterfaceId_ERC721Metadata);
  }

  function mint(
    address _to
  )
    external
    onlyMinter
    returns (uint256)
  {
    uint256 _tokenId = generateTokenId();
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

  function tokensOfOwner(address _owner) external view returns (uint256[]) {
    return ownedTokens[_owner];
  }

  function addRoleTo(address _operator, string _role) external onlyOwner {
    super.addRole(_operator, _role);
  }

  function removeRoleFrom(address _operator, string _role) external onlyOwner {
    super.removeRole(_operator, _role);
  }

  function generateTokenId() internal returns (uint256) {
    return packTokenIdCounter++;
  }
}