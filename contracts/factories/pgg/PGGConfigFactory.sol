/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/ownership/Ownable.sol";

// This contract will be included into the current one
import "../../pgg/PGGConfig.sol";
import "../../registries/GaltGlobalRegistry.sol";


contract PGGConfigFactory is Ownable {
  function build(
    GaltGlobalRegistry _ggr,
    uint256 _m,
    uint256 _n,
    uint256 _minimalArbitratorStake,
    uint256 _defaultProposalThreshold
  )
    external
    returns (PGGConfig config)
  {
    config = new PGGConfig(
      _ggr,
      _m,
      _n,
      _minimalArbitratorStake,
      _defaultProposalThreshold
    );

    bytes32 role = config.INTERNAL_ROLE_MANAGER();
    config.addInternalRole(msg.sender, role);
    config.removeInternalRole(address(this), role);
  }
}
