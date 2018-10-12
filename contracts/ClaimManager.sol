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
pragma experimental "ABIEncoderV2";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./AbstractApplication.sol";
import "./SpaceToken.sol";
import "./Validators.sol";


contract ClaimManager is AbstractApplication {
  using SafeMath for uint256;

  // `ClaimManager` keccak256 hash
  bytes32 public constant APPLICATION_TYPE = 0x6cdf6ab5991983536f64f626597a53b1a46773aa1473467b6d9d9a305b0a03ef;

  // `CM_JUROR` bytes32 representation hash
  bytes32 public constant CM_JUROR = 0x434d5f4a55524f52000000000000000000000000000000000000000000000000;

  enum ApplicationStatus {
    NOT_EXISTS,
    SUBMITTED,
    APPROVED,
    REJECTED,
    REVERTED
  }

  enum ValidationStatus {
    NOT_EXISTS,
    PENDING,
    LOCKED
  }

  event LogClaimStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event LogProposalStatusChanged(bytes32 applicationId, bytes32 role, ValidationStatus status);
  event LogNewApplication(bytes32 id, address applicant);

  struct Claim {
    bytes32 id;
    address applicant;
    uint256 packageTokenId;

    ApplicationStatus status;

    bytes32[] attachedDocuments;
  }

  struct FeeDetails {
    Currency currency;
    uint256 validatorsReward;
    uint256 galtSpaceReward;
  }

  mapping(bytes32 => Claim) public claims;
  constructor () public {}

  function initialize(
    Validators _validators,
    ERC20 _galtToken,
    address _galtSpaceRewardsAddress
  )
    public
    isInitializer
  {
    owner = msg.sender;

    validators = _validators;
    galtToken = _galtToken;
    galtSpaceRewardsAddress = _galtSpaceRewardsAddress;

    // Default values for revenue shares and application fees
    // Override them using one of the corresponding setters
    minimalApplicationFeeInEth = 1;
    minimalApplicationFeeInGalt = 10;
    galtSpaceEthShare = 33;
    galtSpaceGaltShare = 33;
    paymentMethod = PaymentMethod.ETH_AND_GALT;
  }


  function claimValidatorReward(bytes32 _aId) external {

  }
  function claimGaltSpaceReward(bytes32 _aId) external {

  }

  function getAllClaims() external view returns (bytes32[]) {
    return applicationsArray;
  }

  function getApplicationsByAddress(address _applicant) external view returns (bytes32[]) {
    return applicationsByAddresses[_applicant];
  }

  function getApplicationsByValidator(address _applicant) external view returns (bytes32[]) {
    return applicationsByValidator[_applicant];
  }
}
