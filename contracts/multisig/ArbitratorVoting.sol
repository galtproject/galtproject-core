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

import "../collections/ArraySet.sol";
import "./ArbitratorsMultiSig.sol";
import "../traits/Permissionable.sol";
import "./OracleStakesAccounting.sol";
import "../SpaceReputationAccounting.sol";

contract ArbitratorVoting is Permissionable {
  using ArraySet for ArraySet.AddressSet;

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

  OracleStakesAccounting oracleStakesAccounting;
  SpaceReputationAccounting spaceReputationAccounting;

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


  // Candidate address => Candidate details
  mapping(address => Candidate) candidates;

  struct Oracle {
    address candidate;
    uint256 weight;
  }

  struct Delegate {
    mapping(address => uint256) distributedReputation;
    ArraySet.AddressSet candidates;
  }

  struct Candidate {
    bool active;
    address next;
    address prev;
    uint256 weight;
  }

  // HEAD. Candidate from Top-N with the highest weight
  address public candidatesHead;
  // TAIL. candidate from Top-N with the lower weight
  address public candidatesTail;

  uint256 public totalSpaceReputation;
  uint256 public totalOracleStakes;

  uint256 candidateCounter;

  uint256 public n;
  uint256 public m;

  ArbitratorsMultiSig arbitratorsMultiSig;

  constructor(
    ArbitratorsMultiSig _arbitratorsMultiSig,
    SpaceReputationAccounting _spaceReputationAccounting,
    OracleStakesAccounting _oracleStakesAccounting
  )
    public
  {
    arbitratorsMultiSig = _arbitratorsMultiSig;
    spaceReputationAccounting = _spaceReputationAccounting;
    oracleStakesAccounting = _oracleStakesAccounting;
    n = 10;
  }


  function recalculate(address _candidate) external {
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

    uint256 weight = 0;

    if (combinedRatio > 0) {
      weight = combinedRatio / 2;
    }

    candidates[_candidate].weight = weight;

    emit Recalculate(
      _candidate,
      candidateSpaceReputation,
      candidateOracleStake,
      totalSpaceReputation,
      totalOracleStakes,
      spaceReputationRatio,
      oracleStakeRatio,
      combinedRatio,
      weight
    );

    if (weight == 0) {
      if (candidates[_candidate].active) {
        emit RemoveFromList(_candidate);
        _removeFromList(_candidate);
      }
      return;
    }

    // an empty list
    if (candidateCounter == 0) {
      candidatesHead = _candidate;
      candidates[_candidate].active = true;
      candidateCounter = 1;

      return;
    }

    // one-element list
    if (candidateCounter == 1) {
      uint256 headWeight = candidates[candidatesHead].weight;
      if (candidates[_candidate].active) {
        assert(_candidate == candidatesHead);
        assert(address(0) == candidatesTail);
      } else {
        if (weight >= headWeight) {
          // move head to the tail
          candidatesTail = candidatesHead;
          // insert as HEAD
          candidatesHead = _candidate;
        } else {
          // insert as TAIL
          candidatesTail = _candidate;
        }

        candidates[candidatesHead].next = candidatesTail;
        candidates[candidatesTail].prev = candidatesHead;
        candidates[_candidate].active = true;
        candidateCounter = 2;
      }

      return;
    }

    // >= 2 elements list
    // existing element
    if (candidates[_candidate].active) {
      emit Update();
      _recalculateActive(_candidate, weight);
    // new element
    } else {
      emit New();
      _insertNew(_candidate, weight);
    }
  }

  function _insertNew(address _candidate, uint256 weight) internal {
    Candidate storage c = candidates[_candidate];
    Candidate storage currentHead = candidates[candidatesHead];
    Candidate storage currentTail = candidates[candidatesTail];

    c.active = true;

    // weight > HEAD
    if (weight > currentHead.weight) {
      emit InsertHead();
      currentHead.prev = _candidate;
      c.next = candidatesHead;
      candidatesHead = _candidate;
    } else if (weight < currentTail.weight) {
      // skip if limit is already reached
      if (candidateCounter >= n) {
        emit LimitReached();
        return;
      }

      emit InsertTail();

      currentTail.next = _candidate;
      c.prev = candidatesTail;
      candidatesTail = _candidate;
    // HEAD > weight > TAIL
    } else {
      emit InsertMiddle();

      address current = candidatesHead;
      address nextAfter = candidates[current].next;

      while (weight < candidates[nextAfter].weight) {
        current = candidates[current].next;
        nextAfter = candidates[current].next;
      }

      // relink
      candidates[current].next = _candidate;
      candidates[nextAfter].prev = _candidate;
      candidates[_candidate].next = nextAfter;
      candidates[_candidate].prev = current;
    }
    // else do nothing

    if (candidateCounter >= n) {
      emit CutTail();
      address prev = candidates[candidatesTail].prev;
      delete candidates[prev].next;
      delete candidates[candidatesTail].prev;
      candidatesTail = prev;
    } else {
      candidateCounter += 1;
    }
  }

  function _recalculateActive(address _candidate, uint256 weight) internal {
    Candidate storage c = candidates[_candidate];
    Candidate storage currentHead = candidates[candidatesHead];
    Candidate storage currentTail = candidates[candidatesTail];

    if (_candidate == candidatesHead) {
      if (weight > candidates[currentHead.next].weight) {
        emit KeepHead();
        return;
      }

      emit DeposeHead();

      if (candidateCounter == 2) {
        delete candidates[candidatesHead].next;
        delete candidates[candidatesTail].prev;

        candidatesHead = candidatesTail;
        candidatesTail = _candidate;

        candidates[candidatesHead].next = candidatesTail;
        candidates[candidatesTail].prev = candidatesHead;
        return;
      }

      // pop head (now it's not the HEAD)
      delete candidates[currentHead.next].prev;
      candidatesHead = currentHead.next;
    } else if (_candidate == candidatesTail) {
      if (weight < candidates[currentTail.prev].weight) {
        emit KeepTail();
        return;
      }

      emit DeposeTail();

      if (candidateCounter == 2) {
        delete candidates[candidatesHead].next;
        delete candidates[candidatesTail].prev;

        candidatesTail = candidatesHead;
        candidatesHead = _candidate;

        candidates[candidatesHead].next = candidatesTail;
        candidates[candidatesTail].prev = candidatesHead;
        return;
      }

      // pop tail (now it's not the HEAD)
      delete candidates[currentTail.prev].next;
      candidatesTail = currentTail.prev;
    }  else {
      candidates[c.prev].next = c.next;
      candidates[c.next].prev = c.prev;

      if (weight > currentHead.weight) {
        emit AppointHead();

        currentHead.prev = _candidate;
        c.next = candidatesHead;
        candidatesHead = _candidate;

        return;
      } else if (weight < currentTail.weight) {
        emit AppointTail();

        currentTail.next = _candidate;
        c.prev = candidatesTail;
        candidatesTail = _candidate;

        return;
      }
    }

    // walk from HEAD to TAIL
    address currentAddress = candidatesHead;
    address next = candidates[currentAddress].next;
    // TODO: case when it is a head now

    while (currentAddress != address(0)) {
      // TODO: limit not reahed
      if (next == address(0)) {
        candidates[currentAddress].next = _candidate;
        candidates[_candidate].prev = currentAddress;
        return;
      }

      if (weight < candidates[currentAddress].weight && weight > candidates[next].weight) {
        candidates[currentAddress].next = _candidate;
        candidates[_candidate].prev = currentAddress;
        candidates[next].prev = _candidate;
        candidates[_candidate].next = next;
        return;
      }

      currentAddress = candidates[currentAddress].next;
      next = candidates[currentAddress].next;
    }

    // something went wrong;
    assert(false);
  }

  function _removeFromList(address _candidate) internal {
    assert(candidateCounter > 0);

    Candidate storage c = candidates[candidatesHead];

    candidates[_candidate].active = false;

    if (candidateCounter == 1) {
      assert(_candidate == candidatesHead);
      delete candidatesHead;
      candidateCounter = 0;

      return;
    }

    if (candidateCounter == 2) {
      assert(_candidate == candidatesHead || _candidate == candidatesTail);

      Candidate storage t = candidates[candidatesTail];

      if (_candidate == candidatesHead) {
        candidatesHead = candidatesTail;
      }

      delete c.next;
      delete t.prev;
      delete candidatesTail;
      candidateCounter -= 1;
      return;
    }

    candidateCounter -= 1;

    // walk from head till tail
    Candidate storage h = candidates[candidatesHead];
    Candidate storage t = candidates[candidatesTail];

    // if tail
    if (_candidate == candidatesTail) {
      delete candidates[t.prev].next;
      candidatesTail = t.prev;
      delete t.prev;

      return;
    }

    // if head
    if (_candidate == candidatesHead) {
      delete candidates[h.next].prev;
      candidatesHead = h.next;
      delete h.next;

      return;
    }

    // walk from HEAD to TAIL
    address currentAddress = candidatesHead;
    address next = candidates[currentAddress].next;

    while (next != address(0)) {
      if (_candidate == next) {
        address nextAfter = candidates[next].next;
        candidates[currentAddress].next = nextAfter;
        candidates[nextAfter].prev = currentAddress;

        delete candidates[next].prev;
        delete candidates[next].next;

        return;
      }

      currentAddress = candidates[currentAddress].next;
      next = candidates[currentAddress].next;
    }
  }

  // 'Oracle Stake Locking' accounting only inside this contract
  function voteWithOracleStake(address _candidate) external {
    // TODO: check oracle is activev

    uint256 newWeight = uint256(oracleStakesAccounting.balanceOf(msg.sender));
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

    reputationBalance[_candidate] == _amount;
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

  // TODO: define permissions
  function setMofN(
    uint256 _m,
    uint256 _n
  )
    external
  {
    // NOTICE: n < 3 doesn't supported by recalculation logic
    require(2 <= _m, "Should satisfy `2 <= m`");
    require(3 <= _n, "Should satisfy `3 <= n`");
    require(_m <= _n, "Should satisfy `m <= n`");

    m = _m;
    n = _n;
  }

  function pushArbitrators() external {
    address[] memory c = getCandidates();

    require(c.length >= 3, "List should be L >= 3");
    assert(c.length >= m);

    arbitratorsMultiSig.setArbitrators(m, n, c);
  }

  // Getters
  function getCandidates() public view returns (address[]) {
    if (candidateCounter == 0) {
      return;
    }

    address[] memory c = new address[](candidateCounter);
    address currentAddress = candidatesHead;

    // head to tail
    for (uint256 i = 0; i < candidateCounter; i++) {
      c[i] = currentAddress;

      currentAddress = candidates[currentAddress].next;
    }

    return c;
  }

  function getOracleStakes(address _candidate) external view returns (uint256) {
    return oracleStakes[_candidate];
  }

  function getSpaceReputation(address _delegate) external view returns (uint256) {
    return reputationBalance[_delegate];
  }

  function getWeight(address _candidate) external view returns (uint256) {
    return candidates[_candidate].weight;
  }

  function isCandidateInList(address _candidate) external view returns (bool) {
    return candidates[_candidate].active;
  }

  function getSize() external view returns (uint256 size) {
    return candidateCounter;
  }
}
