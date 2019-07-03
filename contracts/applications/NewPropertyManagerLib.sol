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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./NewPropertyManager.sol";


library NewPropertyManagerLib {
  using SafeMath for uint256;

  function rejectApplicationHelper(
    NewPropertyManager.Application storage _a,
    string memory _message
  )
    internal
  {
    require(
      _a.status == NewPropertyManager.ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");

    uint256 len = _a.assignedOracleTypes.length;

    for (uint256 i = 0; i < len; i++) {
      bytes32 currentOracleType = _a.assignedOracleTypes[i];
      if (_a.validationStatus[currentOracleType] == NewPropertyManager.ValidationStatus.PENDING) {
        revert("One of the oracle type has PENDING status");
      }
    }

    bytes32 senderOracleType = _a.addressOracleTypes[msg.sender];
    _a.oracleTypeMessages[senderOracleType] = _message;
  }
}
