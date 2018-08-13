pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "zos-lib/contracts/migrations/Initializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./SpaceToken.sol";


contract SplitMerge is Initializable, Ownable {
  SpaceToken spaceToken;

  mapping(uint256 => uint256[]) packedTokens;

  constructor () public {}

  function initialize(SpaceToken _spaceToken) public isInitializer {
    owner = msg.sender;
    spaceToken = _spaceToken;
  }

  function swapTokens(uint256 _packageToken, uint256[] _geohashTokens) public {
    require(_packageToken != 0, "Missing package token");
    require(spaceToken != address(0), "SpaceToken address not set");

    require(spaceToken.ownerOf(_packageToken) == address(this), "Package token doesn't belong to SplitMerge contract");

    for (uint256 i = 0; i < _geohashTokens.length; i++) {
      require(_geohashTokens[i] != 0, "Geohash is 0");
      require(spaceToken.ownerOf(_geohashTokens[i]) == msg.sender, "Geohash owner is not msg.sender");
      packedTokens[_packageToken].push(_geohashTokens[i]);
    }
  }
}
