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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@galtproject/geodesic/contracts/interfaces/IGeodesic.sol";
import "@galtproject/geodesic/contracts/utils/GeohashUtils.sol";
import "@galtproject/libs/contracts/traits/Initializable.sol";
import "../interfaces/ISpaceToken.sol";
import "../registries/SpaceGeoDataRegistry.sol";


contract SpaceGeoDataRegistrySandbox is SpaceGeoDataRegistry {
  function setSpaceTokenContour(uint256 _spaceTokenId, uint256[] memory _geohashesContour) public {
    require(_geohashesContour.length >= 3, "Number of contour elements should be equal or greater than 3");
    require(
      _geohashesContour.length <= MAX_CONTOUR_GEOHASH_COUNT,
      "Number of contour elements should be equal or less than MAX_CONTOUR_GEOHASH_COUNT"
    );

    for (uint256 i = 0; i < _geohashesContour.length; i++) {
      require(_geohashesContour[i] > 0, "Contour element geohash should not be a zero");
      require(
        GeohashUtils.geohash5Precision(_geohashesContour[i]) >= MIN_CONTOUR_GEOHASH_PRECISION,
        "Contour element geohash should have at least MIN_CONTOUR_GEOHASH_PRECISION precision"
      );
    }

    spaceTokens[_spaceTokenId].contour = _geohashesContour;
    emit SetSpaceTokenContour(_spaceTokenId, _geohashesContour);
  }

  function setSpaceTokenHeights(uint256 _packageTokenId, int256[] memory _heightsList) public {
    require(
      _heightsList.length == getSpaceTokenContour(_packageTokenId).length,
      "Number of height elements should be equal contour length"
    );

    spaceTokens[_packageTokenId].heights = _heightsList;
    emit SetSpaceTokenHeights(_packageTokenId, _heightsList);
  }

  function setSpaceTokenArea(uint256 _spaceTokenId, uint256 _area, AreaSource _areaSource) public {
    spaceTokens[_spaceTokenId].area = _area;
    spaceTokens[_spaceTokenId].areaSource = _areaSource;
    emit SetSpaceTokenArea(_spaceTokenId, _area, _areaSource);
  }

  function setSpaceToken(
    uint256 _spaceTokenId,
    uint256[] memory _geohashesContour,
    int256[] memory _heightsList,
    uint256 _area,
    AreaSource _areaSource
  )
    public
  {
    setSpaceTokenContour(_spaceTokenId, _geohashesContour);
    setSpaceTokenHeights(_spaceTokenId, _heightsList);
    setSpaceTokenArea(_spaceTokenId, _area, _areaSource);
  }
}
