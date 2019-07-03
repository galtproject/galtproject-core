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
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/drafts/Counters.sol";
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
