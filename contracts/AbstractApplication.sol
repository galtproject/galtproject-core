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

import "./Oracles.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./utils/Initializable.sol";


contract AbstractApplication is Initializable, Permissionable {
  string public constant ROLE_FEE_MANAGER = "fee_manager";
  string public constant ROLE_GALT_SPACE = "galt_space";

  PaymentMethod public paymentMethod;
  uint256 public minimalApplicationFeeInEth;
  uint256 public minimalApplicationFeeInGalt;
  uint256 public galtSpaceEthShare;
  uint256 public galtSpaceGaltShare;
  address internal galtSpaceRewardsAddress;

  ERC20 public galtToken;

  bytes32[] internal applicationsArray;
  mapping(address => bytes32[]) public applicationsByApplicant;

  enum Currency {
    ETH,
    GALT
  }

  enum PaymentMethod {
    NONE,
    ETH_ONLY,
    GALT_ONLY,
    ETH_AND_GALT
  }

  modifier onlyFeeManager() {
    requireRole(msg.sender, ROLE_FEE_MANAGER);
    _;
  }

  constructor() public {}

  function claimGaltSpaceReward(bytes32 _aId) external;

  function setGaltSpaceRewardsAddress(address _newAddress) external onlyRole(ROLE_GALT_SPACE) {
    galtSpaceRewardsAddress = _newAddress;
  }

  function setPaymentMethod(PaymentMethod _newMethod) external onlyFeeManager {
    paymentMethod = _newMethod;
  }

  function setMinimalApplicationFeeInEth(uint256 _newFee) external onlyFeeManager {
    minimalApplicationFeeInEth = _newFee;
  }

  function setMinimalApplicationFeeInGalt(uint256 _newFee) external onlyFeeManager {
    minimalApplicationFeeInGalt = _newFee;
  }

  function setGaltSpaceEthShare(uint256 _newShare) external onlyFeeManager {
    require(_newShare >= 1 && _newShare <= 100, "Percent value should be between 1 and 100");

    galtSpaceEthShare = _newShare;
  }

  function setGaltSpaceGaltShare(uint256 _newShare) external onlyFeeManager {
    require(_newShare >= 1 && _newShare <= 100, "Percent value should be between 1 and 100");

    galtSpaceGaltShare = _newShare;
  }

  function getAllApplications() external view returns (bytes32[]) {
    return applicationsArray;
  }

  function getApplicationsByApplicant(address _applicant) external view returns (bytes32[]) {
    return applicationsByApplicant[_applicant];
  }
}
