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

pragma solidity 0.5.3;

import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/IRA.sol";
import "./interfaces/IGaltLocker.sol";
import "./interfaces/ILocker.sol";
import "./registries/GaltGlobalRegistry.sol";


contract GaltLocker is ILocker, IGaltLocker {
  using ArraySet for ArraySet.AddressSet;

  event ReputationMinted(address gra);
  event ReputationBurned(address gra);
  event TokenBurned(uint256 spaceTokenId);

  address public owner;

  GaltGlobalRegistry public ggr;

  ArraySet.AddressSet gras;

  constructor(GaltGlobalRegistry _ggr, address _owner) public {
    owner = _owner;

    ggr = _ggr;
  }

  modifier onlyOwner() {
    require(isOwner());
    _;
  }

  // deposit allowed only when there are no any gra in the minted list
  function deposit(uint256 _amount) external onlyOwner {
    require(gras.size() == 0, "GRAs counter not 0");

    ggr.getGaltToken().transferFrom(msg.sender, address(this), _amount);
  }

  function withdraw(uint256 _amount) external onlyOwner {
    require(gras.size() == 0, "GRAs counter not 0");

    ggr.getGaltToken().transferFrom(address(this), msg.sender, _amount);
  }

  function approveMint(IRA _gra) external onlyOwner {
    require(!gras.has(address(_gra)), "Already minted to this GRA");
    require(_gra.ping() == bytes32("pong"), "Handshake failed");

    gras.add(address(_gra));
  }

  function burn(IRA _gra) external onlyOwner {
    require(gras.has(address(_gra)), "Not minted to the SRA");
    require(_gra.balanceOf(msg.sender) == 0, "Reputation not completely burned");

    gras.remove(address(_gra));
  }

  // GETTERS

  function isMinted(address _gra) external returns (bool) {
    return gras.has(_gra);
  }

  function getGras() external returns (address[] memory) {
    return gras.elements();
  }

  function getGrasCount() external returns (uint256) {
    return gras.size();
  }

  function isOwner() public view returns (bool) {
    return msg.sender == owner;
  }

  function getTokenInfo()
    public
    view
    returns (
        address _owner
    )
  {
    return (
      owner
    );
  }
}
