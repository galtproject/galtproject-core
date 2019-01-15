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
import "../../collections/ArraySet.sol";
import "../../interfaces/IRSRA.sol";
import "../FundStorage.sol";
import "./AbstractProposalManager.sol";


contract ModifyConfigProposalManager is AbstractProposalManager {
  struct Proposal {
    bytes32 key;
    bytes32 value;
    string description;
  }

  mapping(uint256 => Proposal) private _proposals;

  constructor(IRSRA _rsra, FundStorage _fundStorage) public AbstractProposalManager(_rsra, _fundStorage) {
  }

  function propose(bytes32 _key, bytes32 _value, string _description) external onlyMember {
    uint256 id = idCounter.next();

    _proposals[id] = Proposal({
      key: _key,
      value: _value,
      description: _description
    });

    emit NewProposal(id, msg.sender);

    ProposalVoting storage proposalVoting = _proposalVotings[id];

    proposalVoting.status = ProposalStatus.ACTIVE;
  }

  function getProposal(uint256 _proposalId) external view returns (bytes32 key, bytes32 value, string description) {
    Proposal storage p = _proposals[_proposalId];

    return (p.key, p.value, p.description);
  }

  function _execute(uint256 _proposalId) internal {
    Proposal storage p = _proposals[_proposalId];

    fundStorage.setConfigValue(p.key, p.value);
  }
}
