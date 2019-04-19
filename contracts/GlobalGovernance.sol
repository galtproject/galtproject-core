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

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/drafts/Counter.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "@galtproject/libs/contracts/traits/Initializable.sol";
import "./interfaces/IACL.sol";
import "./reputation/interfaces/ILockableRA.sol";
import "./reputation/interfaces/IRA.sol";
import "./registries/interfaces/IMultiSigRegistry.sol";
import "./registries/GaltGlobalRegistry.sol";
import "./interfaces/IGlobalGovernance.sol";
import "./interfaces/IStakeTracker.sol";


contract GlobalGovernance is Initializable, IGlobalGovernance {
  using Counter for Counter.Counter;

  event NewProposal(uint256 id, address indexed creator, address indexed destination);

  uint256 public constant DECIMALS = 10**6;

  enum ProposalStatus {
    NULL,
    ACTIVE,
    APPROVED,
    REJECTED
  }

  enum Choice {
    PENDING,
    AYE,
    NAY
  }

  struct ProposalVoting {
    ProposalStatus status;
    mapping(address => Choice) participants;
    ArraySet.AddressSet ayes;
    ArraySet.AddressSet nays;
  }

  struct Proposal {
    ProposalStatus status;
    address creator;
    address destination;
    uint256 value;
    bytes32 marker;
    bytes data;
    bytes response;
  }

  mapping(bytes32 => uint256) public thresholds;
  mapping(uint256 => Proposal) public proposals;

  Counter.Counter internal idCounter;
  GaltGlobalRegistry internal ggr;

  uint256 public spaceSharePercent = 30;
  uint256 public galtSharePercent = 40;
  uint256 public stakeSharePercent = 30;

  // in percents (0 < threshold <= 100)
  uint256 public defaultThreshold;

  modifier onlyValidMultiSig() {
    require(
      IMultiSigRegistry(ggr.getMultiSigRegistryAddress()).isMultiSigValid(msg.sender) == true,
      "Invalid MultiSig"
    );

    _;
  }

  function initialize(GaltGlobalRegistry _ggr) external isInitializer {
    ggr = _ggr;
    defaultThreshold = 51 * DECIMALS / 100;
  }

  function setShares(uint256 _spaceShare, uint256 _galtShare, uint256 _stakeShare) public {
    require(_spaceShare + _galtShare + _stakeShare == 100, "Share sum should be eq 100");

    spaceSharePercent = _spaceShare;
    galtSharePercent = _galtShare;
    stakeSharePercent = _stakeShare;
  }

  function propose(
    address _destination,
    uint256 _value,
    bytes calldata _data
  )
    external
//    onlyValidMultiSig
    returns(uint256)
  {
    uint256 id = idCounter.next();
    Proposal storage p = proposals[id];

    p.creator = msg.sender;
    p.destination = _destination;
    p.value = _value;
    p.data = _data;

    // TODO: build marker

    emit NewProposal(id, msg.sender, _destination);

    return id;
  }

  function trigger(uint256 _proposalId) external {
    uint256 support = getSupport(_proposalId);

    assert(support <= DECIMALS);

    // TODO: check custom thresholds
    require(support > defaultThreshold, "Threshold doesn't reached yet");

    execute(_proposalId);
  }

  function execute(uint256 _proposalId) internal {
    Proposal storage p = proposals[_proposalId];

    // TODO: configure the gas value
    (bool x, bytes memory response) = address(p.destination)
      .call
      .value(p.value)
      .gas(gasleft() - 50000)(p.data);

    assert(x == true);

    p.response = response;
  }

  // GETTERS

  function getSupport(uint256 _proposalId) public view returns(uint256) {
    address[] memory supportMultiSigs = getSupportedMultiSigs(_proposalId);

    address spaceRA = ggr.getSpaceRAAddress();
    address galtRA = ggr.getGaltRAAddress();
    IStakeTracker stakeTracker = IStakeTracker(ggr.getStakeTrackerAddress());

    uint256 totalSpace = IRA(spaceRA).totalSupply();
    uint256 totalGalt = IRA(galtRA).totalSupply();
    uint256 totalStake = stakeTracker.totalSupply();

    uint256 supportBySpace = ILockableRA(spaceRA).lockedMultiSigBalances(supportMultiSigs);
    uint256 supportByGalt = ILockableRA(galtRA).lockedMultiSigBalances(supportMultiSigs);
    uint256 supportByStake = stakeTracker.balancesOf(supportMultiSigs);

    (, , , uint256 totalSupport) = calculateSupport(supportBySpace, supportByGalt, supportByStake, totalSpace, totalGalt, totalStake);

    return totalSupport;
  }

  function getSupportedMultiSigs(uint256 _proposalId) public view returns(address[] memory) {
    IMultiSigRegistry multiSigRegistry = IMultiSigRegistry(ggr.getMultiSigRegistryAddress());
    address[] memory validMultiSigs = multiSigRegistry.getMultiSigList();
    uint256 len = validMultiSigs.length;
    address[] memory supportMultiSigs = new address[](len);
    uint256 sI = 0;

    // TODO: walk through the multiSig list and poll for approval
    for (uint256 i = 0; i < len; i++) {
      IArbitrationConfig config = IArbitrationConfig(multiSigRegistry.getArbitrationConfig(validMultiSigs[i]));

      if (config.globalProposalSupport(_proposalId) == true) {
        supportMultiSigs[sI] = validMultiSigs[i];
        sI += 1;
      }
    }

    if (sI == 0) {
      return new address[](0);
    }

    // supportMultiSigs.length = pI
    assembly { mstore(supportMultiSigs, sI) }

    return supportMultiSigs;
  }

  function getSupportDetails(
    uint256 _proposalId
  )
    external
    view
    returns(
      uint256 supportBySpace,
      uint256 supportByGalt,
      uint256 supportByStake,
      uint256 totalSpace,
      uint256 totalGalt,
      uint256 totalStake,
      uint256 spaceShare,
      uint256 galtShare,
      uint256 stakeShare,
      uint256 totalSupport
    )
  {
    address[] memory supportMultiSigs = getSupportedMultiSigs(_proposalId);

    address spaceRA = ggr.getSpaceRAAddress();
    address galtRA = ggr.getGaltRAAddress();
    IStakeTracker stakeTracker = IStakeTracker(ggr.getStakeTrackerAddress());

    totalSpace = IRA(spaceRA).totalSupply();
    totalGalt = IRA(galtRA).totalSupply();
    totalStake = stakeTracker.totalSupply();

    supportBySpace = ILockableRA(spaceRA).lockedMultiSigBalances(supportMultiSigs);
    supportByGalt = ILockableRA(galtRA).lockedMultiSigBalances(supportMultiSigs);
    supportByStake = stakeTracker.balancesOf(supportMultiSigs);

    (spaceShare, galtShare, stakeShare, totalSupport) = calculateSupport(supportBySpace, supportByGalt, supportByStake, totalSpace, totalGalt, totalStake);
  }

  function calculateSupport(
    uint256 _supportBySpace,
    uint256 _supportByGalt,
    uint256 _supportByStake,
    uint256 _totalSpace,
    uint256 _totalGalt,
    uint256 _totalStake
  )
    public
    view
    returns(
      uint256 spaceShare,
      uint256 galtShare,
      uint256 stakeShare,
      uint256 totalSupport
    )
  {
    spaceShare = (_supportBySpace * DECIMALS * spaceSharePercent) / _totalSpace / 100;
    galtShare = (_supportByGalt * DECIMALS * galtSharePercent) / _totalGalt / 100;
    stakeShare = (_supportByStake * DECIMALS * stakeSharePercent) / _totalStake / 100;

    totalSupport = (spaceShare + galtShare + stakeShare);
  }
}
