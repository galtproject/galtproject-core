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

import "./PlotManager.sol";
import "./SpaceToken.sol";
import "./SplitMerge.sol";
import "./LandUtils.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


library PlotManagerLib {
  using SafeMath for uint256;
  using LandUtils for uint256;

  // weight = 32 ** (12 - geohashLength)
  function geohashCapacityToWeight(uint256 _capacity) public pure returns (uint256) {
    // requires sezu06 = sezu06a * 32
    return (32 ** (12 - _capacity));
  }

  function geohash5Weight(uint256 _geohash5) public pure returns (uint256) {
    return geohashCapacityToWeight(LandUtils.geohash5Precision(_geohash5));
  }

  function rejectApplicationHelper(
    PlotManager.Application storage _a,
    string _message
  )
    external
  {
    require(
      _a.status == PlotManager.ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");

    uint256 len = _a.assignedRoles.length;

    for (uint8 i = 0; i < len; i++) {
      bytes32 currentRole = _a.assignedRoles[i];
      if (_a.validationStatus[currentRole] == PlotManager.ValidationStatus.PENDING) {
        revert("One of the roles has PENDING status");
      }
    }

    bytes32 senderRole = _a.addressRoles[msg.sender];
    _a.roleMessages[senderRole] = _message;
  }
}
