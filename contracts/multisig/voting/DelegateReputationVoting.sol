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
import "../../collections/AddressLinkedList.sol";
import "./interfaces/IArbitrationCandidateTop.sol";
import "../interfaces/IArbitrationConfig.sol";
import "./interfaces/IDelegateReputationVoting.sol";

contract DelegateReputationVoting is IDelegateReputationVoting {
  using ArraySet for ArraySet.AddressSet;
  using AddressLinkedList for AddressLinkedList.Data;

  event ReputationMint(address delegate, uint256 amount);
  event ReputationBurn(address delegate, uint256 amount);
  event ReputationChanged(address _delegate, uint256 prevReputation, uint256 newReputation);

  event ReputationBurnWithRevoke(
    address delegate,
    uint256 remainder,
    uint256 limit
  );

  // limit for Reputation delegation
  uint256 private constant DELEGATE_CANDIDATES_LIMIT = 5;
  uint256 private constant DECIMALS = 10**6;

  // Delegate => Delegate details
  mapping(address => Delegate) private delegatedReputation;
  // Candidate/Delegate => locked
  mapping(address => uint256) private lockedReputation;
  // Candidate/Delegate => balance
  mapping(address => uint256) private reputationBalance;

  struct Delegate {
    mapping(address => uint256) distributedReputation;
    ArraySet.AddressSet candidates;
  }

  bytes32 public roleReputationNotifier;
  uint256 public totalReputation;

  IArbitrationConfig arbitrationConfig;

  constructor(
    IArbitrationConfig _arbitrationConfig,
    bytes32 _roleSpaceReputationNotifier
  )
    public
  {
    arbitrationConfig = _arbitrationConfig;
    roleReputationNotifier = _roleSpaceReputationNotifier;
  }

  modifier onlySpaceReputationNotifier() {
    require(
      arbitrationConfig.ggr().getACL().hasRole(msg.sender, roleReputationNotifier),
      "Invalid notifier"
    );

    _;
  }

  function grantReputation(address _candidate, uint256 _amount) external {
    require(lockedReputation[msg.sender] >= _amount, "Not enough reputation");
    require(delegatedReputation[msg.sender].distributedReputation[msg.sender] >= _amount, "Not enough reputation");
    require(delegatedReputation[msg.sender].candidates.size() <= 5, "Delegate reputation limit is 5 candidates");

    delegatedReputation[msg.sender].distributedReputation[msg.sender] -= _amount;
    delegatedReputation[msg.sender].distributedReputation[_candidate] += _amount;

    reputationBalance[msg.sender] -= _amount;
    reputationBalance[_candidate] += _amount;

    delegatedReputation[msg.sender].candidates.addSilent(_candidate);
  }

  function revokeReputation(address _candidate, uint256 _amount) external {
    require(lockedReputation[_candidate] >= _amount, "Not enough reputation");
    require(delegatedReputation[msg.sender].distributedReputation[_candidate] >= _amount, "Not enough reputation");

    delegatedReputation[msg.sender].distributedReputation[_candidate] -= _amount;
    delegatedReputation[msg.sender].distributedReputation[msg.sender] += _amount;

    reputationBalance[_candidate] -= _amount;
    reputationBalance[msg.sender] += _amount;

    if (delegatedReputation[msg.sender].distributedReputation[_candidate] == 0) {
      delegatedReputation[msg.sender].candidates.remove(_candidate);
    }
  }

  // @dev SpaceOwner balance changed
  // Handles SRA stakeReputation and revokeReputation calls
  // TODO: fix this using ggr
  // onlySpaceReputationNotifier
  // onlyRole(SPACE_REPUTATION_NOTIFIER)
  function onDelegateReputationChanged(
    address _delegate,
    uint256 _newLocked
  )
    external
    onlySpaceReputationNotifier
  {
    // need more details
    uint256 currentLocked = lockedReputation[_delegate];
    uint256 selfDelegated = delegatedReputation[_delegate].distributedReputation[_delegate];

    emit ReputationChanged(_delegate, currentLocked, _newLocked);

    // mint
    if (_newLocked >= currentLocked) {
      uint256 diff = _newLocked - currentLocked;

      lockedReputation[_delegate] += diff;
      delegatedReputation[_delegate].distributedReputation[_delegate] += diff;
      reputationBalance[_delegate] += diff;
      totalReputation += diff;

      emit ReputationMint(_delegate, diff);
    // burn
    } else {
      // diff is always positive, not 0
      uint256 diff = currentLocked - _newLocked;
      assert(diff <= currentLocked);
      assert(diff > 0);

      lockedReputation[_delegate] -= diff;
      totalReputation -= diff;

      // delegate has enough reputation on his own delegated account, no need to iterate over his candidates
      if (diff <= selfDelegated) {
        delegatedReputation[_delegate].distributedReputation[_delegate] -= diff;
        reputationBalance[_delegate] -= diff;

        emit ReputationBurn(_delegate, diff);

        return;
      }

      uint256 ownedDelegatedBalance = selfDelegated;

      delegatedReputation[_delegate].distributedReputation[_delegate] = 0;
      reputationBalance[_delegate] -= ownedDelegatedBalance;

      uint256 remainder = diff - ownedDelegatedBalance;
      assert(remainder > 0);

      _revokeDelegatedReputation(_delegate, remainder);
    }
  }

  function _revokeDelegatedReputation(address _delegate, uint256 _revokeAmount) internal {
    address[] memory candidatesToRevoke = delegatedReputation[_delegate].candidates.elements();
    uint256 len = candidatesToRevoke.length;
    assert(candidatesToRevoke.length > 0);
    uint256 remainder = _revokeAmount;

    assert(len <= DELEGATE_CANDIDATES_LIMIT);

    emit ReputationBurnWithRevoke(_delegate, remainder, len);

    for (uint256 i = 0; i < len; i++) {
      address candidate = candidatesToRevoke[i];
      uint256 candidateReputation = delegatedReputation[_delegate].distributedReputation[candidate];

      if (candidateReputation <= remainder) {
        assert(reputationBalance[candidate] >= candidateReputation);

        reputationBalance[candidate] -= candidateReputation;
        delegatedReputation[_delegate].distributedReputation[candidate] = 0;

        remainder -= candidateReputation;
      } else {
        assert(reputationBalance[candidate] >= remainder);

        reputationBalance[candidate] -= remainder;
        delegatedReputation[_delegate].distributedReputation[candidate] -= remainder;
        return;
      }
    }
  }

  function totalSupply() external view returns(uint256) {
    return totalReputation;
  }

  function balanceOf(address _candidate) external view returns(uint256) {
    return reputationBalance[_candidate];
  }
  
  function shareOf(address _candidate, uint256 _decimals) external view returns(uint256) {
    uint256 reputation = reputationBalance[_candidate];

    if (reputation == 0) { return 0; }
    if (_decimals == 0) { return 0; }

    return (reputationBalance[_candidate] * _decimals) / totalReputation;
  }
}
