/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "../SpaceLocker.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";


contract MockSpaceLocker is SpaceLocker {

  constructor(GaltGlobalRegistry _ggr, address _owner) public SpaceLocker(_ggr, _owner) { }

  function hackDeposit(uint256 _spaceTokenId) external {
    require(!tokenDeposited, "Token already deposited");

    spaceTokenId = _spaceTokenId;
    reputation = ISpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress()).getArea(_spaceTokenId);
    tokenDeposited = true;
  }

  function hackApproveMint(IRA _sra) external notBurned {
    require(!sras.has(address(_sra)), "Already minted to this RA");
    require(_sra.ping() == bytes32("pong"), "Handshake failed");

    sras.add(address(_sra));
  }
}
