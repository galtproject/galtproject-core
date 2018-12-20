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

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./collections/ArraySet.sol";
import "./traits/Permissionable.sol";
import "./SpaceToken.sol";
import "./multisig/ArbitratorsMultiSig.sol";
import "./multisig/ArbitratorVoting.sol";


contract SpaceReputationAccounting is Permissionable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  string public constant ROLE_SPACE_TOKEN = "space_token";

  SpaceToken spaceToken;

  // Delegate => balance
  mapping(address => uint256) private _balances;

  // Reputation Owner => (Delegate => balance))
  mapping(address => mapping(address => uint256)) private _delegations;

  // Delegate => (MultiSig => locked amount)
  mapping(address => mapping(address => uint256)) private _locks;

  // HACK: there is no token area accounting anywhere else yet
  mapping(uint256 => uint256) public tokenArea;

  // Token #ID => isStaked
  mapping(uint256 => bool) public tokenStaked;

  // L0
  uint256 private totalStakedSpace;


  constructor(SpaceToken _spaceToken) public {
    _addRoleTo(address(_spaceToken), ROLE_SPACE_TOKEN);
    spaceToken = _spaceToken;
  }

  modifier onlySpaceTokenContract() {
    require(msg.sender == address(spaceToken), "Invalid sender. SpaceToken contract expected");
    _;
  }

  modifier onlySpaceTokenOwner(uint256 _spaceTokenId) {
    require(msg.sender == spaceToken.ownerOf(_spaceTokenId), "Invalid sender. Token owner expected.");
    _;
  }

  // MODIFIERS

  // HACK: no permissions check since this method is a temporary hack
  function setTokenArea(uint256 _spaceTokenId, uint256 _area) external {
    tokenArea[_spaceTokenId] = _area;
  }

  function stake(
    uint256 _spaceTokenId
  )
    external
    onlySpaceTokenOwner(_spaceTokenId)
  {
    require(tokenStaked[_spaceTokenId] == false, "SpaceToken is already staked");

    // TODO: fetch token weight from the correct source
    uint256 area = tokenArea[_spaceTokenId];
    assert(area > 0);

    totalStakedSpace += area;

    _balances[msg.sender] += area;
    _delegations[msg.sender][msg.sender] += area;
    tokenStaked[_spaceTokenId] = true;
  }

  // Transfer owned reputation
  function delegate(address _to, address _owner, uint256 _amount) external {
    require(_balances[msg.sender] >= _amount, "Not enough funds");
    require(_delegations[_owner][msg.sender] >= _amount, "Not enough funds");
    // TODO: check space owner

    _balances[msg.sender] -= _amount;
    _delegations[_owner][msg.sender] -= _amount;

    assert(_balances[msg.sender] >= 0);
    assert(_delegations[_owner][msg.sender] >= 0);

    _balances[_to] += _amount;
    _delegations[_owner][_to] += _amount;
  }

  function revoke(address _from, uint256 _amount) external {
    require(_balances[_from] >= _amount, "Not enough funds");
    require(_delegations[msg.sender][_from] >= _amount, "Not enough funds");

    _balances[_from] -= _amount;
    _delegations[msg.sender][_from] -= _amount;

    assert(_balances[_from] >= 0);
    assert(_delegations[msg.sender][_from] >= 0);

    _balances[msg.sender] += _amount;
    _delegations[msg.sender][msg.sender] += _amount;
  }

  function revokeLocked(address _delegate, address _multiSig, uint256 _amount) external {
    require(_delegations[msg.sender][_delegate] >= _amount, "Not enough funds");
    require(_locks[_delegate][_multiSig] >= _amount, "Not enough funds");

    _delegations[msg.sender][_delegate] -= _amount;
    _locks[_delegate][_multiSig] -= _amount;
    _delegations[msg.sender][msg.sender] += _amount;
    _balances[msg.sender] += _amount;

    address voting = ArbitratorsMultiSig(_multiSig).arbitratorVoting();
    ArbitratorVoting(voting).onDelegateReputationChanged(_delegate, _locks[_delegate][_multiSig]);
  }

  function lockReputation(address _multiSig, uint256 _amount) external {
    require(_balances[msg.sender] >= _amount, "Insufficient amount to lock");

    _balances[msg.sender] -= _amount;
    _locks[msg.sender][_multiSig] += _amount;

    address voting = ArbitratorsMultiSig(_multiSig).arbitratorVoting();
    ArbitratorVoting(voting).onDelegateReputationChanged(msg.sender, _locks[msg.sender][_multiSig]);
  }

  function unlockReputation(address _multiSig, uint256 _amount) external {
    uint256 beforeUnlock = _locks[msg.sender][_multiSig];
    uint256 afterUnlock = _locks[msg.sender][_multiSig] - _amount;

    require(beforeUnlock >= _amount, "Insufficient amount to lock");
    require(afterUnlock >= 0, "Insufficient amount to lock");
    require(afterUnlock < _locks[msg.sender][_multiSig], "Insufficient amount to lock");

    _locks[msg.sender][_multiSig] -= _amount;
    _balances[msg.sender] += _amount;

    address voting = ArbitratorsMultiSig(_multiSig).arbitratorVoting();
    ArbitratorVoting(voting).onDelegateReputationChanged(msg.sender, afterUnlock);
  }

  function unstake(
    uint256 _spaceTokenId
  )
    external
    onlySpaceTokenOwner(_spaceTokenId)
  {
    require(tokenStaked[_spaceTokenId] == true, "SpaceToken is already staked");

    // TODO: fetch token weight from the correct source
    uint256 area = tokenArea[_spaceTokenId];
    assert(area > 0);

    require(_balances[msg.sender] >= area, "Not enough funds to unstake");
    require(_delegations[msg.sender][msg.sender] >= area, "Not enough funds to unstake");

    totalStakedSpace -= area;

    _balances[msg.sender] -= area;
    _delegations[msg.sender][msg.sender] -= area;
    tokenStaked[_spaceTokenId] = false;
  }

  // EVENTS (PERMISSION CHECKS)
  function requireUnstaked(uint256 _spaceTokenId) external {
    require(tokenStaked[_spaceTokenId] == false, "Token is staked and cannot be moved");
  }

  // GETTERS

  function lockedBalanceOf(address _owner, address _multiSig) public view returns (uint256) {
    return _locks[_owner][_multiSig];
  }

  // ERC20 compatible
  function balanceOf(address owner) public view returns (uint256) {
    return _balances[owner];
  }

  // ERC20 compatible
  function totalSupply() public returns (uint256) {
    return totalStakedSpace;
  }
}
