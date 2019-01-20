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

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../fund/FundStorage.sol";
import "../fund/FundController.sol";
import "../interfaces/IRSRA.sol";
import "../SpaceToken.sol";
import "../registries/SpaceLockerRegistry.sol";
import "./fund/RSRAFactory.sol";
import "./fund/FundStorageFactory.sol";
import "./fund/FundMultiSigFactory.sol";
import "./fund/FundControllerFactory.sol";
import "./fund/ModifyConfigProposalManagerFactory.sol";
import "./fund/NewMemberProposalManagerFactory.sol";
import "./fund/FineMemberProposalManagerFactory.sol";
import "./fund/ExpelMemberProposalManagerFactory.sol";
import "./fund/WLProposalManagerFactory.sol";


contract FundFactory is Ownable {
  event CreateFundFirstStep(
    address fundRsra,
    address fundMultiSig,
    address fundStorage,
    address fundController
  );

  event CreateFundSecondStep(
    address multiSig,
    address modifyConfigProposalManager,
    address newMemberProposalManager,
    address fineMemberProposalManager,
    address expelMemberProposalManager
  );

  event CreateFundThirdStep(
    address multiSig,
    address whiteListProposalManager
  );

  string public constant RSRA_CONTRACT = "rsra_contract";

  uint256 commission;

  ERC20 galtToken;
  SpaceToken spaceToken;
  SpaceLockerRegistry spaceLockerRegistry;

  RSRAFactory rsraFactory;
  FundStorageFactory fundStorageFactory;
  FundMultiSigFactory fundMultiSigFactory;
  FundControllerFactory fundControllerFactory;
  ModifyConfigProposalManagerFactory modifyConfigProposalManagerFactory;
  NewMemberProposalManagerFactory newMemberProposalManagerFactory;
  FineMemberProposalManagerFactory fineMemberProposalManagerFactory;
  ExpelMemberProposalManagerFactory expelMemberProposalManagerFactory;
  WLProposalManagerFactory wlProposalManagerFactory;

  enum Step {
    FIRST,
    SECOND,
    THIRD
  }

  struct FirstStepContracts {
    Step currentStep;
    IRSRA rsra;
    FundMultiSig fundMultiSig;
    FundStorage fundStorage;
    FundController fundController;
  }

  mapping(address => FirstStepContracts) private _firstStepContracts;

  constructor (
    ERC20 _galtToken,
    SpaceToken _spaceToken,
    SpaceLockerRegistry _spaceLockerRegistry,
    RSRAFactory _rsraFactory,
    FundMultiSigFactory _fundMultiSigFactory,
    FundStorageFactory _fundStorageFactory,
    FundControllerFactory _fundControllerFactory,
    ModifyConfigProposalManagerFactory _modifyConfigProposalManagerFactory,
    NewMemberProposalManagerFactory _newMemberProposalManagerFactory,
    FineMemberProposalManagerFactory _fineMemberProposalManagerFactory,
    ExpelMemberProposalManagerFactory _expelMemberProposalManagerFactory,
    WLProposalManagerFactory _wlProposalManagerFactory
  ) public {
    commission = 10 ether;

    galtToken = _galtToken;
    spaceToken = _spaceToken;
    spaceLockerRegistry = _spaceLockerRegistry;

    rsraFactory = _rsraFactory;
    fundStorageFactory = _fundStorageFactory;
    fundMultiSigFactory = _fundMultiSigFactory;
    fundControllerFactory = _fundControllerFactory;
    modifyConfigProposalManagerFactory = _modifyConfigProposalManagerFactory;
    newMemberProposalManagerFactory = _newMemberProposalManagerFactory;
    fineMemberProposalManagerFactory = _fineMemberProposalManagerFactory;
    expelMemberProposalManagerFactory = _expelMemberProposalManagerFactory;
    wlProposalManagerFactory = _wlProposalManagerFactory;
  }

  function buildFirstStep(
    bool _isPrivate,
    uint256 _manageWhiteListThreshold,
    uint256 _modifyConfigThreshold,
    uint256 _newMemberThreshold,
    uint256 _expelMemberThreshold,
    uint256 _fineMemberThreshold,
    address[] _multiSigInitialOwners,
    uint256 _multiSigRequired
  )
    external
    returns (IRSRA rsra, FundMultiSig fundMultiSig, FundStorage fundStorage, FundController fundController)
  {
    FirstStepContracts storage c = _firstStepContracts[msg.sender];
    require(c.currentStep == Step.FIRST, "Requires first step");

    _acceptPayment();

    fundMultiSig = fundMultiSigFactory.build(_multiSigInitialOwners, _multiSigRequired);
    fundStorage = fundStorageFactory.build(
      _isPrivate,
      _manageWhiteListThreshold,
      _modifyConfigThreshold,
      _newMemberThreshold,
      _expelMemberThreshold,
      _fineMemberThreshold
    );
    fundController = fundControllerFactory.build(
      galtToken,
      fundStorage,
      fundMultiSig
    );
    rsra = rsraFactory.build(spaceToken, spaceLockerRegistry, fundStorage);

    c.currentStep = Step.SECOND;
    c.rsra = rsra;
    c.fundStorage = fundStorage;
    c.fundMultiSig = fundMultiSig;
    c.fundController = fundController;

    emit CreateFundFirstStep(rsra, fundMultiSig, fundStorage, fundController);
  }

  function buildSecondStep() external {
    FirstStepContracts storage c = _firstStepContracts[msg.sender];
    require(c.currentStep == Step.SECOND, "Requires second step");

    IRSRA _rsra = c.rsra;
    FundStorage _fundStorage = c.fundStorage;
    FundMultiSig _fundMultiSig = c.fundMultiSig;
    FundController _fundController = c.fundController;

    ModifyConfigProposalManager modifyConfigProposalManager = modifyConfigProposalManagerFactory.build(_rsra, _fundStorage);
    NewMemberProposalManager newMemberProposalManager = newMemberProposalManagerFactory.build(_rsra, _fundStorage);
    FineMemberProposalManager fineMemberProposalManager = fineMemberProposalManagerFactory.build(_rsra, _fundStorage);
    ExpelMemberProposalManager expelMemberProposalManager = expelMemberProposalManagerFactory.build(_rsra, _fundStorage, spaceToken);

    _fundStorage.addRoleTo(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());
    _fundStorage.addWhiteListedContract(modifyConfigProposalManager);
    _fundStorage.addWhiteListedContract(newMemberProposalManager);
    _fundStorage.addWhiteListedContract(fineMemberProposalManager);
    _fundStorage.addWhiteListedContract(expelMemberProposalManager);
    _fundStorage.removeRoleFrom(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());

    _fundStorage.addRoleTo(modifyConfigProposalManager, _fundStorage.CONTRACT_CONFIG_MANAGER());
    _fundStorage.addRoleTo(newMemberProposalManager, _fundStorage.CONTRACT_NEW_MEMBER_MANAGER());
    _fundStorage.addRoleTo(fineMemberProposalManager, _fundStorage.CONTRACT_FINE_MEMBER_INCREMENT_MANAGER());
    _fundStorage.addRoleTo(expelMemberProposalManager, _fundStorage.CONTRACT_EXPEL_MEMBER_MANAGER());
    _fundStorage.addRoleTo(_rsra, _fundStorage.CONTRACT_RSRA());
    _fundStorage.addRoleTo(_fundController, _fundStorage.CONTRACT_FINE_MEMBER_DECREMENT_MANAGER());

    c.currentStep = Step.THIRD;

    emit CreateFundSecondStep(
      _fundMultiSig,
      modifyConfigProposalManager,
      newMemberProposalManager,
      fineMemberProposalManager,
      expelMemberProposalManager
    );
  }

  function buildThirdStep() external {
    FirstStepContracts storage c = _firstStepContracts[msg.sender];
    require(c.currentStep == Step.THIRD, "Requires second step");

    FundStorage _fundStorage = c.fundStorage;

    WLProposalManager wlProposalManager = wlProposalManagerFactory.build(c.rsra, _fundStorage);

    _fundStorage.addRoleTo(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());
    _fundStorage.addWhiteListedContract(wlProposalManager);
    _fundStorage.removeRoleFrom(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());

    _fundStorage.addRoleTo(wlProposalManager, _fundStorage.CONTRACT_WHITELIST_MANAGER());

    delete _firstStepContracts[msg.sender];

    emit CreateFundThirdStep(
      c.fundMultiSig,
      wlProposalManager
    );
  }

  function _acceptPayment() internal {
    galtToken.transferFrom(msg.sender, address(this), commission);
  }

  function setCommission(uint256 _commission) external onlyOwner {
    commission = _commission;
  }
}
