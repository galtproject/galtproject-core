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

pragma solidity 0.5.7;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/traits/Initializable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../../interfaces/ISpaceToken.sol";
import "../../interfaces/ISpaceLocker.sol";
import "../../registries/interfaces/ILockerRegistry.sol";
import "../../registries/GaltGlobalRegistry.sol";


contract LiquidRA is Permissionable, Initializable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;
  using ArraySet for ArraySet.Uint256Set;

  event Burn(address owner, uint256 amount);
  event Mint(address owner, uint256 amount);
  event Transfer(address from, address to, uint256 amount);

  GaltGlobalRegistry public ggr;

  // Delegate => balance
  mapping(address => uint256) private _balances;

  // Owner => totalMinted
  mapping(address => uint256) private _ownedBalances;

  // Reputation Owner => (Delegate => balance))
  mapping(address => mapping(address => uint256)) private _delegatedBalances;

  mapping(address => ArraySet.AddressSet) private _delegations;
  mapping(address => ArraySet.AddressSet) private _delegatedBy;

  // L0
  uint256 internal totalStakedSpace;

  function initializeInternal(
    GaltGlobalRegistry _ggr
  )
    internal
    isInitializer
  {
    ggr = _ggr;
  }

  // PermissionED
  function revoke(address _from, uint256 _amount) public {
    _debitAccount(_from, msg.sender, _amount);
    _creditAccount(msg.sender, msg.sender, _amount);
  }

  // INTERNAL

  function _mint(address _beneficiary, uint256 _amount) internal {
    totalStakedSpace += _amount;

    _creditAccount(_beneficiary, _beneficiary, _amount);

    _ownedBalances[_beneficiary] += _amount;

    emit Mint(_beneficiary, _amount);
  }

  function _burn(address _benefactor, uint256 _amount) internal {
    require(_balances[_benefactor] >= _amount, "LiquidRA: Not enough funds to burn");
    require(_delegatedBalances[_benefactor][_benefactor] >= _amount, "LiquidRA: Not enough funds to burn");
    require(_ownedBalances[_benefactor] >= _amount, "LiquidRA: Not enough funds to burn");

    totalStakedSpace -= _amount;

    _debitAccount(_benefactor, _benefactor, _amount);

    _ownedBalances[_benefactor] -= _amount;

    emit Burn(_benefactor, _amount);
  }

  function _transfer(address _from, address _to, address _owner, uint256 _amount) internal {
    _debitAccount(_from, _owner, _amount);
    _creditAccount(_to, _owner, _amount);

    emit Transfer(_from, _to, _amount);
  }

  function _creditAccount(address _account, address _owner, uint256 _amount) internal {
    _balances[_account] += _amount;
    _delegatedBalances[_owner][_account] += _amount;

    if (_account != _owner) {
      _delegations[_owner].addSilent(_account);
      _delegatedBy[_account].addSilent(_owner);
    }
  }

  function _debitAccount(address _account, address _owner, uint256 _amount) internal {
    require(_balances[_account] >= _amount, "LiquidRA: Not enough funds");
    require(_delegatedBalances[_owner][_account] >= _amount, "LiquidRA: Not enough funds");

    _balances[_account] -= _amount;
    _delegatedBalances[_owner][_account] -= _amount;

    if (_delegatedBalances[_owner][_account] == 0) {
      if (_account != _owner) {
        _delegations[_owner].remove(_account);
        _delegatedBy[_account].remove(_owner);
      }
    }
  }

  function _revokeDelegated(address _account, uint _amount) internal {
    require(_delegatedBalances[msg.sender][_account] >= _amount, "Not enough funds");

    _balances[_account] -= _amount;
    _delegatedBalances[msg.sender][_account] -= _amount;

    if (_delegatedBalances[msg.sender][_account] == 0) {
      _delegations[msg.sender].remove(_account);
      _delegatedBy[_account].remove(msg.sender);
    }

    _creditAccount(msg.sender, msg.sender, _amount);
  }

  // GETTERS

  // ERC20 compatible
  function balanceOf(address _owner) public view returns (uint256) {
    return _balances[_owner];
  }

  function ownedBalanceOf(address _owner) public view returns (uint256) {
    return _ownedBalances[_owner];
  }

  function delegatedBalanceOf(address _delegate, address _owner) public view returns (uint256) {
    return _delegatedBalances[_owner][_delegate];
  }

  function delegations(address _owner) public view returns (address[] memory) {
    return _delegations[_owner].elements();
  }

  function delegationCount(address _owner) public view returns (uint256) {
    return _delegations[_owner].size();
  }

  function delegatedBy(address _account) public view returns (address[] memory) {
    return _delegatedBy[_account].elements();
  }

  function delegatedByCount(address _account) public view returns (uint256) {
    return _delegatedBy[_account].size();
  }

  // ERC20 compatible
  function totalSupply() public view returns (uint256) {
    return totalStakedSpace;
  }

  // Ping-Pong Handshake
  function ping() public pure returns (bytes32) {
    return bytes32("pong");
  }
}
