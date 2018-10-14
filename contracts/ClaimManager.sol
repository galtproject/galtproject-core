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
//pragma experimental "ABIEncoderV2";

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

//  enum ValidationStatus {
//    NOT_EXISTS,
//    PENDING,
//    LOCKED
//  }

  event LogApplicationStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event LogNewApplication(bytes32 id, address applicant);
//  event LogProposalStatusChanged(bytes32 applicationId, bytes32 role, ValidationStatus status);

  struct Claim {
    bytes32 id;
    address applicant;
    address beneficiary;
    uint256 amount;

    ApplicationStatus status;
    FeeDetails fees;

    bytes32[] attachedDocuments;
  }

  struct FeeDetails {
    Currency currency;
    uint256 validatorsReward;
    uint256 galtSpaceReward;
  }

  mapping(bytes32 => Claim) public claims;

  // validator count required to
  uint256 public n;

  // total validator count able to lock the claim
  uint256 public m;

  constructor () public {}

  function setNofM(uint256 _n, uint256 _m) external onlyOwner {
    require(1 <= _n, "Should satisfy `1 <= n`");
    require(_n <= _m, "Should satisfy `n <= m`");

    n = _n;
    m = _m;
  }

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

  /**
   * @dev Submit a new claim.
   *
   * @param _beneficiary for refund
   * @param _amount of claim
   * @param _documents with details
   * @param _applicationFeeInGalt or 0 for ETH payment method
   * @return new claim id
   */
  function submit(
    address _beneficiary,
    uint256 _amount,
    bytes32[] _documents,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    returns (bytes32)
  {
    // Default is ETH
    Currency currency;
    uint256 fee;

    // ETH
    if (msg.value > 0) {
      require(_applicationFeeInGalt == 0, "Could not accept both ETH and GALT");
      require(msg.value >= minimalApplicationFeeInEth, "Incorrect fee passed in");
      fee = msg.value;
    // GALT
    } else {
      require(msg.value == 0, "Could not accept both ETH and GALT");
      require(_applicationFeeInGalt >= minimalApplicationFeeInGalt, "Incorrect fee passed in");
      galtToken.transferFrom(msg.sender, address(this), _applicationFeeInGalt);
      fee = _applicationFeeInGalt;
      currency = Currency.GALT;
    }

    Claim memory c;
    bytes32 id = keccak256(
      abi.encodePacked(
        msg.sender,
        _beneficiary,
        _documents,
        blockhash(block.number),
        applicationsArray.length
      )
    );

    require(claims[id].status == ApplicationStatus.NOT_EXISTS, "Claim already exists");

    c.status = ApplicationStatus.SUBMITTED;
    c.id = id;
    c.beneficiary = _beneficiary;
    c.applicant = msg.sender;
    c.attachedDocuments = _documents;
    c.fees.currency = currency;

    calculateAndStoreFee(c, fee);

    claims[id] = c;

    emit LogNewApplication(id, msg.sender);
    emit LogApplicationStatusChanged(id, ApplicationStatus.SUBMITTED);

    return id;
  }

  function claimValidatorReward(bytes32 _aId) external {

  }

  function claimGaltSpaceReward(bytes32 _aId) external {

  }

  function claim(
    bytes32 _cId
  )
    external
    returns (
      bytes32 id,
      address applicant,
      address beneficiary,
      uint256 amount,
      ApplicationStatus status
  ) {
    Claim storage c = claims[_cId];

    return (
      c.id,
      c.applicant,
      c.beneficiary,
      c.amount,
      c.status
    );
  }

  function claimFees(
    bytes32 _cId
  )
    external
    returns (
      Currency currency,
      uint256 validatorsReward,
      uint256 galtSpaceReward
  ) {
    FeeDetails storage f = claims[_cId].fees;

    return (
      f.currency,
      f.validatorsReward,
      f.galtSpaceReward
    );
  }

  function getAllClaims() external view returns (bytes32[]) {
    return applicationsArray;
  }

  function getClaimsByAddress(address _applicant) external view returns (bytes32[]) {
    return applicationsByAddresses[_applicant];
  }

  function getClaimsByValidator(address _applicant) external view returns (bytes32[]) {
    return applicationsByValidator[_applicant];
  }


  function calculateAndStoreFee(
    Claim memory _c,
    uint256 _fee
  )
    internal
  {
    uint256 share;

    if (_c.fees.currency == Currency.ETH) {
      share = galtSpaceEthShare;
    } else {
      share = galtSpaceGaltShare;
    }

    uint256 galtSpaceReward = share.mul(_fee).div(100);
    uint256 validatorsReward = _fee.sub(galtSpaceReward);

    assert(validatorsReward.add(galtSpaceReward) == _fee);

    _c.fees.validatorsReward = validatorsReward;
    _c.fees.galtSpaceReward = galtSpaceReward;
  }
}
