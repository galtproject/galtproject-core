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
import "../../pgg/voting/PGGDelegateReputationVoting.sol";
import "../../pgg/interfaces/IPGGConfig.sol";


contract PGGDelegateReputationVotingFactory is Ownable {
  function build(
    IPGGConfig _pggConfig,
    bytes32 _roleReputationNotifier
  )
    external
    returns (PGGDelegateReputationVoting)
  {
    PGGDelegateReputationVoting voting = new PGGDelegateReputationVoting(
      _pggConfig,
      _roleReputationNotifier
    );

    return voting;
  }
}
