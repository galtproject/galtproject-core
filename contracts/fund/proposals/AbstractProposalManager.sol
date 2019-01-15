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
import "openzeppelin-solidity/contracts/drafts/Counter.sol";
import "../../collections/ArraySet.sol";
import "../../traits/Permissionable.sol";
import "../../interfaces/IRSRA.sol";
import "../FundStorage.sol";
import "./IProposalManager.sol";


contract AbstractProposalManager is Permissionable, IProposalManager {
  using Counter for Counter.Counter;
  using ArraySet for ArraySet.AddressSet;

  event NewProposal(uint256 proposalId, address proposee);
  event Approved(uint256 ayeShare, uint256 threshold);
  event Rejected(uint256 nayShare, uint256 threshold);

  // Method #1 ONLY:
  mapping(address => uint256) _balances;

  Counter.Counter idCounter;

  FundStorage fundStorage;
  IRSRA rsra;

  string public constant RSRA_CONTRACT = "rsra_contract";

  mapping(uint256 => ProposalVoting) internal _proposalVotings;

  enum ProposalStatus {
    NULL,
    ACTIVE,
    APPROVED,
    REJECTED
  }

  enum Choice {
    PENDING,
    AYE,
    NAY
  }

  struct ProposalVoting {
    ProposalStatus status;
    mapping(address => Choice) participants;
    ArraySet.AddressSet ayes;
    ArraySet.AddressSet nays;
  }

  constructor(IRSRA _rsra, FundStorage _fundStorage) public {
    fundStorage = _fundStorage;
    rsra = _rsra;
  }

  modifier onlyMember() {
    require(rsra.lockedBalanceOf(msg.sender) > 0, "Not valid member");

    _;
  }

  // Should be implemented inside descendant
  function _execute(uint256 _proposalId) internal;

  // Method #1 ONLY:
  function onLockChanged(
    address _delegate,
    uint256 _newLockedBalance
  )
    external
    onlyRole(RSRA_CONTRACT)
  {
    _balances[_delegate] = _newLockedBalance;

    // NOTICE: unable to revoke proposal votes in case of balance decrease due complexity of operation
    // (revoke in this case should be performed atomically, within a single transaction, in all
    // proposal contracts and their proposals).
  }

  function aye(uint256 _proposalId) external onlyMember {
    require(_proposalVotings[_proposalId].status == ProposalStatus.ACTIVE);

    _aye(_proposalId, msg.sender);
  }

  function nay(uint256 _proposalId) external onlyMember {
    require(_proposalVotings[_proposalId].status == ProposalStatus.ACTIVE);

    _nay(_proposalId, msg.sender);
  }

  // Method #2 ONLY:
  // permissionLESS
  function triggerApprove(uint256 _proposalId) external {
    ProposalVoting storage proposalVoting = _proposalVotings[_proposalId];
    require(proposalVoting.status == ProposalStatus.ACTIVE);

    uint256 threshold = getThreshold();
    uint256 ayeShare = getAyeShare(_proposalId);

    require(ayeShare > threshold, "Threshold doesn't reached yet");

    proposalVoting.status = ProposalStatus.APPROVED;

    _execute(_proposalId);

    emit Approved(ayeShare, threshold);
  }

  // Method #2 ONLY:
  // permissionLESS
  function triggerReject(uint256 _proposalId) external {
    ProposalVoting storage proposalVoting = _proposalVotings[_proposalId];
    require(proposalVoting.status == ProposalStatus.ACTIVE);

    uint256 threshold = getThreshold();
    uint256 nayShare = getNayShare(_proposalId);

    require(nayShare > threshold, "Threshold doesn't reached yet");

    proposalVoting.status = ProposalStatus.REJECTED;
    emit Rejected(nayShare, threshold);
  }

  // INTERNAL
  function _aye(uint256 _proposalId, address _voter) internal {
    if (_proposalVotings[_proposalId].participants[_voter] == Choice.NAY) {
      _proposalVotings[_proposalId].nays.remove(_voter);
    }

    _proposalVotings[_proposalId].participants[_voter] = Choice.AYE;
    _proposalVotings[_proposalId].ayes.add(_voter);
  }

  function _nay(uint256 _proposalId, address _voter) internal {
    if (_proposalVotings[_proposalId].participants[_voter] == Choice.AYE) {
      _proposalVotings[_proposalId].ayes.remove(_voter);
    }

    _proposalVotings[_proposalId].participants[msg.sender] = Choice.NAY;
    _proposalVotings[_proposalId].nays.add(msg.sender);
  }

  // GETTERS

  // Method #2 ONLY:
  function getAyeShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    return rsra.getShare(_proposalVotings[_proposalId].ayes.elements());
  }

  // Method #2 ONLY:
  function getNayShare(uint256 _proposalId) public view returns (uint256 approvedShare) {
    return rsra.getShare(_proposalVotings[_proposalId].nays.elements());
  }

  function getThreshold() public view returns (uint256) {
    return uint256(fundStorage.getConfigValue(fundStorage.MODIFY_CONFIG_THRESHOLD()));
  }

  function getProposalVoting(
    uint256 _proposalId
  )
    external
    view
    returns (
      ProposalStatus status,
      address[] ayes,
      address[] nays
  ) {
    ProposalVoting storage p = _proposalVotings[_proposalId];

    return (p.status, p.ayes.elements(), p.nays.elements());
  }

  // Method #1 ONLY:
  function balanceOf(address _delegate) external view returns (uint256) {
    return _balances[_delegate];
  }
}
