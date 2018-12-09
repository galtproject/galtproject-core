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

  event OracleStakeChanged(
    address oracle,
    address candidate,
    uint256 currentOracleWeight,
    uint256 newOracleWeight,
    uint256 newCandidateWeight
  );

  string public constant ORACLE_STAKES_NOTIFIER = "oracle_stakes_notifier";
  string public constant SPACE_REPUTATION_NOTIFIER = "space_reputation_notifier";

  ArraySet.AddressSet arbitrators;
  mapping(address => uint256) public arbitratorWeight;

  OracleStakesAccounting oracleStakesAccounting;
  SpaceReputationAccounting spaceReputationAccounting;
  SpaceToken spaceToken; // Remove?
//  mapping(address => uint256) private candidate;
//  mapping(address => uint256) private stakeTotal;

  // Oracle address => Oracle details
  mapping(address => Oracle) private oracles;
  // Candidate => totalWeights
  mapping(address => uint256) private oracleCandidateWeight;

  struct Oracle {
    address candidate;
    uint256 weight;
  }

  uint256 totalOracleStakes;

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
  }

  //
  function voteWithSpaceReputation(address _candidate, uint256 _weight) external {
    // TODO: mint reputation
    // TODO: check weither user has already voted for this candidate or not
    // TODO: if yes, increment
    // TODO: if not, check that set is < 5
    // TODO: add candidate to set
    // tODO: store weigt
    // TODO: increment candidate weight
  }

  // 'Oracle Stake Locking' accounting only inside this contract
  function voteWithOracleStake(address _candidate) external {
    // TODO: check oracle is activev

    uint256 newWeight = uint256(oracleStakesAccounting.balanceOf(msg.sender));
    require(newWeight > 0, "Weight is 0 or less");

    address previousCandidate = oracles[msg.sender].candidate;

    // If already voted
    if (previousCandidate != address(0)) {
      oracleCandidateWeight[previousCandidate] -= oracles[msg.sender].weight;
    }

    oracles[msg.sender].weight = newWeight;
    oracles[msg.sender].candidate = _candidate;
    oracleCandidateWeight[_candidate] += newWeight;
  }

  // @dev SpaceOwner balance changed
  function spaceOwnersCallback() external {

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
    oracleCandidateWeight[currentCandidate] += (_newWeight - currentWeight);

    // Change oracle weight
    oracles[_oracle].weight = _newWeight;

    emit OracleStakeChanged(
      _oracle,
      currentCandidate,
      currentWeight,
      _newWeight,
      oracleCandidateWeight[currentCandidate]
    );
  }

  function recalculateCandidateWeight(address _candidate) external {
    // recalculate space weight
    uint256 candidateSpace = spaceReputationAccounting.balanceOf(_candidate);
    uint256 totalSpace = spaceReputationAccounting.totalSupply();
    uint256 candidateSpaceWeight = candidateSpace * 100 / totalSpace;

    // recalculate stakes weight
    uint256 candidateStake = oracleCandidateWeight[_candidate];
    uint256 candidateStakeWeight = totalOracleStakes * 100 / candidateStake;
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

  function pushArbitrators(address[] descSortedArbitrators) external {
    require(descSortedArbitrators.length == arbitrators.size(), "Sorted arbitrators list should be equal to the stored one");

    uint256 len = descSortedArbitrators.length;
    uint256 previousWeight = arbitratorWeight[descSortedArbitrators[0]];
    require(previousWeight > 0, "Could not accept arbitrators with 0 weight");

    for (uint256 i = 0; i < len; i++) {
      uint256 currentWeight = arbitratorWeight[descSortedArbitrators[i]];
      require(currentWeight > 0, "Could not accept arbitrators with 0 weight");

      require(currentWeight <= previousWeight, "Invalid sorting");
      previousWeight = currentWeight;
    }

    arbitratorsMultiSig.setArbitrators(m, n, descSortedArbitrators);
  }

  // Getters
  function getArbitrators() external view returns (address[]) {
    return arbitrators.elements();
  }

  function getOracleCandidateWeight(address _candidate) external view returns (uint256) {
    return oracleCandidateWeight[_candidate];
  }

  function getSize() external view returns (uint256 size) {
    return arbitrators.size();
  }
}
