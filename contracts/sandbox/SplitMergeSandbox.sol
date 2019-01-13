pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "../SplitMerge.sol";

contract SplitMergeSandbox is SplitMerge {

  constructor() public {}

  function initPackage(address spaceTokenOwner) public returns (uint256) {
    uint256 _packageTokenId = spaceToken.mint(spaceTokenOwner);

    emit PackageInit(bytes32(_packageTokenId), spaceTokenOwner);

    return _packageTokenId;
  }
}
