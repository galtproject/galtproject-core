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

pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "../registries/interfaces/ILockerRegistry.sol";
import "../reputation/SpaceRA.sol";


contract MockSpaceRA is SpaceRA {

  function mintHack(address _beneficiary, uint256 _amount, uint256 _spaceTokenId) external {
    _mint(_beneficiary, _amount);
    _cacheSpaceTokenOwner(_beneficiary, _spaceTokenId);
  }

  function delegateHack(address _to, address _from, address _owner, uint256 _amount) external {
    _transfer(_to, _from, _owner, _amount);
  }

  function mintAll(address[] calldata _addresses, uint256[] calldata _spaceTokens, uint256 _amount) external {
    for (uint256 i = 0; i < _addresses.length; i++) {
      _mint(_addresses[i], _amount);
      _cacheSpaceTokenOwner(_addresses[i], _spaceTokens[i]);
    }
  }
}
