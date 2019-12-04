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


contract AbstractArbitratorApplication is AbstractApplication {
  mapping(address => uint256[]) public applicationsByArbitrator;

  modifier anyArbitrator(address _pgg) {
    require(pggConfig(_pgg).getMultiSig().isOwner(msg.sender), "Not active arbitrator");
    _;
  }

  constructor() public {}

  function claimArbitratorReward(uint256 _aId) external;

  function getApplicationsByArbitrator(address _arbitrator) external view returns (uint256[] memory) {
    return applicationsByArbitrator[_arbitrator];
  }
}
