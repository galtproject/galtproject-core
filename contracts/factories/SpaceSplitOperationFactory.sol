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
//pragma experimental ABIEncoderV2;

import "../interfaces/ISpaceSplitOperationFactory.sol";
import "../SpaceSplitOperation.sol";
import "../SpaceToken.sol";
import "../SplitMerge.sol";

contract SpaceSplitOperationFactory is ISpaceSplitOperationFactory {

  address spaceToken;
  address splitMerge;
  
  constructor(address _spaceToken, address _splitMerge) public {
    spaceToken = _spaceToken;
    splitMerge = _splitMerge;
  }

  function build(uint256 _spaceTokenId, uint256[] _clippingContour) external returns (address) {
    SpaceSplitOperation newSplitOperation = new SpaceSplitOperation(spaceToken, splitMerge, SpaceToken(spaceToken).ownerOf(_spaceTokenId), _spaceTokenId, SplitMerge(splitMerge).getPackageContour(_spaceTokenId), _clippingContour);
    return address(newSplitOperation);
  }
}
