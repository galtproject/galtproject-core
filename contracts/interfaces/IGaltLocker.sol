/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
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
