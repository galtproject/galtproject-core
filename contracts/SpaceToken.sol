pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Token.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/ownership/rbac/RBAC.sol";
import "zos-lib/contracts/migrations/Initializable.sol";

// Just keep it here to make it loaded in tests
import "zos-lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol";
import "./SplitMerge.sol";


/*
 * SpaceToken id encode the following additional logic
 * left two bits describes what type is it:
 *  - 0x01 for geohash, for ex. "0x01000000000000000...00005df"
 *  - 0x02 for pack, for ex. "0x020000000000000000...0003022fd0"
 *
 */
contract SpaceToken is ERC721Token, Ownable, RBAC, Initializable {
  // solium-disable-next-line uppercase
  bytes4 private constant InterfaceId_ERC721Enumerable = 0x780e9d63;

  // solium-disable-next-line uppercase
  bytes4 private constant InterfaceId_ERC721Metadata = 0x5b5e139f;

  bytes32 public constant GEOHASH_MASK = 0x0100000000000000000000000000000000000000000000000000000000000000;
  bytes32 public constant PACKAGE_MASK = 0x0200000000000000000000000000000000000000000000000000000000000000;

  string public constant ROLE_MINTER = "minter";
  string public constant ROLE_BURNER = "burner";
  string public constant ROLE_OPERATOR = "operator";

  uint256 packTokenIdCounter;
  bool splitMergeSet;
  SplitMerge splitMerge;

  event LogNewPackIdGenerated(bytes32 id);
  event LogPackTokenMinted(bytes32 tokenId, address owner);
  event LogGeohashTokenMinted(bytes32 tokenId, address owner);

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

  function mintPack(
    address _to
  )
    public
    onlyMinter
    returns (uint256)
  {
    uint256 _tokenId = generatePackTokenId();
    super._mint(_to, _tokenId);
    emit LogPackTokenMinted(bytes32(_tokenId), _to);

    return _tokenId;
  }

  function mintGeohash(
    address _to,
    uint256 _geohash5
  )
    public
    onlyMinter
    returns (uint256)
  {
    uint256 _tokenId = geohashToTokenId(_geohash5);
    super._mint(_to, _tokenId);
    emit LogGeohashTokenMinted(bytes32(_tokenId), _to);

    return _tokenId;
  }

  function burn(uint256 _tokenId) public onlyBurner {
    super._burn(ownerOf(_tokenId), _tokenId);
  }

  function setTokenURI(
    uint256 _tokenId,
    string _uri
  )
    public
    onlyOwnerOf(_tokenId)
  {
    super._setTokenURI(_tokenId, _uri);
  }

  /**
   * Add geohash mask to a 5-byte numerical representation of a geohash.
   * Converts tokenId uint like `824642203853484471` to
   * `452312848583266388373324160190187140051835877600158453279955829734764147127L`.
   */
  function geohashToTokenId(uint256 _geohash) public pure returns (uint256) {
    bytes32 newIdBytes = bytes32(_geohash);

    // Do not allow create more than 2^62 (4.611e18) geohashes
    assert((newIdBytes & GEOHASH_MASK) == 0x0);
    // TODO: assert length not more than 12 characters

    uint256 newId = uint256(newIdBytes ^ GEOHASH_MASK);

    return newId;
  }

  /**
   * Remove geohash mask from tokenId and keep only a 5-byte numerical representation of geohash.
   * Convert tokenId uint like `452312848583266388373324160190187140051835877600158453279955829734764147127L`
   * to `824642203853484471`
   */
  function tokenIdToGeohash(uint256 _tokenId) public pure returns (uint256) {
    return uint256(bytes32(_tokenId) ^ GEOHASH_MASK);
  }

  /**
   * Check whether token has a GEOHASH_MASK or not
   * @return bool if does
   */
  function isGeohash(bytes32 id) public pure returns (bool) {
    return (id & GEOHASH_MASK) == GEOHASH_MASK;
  }

  /**
   * Check whether token has a PACKAGE_MASK or not
   * @return bool if does
   */
  function isPack(bytes32 id) public pure returns (bool) {
    return (id & PACKAGE_MASK) == PACKAGE_MASK;
  }

  function generatePackTokenId() internal returns (uint256) {
    bytes32 newIdBytes = bytes32(packTokenIdCounter++);

    // Do not allow create more than 2^62 (4.611e18) packs
    assert((newIdBytes & PACKAGE_MASK) == 0x0);

    uint256 newId = uint256(newIdBytes ^ PACKAGE_MASK);

    assert(!exists(newId));

    emit LogNewPackIdGenerated(bytes32(newId));

    return newId;
  }

  function addRoleTo(address _operator, string _role) public onlyOwner {
    super.addRole(_operator, _role);
  }

  function removeRoleFrom(address _operator, string _role) public onlyOwner {
    super.removeRole(_operator, _role);
  }
}