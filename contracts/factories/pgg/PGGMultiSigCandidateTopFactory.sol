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
import "../../pgg/voting/PGGMultiSigCandidateTop.sol";
import "../../pgg/PGGConfig.sol";


contract PGGMultiSigCandidateTopFactory is Ownable {
  function build(
    PGGConfig pggConfig
  )
    external
    returns (PGGMultiSigCandidateTop)
  {
    PGGMultiSigCandidateTop voting = new PGGMultiSigCandidateTop(
      pggConfig
    );

    return voting;
  }
}
