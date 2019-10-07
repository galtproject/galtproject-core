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


interface ISpaceLocker {
  function deposit(uint256 _spaceTokenId) external;
  function withdraw(uint256 _spaceTokenId) external;
  function approveMint(IRA _sra) external;
  function burn(IRA _sra) external;
  function burnToken(bytes32 _spaceTokenIdHash) external;
  function isMinted(address _sra) external returns (bool);
  function getSras() external returns (address[] memory);
  function getSrasCount() external returns (uint256);
  function isOwner() external view returns (bool);
  function owner() external view returns(address);
  function spaceTokenId() external view returns(uint256);
  function reputation() external view returns(uint256);
}
