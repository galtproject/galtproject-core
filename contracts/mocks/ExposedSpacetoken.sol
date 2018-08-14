pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "../SpaceToken.sol";

contract ExposedSpaceToken is SpaceToken {
  constructor(
    string name,
    string symbol
  )
    public
    SpaceToken(name, symbol)
  {
  }

  function exposedGeneratePackTokenId() external returns (uint256) {
    return super.generatePackTokenId();
  }
}