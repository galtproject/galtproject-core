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

import "../SpaceLocker.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";


contract MockSpaceLocker is SpaceLocker {

  constructor(GaltGlobalRegistry _ggr, address _owner) public SpaceLocker(_ggr, _owner) { }

  function hackDeposit(uint256 _spaceTokenId) external {
    require(!tokenDeposited, "Token already deposited");

    spaceTokenId = _spaceTokenId;
    reputation = ISpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress()).getSpaceTokenArea(_spaceTokenId);
    tokenDeposited = true;
  }

  function hackApproveMint(IRA _sra) external notBurned {
    require(!sras.has(address(_sra)), "Already minted to this RA");
    require(_sra.ping() == bytes32("pong"), "Handshake failed");

    sras.add(address(_sra));
  }
}
