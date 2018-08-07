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
  bytes4 private constant InterfaceId_ERC721Enumerable = 0x780e9d63;
  bytes4 private constant InterfaceId_ERC721Metadata = 0x5b5e139f;

  bytes32 public constant GeohashMask = 0x0100000000000000000000000000000000000000000000000000000000000000;
  bytes32 public constant PackMask = 0x0200000000000000000000000000000000000000000000000000000000000000;

  uint256 packTokenIdCounter;
  bool splitMergeSet;
  SplitMerge splitMerge;

  event SpaceTokenMinted(bytes32 id, address owner);

  constructor(
    string name,
    string symbol
  )
    public
    ERC721Token(name, symbol)
  {
  }

  function initialize(address _owner, string _name, string _symbol) isInitializer public {
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

  modifier canTransfer(uint256 _tokenId) {
    require(isApprovedOrOwner(msg.sender, _tokenId) || splitMerge == msg.sender);
    _;
  }

  function setSplitMerge(SplitMerge _splitMerge) public {
    require(splitMergeSet == false);

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
    require(splitMerge != address(0));
    require(splitMerge == msg.sender);
    // TODO: add assert for length of _geohasheIds
    // TODO: add assertion that _packageId token is a package
    // TODO: add assertions for each geohashId to make sure that it is a geohash

    for (uint256 i = 0; i < _geohashIds.length; i++) {
      transferFrom(_beneficiary, splitMerge, _geohashIds[i]);
    }

    transferFrom(splitMerge, _beneficiary, _packageId);
  }

  function generatePackTokenId() internal returns (uint256) {
    bytes32 newIdBytes = bytes32(packTokenIdCounter++);

    // Do not allow create more than 2^62 (4.611e18) packs
    assert((newIdBytes & PackMask) == 0x0);

    uint256 newId = uint256(newIdBytes ^ PackMask);

    assert(!exists(newId));

    return newId;
  }

  function burn(uint256 _tokenId) public {
    super._burn(ownerOf(_tokenId), _tokenId);
  }

  function setTokenURI(uint256 _tokenId, string _uri) public {
    super._setTokenURI(_tokenId, _uri);
  }

  // TODO: add unit tests
  function geohashToTokenId(uint256 _geohash) pure public returns (uint256) {
    bytes32 newIdBytes = bytes32(_geohash);

    // Do not allow create more than 2^62 (4.611e18) geohashes
    assert((newIdBytes & GeohashMask) == 0x0);
    // TODO: assert length not more than 12 characters

    uint256 newId = uint256(newIdBytes ^ GeohashMask);

    return newId;
  }

  // TODO: add unit tests
  function tokenIdToGeohash(uint256 _tokenId) pure public returns (uint256) {
    return uint256(bytes32(_tokenId) ^ GeohashMask);
  }

  // TODO: add unit tests
  function isGeohash(bytes32 id) pure public returns (bool) {
    return (id & GeohashMask) == GeohashMask;
  }

  // TODO: add unit tests
  function isPack(bytes32 id) pure public returns (bool) {
    return (id & PackMask) == PackMask;
  }
}