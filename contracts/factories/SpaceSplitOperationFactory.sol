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

pragma solidity 0.5.10;

import "../interfaces/ISpaceSplitOperationFactory.sol";
import "../interfaces/ISpaceToken.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "../SpaceSplitOperation.sol";
import "../registries/GaltGlobalRegistry.sol";


contract SpaceSplitOperationFactory is ISpaceSplitOperationFactory {

  GaltGlobalRegistry ggr;

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
