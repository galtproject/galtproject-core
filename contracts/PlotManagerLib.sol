pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "./PlotManager.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./LandUtils.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library PlotManagerLib {
  using SafeMath for uint256;
  using LandUtils for uint256;

  // weight = 32 ** (12 - geohashLength)
  function geohashCapacityToWeight(uint256 _capacity) public pure returns (uint256) {
    // requires sezu06 = sezu06a * 32
    return (32 ** (12 - _capacity));
  }

  function geohash5Weight(uint256 _geohash5) public pure returns (uint256) {
    return geohashCapacityToWeight(LandUtils.geohash5Capacity(_geohash5));
  }

  function addGeohashesToApplication(
    PlotManager.Application storage _a,
    SpaceToken _spaceToken,
    SplitMerge _splitMerge,
    uint256[] _geohashes,
    uint256[] _neighborsGeohashTokens,
    bytes2[] _directions
  )
    public
  {
    uint256 initGas = gasleft();
    uint256 totalAreaWeight = 0;

    for (uint8 i = 0; i < _geohashes.length; i++) {
      totalAreaWeight = totalAreaWeight.add(geohash5Weight(_geohashes[i]));

      uint256 geohashTokenId = _spaceToken.geohashToTokenId(_geohashes[i]);
      if (_spaceToken.exists(geohashTokenId)) {
        require(
          _spaceToken.ownerOf(geohashTokenId) == address(this),
          "Existing geohash token should belongs to PlotManager contract"
        );
      } else {
        _spaceToken.mintGeohash(address(this), _geohashes[i]);
      }

      _geohashes[i] = geohashTokenId;
    }

    _splitMerge.addGeohashesToPackage(_a.packageTokenId, _geohashes, _neighborsGeohashTokens, _directions);

    _a.areaWeight = _a.areaWeight.add(totalAreaWeight);
    _a.gasDepositEstimation = _a.gasDepositEstimation.add(initGas.sub(gasleft()));
  }

  function removeGeohashesFromApplication(
    PlotManager.Application storage _a,
    SpaceToken _spaceToken,
    SplitMerge _splitMerge,
    uint256[] _geohashes,
    bytes2[] _directions1,
    bytes2[] _directions2
  )
    public
  {
    uint256 totalAreaWeight = 0;

    for (uint8 i = 0; i < _geohashes.length; i++) {
      totalAreaWeight = totalAreaWeight.add(geohash5Weight(_geohashes[i]));
      uint256 geohashTokenId = _spaceToken.geohashToTokenId(_geohashes[i]);

      require(_spaceToken.ownerOf(geohashTokenId) == address(_splitMerge), "Existing geohash token should belongs to PlotManager contract");

      _geohashes[i] = geohashTokenId;
    }

    // TODO: implement directions
    _splitMerge.removeGeohashesFromPackage(_a.packageTokenId, _geohashes, _directions1, _directions2);

    _a.areaWeight = _a.areaWeight.sub(totalAreaWeight);
  }
}
