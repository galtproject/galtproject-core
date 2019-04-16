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

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/drafts/Counter.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "@galtproject/libs/contracts/traits/Initializable.sol";
import "./interfaces/IACL.sol";
import "./registries/interfaces/IMultiSigRegistry.sol";
import "./registries/GaltGlobalRegistry.sol";
import "./interfaces/IGlobalGovernance.sol";


contract GlobalGovernance is Initializable, IGlobalGovernance {
  using Counter for Counter.Counter;

  event NewProposal(uint256 id, address indexed creator, address indexed destination);

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

  struct Proposal {
    address creator;
    address destination;
    uint256 value;
    bytes data;
  }

  mapping(bytes32 => uint256) public thresholds;
  mapping(uint256 => Proposal) public proposals;

  Counter.Counter internal idCounter;
  GaltGlobalRegistry internal ggr;

  modifier onlyValidMultiSig() {
    require(
      IMultiSigRegistry(ggr.getMultiSigRegistryAddress()).isMultiSigValid(msg.sender) == true,
      "Invalid MultiSig"
    );

    _;
  }

  function initialize(GaltGlobalRegistry _ggr) external isInitializer {
    ggr = _ggr;
 }

  function propose(
    address _destination,
    uint256 _value,
    bytes calldata _data
  )
    external
//    onlyValidMultiSig
    returns(uint256)
  {
    uint256 id = idCounter.next();
    Proposal storage p = proposals[id];

    p.creator = msg.sender;
    p.destination = _destination;
    p.value = _value;
    p.data = _data;

    emit NewProposal(id, msg.sender, _destination);

    return id;
  }
}
