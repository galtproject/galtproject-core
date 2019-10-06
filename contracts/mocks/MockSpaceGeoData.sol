/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;


contract MockSpaceGeoData {
  string public constant GEO_DATA_MANAGER = "geo_data_manager";

  mapping(uint256 => uint256) private _tokenAreas;

  function setSpaceTokenArea(uint256 _tokenId, uint256 _amount) external {
    _tokenAreas[_tokenId] = _amount;
  }

  function getSpaceTokenArea(uint256 _tokenId) external view returns(uint256) {
    return _tokenAreas[_tokenId];
  }
}
