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

import "../collections/ArraySet.sol";
import "./ArbitratorsMultiSig.sol";
import "../traits/Permissionable.sol";
import "./OracleStakesAccounting.sol";
import "../SpaceReputationAccounting.sol";

contract ArbitratorVoting is Permissionable {
//  using Bytes32Set for ArraySet.Bytes32Set;
  using ArraySet for ArraySet.AddressSet;

  event LimitReached();
  event Update();
  event New();

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

  event OracleStakeChanged(
    address oracle,
    address candidate,
    uint256 currentOracleWeight,
    uint256 newOracleWeight,
    uint256 newCandidateWeight
  );

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
  mapping(address => Delegate) private delegates;
  // Candidate/Delegate => balance
  mapping(address => uint256) private spaceReputation;

  // Candidate address => Candidate details
  mapping(address => Candidate) candidates;

  struct Oracle {
    address candidate;
    uint256 weight;
  }

  struct Delegate {
    mapping(address => uint256) distributedWeight;
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

  function recalculate(address _candidate) external {
    uint256 candidateSpaceReputation = spaceReputation[_candidate];
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

    candidateCounter += 1;

    if (candidateCounter > n) {
      address prev = candidates[candidatesTail].prev;
      delete candidates[prev].next;
      delete candidates[candidatesTail].prev;
      candidatesTail = prev;
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

    while(currentAddress != address(0)) {
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

    while(next != address(0)) {
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
    require(spaceReputation[msg.sender] >= _amount, "Not enough reputation");

    delegates[msg.sender].distributedWeight[_candidate] += _amount;
    spaceReputation[msg.sender] -= _amount;
    spaceReputation[_candidate] += _amount;
  }

  function revokeReputation(address _candidate, uint256 _amount) external {
    require(spaceReputation[_candidate] >= _amount, "Not enough reputation");
    require(delegates[msg.sender].distributedWeight[_candidate] >= _amount, "Not enough reputation");

    delegates[msg.sender].distributedWeight[_candidate] -= _amount;
    spaceReputation[msg.sender] += _amount;
    spaceReputation[_candidate] -= _amount;
  }
  event ReputationChanged(address _delegate, uint256 prevReputation, uint256 newReputation);

  // @dev SpaceOwner balance changed
  // Handles SRA stakeReputation and revokeReputation calls
  function onDelegateReputationChanged(
    address _delegate,
    uint256 _newWeight
  )
    external
    onlyRole(SPACE_REPUTATION_NOTIFIER)
  {
    uint256 currentWeight = spaceReputation[_delegate];
    emit ReputationChanged(_delegate, currentWeight, _newWeight);

    if (_newWeight >= currentWeight) {
      // mint
      uint256 diff = _newWeight - currentWeight;
      spaceReputation[_delegate] += diff;
      totalSpaceReputation += diff;

      emit ReputationMint(_delegate, diff);
    } else {
      // burn
      uint256 diff = currentWeight - _newWeight;
      assert(diff <= currentWeight);
      uint256 remainder = diff;

      spaceReputation[_delegate] -= diff;
      remainder -=currentWeight;

      totalSpaceReputation -= diff;

      if (remainder == 0) {
        emit ReputationBurn(_delegate, diff);
        return;
      }

      address[] memory candidatesToRevoke = delegates[_delegate].candidates.elements();

      uint256 limit = 0;
      if (candidateCounter < DELEGATE_CANDIDATES_LIMIT) {
        limit = delegates[_delegate].candidates.size();
      } else {
        limit = DELEGATE_CANDIDATES_LIMIT;
      }

      emit ReputationBurnWithRevoke(_delegate, diff, remainder, limit);
      for (uint256 i = 0; i < limit; i++) {
        address candidate = candidatesToRevoke[i];
        uint256 v = delegates[_delegate].distributedWeight[candidate];

        if (v >= remainder) {
          delegates[_delegate].distributedWeight[candidate] = 0;
          assert(spaceReputation[candidate] >= v);

          spaceReputation[candidate] -= v;
        } else {
          assert(delegates[_delegate].distributedWeight[candidate] > remainder);
          delegates[_delegate].distributedWeight[candidate] -= remainder;
          return;
        }
      }
    }
  }
  event ReputationBurnWithRevoke(
    address delegate,
    uint256 diff,
    uint256 remainder,
    uint256 limit
  );

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
    require(2 <= _m, "Should satisfy `2 <= m`");
    require(_m <= _n, "Should satisfy `n <= n`");

    m = _m;
    n = _n;
  }

//  function pushArbitrators(address[] descSortedArbitrators) external {
//    require(descSortedArbitrators.length == arbitrators.size(), "Sorted arbitrators list should be equal to the stored one");
//
//    uint256 len = descSortedArbitrators.length;
//    uint256 previousWeight = arbitratorWeight[descSortedArbitrators[0]];
//    require(previousWeight > 0, "Could not accept arbitrators with 0 weight");
//
//    for (uint256 i = 0; i < len; i++) {
//      uint256 currentWeight = arbitratorWeight[descSortedArbitrators[i]];
//      require(currentWeight > 0, "Could not accept arbitrators with 0 weight");
//
//      require(currentWeight <= previousWeight, "Invalid sorting");
//      previousWeight = currentWeight;
//    }
//
//    arbitratorsMultiSig.setArbitrators(m, n, descSortedArbitrators);
//  }

  // Getters
  function getCandidates() external view returns (address[]) {
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
    return spaceReputation[_delegate];
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
