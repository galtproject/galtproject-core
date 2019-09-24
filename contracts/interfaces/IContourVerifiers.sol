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


interface IContourVerifiers {
  // OWNER INTERFACE

  function setRequiredDeposit(uint256 _requiredDeposit) external;

  // SLASHER INTERFACE

  function slash(address[] calldata _verifiers, address _beneficiary) external;

  // USER INTERFACE

  function deposit(uint256 _amount) external;
  function withdraw(uint256 _amount) external;

  function setOperator(address _operator) external;

  function claimSlashedReward() external;
  function claimSlashedProtocolReward() external;

  // GETTERS

  function isVerifierValid(address _verifier, address _operator) external view returns (bool);
}
