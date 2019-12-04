/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "./AbstractApplication.sol";


contract AbstractOracleApplication is AbstractApplication {

  bytes32 public constant ROLE_APPLICATION_UNLOCKER = bytes32("APPLICATION_UNLOCKER");

  mapping(address => uint256[]) public applicationsByOracle;

  constructor() public {}

  function claimOracleReward(uint256 _aId) external;
  function getOracleTypeShareKey(bytes32 _oracleType) public pure returns (bytes32);

  // INTERNAL

  function oracleTypeShare(address _pgg, bytes32 _oracleType) internal view returns (uint256) {
    uint256 val = uint256(pggConfigValue(_pgg, getOracleTypeShareKey(_oracleType)));

    assert(val <= 100);

    return val;
  }

  function requireOracleActiveWithAssignedActiveOracleType(
    address _pgg,
    address _oracle,
    bytes32 _role
  )
    internal
    view
  {
    pggConfig(_pgg)
      .getOracles()
      .requireOracleActiveWithAssignedActiveOracleType(_oracle, _role);
  }

  // GETTERS

  function getApplicationsByOracle(address _oracle) external view returns (uint256[] memory) {
    return applicationsByOracle[_oracle];
  }
}
