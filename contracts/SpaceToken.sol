pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Token.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
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
contract SpaceToken is ERC721Token, Ownable, Initializable {
  // solium-disable-next-line uppercase
  bytes4 private constant InterfaceId_ERC721Enumerable = 0x780e9d63;

  // solium-disable-next-line uppercase
  bytes4 private constant InterfaceId_ERC721Metadata = 0x5b5e139f;

  bytes32 public constant GEOHASH_MASK = 0x0100000000000000000000000000000000000000000000000000000000000000;
  bytes32 public constant PACKAGE_MASK = 0x0200000000000000000000000000000000000000000000000000000000000000;

  uint256 packTokenIdCounter;
  bool splitMergeSet;
  SplitMerge splitMerge;

  event SpaceTokenMinted(bytes32 id, address owner);

  modifier canTransfer(uint256 _tokenId) {
    require(isApprovedOrOwner(msg.sender, _tokenId) || splitMerge == msg.sender, "No permissions to transfer tokens");
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

  function initialize(address _owner, string _name, string _symbol) public isInitializer {
    // TODO: figure out how to call constructor
    // For now all parent constructors code is copied here
    owner = _owner;
    name_ = _name;
    symbol_ = _symbol;

    packTokenIdCounter = 0;

    // register the supported interfaces to conform to ERC721 via ERC165
    _registerInterface(InterfaceId_ERC721Enumerable);
    _registerInterface(InterfaceId_ERC721Metadata);
  }

  function setSplitMerge(SplitMerge _splitMerge) public {
    require(splitMergeSet == false, "SplitMerge address is already set");

    splitMerge = _splitMerge;
    splitMergeSet = true;
  }

  function mint(
    address _to,
    uint256 _tokenId
  )
    public
  {
    super._mint(_to, _tokenId);
    emit SpaceTokenMinted(bytes32(_tokenId), _to);
  }

  function mintPack(
    address _to
  )
    public
    onlyOwner
    returns (uint256 _tokenId)
  {
    _tokenId = generatePackTokenId();
    mint(_to, _tokenId);
  }

  // Assume that can be called only by splitMerge for now
  function swapToPack(uint256 _packageId, uint256[] _geohashIds, address _beneficiary) public {
    require(splitMerge != address(0), "SplitMerge address not set");
    require(splitMerge == msg.sender, "Sender is not SplitMerge");
    // TODO: add assert for length of _geohasheIds
    // TODO: add assertion that _packageId token is a package
    // TODO: add assertions for each geohashId to make sure that it is a geohash

    for (uint256 i = 0; i < _geohashIds.length; i++) {
      transferFrom(_beneficiary, splitMerge, _geohashIds[i]);
    }

    transferFrom(splitMerge, _beneficiary, _packageId);
  }

  function burn(uint256 _tokenId) public {
    super._burn(ownerOf(_tokenId), _tokenId);
  }

  function setTokenURI(uint256 _tokenId, string _uri) public {
    super._setTokenURI(_tokenId, _uri);
  }

  // TODO: add unit tests
  function geohashToTokenId(uint256 _geohash) public pure returns (uint256) {
    bytes32 newIdBytes = bytes32(_geohash);

    // Do not allow create more than 2^62 (4.611e18) geohashes
    assert((newIdBytes & GEOHASH_MASK) == 0x0);
    // TODO: assert length not more than 12 characters

    uint256 newId = uint256(newIdBytes ^ GEOHASH_MASK);

    return newId;
  }

  // TODO: add unit tests
  function tokenIdToGeohash(uint256 _tokenId) public pure returns (uint256) {
    return uint256(bytes32(_tokenId) ^ GEOHASH_MASK);
  }

  // TODO: add unit tests
  function isGeohash(bytes32 id) public pure returns (bool) {
    return (id & GEOHASH_MASK) == GEOHASH_MASK;
  }

  // TODO: add unit tests
  function isPack(bytes32 id) public pure returns (bool) {
    return (id & PACKAGE_MASK) == PACKAGE_MASK;
  }

  function generatePackTokenId() public returns (uint256) {
    bytes32 newIdBytes = bytes32(packTokenIdCounter++);

    // Do not allow create more than 2^62 (4.611e18) packs
    assert((newIdBytes & PACKAGE_MASK) == 0x0);

    uint256 newId = uint256(newIdBytes ^ PACKAGE_MASK);

    assert(!exists(newId));

    return newId;
  }
}