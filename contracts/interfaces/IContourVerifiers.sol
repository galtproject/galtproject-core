/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;


interface IContourVerifiers {
  // OWNER INTERFACE

  function setRequiredDeposit(uint256 _requiredDeposit) external;

  // SLASHER INTERFACE

  function slash(address[] calldata _verifiers, address _beneficiary) external;

  // USER INTERFACE

  function deposit(uint256 _amount, address _verifier) external;
  function withdraw(uint256 _amount) external;

  function setOperator(address _operator) external;

  function claimSlashedReward() external;
  function claimSlashedProtocolReward() external;

  // GETTERS

  function isVerifierValid(address _verifier, address _operator) external view returns (bool);
}
