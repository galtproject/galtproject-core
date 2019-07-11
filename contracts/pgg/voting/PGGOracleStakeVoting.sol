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

pragma solidity 0.5.10;

import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../../collections/AddressLinkedList.sol";
import "./interfaces/IPGGMultiSigCandidateTop.sol";
import "../interfaces/IPGGConfig.sol";
import "./interfaces/IPGGOracleStakeVoting.sol";


contract PGGOracleStakeVoting is IPGGOracleStakeVoting {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;
  using AddressLinkedList for AddressLinkedList.Data;

  event ReputationMint(address delegate, uint256 amount);
  event ReputationBurn(address delegate, uint256 amount);
  event ReputationChanged(address delegate, uint256 prevReputation, uint256 newReputation);

  event OracleStakeChanged(
    address oracle,
    address candidate,
    uint256 oracleReputationBefore,
    uint256 oracleReputationAfter,
    uint256 candidateReputation,
    uint256 totalReputation
  );

  event ReputationBurnWithRevoke(
    address delegate,
    uint256 remainder,
    uint256 limit
  );

  // Oracle address => Oracle details
  mapping(address => Oracle) private oracles;
  // Oracle Candidate => totalWeights
  mapping(address => uint256) private _candidateReputation;

  struct Oracle {
    address candidate;
    uint256 reputation;
  }

  uint256 private _totalReputation;

  IPGGConfig pggConfig;

  modifier onlyInternalRole(bytes32 _role) {
    require(
      pggConfig.hasInternalRole(_role, msg.sender),
      "Invalid internal PGG role"
    );

    _;
  }

  constructor(
    IPGGConfig _pggConfig
  )
    public
  {
    pggConfig = _pggConfig;
  }

  // 'Oracle Stake Locking' accounting only inside this contract
  function vote(address _candidate) external {
    pggConfig.getOracles().requireOracleActive(msg.sender);

    uint256 newReputation = uint256(pggConfig.getOracleStakes().balanceOf(msg.sender));
    require(newReputation > 0, "Reputation is 0");

    address previousCandidate = oracles[msg.sender].candidate;

    // If already voted
    if (previousCandidate != address(0)) {
      // _candidateReputation[previousCandidate] -= oracles[msg.sender].reputation;
      _candidateReputation[previousCandidate] = _candidateReputation[previousCandidate].sub(oracles[msg.sender].reputation);
    }
    // TODO: what about total oracle stakes?

    oracles[msg.sender].reputation = newReputation;
    oracles[msg.sender].candidate = _candidate;
    // _candidateReputation[_candidate] += newReputation;
    _candidateReputation[_candidate] = _candidateReputation[_candidate].add(newReputation);
  }

  // @dev Oracle balance changed
  // reputationAfter is already casted to uint256 positive
  function onOracleStakeChanged(
    address _oracle,
    uint256 _oracleReputationAfter
  )
    external
    onlyInternalRole(ROLE_ORACLE_STAKE_NOTIFIER)
  {
    address currentCandidate = oracles[_oracle].candidate;
    uint256 oracleReputationBefore = oracles[_oracle].reputation;
    // uint256 totalReputationAfter = _totalReputation + _oracleReputationAfter - oracleReputationBefore;
    uint256 totalReputationAfter = _totalReputation.add(_oracleReputationAfter).sub(oracleReputationBefore);

    _totalReputation = totalReputationAfter;

    emit OracleStakeChanged(
      _oracle,
      currentCandidate,
      oracleReputationBefore,
      _oracleReputationAfter,
      _candidateReputation[currentCandidate],
      _totalReputation
    );

    // Change oracle weight
    oracles[_oracle].reputation = _oracleReputationAfter;

    // The oracle hadn't vote or revoked his vote
    if (currentCandidate == address(0)) {
      return;
    }

    // Change candidate reputation
    // _candidateReputation[currentCandidate] = _candidateReputation[currentCandidate] - reputationBefore + _reputationAfter;
    _candidateReputation[currentCandidate] = _candidateReputation[currentCandidate].add(_oracleReputationAfter).sub(oracleReputationBefore);
  }

  function getOracle(address _oracle) external view returns (address _currentCandidate, uint256 reputation) {
    Oracle storage oracle = oracles[_oracle];
    return (oracle.candidate, oracle.reputation);
  }

  function totalSupply() external view returns (uint256) {
    return _totalReputation;
  }

  // function balanceOf(address _candidate) external view returns (uint256) {
  function candidateBalanceOf(address _candidate) external view returns (uint256) {
    return _candidateReputation[_candidate];
  }

  function oracleBalanceOf(address _oracle) external view returns (uint256) {
    return oracles[_oracle].reputation;
  }

  // function shareOf(address _candidate, uint256 _decimals) external view returns(uint256) {
  function candidateShareOf(address _candidate, uint256 _decimals) external view returns(uint256) {
    uint256 reputation = _candidateReputation[_candidate];

    if (reputation == 0) {return 0;}
    if (_decimals == 0) {return 0;}

    // return (_candidateReputation[_candidate] * _decimals) / _totalReputation;
    return _candidateReputation[_candidate].mul(_decimals).div(_totalReputation);
  }

  function oracleShareOf(address _oracle, uint256 _decimals) external view returns(uint256) {
    uint256 reputation = oracles[_oracle].reputation;

    if (reputation == 0) {return 0;}
    if (_decimals == 0) {return 0;}

    // return (reputation * _decimals) / _totalReputation;
    return reputation.mul(_decimals).div(_totalReputation);
  }
}
