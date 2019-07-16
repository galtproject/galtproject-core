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


import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/traits/Statusable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../registries/PGGRegistry.sol";
import "./AbstractApplication.sol";
import "./AbstractArbitratorApplication.sol";


contract ArbitratorApprovableApplication is AbstractArbitratorApplication, Statusable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  event NewApplication(address indexed applicant, bytes32 applicationId);
  event ApplicationStatusChanged(bytes32 indexed applicationId, ApplicationStatus indexed status);
  event ArbitratorSlotTaken(bytes32 indexed applicationId, uint256 slotsTaken, uint256 totalSlots);
  event Aye(bytes32 indexed applicationId, uint256 indexed ayeCount, uint256 nayCount, uint256 threshold);
  event Nay(bytes32 indexed applicationId, uint256 indexed ayeCount, uint256 nayCount, uint256 threshold);
  event ArbitratorRewardClaim(bytes32 indexed applicationId, address indexed oracle);
  event GaltProtocolFeeAssigned(bytes32 indexed applicationId);

  struct Application {
    bytes32 id;
    address pgg;
    address applicant;

    // votes required
    uint256 m;
    // available slots to vote
    uint256 n;

    uint256 ayeCount;
    uint256 nayCount;

    uint256 createdAt;

    ApplicationStatus status;
    Rewards rewards;

    ArraySet.AddressSet arbitrators;
    mapping(address => Choice) votes;
  }

  enum Choice {
    PENDING,
    AYE,
    NAY
  }

  struct Rewards {
    Currency currency;

    uint256 totalReward;

    // arbitratorsReward + galtProtocolFee = totalReward
    uint256 arbitratorsReward;
    uint256 galtProtocolFee;

    // a single arbitrator reward
    uint256 arbitratorReward;

    mapping(address => bool) arbitratorRewardPaidOut;
    bool galtProtocolFeePaidOut;
  }

  mapping(bytes32 => Application) internal applications;

  constructor() public {}

  function _execute(bytes32) internal;
  function minimalApplicationFeeEth(address _pgg) internal view returns (uint256);
  function minimalApplicationFeeGalt(address _pgg) internal view returns (uint256);
  function m(address _pgg) public view returns (uint256);
  function n(address _pgg) public view returns (uint256);

  /**
   * @dev Any arbitrator locks an application if an empty slots available
   * @param _aId Application ID
   */
  function lock(bytes32 _aId) external {
    Application storage a = applications[_aId];

    pggRegistry().requireValidPgg(a.pgg);
    require(pggConfig(a.pgg).getMultiSig().isOwner(msg.sender), "Not active arbitrator");

    require(a.status == ApplicationStatus.SUBMITTED, "SUBMITTED claim status required");
    require(!a.arbitrators.has(msg.sender), "Arbitrator has already locked the application");
    require(a.arbitrators.size() < n(a.pgg), "All arbitrator slots are locked");

    a.arbitrators.add(msg.sender);

    emit ArbitratorSlotTaken(_aId, a.arbitrators.size(), n(a.pgg));
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
      a.status = ApplicationStatus.APPROVED;
      _execute(_aId);
      calculateAndStoreAuditorRewards(a);
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
    require(a.rewards.arbitratorRewardPaidOut[msg.sender] == false, "Reward already paid out");

    a.rewards.arbitratorRewardPaidOut[msg.sender] = true;

    _assignGaltProtocolFee(a);

    if (a.rewards.currency == Currency.ETH) {
      msg.sender.transfer(a.rewards.arbitratorReward);
    } else if (a.rewards.currency == Currency.GALT) {
      ggr.getGaltToken().transfer(msg.sender, a.rewards.arbitratorReward);
    }

    emit ArbitratorRewardClaim(_aId, msg.sender);
  }

  function _assignGaltProtocolFee(Application storage _a) internal {
    if (_a.rewards.galtProtocolFeePaidOut == false) {
      if (_a.rewards.currency == Currency.ETH) {
        protocolFeesEth = protocolFeesEth.add(_a.rewards.galtProtocolFee);
      } else if (_a.rewards.currency == Currency.GALT) {
        protocolFeesGalt = protocolFeesGalt.add(_a.rewards.galtProtocolFee);
      }

      _a.rewards.galtProtocolFeePaidOut = true;
      emit GaltProtocolFeeAssigned(_a.id);
    }
  }

  // INTERNALS

  function _initialize(
    GaltGlobalRegistry _ggr
  )
    internal
  {
    ggr = _ggr;
  }

  function _submit(
    bytes32 _id,
    address _pgg,
    uint256 _applicationFeeInGalt
  )
    internal
  {
    pggRegistry().requireValidPgg(_pgg);

    // Default is ETH
    Currency currency;
    uint256 fee;

    // ETH
    if (msg.value > 0) {
      requireValidPaymentType(_pgg, PaymentType.ETH);
      require(_applicationFeeInGalt == 0, "Could not accept both ETH and GALT");
      require(msg.value >= minimalApplicationFeeEth(_pgg), "Incorrect fee passed in");
      fee = msg.value;
      // GALT
    } else {
      requireValidPaymentType(_pgg, PaymentType.GALT);
      require(msg.value == 0, "Could not accept both ETH and GALT");
      require(_applicationFeeInGalt >= minimalApplicationFeeGalt(_pgg), "Incorrect fee passed in");
      ggr.getGaltToken().transferFrom(msg.sender, address(this), _applicationFeeInGalt);
      fee = _applicationFeeInGalt;
      currency = Currency.GALT;
    }

    Application storage a = applications[_id];
    require(a.status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    a.id = _id;
    a.status = ApplicationStatus.SUBMITTED;
    a.pgg = _pgg;
    a.applicant = msg.sender;
    a.createdAt = block.timestamp;
    a.m = m(_pgg);
    a.n = n(_pgg);

    a.rewards.currency = currency;

    calculateAndStoreFee(a, fee);

    applicationsArray.push(_id);
    applicationsByApplicant[msg.sender].push(_id);

    emit NewApplication(msg.sender, _id);
    emit ApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);
  }

  function calculateAndStoreFee(
    Application storage _a,
    uint256 _fee
  )
    internal
  {
    uint256 share;

    (uint256 ethFee, uint256 galtFee) = getProtocolShares();

    if (_a.rewards.currency == Currency.ETH) {
      share = ethFee;
    } else {
      share = galtFee;
    }

    assert(share > 0);
    assert(share <= 100);

    uint256 galtProtocolFee = share.mul(_fee).div(100);
    uint256 arbitratorsReward = _fee.sub(galtProtocolFee);

    assert(arbitratorsReward.add(galtProtocolFee) == _fee);

    _a.rewards.arbitratorsReward = arbitratorsReward;
    _a.rewards.galtProtocolFee = galtProtocolFee;
  }

  // NOTICE: in case 100 ether / 3, each arbitrator will receive 33.33... ether and 1 wei will remain on contract
  function calculateAndStoreAuditorRewards (Application storage c) internal {
    uint256 len = c.arbitrators.size();
    uint256 rewardSize = c.rewards.arbitratorsReward.div(len);

    c.rewards.arbitratorReward = rewardSize;
  }

  // GETTERS

  function getApplication(
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
      uint256 nayCount,
      uint256 createdAt
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
      m.nayCount,
      m.createdAt
    );
  }

  function getApplicationRewards(
    bytes32 _id
  )
    external
    view
    returns (
      Currency currency,
      uint256 arbitratorsReward,
      uint256 galtProtocolFee,
      bool galtProtocolFeePaidOut
    )
  {
    Rewards storage f = applications[_id].rewards;

    return (
      f.currency,
      f.arbitratorsReward,
      f.galtProtocolFee,
      f.galtProtocolFeePaidOut
    );
  }
}
