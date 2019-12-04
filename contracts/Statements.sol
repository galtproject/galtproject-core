/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/drafts/Counters.sol";
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";


contract Statements is OwnableAndInitializable {
  using Counters for Counters.Counter;

  event NewStatement(address indexed addr, uint256 indexed id, uint256 block);

  struct Statement {
    uint256 block;
    string subject;
    string statement;
  }

  struct Account {
    mapping(uint256 => Statement) statements;
    Counters.Counter counter;
  }

  mapping(address => Account) internal accounts;

  function initialize() external isInitializer {
  }

  function addStatement(string calldata subject, string calldata statement) external {
    Account storage a = accounts[msg.sender];

    uint256 id = a.counter.current();
    uint256 blockNumber = block.number;

    a.statements[id] = Statement(blockNumber, subject, statement);

    a.counter.increment();

    emit NewStatement(msg.sender, id, blockNumber);
  }

  function getStatement(address _address, uint256 _id) external view returns(Statement memory) {
    return accounts[_address].statements[_id];
  }

  function getStatementCount(address _address) external view returns(uint256) {
    return accounts[_address].counter.current();
  }
}
