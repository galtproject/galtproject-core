/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

// This contract will be included into the current one
import "../../pgg/PGGConfig.sol";
import "../../pgg/PGGMultiSig.sol";


contract PGGMultiSigFactory is Ownable {
  function build(
    address[] calldata _initialOwners,
    uint256 _multiSigRequired,
    PGGConfig _pggConfig
  )
    external
    returns (PGGMultiSig multiSig)
  {
    multiSig = new PGGMultiSig(_initialOwners, _multiSigRequired, _pggConfig);
  }
}
