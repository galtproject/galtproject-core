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


contract Messagable {
  event NewMessage(address indexed account);

  using ArraySet for ArraySet.AddressSet;

  struct Message {
    uint256 id;
    uint256 timestamp;
    address from;
    string text;
  }

  struct MessagesList {
    uint256 count;
    Message[] messages;
  }

  // applicationId => MessagesList
  mapping(bytes32 => MessagesList) messages;

  modifier onlyApplicationParticipant(bytes32 _aId) {
    // sender could be either an applicant or any oracle who locked the application
    // WARNING: should be overridden
    assert(false);
    _;
  }

  function pushMessage(bytes32 _aId, string _text) external;
}