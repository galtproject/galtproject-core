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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../SpaceToken.sol";
import "../SplitMerge.sol";
import "../Oracles.sol";
import "../PlotEscrow.sol";
import "../AbstractOracleApplication.sol";
import "../traits/Statusable.sol";
import "../registries/SpaceCustodianRegistry.sol";


contract PlotCustodianManager is AbstractOracleApplication, Statusable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  // `PlotCustodianManager` keccak256 hash
  bytes32 public constant APPLICATION_TYPE = 0xe2ce825e66d1e2b4efe1252bf2f9dc4f1d7274c343ac8a9f28b6776eb58188a6;

  // `PC_CUSTODIAN_ORACLE_TYPE` bytes32 representation hash
  bytes32 public constant PC_CUSTODIAN_ORACLE_TYPE = 0x50435f435553544f4449414e5f4f5241434c455f545950450000000000000000;
  // `PC_AUDITOR_ORACLE_TYPE` bytes32 representation
  bytes32 public constant PC_AUDITOR_ORACLE_TYPE = 0x50435f41554449544f525f4f5241434c455f5459504500000000000000000000;

  uint256 public constant MODIFY_CUSTODIAN_LIMIT = 10;
  uint256 public constant TOTAL_CUSTODIAN_LIMIT = 10;

  enum ValidationStatus {
    NOT_EXISTS,
    PENDING,
    LOCKED
  }

  enum Action {
    ATTACH,
    DETACH
  }

  enum Choice {
    PENDING,
    APPROVE,
    REJECT
  }

  event LogApplicationStatusChanged(bytes32 applicationId, ApplicationStatus status);
  event LogValidationStatusChanged(bytes32 applicationId, bytes32 role, ValidationStatus status);
  event LogNewApplication(bytes32 id, address applicant);

  struct Application {
    bytes32 id;
    address applicant;
    address auditor;
    uint256 spaceTokenId;
    bool throughEscrow;
    string rejectMessage;

    Action action;
    Currency currency;
    ApplicationStatus status;

    bytes32[] custodianDocuments;

    ArraySet.AddressSet custodiansToModify;
    ArraySet.AddressSet acceptedCustodians;
    ArraySet.AddressSet lockedCustodians;

    Voting voting;
    Rewards rewards;
  }

  struct Voting {
    uint256 approveCount;

    uint256 required;

    // voters = unique(acceptedCustodians + lockedCustodians) + 1 auditor + 1 applicant
    ArraySet.AddressSet voters;
    mapping(address => bool) approvals;
  }

  struct Rewards {
    uint256 galtSpaceReward;
    // oraclesReward = custodianReward * N + auditorReward (with some chance of error)
    uint256 oraclesReward;
    uint256 totalCustodiansReward;
    uint256 custodianReward;
    uint256 auditorReward;

    bool galtSpaceRewardPaidOut;
    bool auditorRewardPaidOut;
    mapping(address => bool) custodianRewardPaidOut;
  }

  mapping(bytes32 => Application) private applications;

  // TODO: do not store in the application contract
  mapping(uint256 => ArraySet.AddressSet) private assignedCustodians;

  SpaceToken public spaceToken;
  SplitMerge public splitMerge;
  PlotEscrow public plotEscrow;
  SpaceCustodianRegistry public spaceCustodianRegistry;

  modifier onlyApplicant(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(
      a.applicant == msg.sender,
      "Invalid applicant");

    _;
  }

  modifier onlyParticipatingCustodian(bytes32 _aId) {
    Application storage a = applications[_aId];

    require(
      a.acceptedCustodians.has(msg.sender) ||
      a.lockedCustodians.has(msg.sender),
      "Only a custodian role is allowed to perform this action");

    _;
  }

  // TODO: move to abstract class
  modifier oraclesReady() {
    require(oracles.isApplicationTypeReady(APPLICATION_TYPE), "Oracles list not complete");

    _;
  }

  constructor () public {}

  function initialize(
    SpaceToken _spaceToken,
    SplitMerge _splitMerge,
    Oracles _oracles,
    ERC20 _galtToken,
    PlotEscrow _plotEscrow,
    SpaceCustodianRegistry _spaceCustodianRegistry,
    address _galtSpaceRewardsAddress
  )
    external
    isInitializer
  {
    spaceToken = _spaceToken;
    splitMerge = _splitMerge;
    oracles = _oracles;
    galtToken = _galtToken;
    plotEscrow = _plotEscrow;
    galtSpaceRewardsAddress = _galtSpaceRewardsAddress;
    spaceCustodianRegistry = _spaceCustodianRegistry;

    // Default values for revenue shares and application fees
    // Override them using one of the corresponding setters
    minimalApplicationFeeInEth = 1;
    minimalApplicationFeeInGalt = 10;
    galtSpaceEthShare = 33;
    galtSpaceGaltShare = 33;
    paymentMethod = PaymentMethod.ETH_AND_GALT;
  }

  /**
   * @dev Submit a new custodian management application from PlotEscrow contract
   */
  function submitApplicationFromEscrow(
    uint256 _spaceTokenId,
    Action _action,
    address[] _custodiansToModify,
    address _applicant,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    returns (bytes32)
  {
    require(msg.sender == address(plotEscrow), "Only trusted PlotEscrow contract allowed overriding applicant address");
    require(_applicant != address(0), "Should specify applicant");
    require(spaceToken.exists(_spaceTokenId), "SpaceToken with the given ID doesn't exist");
    require(spaceToken.ownerOf(_spaceTokenId) == address(plotEscrow), "PlotEscrow contract should own the token");

    return submitApplicationHelper(
      _spaceTokenId,
      _action,
      _applicant,
      _custodiansToModify,
      true,
      _applicationFeeInGalt
    );
  }

  /**
   * @dev Submit a new custodian management application
   * @param _spaceTokenId package SpaceToken ID
   * @param _action either ATTACH or DETACH custodian
   * @param _custodiansToModify which would be either pushed to the current ones or removed
   * @param _applicationFeeInGalt if GALT is application currency, 0 for ETH
   */
  function submit(
    uint256 _spaceTokenId,
    Action _action,
    address[] _custodiansToModify,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    returns (bytes32)
  {
    require(spaceToken.exists(_spaceTokenId), "SpaceToken with the given ID doesn't exist");
    require(spaceToken.ownerOf(_spaceTokenId) == msg.sender, "Sender should own the token");

    return submitApplicationHelper(
      _spaceTokenId,
      _action,
      msg.sender,
      _custodiansToModify,
      false,
      _applicationFeeInGalt
    );
  }

  function submitApplicationHelper(
    uint256 _spaceTokenId,
    Action _action,
    address _applicant,
    address[] _custodiansToModify,
    bool _throughEscrow,
    uint256 _applicationFeeInGalt
  )
    internal
    returns (bytes32)
  {
    require(_custodiansToModify.length <= MODIFY_CUSTODIAN_LIMIT, "Too many custodians to modify");

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
      galtToken.transferFrom(_applicant, address(this), _applicationFeeInGalt);
      fee = _applicationFeeInGalt;
      currency = Currency.GALT;
    }

    bytes32 _id = keccak256(
      abi.encodePacked(
        _spaceTokenId,
        blockhash(block.number),
        applicationsArray.length
      )
    );

    require(applications[_id].status == ApplicationStatus.NOT_EXISTS, "Application already exists");

    Application storage a = applications[_id];

    _storeCustodians(a, _spaceTokenId, _custodiansToModify, _action);

    a.status = ApplicationStatus.SUBMITTED;
    a.id = _id;
    a.throughEscrow = _throughEscrow;
    a.applicant = _applicant;
    a.currency = currency;
    a.spaceTokenId = _spaceTokenId;
    a.action = _action;

    calculateAndStoreFee(a, fee);

    applicationsArray.push(_id);
    applicationsByApplicant[_applicant].push(_id);

    emit LogNewApplication(_id, _applicant);
    emit LogApplicationStatusChanged(_id, ApplicationStatus.SUBMITTED);

    return _id;
  }

  /**
   * @dev Resubmit an already reverted application
   * @param _aId application ID
   * @param _spaceTokenId package SpaceToken ID
   * @param _action either ATTACH or DETACH custodian
   * @param _custodiansToModify which would consider working on this application
   */
  function resubmit(
    bytes32 _aId,
    uint256 _spaceTokenId,
    Action _action,
    address[] _custodiansToModify
  )
    external
    onlyApplicant(_aId)
    returns (bytes32)
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.REVERTED, "Application status should be REVERTED");
    require(spaceToken.exists(_spaceTokenId), "SpaceToken with the given ID doesn't exist");
    require(spaceToken.ownerOf(_spaceTokenId) == msg.sender, "Sender should own the token");

    a.custodiansToModify.clear();
    _storeCustodians(a, _spaceTokenId, _custodiansToModify, _action);

    a.spaceTokenId = _spaceTokenId;
    a.action = _action;
    a.acceptedCustodians.clear();
    a.lockedCustodians.clear();

    changeApplicationStatus(a, ApplicationStatus.SUBMITTED);
  }

  function _storeCustodians(
    Application storage _a,
    uint256 _spaceTokenId,
    address[] memory _custodiansToModify,
    Action _action
  )
    internal
  {
    uint256 len = _custodiansToModify.length;

    require((assignedCustodians[_spaceTokenId].size() + len) < TOTAL_CUSTODIAN_LIMIT, "Exceed total custodian limit");

    for (uint256 i = 0; i < len; i++) {
      address custodian = _custodiansToModify[i];
      oracles.requireOracleActiveWithAssignedActiveOracleType(custodian, PC_CUSTODIAN_ORACLE_TYPE);

      if (_action == Action.ATTACH) {
        require(!assignedCustodians[_spaceTokenId].has(custodian), "Custodian already locked a slot");
      } else {
        require(assignedCustodians[_spaceTokenId].has(custodian), "Custodian doesn't have slot");
      }

      _a.custodiansToModify.add(custodian);
    }
  }

  /**
   * @dev Application can be reverted by a custodian
   * @param _aId application ID
   */
  function revert(bytes32 _aId) external {
    Application storage a = applications[_aId];
    oracles.requireOracleActiveWithAssignedActiveOracleType(msg.sender, PC_CUSTODIAN_ORACLE_TYPE);

    require(
      a.status == ApplicationStatus.SUBMITTED || a.status == ApplicationStatus.ACCEPTED,
      "Application status should be SUBMITTED or ACCEPTED");
    require(
      a.custodiansToModify.has(msg.sender) ||
      assignedCustodians[a.spaceTokenId].has(msg.sender),
      "Not valid custodian");

    changeApplicationStatus(a, ApplicationStatus.REVERTED);
  }

  /**
   * @dev The modifying custodians accept changes
   * @param _aId application ID
   */
  function accept(bytes32 _aId) external {
    Application storage a = applications[_aId];
    oracles.requireOracleActiveWithAssignedActiveOracleType(msg.sender, PC_CUSTODIAN_ORACLE_TYPE);

    require(
      a.status == ApplicationStatus.SUBMITTED,
      "Application status should be SUBMITTED");

    require(a.custodiansToModify.has(msg.sender), "Not in modifiers list");
    require(!a.acceptedCustodians.has(msg.sender), "Already accepted");

    a.acceptedCustodians.add(msg.sender);

    // TODO: add/replace with event
    applicationsByOracle[msg.sender].push(_aId);

    if (a.acceptedCustodians.size() == a.custodiansToModify.size()) {
      if (assignedCustodians[a.spaceTokenId].size() == 0) {
        changeApplicationStatus(a, ApplicationStatus.LOCKED);
      } else {
        changeApplicationStatus(a, ApplicationStatus.ACCEPTED);
      }
    }
  }

  /**
   * @dev Existing custodians lock application
   * @param _aId application ID
   */
  function lock(bytes32 _aId) external {
    Application storage a = applications[_aId];
    oracles.requireOracleActiveWithAssignedActiveOracleType(msg.sender, PC_CUSTODIAN_ORACLE_TYPE);

    require(
      a.status == ApplicationStatus.ACCEPTED,
      "Application status should be ACCEPTED");
    require(assignedCustodians[a.spaceTokenId].has(msg.sender), "Not in assigned list");
    require(!a.lockedCustodians.has(msg.sender), "Already locked");

    a.lockedCustodians.add(msg.sender);

    // TODO: add/replace with event
    applicationsByOracle[msg.sender].push(_aId);

    if (assignedCustodians[a.spaceTokenId].size() == a.lockedCustodians.size()) {
      changeApplicationStatus(a, ApplicationStatus.LOCKED);
    }
  }

  /**
   * @dev Attach SpaceToken to an application
   * @param _aId application ID
   */
  function attachToken(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];
    ArraySet.AddressSet storage voters = a.voting.voters;

    require(
      a.status == ApplicationStatus.LOCKED,
      "Application status should be LOCKED");
    spaceToken.transferFrom(a.throughEscrow ? plotEscrow : a.applicant, address(this), a.spaceTokenId);
    // TODO: assign values;

    // voters = unique(acceptedCustodians + lockedCustodians) + 1 auditor + 1 applicant
    uint256 votersCount = a.acceptedCustodians.size() + 2;

    address[] memory accepted = a.acceptedCustodians.elements();
    for (uint256 i = 0; i < accepted.length; i++) {
      voters.add(accepted[i]);
    }

    address[] memory current = a.lockedCustodians.elements();
    for (uint256 i = 0; i < current.length; i++) {
      if (!voters.has(current[i])) {
        voters.add(current[i]);
        votersCount++;
      }
    }

    voters.add(a.applicant);
    a.voting.required = votersCount;

    _calculateAndStoreCustodianRewards(a);

    changeApplicationStatus(a, ApplicationStatus.REVIEW);
  }

  /**
   * @dev Custodian attaches documents to the application.
   * Allows multiple calls. Each call replaces the previous document hashes array with a new one.
   *
   * @param _aId application ID
   * @param _documents to attach
   */
  function attachDocuments(
    bytes32 _aId,
    bytes32[] _documents
  )
    external
    onlyParticipatingCustodian(_aId)
  {
    Application storage a = applications[_aId];
    oracles.requireOracleActiveWithAssignedActiveOracleType(msg.sender, PC_CUSTODIAN_ORACLE_TYPE);

    require(a.status == ApplicationStatus.REVIEW, "Application status should be REVIEW");

    address[] memory voters = a.voting.voters.elements();
    for (uint256 i = 0; i < voters.length; i++) {
      a.voting.approvals[voters[i]] = false;
    }

    a.voting.approveCount = 0;
    a.voting.required = 0;

    a.custodianDocuments = _documents;
  }

  /**
   * @dev Auditor lock application
   * @param _aId application ID
   */
  function auditorLock(bytes32 _aId) external {
    Application storage a = applications[_aId];
    oracles.requireOracleActiveWithAssignedActiveOracleType(msg.sender, PC_AUDITOR_ORACLE_TYPE);

    require(
      a.status == ApplicationStatus.REVIEW,
      "Application status should be REVIEW");
    require(a.auditor == address(0), "Not in assigned list");

    // TODO: add/replace with event
    applicationsByOracle[msg.sender].push(_aId);

    a.auditor = msg.sender;
    a.voting.voters.add(msg.sender);
  }

  /**
   * @dev Custodian, Auditor and Applicant approve application.
   * Requires all the participants to call this method in order to confirm that they are agree on the given terms.
   * @param _aId application ID
   */
  function approve(bytes32 _aId) external {
    Application storage a = applications[_aId];
    Voting storage v = a.voting;

    require(a.status == ApplicationStatus.REVIEW, "Application status should be REVIEW");
    require(v.voters.has(msg.sender), "Not in voters list");
    require(v.approvals[msg.sender] == false, "Already approved");

    v.approveCount += 1;
    v.approvals[msg.sender] = true;

    if (v.approveCount == v.required) {
      if (a.action == Action.DETACH) {
        spaceCustodianRegistry.detach(a.spaceTokenId, a.custodiansToModify.elements());
      } else {
        spaceCustodianRegistry.attach(a.spaceTokenId, a.custodiansToModify.elements());
      }

      changeApplicationStatus(a, ApplicationStatus.APPROVED);
    }
  }

  /**
   * @dev Reject the application by a custodian if he changed his mind or the application looks suspicious.
   * @param _aId application ID
   */
  function reject(
    bytes32 _aId,
    string _message
  )
    external
    onlyParticipatingCustodian(_aId)
  {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.REVIEW, "Application status should be REVIEW");
    require(
      a.acceptedCustodians.has(msg.sender) || a.lockedCustodians.has(msg.sender) || a.auditor == msg.sender,
      "Only a custodians or auditor are allowed to perform this action");
    require(a.auditor != address(0), "Auditor should be assigned first");

    a.rejectMessage = _message;

    changeApplicationStatus(a, ApplicationStatus.REJECTED);
  }

  /**
   * @dev Withdraw the attached SpaceToken back by the applicant
   * @param _aId application ID
   */
  function withdrawToken(bytes32 _aId) external {
    Application storage a = applications[_aId];

    require(a.status == ApplicationStatus.APPROVED, "Application status should be APPROVED");

    if (a.throughEscrow) {
      require(msg.sender == address(plotEscrow), "Only plotEscrow allowed claiming token back");
    } else {
      require(msg.sender == a.applicant, "Invalid applicant");
    }

    spaceToken.transferFrom(address(this), msg.sender, a.spaceTokenId);

    changeApplicationStatus(a, ApplicationStatus.COMPLETED);
  }

  /**
   * @dev Close the application by the applicant without attaching/detaching a custodian
   * @param _aId application ID
   */
  function close(bytes32 _aId) external onlyApplicant(_aId) {
    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.REJECTED ||
      a.status == ApplicationStatus.LOCKED,
      "Application status should be either REJECTED or LOCKED");

    if (a.status == ApplicationStatus.REJECTED) {
      spaceToken.transferFrom(address(this), msg.sender, a.spaceTokenId);
    }

    changeApplicationStatus(a, ApplicationStatus.CLOSED);
  }

  /**
   * @dev Custodians and auditor claim their rewards
   * @param _aId application ID
   */
  function claimOracleReward(
    bytes32 _aId
  )
    external
  {
    Application storage a = applications[_aId];

    require(oracles.isOracleActive(msg.sender), "Not active oracle");

    require(
      a.status == ApplicationStatus.COMPLETED ||
      a.status == ApplicationStatus.CLOSED,
      "Application status should be either COMPLETED or CLOSED");

    uint256 reward;

    if (msg.sender == a.auditor) {
      require(a.rewards.auditorRewardPaidOut == false, "Reward is already paid out");
      reward = a.rewards.auditorReward;
      a.rewards.auditorRewardPaidOut = true;
    } else {
      require(
        a.acceptedCustodians.has(msg.sender) || a.lockedCustodians.has(msg.sender),
        "Not a participating custodian");

      require(a.rewards.custodianRewardPaidOut[msg.sender] == false, "Reward is already paid out");
      a.rewards.custodianRewardPaidOut[msg.sender] = true;

      reward = a.rewards.custodianReward;
    }

    require(reward > 0, "Reward is 0");

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(reward);
    } else {
      galtToken.transfer(msg.sender, reward);
    }
  }

  function claimGaltSpaceReward(
    bytes32 _aId
  )
    external
  {
    require(msg.sender == galtSpaceRewardsAddress, "The method call allowed only for galtSpace address");

    Application storage a = applications[_aId];

    require(
      a.status == ApplicationStatus.COMPLETED ||
      a.status == ApplicationStatus.CLOSED,
      "Application status should be either COMPLETED or CLOSED");
    require(a.rewards.galtSpaceReward > 0, "Reward is 0");
    require(a.rewards.galtSpaceRewardPaidOut == false, "Reward is already paid out");

    a.rewards.galtSpaceRewardPaidOut = true;

    if (a.currency == Currency.ETH) {
      msg.sender.transfer(a.rewards.galtSpaceReward);
    } else if (a.currency == Currency.GALT) {
      galtToken.transfer(msg.sender, a.rewards.galtSpaceReward);
    }
  }

  // NOTICE: in case 100 ether / 3, each arbitrator will receive 33.33... ether and 1 wei will remain on contract
  function _calculateAndStoreCustodianRewards(Application storage a) internal {
    // voters = 1 applicant + oracles (1 auditor will be pushed later)
    // at the moment only oracles and an applicant are pushed here
    uint256 len = a.voting.voters.size();
    assert(len > 0);

    uint256 rewardSize = a.rewards.totalCustodiansReward.div(len);

    a.rewards.custodianReward = rewardSize;
  }

  function getApplicationById(
    bytes32 _id
  )
    external
    view
    returns (
      address applicant,
      uint256 spaceTokenId,
      address[] custodiansToModify,
      address[] acceptedCustodians,
      address[] lockedCustodians,
      bytes32[] custodianDocuments,
      address auditor,
      bool throughEscrow,
      ApplicationStatus status,
      Currency currency,
      Action action
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Application storage m = applications[_id];

    return (
      m.applicant,
      m.spaceTokenId,
      m.custodiansToModify.elements(),
      m.acceptedCustodians.elements(),
      m.lockedCustodians.elements(),
      m.custodianDocuments,
      m.auditor,
      m.throughEscrow,
      m.status,
      m.currency,
      m.action
    );
  }

  function getApplicationRewards(
    bytes32 _id
  )
    external
    view
    returns (
      Currency currency,
      uint256 galtSpaceReward,
      uint256 oraclesReward,
      uint256 totalCustodiansReward,
      uint256 custodianReward,
      uint256 auditorReward,
      bool galtSpaceRewardPaidOut,
      bool auditorRewardPaidOut
    )
  {
    require(applications[_id].status != ApplicationStatus.NOT_EXISTS, "Application doesn't exist");

    Rewards storage r = applications[_id].rewards;

    return (
      applications[_id].currency,
      r.galtSpaceReward,
      r.oraclesReward,
      r.totalCustodiansReward,
      r.custodianReward,
      r.auditorReward,
      r.galtSpaceRewardPaidOut,
      r.auditorRewardPaidOut
    );
  }

  function getApplicationCustodian(
    bytes32 _aId,
    address _custodian
  )
    external
    view
    returns (
      bool approved,
      bool rewardPaidOut,
      bool involved
    )
  {
    Application storage a = applications[_aId];

    bool involved = (
      a.acceptedCustodians.has(_custodian) ||
      a.lockedCustodians.has(_custodian) || a.custodiansToModify.has(_custodian));

    return (
      a.voting.approvals[_custodian],
      a.rewards.custodianRewardPaidOut[_custodian],
      involved
    );
  }

  function getApplicationVoting(bytes32 _aId)
    external
    view
    returns (
      uint256 approveCount,
      uint256 required,
      address[] voters,
      bool currentAddressApproved
    )
  {
    Voting storage v = applications[_aId].voting;

    return (
      v.approveCount,
      v.required,
      v.voters.elements(),
      v.approvals[msg.sender]
    );
  }

  function changeApplicationStatus(
    Application storage _a,
    ApplicationStatus _status
  )
    internal
  {
    emit LogApplicationStatusChanged(_a.id, _status);

    _a.status = _status;
  }

  function calculateAndStoreFee(
    Application storage _a,
    uint256 _fee
  )
    internal
  {
    uint256 share;

    if (_a.currency == Currency.ETH) {
      share = galtSpaceEthShare;
    } else {
      share = galtSpaceGaltShare;
    }

    uint256 galtSpaceReward = share.mul(_fee).div(100);
    uint256 oraclesReward = _fee.sub(galtSpaceReward);

    assert(oraclesReward.add(galtSpaceReward) == _fee);

    _a.rewards.galtSpaceReward = galtSpaceReward;
    _a.rewards.oraclesReward = oraclesReward;

    _a.rewards.totalCustodiansReward = _a
      .rewards
      .oraclesReward
      .mul(oracles.getOracleTypeRewardShare(PC_CUSTODIAN_ORACLE_TYPE))
      .div(100);

    _a.rewards.auditorReward = oraclesReward.sub(_a.rewards.totalCustodiansReward);
  }
}
