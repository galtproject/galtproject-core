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
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "../../collections/ArraySet.sol";
import "../../interfaces/IRSRA.sol";
import "../../SpaceLocker.sol";
import "../FundStorage.sol";
import "./AbstractProposalManager.sol";


contract ExpelMemberProposalManager is AbstractProposalManager {
  struct Proposal {
    uint256 spaceTokenId;
    string description;
  }

  mapping(uint256 => Proposal) private _proposals;

  IERC721 spaceToken;

  constructor(
    IRSRA _rsra,
    FundStorage _fundStorage,
    IERC721 _spaceToken
  )
    public
    AbstractProposalManager(_rsra, _fundStorage)
  {
    spaceToken = _spaceToken;
  }

  function propose(uint256 _spaceTokenId, string _description) external {
    uint256 id = idCounter.next();

    _proposals[id] = Proposal({
      spaceTokenId: _spaceTokenId,
      description: _description
    });

    emit NewProposal(id, msg.sender);

    ProposalVoting storage proposalVoting = _proposalVotings[id];

    proposalVoting.status = ProposalStatus.ACTIVE;
  }

  function _execute(uint256 _proposalId) internal {
    Proposal storage p = _proposals[_proposalId];

    address owner = spaceToken.ownerOf(p.spaceTokenId);
    uint256 amount = SpaceLocker(owner).reputation();

    assert(amount > 0);

    fundStorage.expel(p.spaceTokenId, amount);
  }

  function getThreshold() public view returns (uint256) {
    return uint256(fundStorage.getConfigValue(fundStorage.EXPEL_MEMBER_THRESHOLD()));
  }

  function getProposal(uint256 _proposalId) external view returns (uint256 spaceTokenId, string description) {
    Proposal storage p = _proposals[_proposalId];

    return (p.spaceTokenId, p.description);
  }
}
