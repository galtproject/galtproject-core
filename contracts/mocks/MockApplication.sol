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

pragma solidity ^0.5.10;


contract MockApplication {
  bytes32[] internal activeApplications;
  mapping(bytes32 => uint256[]) internal applicationContours;

  function addActiveApplication(uint256[] calldata _contour) external {
    bytes32 id = keccak256(abi.encode(_contour));
    activeApplications.push(id);
    applicationContours[id] = _contour;
  }

  function clearActiveApplications() external {
    delete activeApplications;
  }

  function getActiveApplications() external returns(bytes32[] memory) {
    return activeApplications;
  }
}
