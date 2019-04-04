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

pragma solidity 0.5.3;


contract ISpaceCustodianRegistry {
  function attach(uint256 _spaceTokenId, address[] calldata _custodians, bytes32[] calldata _documents) external;
  function detach(uint256 _spaceTokenId, address[] calldata _custodians, bytes32[] calldata _documents) external;
  function spaceCustodianAssigned(uint256 _spaceTokenId, address _custodian) external view returns (bool);
  function spaceCustodians(uint256 _spaceTokenId) external view returns (address[] memory);
  function spaceCustodianCount(uint256 _spaceTokenId) external view returns (uint256);
}
