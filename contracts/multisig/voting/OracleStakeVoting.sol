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
import "../../collections/AddressLinkedList.sol";
import "./interfaces/IArbitrationCandidateTop.sol";
import "../interfaces/IArbitrationConfig.sol";
import "./interfaces/IOracleStakeVoting.sol";


contract OracleStakeVoting is IOracleStakeVoting, Permissionable {
  using ArraySet for ArraySet.AddressSet;
  using AddressLinkedList for AddressLinkedList.Data;

  event ReputationMint(address delegate, uint256 amount);
  event ReputationBurn(address delegate, uint256 amount);
  event ReputationChanged(address _delegate, uint256 prevReputation, uint256 newReputation);

  event OracleStakeChanged(
    address oracle,
    address candidate,
    uint256 currentOracleReputation,
    uint256 newOracleReputation,
    uint256 newCandidateReputation
  );

  event ReputationBurnWithRevoke(
    address delegate,
    uint256 remainder,
    uint256 limit
  );

  string public constant ORACLE_STAKES_NOTIFIER = "oracle_stakes_notifier";

  // Oracle address => Oracle details
  mapping(address => Oracle) private oracles;
  // Oracle Candidate => totalWeights
  mapping(address => uint256) private _reputationBalance;

  struct Oracle {
    address candidate;
    uint256 reputation;
  }

  uint256 private _totalReputation;

  IArbitrationConfig arbitrationConfig;

  constructor(
    IArbitrationConfig _arbitrationConfig
  )
    public
  {
    arbitrationConfig = _arbitrationConfig;
  }


  // 'Oracle Stake Locking' accounting only inside this contract
  function vote(address _candidate) external {
    // TODO: check oracle is activev

    uint256 newReputation = uint256(arbitrationConfig.getOracleStakes().balanceOf(msg.sender));
    require(newReputation > 0, "Reputation is 0");

    address previousCandidate = oracles[msg.sender].candidate;

    // If already voted
    if (previousCandidate != address(0)) {
      _reputationBalance[previousCandidate] -= oracles[msg.sender].reputation;
    }
    // TODO: what about total oracle stakes?

    oracles[msg.sender].reputation = newReputation;
    oracles[msg.sender].candidate = _candidate;
    _reputationBalance[_candidate] += newReputation;
  }

  // TODO: fix oracle stake change logic
  // @dev Oracle balance changed
  function onOracleStakeChanged(
    address _oracle,
    uint256 _newReputation
  )
    external
//    onlyRole(ORACLE_STAKES_NOTIFIER)
  {
    address currentCandidate = oracles[_oracle].candidate;
    uint256 currentReputation = oracles[_oracle].reputation;

    _totalReputation = _totalReputation + _newReputation - currentReputation;

    // The oracle hadn't vote or revoked his vote
    if (currentCandidate == address(0)) {
      return;
    }

    // Change candidate weight
    _reputationBalance[currentCandidate] = _reputationBalance[currentCandidate] - currentReputation + _newReputation;

    // Change oracle weight
    oracles[_oracle].reputation = _newReputation;

    emit OracleStakeChanged(
      _oracle,
      currentCandidate,
      currentReputation,
      _newReputation,
      _reputationBalance[currentCandidate]
    );
  }

  function getOracle(address _oracle) external view returns (address _currentCandidate, uint256 reputation) {
    Oracle storage oracle = oracles[_oracle];
    return (oracle.candidate, oracle.reputation);
  }

  function totalSupply() external view returns (uint256) {
    return _totalReputation;
  }

  function balanceOf(address _candidate) external view returns (uint256) {
    return _reputationBalance[_candidate];
  }

  function shareOf(address _candidate, uint256 _decimals) external view returns(uint256) {
    return (_reputationBalance[_candidate] * _decimals) / _totalReputation;
  }
}
