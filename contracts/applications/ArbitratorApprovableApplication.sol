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

pragma solidity 0.5.3;


import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/traits/Statusable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../registries/MultiSigRegistry.sol";
import "./AbstractApplication.sol";
import "./AbstractArbitratorApplication.sol";

contract ArbitratorApprovableApplication is AbstractArbitratorApplication, Statusable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  event NewApplication(bytes32 applicationId, address applicant);
  event ApplicationStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event ArbitratorSlotTaken(bytes32 applicationId, uint256 slotsTaken, uint256 totalSlots);
  event Aye(bytes32 applicationId, uint256 ayeCount, uint256 nayCount, uint256 threshold);
  event Nay(bytes32 applicationId, uint256 ayeCount, uint256 nayCount, uint256 threshold);

  struct Application {
    address payable multiSig;
    address applicant;

    // votes required
    uint256 m;
    // available slots to vote
    uint256 n;

    uint256 ayeCount;
    uint256 nayCount;


    ApplicationStatus status;
    FeeDetails fees;

    ArraySet.AddressSet arbitrators;
    mapping(address => Choice) votes;
  }

  enum Choice {
    PENDING,
    AYE,
    NAY
  }

  struct FeeDetails {
    Currency currency;

    uint256 totalReward;

    // arbitratorsReward + galtSpaceReward = totalReward
    uint256 arbitratorsReward;
    uint256 galtSpaceReward;

    // a single arbitrator reward
    uint256 arbitratorReward;

    mapping(address => bool) arbitratorRewardPaidOut;
    bool galtSpaceRewardPaidOut;
  }

  uint256 m;
  uint256 n;

  mapping(bytes32 => Application) applications;

  Oracles oracles;

  constructor() public {}

  function _execute(bytes32) internal;
  function minimalApplicationFeeEth(address _multiSig) internal view returns (uint256);
  function minimalApplicationFeeGalt(address _multiSig) internal view returns (uint256);

  function setMofN(uint256 _m, uint256 _n) external onlyRole(ROLE_GALT_SPACE) {
    require(2 <= _m, "Should satisfy `2 <= n`");
    require(_m <= _n, "Should satisfy `n <= m`");

    m = _m;
    n = _n;
  }

  /**
   * @dev Any arbitrator locks an application if an empty slots available
   * @param _aId Application ID
   */
  function lock(bytes32 _aId) external {
    Application storage a = applications[_aId];

    multiSigRegistry().requireValidMultiSig(a.multiSig);
    require(ArbitratorsMultiSig(a.multiSig).isOwner(msg.sender), "Not active arbitrator");

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
      _execute(_aId);
      calculateAndStoreAuditorRewards(a);
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
      calculateAndStoreAuditorRewards(a);
      a.status = ApplicationStatus.REJECTED;
    }
  }

  function claimArbitratorReward(bytes32 _aId) external {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.APPROVED || a.status == ApplicationStatus.REJECTED,
      "Application status should be APPROVED or REJECTED");
    require(a.arbitrators.has(msg.sender) == true, "Arbitrator not in locked list");
    require(a.fees.arbitratorRewardPaidOut[msg.sender] == false);

    a.fees.arbitratorRewardPaidOut[msg.sender] = true;

    if (a.fees.currency == Currency.ETH) {
      msg.sender.transfer(a.fees.arbitratorReward);
    } else if (a.fees.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(msg.sender, a.fees.arbitratorReward);
    }
  }

  function claimGaltSpaceReward(bytes32 _aId) external {
    require(msg.sender == galtSpaceRewardsAddress, "The method call allowed only for galtSpace address");

    Application storage a = applications[_aId];

    /* solium-disable-next-line */
    require(
      a.status == ApplicationStatus.APPROVED || a.status == ApplicationStatus.REJECTED,
      "Application status should be APPROVED or REJECTED");

    require(a.fees.galtSpaceReward > 0, "Reward is 0");
    require(a.fees.galtSpaceRewardPaidOut == false, "Reward is already paid out");

    a.fees.galtSpaceRewardPaidOut = true;

    if (a.fees.currency == Currency.ETH) {
      msg.sender.transfer(a.fees.galtSpaceReward);
    } else if (a.fees.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(msg.sender, a.fees.galtSpaceReward);
    }
  }

  // INTERNALS

  function _initialize(
    GaltGlobalRegistry _ggr,
    address _galtSpaceRewardsAddress
  )
    internal
  {
    ggr = _ggr;
    galtSpaceRewardsAddress = _galtSpaceRewardsAddress;

    // TODO: figure out where to store these values
    galtSpaceEthShare = 33;
    galtSpaceGaltShare = 13;
    m = 3;
    n = 5;
  }

  function _submit(
    bytes32 _id,
    address payable _multiSig,
    uint256 _applicationFeeInGalt
  )
    internal
    returns (bytes32)
  {
    multiSigRegistry().requireValidMultiSig(_multiSig);

    // Default is ETH
    Currency currency;
    uint256 fee;

    // ETH
    if (msg.value > 0) {
      require(_applicationFeeInGalt == 0, "Could not accept both ETH and GALT");
      require(msg.value >= minimalApplicationFeeEth(_multiSig), "Incorrect fee passed in");
      fee = msg.value;
      // GALT
    } else {
      require(msg.value == 0, "Could not accept both ETH and GALT");
      require(_applicationFeeInGalt >= minimalApplicationFeeGalt(_multiSig), "Incorrect fee passed in");
      ggr.getGaltToken().transferFrom(msg.sender, address(this), _applicationFeeInGalt);
      fee = _applicationFeeInGalt;
      currency = Currency.GALT;
    }

    Application memory a;

    a.status = ApplicationStatus.SUBMITTED;
    a.multiSig = _multiSig;
    a.applicant = msg.sender;
    a.m = m;
    a.n = n;

    a.fees.currency = currency;

    calculateAndStoreFee(a, fee);

    applications[_id] = a;

    applicationsArray.push(_id);
    applicationsByApplicant[msg.sender].push(_id);

    emit NewApplication(_id, msg.sender);
    emit ApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);
  }

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

  // NOTICE: in case 100 ether / 3, each arbitrator will receive 33.33... ether and 1 wei will remain on contract
  function calculateAndStoreAuditorRewards (Application storage c) internal {
    uint256 len = c.arbitrators.size();
    uint256 rewardSize = c.fees.arbitratorsReward.div(len);

    c.fees.arbitratorReward = rewardSize;
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
      address[] memory arbitrators,
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