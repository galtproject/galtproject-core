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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../../multisig/ArbitratorVoting.sol";
import "../../registries/interfaces/ILockerRegistry.sol";
import "../../registries/interfaces/IMultiSigRegistry.sol";
import "../../registries/GaltGlobalRegistry.sol";
import "./LiquidRA.sol";


contract GaltInputRA is LiquidRA {
  ArraySet.AddressSet private _members;

  // @dev Transfer owned reputation
  // PermissionED
  function delegate(address _to, address _owner, uint256 _amount) public {
    require(_members.has(_to), "Beneficiary isn't a member");

    _transfer(msg.sender, _to, _owner, _amount);
  }

  // @dev Mints reputation for given token to the owner account
  function mint(
    ISpaceLocker _galtLocker
  )
    public
  {
    galtLockerRegistry().requireValidLocker(address(_galtLocker));

    address owner = _galtLocker.owner();
    require(msg.sender == owner, "Not owner of the locker");
    _members.addSilent(owner);

    uint256 reputation = ggr.getGaltToken().balanceOf(address(_galtLocker));

    _mint(owner, reputation);
  }

  // Burn space token total reputation
  // Owner should revoke all delegated reputation back to his account before performing this action
  function approveBurn(
    ISpaceLocker _galtLocker
  )
    public
  {
    galtLockerRegistry().requireValidLocker(address(_galtLocker));

    address owner = _galtLocker.owner();

    require(msg.sender == owner, "Not owner of the locker");

    uint256 reputation = ggr.getGaltToken().balanceOf(address(_galtLocker));
    if (balanceOf(owner) == 0) {
      _members.remove(owner);
    }

    _burn(owner, reputation);
  }

  function galtLockerRegistry() internal view returns(ILockerRegistry) {
    return ILockerRegistry(ggr.getGaltLockerRegistryAddress());
  }

  function members() public view returns (address[] memory) {
    return _members.elements();
  }

  function memberCount() public view returns (uint256) {
    return _members.size();
  }

  function isMember(address _owner) public view returns (bool) {
    return _members.has(_owner);
  }
}
