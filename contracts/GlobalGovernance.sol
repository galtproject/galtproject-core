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

import "openzeppelin-solidity/contracts/drafts/Counters.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "./interfaces/IACL.sol";
import "./reputation/interfaces/ILockableRA.sol";
import "./reputation/interfaces/IRA.sol";
import "./registries/interfaces/IPGGRegistry.sol";
import "./registries/GaltGlobalRegistry.sol";
import "./interfaces/IGlobalGovernance.sol";
import "./interfaces/IStakeTracker.sol";


contract GlobalGovernance is OwnableAndInitializable, IGlobalGovernance {
  using Counters for Counters.Counter;

  event NewProposal(uint256 id, address indexed creator, address indexed destination);

  bytes32 public constant GLOBAL_PROPOSAL_CREATOR_ROLE = bytes32("global_proposal_creator");

  // keccak256(setShares(uint256,uint256,uint256))
  bytes32 public constant SET_SHARES_THRESHOLD = bytes32(uint256(0xa0885e93));
  // keccak256(setThreshold(bytes32,uint256))
  bytes32 public constant SET_THRESHOLD_THRESHOLD = bytes32(uint256(0xa4db7b4d));

  uint256 public constant DECIMALS = 10**6;

  enum Choice {
    PENDING,
    AYE,
    NAY
  }

  struct ProposalVoting {
    mapping(address => Choice) participants;
    ArraySet.AddressSet ayes;
    ArraySet.AddressSet nays;
  }

  struct Proposal {
    address creator;
    address destination;
    uint256 value;
    bytes32 marker;
    bytes data;
    bool executed;
    bytes response;
  }

  mapping(bytes32 => uint256) public thresholds;
  mapping(uint256 => Proposal) public proposals;

  Counters.Counter internal idCounter;
  GaltGlobalRegistry internal ggr;

  uint256 public spaceSharePercent;
  uint256 public galtSharePercent;
  uint256 public stakeSharePercent;

  // in percents (0 < threshold <= 100)
  uint256 public defaultThreshold;

  modifier onlyValidPgg(address _pgg) {
    require(
      IPGGRegistry(ggr.getPggRegistryAddress())
        .getPggConfig(_pgg)
        .hasExternalRole(GLOBAL_PROPOSAL_CREATOR_ROLE, msg.sender) == true,
      "No permission for this action"
    );

    _;
  }

  modifier onlyGlobalGovernance() {
    require(msg.sender == address(this), "Not a GlobalGovernance contract");

    _;
  }

  function initialize(
    GaltGlobalRegistry _ggr,
    uint256 _setSharesThreshold,
    uint256 _setThresholdThreshold
  )
    external
    isInitializer
  {
    ggr = _ggr;
    defaultThreshold = 51 * DECIMALS / 100;

    thresholds[keccak256(abi.encode(address(this), SET_SHARES_THRESHOLD))] = _setSharesThreshold;
    thresholds[keccak256(abi.encode(address(this), SET_THRESHOLD_THRESHOLD))] = _setThresholdThreshold;

    spaceSharePercent = 30;
    galtSharePercent = 40;
    stakeSharePercent = 30;
  }

  function setShares(uint256 _spaceShare, uint256 _galtShare, uint256 _stakeShare) external onlyGlobalGovernance {
    require(_spaceShare + _galtShare + _stakeShare == 100, "Share sum should be eq 100");

    spaceSharePercent = _spaceShare;
    galtSharePercent = _galtShare;
    stakeSharePercent = _stakeShare;
  }

  /**
   * @dev Set a new threshold for a given key. Can be called only while executing a proposal.
   *
   * @param _marker is keccak256(abi.encode(bytes32 destination, bytes32 methodSignature))
   * @param _value of threshold in percents when 100% == 1 * DECIMALS (currently 1000000)
   */
  function setThreshold(bytes32 _marker, uint256 _value) external onlyGlobalGovernance {
    require(_value > 0 && _value <= DECIMALS, "Invalid threshold value");

    thresholds[_marker] = _value;
  }

  function getMarker(address _destination, bytes memory _data) public view returns(bytes32 marker) {
    bytes32 methodName;

    assembly {
      methodName := and(mload(add(_data, 0x20)), 0xffffffff00000000000000000000000000000000000000000000000000000000)
    }

    return keccak256(abi.encode(_destination, methodName));
  }

  function propose(
    address _pgg,
    address _destination,
    uint256 _value,
    bytes calldata _data
  )
    external
    onlyValidPgg(_pgg)
    returns(uint256)
  {
    idCounter.increment();
    uint256 id = idCounter.current();

    Proposal storage p = proposals[id];

    p.creator = msg.sender;
    p.destination = _destination;
    p.value = _value;
    p.data = _data;
    p.marker = getMarker(_destination, _data);

    emit NewProposal(id, msg.sender, _destination);

    return id;
  }

  function trigger(uint256 _proposalId) external {
    uint256 support = getSupport(_proposalId);
    assert(support <= DECIMALS);

    Proposal storage p = proposals[_proposalId];

    uint256 customThreshold = thresholds[p.marker];
    if (customThreshold > 0) {
      require(support >= customThreshold, "Threshold doesn't reached yet");
    } else {
      require(support >= defaultThreshold, "Threshold doesn't reached yet");
    }

    execute(_proposalId);
  }

  function execute(uint256 _proposalId) internal {
    Proposal storage p = proposals[_proposalId];

    require(p.executed == false, "Already executed");

    p.executed = true;

    (bool x, bytes memory response) = address(p.destination)
      .call
      .value(p.value)
      .gas(gasleft() - 50000)(p.data);

    p.executed = x;
    p.response = response;
  }

  // GETTERS

  function getProposalResponseAsErrorString(uint256 _proposalId) public view returns (string memory) {
    return string(proposals[_proposalId].response);
  }

  function getSupport(uint256 _proposalId) public view returns(uint256) {
    address[] memory supportPggs = getSupportedPggs(_proposalId);

    address spaceRA = ggr.getSpaceRAAddress();
    address galtRA = ggr.getGaltRAAddress();
    IStakeTracker stakeTracker = IStakeTracker(ggr.getStakeTrackerAddress());

    uint256 totalSpace = IRA(spaceRA).totalSupply();
    uint256 totalGalt = IRA(galtRA).totalSupply();
    uint256 totalStake = stakeTracker.totalSupply();

    uint256 supportBySpace = ILockableRA(spaceRA).lockedPggBalances(supportPggs);
    uint256 supportByGalt = ILockableRA(galtRA).lockedPggBalances(supportPggs);
    uint256 supportByStake = stakeTracker.balancesOf(supportPggs);

    (, , , uint256 totalSupport) = calculateSupport(supportBySpace, supportByGalt, supportByStake, totalSpace, totalGalt, totalStake);

    return totalSupport;
  }

  function getSupportedPggs(uint256 _proposalId) public view returns(address[] memory) {
    IPGGRegistry pggRegistry = IPGGRegistry(ggr.getPggRegistryAddress());
    address[] memory validPggs = pggRegistry.getPggList();
    uint256 len = validPggs.length;
    address[] memory supportPggs = new address[](len);
    uint256 sI = 0;

    for (uint256 i = 0; i < len; i++) {
      if (IPGGConfig(validPggs[i]).globalProposalSupport(_proposalId) == true) {
        supportPggs[sI] = validPggs[i];
        sI += 1;
      }
    }

    if (sI == 0) {
      return new address[](0);
    }

    // supportPggs.length = pI
    assembly { mstore(supportPggs, sI) }

    return supportPggs;
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
    address[] memory supportPggs = getSupportedPggs(_proposalId);

    address spaceRA = ggr.getSpaceRAAddress();
    address galtRA = ggr.getGaltRAAddress();
    IStakeTracker stakeTracker = IStakeTracker(ggr.getStakeTrackerAddress());

    totalSpace = IRA(spaceRA).totalSupply();
    totalGalt = IRA(galtRA).totalSupply();
    totalStake = stakeTracker.totalSupply();

    supportBySpace = ILockableRA(spaceRA).lockedPggBalances(supportPggs);
    supportByGalt = ILockableRA(galtRA).lockedPggBalances(supportPggs);
    supportByStake = stakeTracker.balancesOf(supportPggs);

    (spaceShare, galtShare, stakeShare, totalSupport) = calculateSupport(
      supportBySpace,
      supportByGalt,
      supportByStake,
      totalSpace,
      totalGalt,
      totalStake
    );
  }

  function getPggWeight(
    address _pgg
  )
    external
    view
    returns(
      uint256 space,
      uint256 galt,
      uint256 stake,
      uint256 totalSpace,
      uint256 totalGalt,
      uint256 totalStake,
      uint256 spaceShare,
      uint256 galtShare,
      uint256 stakeShare,
      uint256 weight
    )
  {
    address spaceRA = ggr.getSpaceRAAddress();
    address galtRA = ggr.getGaltRAAddress();
    IStakeTracker stakeTracker = IStakeTracker(ggr.getStakeTrackerAddress());

    totalSpace = IRA(spaceRA).totalSupply();
    totalGalt = IRA(galtRA).totalSupply();
    totalStake = stakeTracker.totalSupply();

    space = ILockableRA(spaceRA).lockedPggBalance(_pgg);
    galt = ILockableRA(galtRA).lockedPggBalance(_pgg);
    stake = stakeTracker.balanceOf(_pgg);

    (spaceShare, galtShare, stakeShare, weight) = calculateSupport(space, galt, stake, totalSpace, totalGalt, totalStake);
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
    assert(spaceSharePercent + galtSharePercent + stakeSharePercent == 100);

    spaceShare = (_supportBySpace * DECIMALS * spaceSharePercent) / _totalSpace / 100;
    galtShare = (_supportByGalt * DECIMALS * galtSharePercent) / _totalGalt / 100;
    stakeShare = (_supportByStake * DECIMALS * stakeSharePercent) / _totalStake / 100;

    totalSupport = (spaceShare + galtShare + stakeShare);
  }
}
