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

import "../traits/Statusable.sol";
import "../AbstractApplication.sol";
import "../collections/ArraySet.sol";
import "../AbstractArbitratorApplication.sol";

contract NewOracleManager is AbstractArbitratorApplication, Statusable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  bytes32 public constant APPLICATION_TYPE = 0xec6610ed0bf714476800ac10ef0615b9f667f714ca25d80079e41026c60a76ed;

  event NewApplication(bytes32 applicationId, address applicant);
  event ApplicationStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event ArbitratorSlotTaken(bytes32 applicationId, uint256 slotsTaken, uint256 totalSlots);
  event Aye(bytes32 applicationId, uint256 ayeCount, uint256 nayCount, uint256 threshold);
  event Nay(bytes32 applicationId, uint256 ayeCount, uint256 nayCount, uint256 threshold);

  struct Application {
    address applicant;

    // votes required
    uint256 m;
    // available slots to vote
    uint256 n;

    uint256 ayeCount;
    uint256 nayCount;


    ApplicationStatus status;
    FeeDetails fees;
    OracleDetails oracleDetails;

    ArraySet.AddressSet arbitrators;
    mapping(address => Choice) votes;
  }

  enum Choice {
    PENDING,
    AYE,
    NAY
  }

  struct OracleDetails {
    address addr;
    bytes32 name;
    bytes32 position;
    bytes32[] descriptionHashes;
    bytes32[] oracleTypes;
  }

  struct FeeDetails {
    Currency currency;

    uint256 totalReward;

    // arbitratorsReward + galtSpaceReward = totalReward
    uint256 arbitratorsReward;
    uint256 galtSpaceReward;

    mapping(address => bool) arbitratorRewardPaidOut;
    bool galtSpaceRewardPaidOut;
  }

  uint256 m;
  uint256 n;

  mapping(bytes32 => Application) applications;

  Oracles oracles;

  constructor() public {}

  function initialize(
    Oracles _oracles,
    ERC20 _galtToken,
    ArbitratorsMultiSig _arbitratorsMultiSig,
    address _galtSpaceRewardsAddress
  )
    public
    isInitializer
  {
    oracles = _oracles;
    galtToken = _galtToken;
    arbitratorsMultiSig = _arbitratorsMultiSig;
    galtSpaceRewardsAddress = _galtSpaceRewardsAddress;

    m = 3;
    n = 5;

    // Default values for revenue shares and application fees
    // Override them using one of the corresponding setters
    minimalApplicationFeeInEth = 1;
    minimalApplicationFeeInGalt = 10;
    galtSpaceEthShare = 33;
    galtSpaceGaltShare = 33;
    paymentMethod = PaymentMethod.ETH_AND_GALT;
  }

  function setMofN(uint256 _m, uint256 _n) external onlyRole(ROLE_GALT_SPACE) {
    require(2 <= _m, "Should satisfy `2 <= n`");
    require(_m <= _n, "Should satisfy `n <= m`");

    m = _m;
    n = _n;
  }

  function submit(
    address _oracleAddress,
    bytes32 _name,
    bytes32 _position,
    bytes32[] _descriptionHashes,
    bytes32[] _oracleTypes,
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

    Application memory a;

    bytes32 id = keccak256(
      abi.encodePacked(
        msg.sender,
        _name,
        _descriptionHashes,
        applicationsArray.length
      )
    );

    a.status = ApplicationStatus.SUBMITTED;
    a.applicant = msg.sender;
    a.m = m;
    a.n = n;

    a.oracleDetails.addr = _oracleAddress;
    a.oracleDetails.name = _name;
    a.oracleDetails.position = _position;
    a.oracleDetails.descriptionHashes = _descriptionHashes;
    a.oracleDetails.oracleTypes = _oracleTypes;

    a.fees.currency = currency;

    calculateAndStoreFee(a, fee);

    applications[id] = a;
    applicationsArray.push(id);
    applicationsByApplicant[msg.sender].push(id);

    emit NewApplication(id, msg.sender);
    emit ApplicationStatusChanged(id, ApplicationStatus.SUBMITTED);
  }

  /**
   * @dev Any arbitrator locks an application if an empty slots available
   * @param _aId Application ID
   */
  function lock(bytes32 _aId) external anyArbitrator {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(!a.arbitrators.has(msg.sender), "Arbitrator has already locked the application");
    require(a.arbitrators.size() < n, "All arbitrator slots are locked");

    a.arbitrators.add(msg.sender);

    emit ArbitratorSlotTaken(_aId, a.arbitrators.size(), n);
  }

  function aye(bytes32 _aId) external {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(a.arbitrators.has(msg.sender), "Arbitrator has already locked the application");
    require(a.votes[msg.sender] != Choice.AYE, "Already AYE vote");
    // should validator still be active in multisig?

    if (a.votes[msg.sender] == Choice.NAY) {
      a.nayCount--;
    }

    a.votes[msg.sender] = Choice.AYE;
    a.ayeCount++;

    emit Aye(_aId, a.ayeCount, a.nayCount, a.m);

    if (a.ayeCount == a.m) {
      OracleDetails storage d = a.oracleDetails;
      oracles.addOracle(d.addr, d.name, d.position, d.descriptionHashes, d.oracleTypes);
      a.status = ApplicationStatus.APPROVED;
    }
  }

  function nay(bytes32 _aId) external {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(a.arbitrators.has(msg.sender), "Arbitrator has already locked the application");
    require(a.votes[msg.sender] != Choice.NAY, "Already NAY vote");
    // should validator still be active in multisig?

    if (a.votes[msg.sender] == Choice.AYE) {
      a.ayeCount--;
    }

    a.votes[msg.sender] = Choice.NAY;
    a.nayCount++;

    emit Nay(_aId, a.ayeCount, a.nayCount, a.m);

    if (a.nayCount == a.m) {
      a.status = ApplicationStatus.REJECTED;
    }
  }

  function claimArbitratorReward(bytes32 _aId) external {

  }

  function claimGaltSpaceReward(bytes32 _aId) external {

  }

  // INTERNALS

  function calculateAndStoreFee(
    Application memory _a,
    uint256 _fee
  )
    internal
  {
    uint256 share;

    if (_a.fees.currency == Currency.ETH) {
      share = galtSpaceEthShare;
    } else {
      share = galtSpaceGaltShare;
    }

    uint256 galtSpaceReward = share.mul(_fee).div(100);
    uint256 arbitratorsReward = _fee.sub(galtSpaceReward);

    assert(arbitratorsReward.add(galtSpaceReward) == _fee);

    _a.fees.arbitratorsReward = arbitratorsReward;
    _a.fees.galtSpaceReward = galtSpaceReward;
  }

  // GETTERS

  function getApplicationById(
    bytes32 _id
  )
    external
    view
    returns (
      ApplicationStatus status,
      address applicant,
      address[] arbitrators,
      uint256 m,
      uint256 n,
      uint256 ayeCount,
      uint256 nayCount
    )
  {
    Application storage m = applications[_id];

    return (
      m.status,
      m.applicant,
      m.arbitrators.elements(),
      m.m,
      m.n,
      m.ayeCount,
      m.nayCount
    );
  }

  function getApplicationOracle(
    bytes32 _id
  )
    external
    view
    returns (
      address addr,
      bytes32 name,
      bytes32 position,
      bytes32[] descriptionHashes,
      bytes32[] oracleTypes
    )
  {
    OracleDetails storage o = applications[_id].oracleDetails;

    return (
      o.addr,
      o.name,
      o.position,
      o.descriptionHashes,
      o.oracleTypes
    );
  }

  function getApplicationFees(
    bytes32 _id
  )
    external
    view
    returns (
      Currency currency,
      uint256 arbitratorsReward,
      uint256 galtSpaceReward,
      bool galtSpaceRewardPaidOut
    )
  {
    FeeDetails storage f = applications[_id].fees;

    return (
      f.currency,
      f.arbitratorsReward,
      f.galtSpaceReward,
      f.galtSpaceRewardPaidOut
    );
  }
}