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

import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../SpaceReputationAccounting.sol";
import "./ArbitratorsMultiSig.sol";
import "./OracleStakesAccounting.sol";
import "./ArbitrationConfig.sol";
import "./ArbitratorStakeAccounting.sol";
import "../collections/AddressLinkedList.sol";
import "../collections/VotingLinkedList.sol";
import "./interfaces/IArbitratorVoting.sol";

contract ArbitratorVoting is IArbitratorVoting, Permissionable {
  using ArraySet for ArraySet.AddressSet;
  using AddressLinkedList for AddressLinkedList.Data;

  event LimitReached();
  event Update();
  event New();
  event CutTail();

  event InsertHead();
  event InsertMiddle();
  event InsertTail();

  event KeepHead();
  event KeepTail();
  event AppointHead();
  event AppointTail();
  event DeposeHead();
  event DeposeTail();

  event Middle(address candidate, uint256 weight);
  event RemoveFromList(address candidate);

  event ReputationMint(address delegate, uint256 amount);
  event ReputationBurn(address delegate, uint256 amount);
  event ReputationChanged(address _delegate, uint256 prevReputation, uint256 newReputation);

  event OracleStakeChanged(
    address oracle,
    address candidate,
    uint256 currentOracleWeight,
    uint256 newOracleWeight,
    uint256 newCandidateWeight
  );

  event Recalculate(
    address delegate,
    bool isIgnored,
    uint256 candidateSpaceReputation,
    uint256 candidateOracleStake,
    uint256 totalSpaceReputation,
    uint256 totalOracleStakes,
    uint256 spaceReputationRatio,
    uint256 oracleStakeRatio,
    uint256 combinedRatio,
    uint256 weight
  );

  event ReputationBurnWithRevoke(
    address delegate,
    uint256 remainder,
    uint256 limit
  );

  // limit for SpaceReputation delegation
  uint256 private constant DELEGATE_CANDIDATES_LIMIT = 5;
  uint256 private constant DECIMALS = 10**6;

  string public constant ORACLE_STAKES_NOTIFIER = "oracle_stakes_notifier";
  string public constant SPACE_REPUTATION_NOTIFIER = "space_reputation_notifier";

  // Oracle address => Oracle details
  mapping(address => Oracle) private oracles;
  // Oracle Candidate => totalWeights
  mapping(address => uint256) private oracleStakes;

  // Delegate => Delegate details
  mapping(address => Delegate) private delegatedReputation;
  // Candidate/Delegate => locked
  mapping(address => uint256) private lockedReputation;
  // Candidate/Delegate => balance
  mapping(address => uint256) private reputationBalance;
  // Candidate => isIgnored
  mapping(address => bool) private ignoredCandidates;

  uint256 public totalWeight;

  struct Oracle {
    address candidate;
    uint256 weight;
  }

  struct Delegate {
    mapping(address => uint256) distributedReputation;
    ArraySet.AddressSet candidates;
  }

  VotingLinkedList.Data votingData;
  AddressLinkedList.Data votingList;

  uint256 public totalSpaceReputation;
  uint256 public totalOracleStakes;

  ArbitrationConfig arbitrationConfig;

  constructor(
    ArbitrationConfig _arbitrationConfig
  )
    public
  {
    arbitrationConfig = _arbitrationConfig;
    votingList.withTail = true;
    // FIX: should rely on arbitrationConfig
    votingData.maxCount = _arbitrationConfig.n();
  }

  function recalculate(address _candidate) external {
    uint256 weightBefore = getWeight(_candidate);
    uint256 candidateSpaceReputation = lockedReputation[_candidate];
    uint256 candidateOracleStake = oracleStakes[_candidate];
    uint256 spaceReputationRatio = 0;
    uint256 oracleStakeRatio = 0;

    if (candidateSpaceReputation > 0) {
      spaceReputationRatio = candidateSpaceReputation * DECIMALS / totalSpaceReputation;
    }

    if (candidateOracleStake > 0) {
      oracleStakeRatio = candidateOracleStake * DECIMALS / totalOracleStakes;
    }

    uint256 combinedRatio = (spaceReputationRatio + oracleStakeRatio);
    uint256 weightAfter = 0;
    bool ignore = (ignoredCandidates[_candidate] == true);

    if (combinedRatio > 0 && !ignore) {
      weightAfter = combinedRatio / 2;
    }

    emit Recalculate(
      _candidate,
      ignore,
      candidateSpaceReputation,
      candidateOracleStake,
      totalSpaceReputation,
      totalOracleStakes,
      spaceReputationRatio,
      oracleStakeRatio,
      combinedRatio,
      weightAfter
    );

    if (weightBefore > weightAfter) {
      totalWeight -= (weightBefore - weightAfter);
    } else {
      totalWeight += (weightAfter - weightBefore);
    }

    VotingLinkedList.insertOrUpdate(votingList, votingData, _candidate, weightAfter);
  }

  // 'Oracle Stake Locking' accounting only inside this contract
  function voteWithOracleStake(address _candidate) external {
    // TODO: check oracle is activev

    uint256 newWeight = uint256(arbitrationConfig.getOracleStakes().balanceOf(msg.sender));
    require(newWeight > 0, "Weight is 0 or less");

    address previousCandidate = oracles[msg.sender].candidate;

    // If already voted
    if (previousCandidate != address(0)) {
      oracleStakes[previousCandidate] -= oracles[msg.sender].weight;
    }

    oracles[msg.sender].weight = newWeight;
    oracles[msg.sender].candidate = _candidate;
    oracleStakes[_candidate] += newWeight;
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
  function onDelegateReputationChanged(
    address _delegate,
    uint256 _newLocked
  )
    external
    onlyRole(SPACE_REPUTATION_NOTIFIER)
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
      totalSpaceReputation += diff;

      emit ReputationMint(_delegate, diff);
    // burn
    } else {
      // diff is always positive, not 0
      uint256 diff = currentLocked - _newLocked;
      assert(diff <= currentLocked);
      assert(diff > 0);

      lockedReputation[_delegate] -= diff;
      totalSpaceReputation -= diff;

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

  // TODO: fix oracle stake change logic
  // @dev Oracle balance changed
  function onOracleStakeChanged(
    address _oracle,
    uint256 _newWeight
  )
    external
    onlyRole(ORACLE_STAKES_NOTIFIER)
  {
    address currentCandidate = oracles[_oracle].candidate;
    uint256 currentWeight = oracles[_oracle].weight;

    totalOracleStakes = totalOracleStakes + _newWeight - currentWeight;

    // The oracle hadn't vote or revoked his vote
    if (currentCandidate == address(0)) {
      return;
    }

    // Change candidate weight
    oracleStakes[currentCandidate] = oracleStakes[currentCandidate] - currentWeight + _newWeight;

    // Change oracle weight
    oracles[_oracle].weight = _newWeight;

    emit OracleStakeChanged(
      _oracle,
      currentCandidate,
      currentWeight,
      _newWeight,
      oracleStakes[currentCandidate]
    );
  }

  function pushArbitrators() external {
    arbitrationConfig
      .getMultiSig()
      .setArbitrators(getCandidatesWithStakes());
  }

  function ignoreMe(bool _value) external {
    ignoredCandidates[msg.sender] = _value;
  }

  // Getters

  function getCandidatesWithStakes() public view returns (address[] memory) {
    if (votingList.count == 0) {
      return new address[](0);
    }

    IArbitratorStakeAccounting arbitratorStakes = arbitrationConfig.getArbitratorStakes();
    address[] memory p = new address[](votingList.count);
    uint256 minimalStake = arbitrationConfig.minimalArbitratorStake();
    uint256 pI = 0;

    address currentAddress = votingList.head;

    for (uint256 i = 0; i < p.length; i++) {
      if (arbitratorStakes.balanceOf(currentAddress) >= minimalStake) {
        p[pI] = currentAddress;
        pI += 1;
      }

      currentAddress = votingList.nodes[currentAddress].next;
    }

    if (pI == 0) {
      return new address[](0);
    }

    // p.length = pI
    assembly { mstore(p, pI) }

    return p;
  }

  function getCandidates() public view returns (address[] memory) {
    if (votingList.count == 0) {
      return new address[](0);
    }

    address[] memory c = new address[](votingList.count);

    address currentAddress = votingList.head;

    for (uint256 i = 0; i < c.length; i++) {
      c[i] = currentAddress;

      currentAddress = votingList.nodes[currentAddress].next;
    }

    return c;
  }

  function getOracleShare(address _oracle) external view returns (uint256) {
    return oracleStakes[_oracle] * 100 / totalOracleStakes;
  }

  function getDelegateShare(address _delegate) external view returns (uint256) {
    return reputationBalance[_delegate] * 100 / totalSpaceReputation;
  }

  function getOracleStakes(address _oracle) external view returns (uint256) {
    return oracleStakes[_oracle];
  }

  function getSpaceReputation(address _delegate) external view returns (uint256) {
    return reputationBalance[_delegate];
  }

  function getShare(address[] calldata _addresses) external view returns (uint256) {
    // delegates
    uint256 delegatesAccumulator = 0;
    // oracles
    uint256 oraclesAccumulator = 0;

    for (uint256 i = 0; i < _addresses.length; i++) {
      delegatesAccumulator += reputationBalance[_addresses[i]];
      oraclesAccumulator += oracleStakes[_addresses[i]];
    }

    uint256 totalShare = 0;

    if (totalSpaceReputation != 0) {
      totalShare += delegatesAccumulator * 100 / totalSpaceReputation;
    }

    if (totalOracleStakes != 0) {
      totalShare += oraclesAccumulator * 100 / totalOracleStakes;
    }

    return totalShare / 2;
  }

  function getWeight(address _candidate) public view returns (uint256) {
    return votingData.votes[_candidate];
  }

  function isCandidateInList(address _candidate) external view returns (bool) {
    return VotingLinkedList.isExists(votingList, _candidate);
  }

  function isIgnored(address _candidate) external view returns (bool) {
    return ignoredCandidates[_candidate];
  }

  function getSize() external view returns (uint256 size) {
    return votingList.count;
  }
}
