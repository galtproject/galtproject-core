/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "../interfaces/ISpaceSplitOperationFactory.sol";
import "../interfaces/ISpaceToken.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "../SpaceSplitOperation.sol";
import "../registries/GaltGlobalRegistry.sol";


contract SpaceSplitOperationFactory is ISpaceSplitOperationFactory {

  GaltGlobalRegistry internal ggr;

  constructor(GaltGlobalRegistry _ggr) public {
    ggr = _ggr;
  }

  function build(uint256 _spaceTokenId, uint256[] calldata _clippingContour) external returns (address) {
    SpaceSplitOperation newSplitOperation = new SpaceSplitOperation(
      ggr,
      _spaceTokenId,
      _clippingContour
    );
    return address(newSplitOperation);
  }
}
