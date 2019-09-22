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

import "../reputation/interfaces/IRA.sol";


interface IGaltLocker {
  function deposit(uint256 _amount) external;
  function withdraw(uint256 _amount) external;
  function approveMint(IRA _gra) external;
  function burn(IRA _gra) external;
  function isMinted(address _gra) external returns (bool);
  function getGras() external returns (address[] memory);
  function getGrasCount() external returns (uint256);
  function isOwner() external view returns (bool);
  function owner() external view returns(address);
}
