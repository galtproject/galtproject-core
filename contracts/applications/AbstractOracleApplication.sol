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

import "./AbstractApplication.sol";


contract AbstractOracleApplication is AbstractApplication {

  bytes32 public constant ROLE_APPLICATION_UNLOCKER = bytes32("APPLICATION_UNLOCKER");

  mapping(address => bytes32[]) public applicationsByOracle;

  modifier _anyOracle() {
    _;
  }

  modifier onlyUnlocker() {
    require(ggr.getACL().hasRole(msg.sender, ROLE_APPLICATION_UNLOCKER), "No permission to unlock");

    _;
  }

  constructor() public {}

  function claimOracleReward(bytes32 _aId) external;

  function getOracleTypeShareKey(bytes32 _oracleType) public pure returns (bytes32);

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
  {
    pggConfig(_pgg)
      .getOracles()
      .requireOracleActiveWithAssignedActiveOracleType(_oracle, _role);
  }

  function getApplicationsByOracle(address _oracle) external view returns (bytes32[] memory) {
    return applicationsByOracle[_oracle];
  }
}
