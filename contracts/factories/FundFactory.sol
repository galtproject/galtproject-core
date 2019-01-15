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
import "../factories/fund/RSRAFactory.sol";
import "../factories/fund/FundStorageFactory.sol";
import "../interfaces/IRSRA.sol";
import "../SpaceToken.sol";
import "../registries/SpaceLockerRegistry.sol";
import "./fund/ModifyConfigProposalManagerFactory.sol";
import "./fund/NewMemberProposalManagerFactory.sol";


contract FundFactory is Ownable {
  event FundCreated(
    address rsra,
    address fundStorage,
    address modifyConfigProposalManager,
    address newMemberProposalManager
  );

  string public constant RSRA_CONTRACT = "rsra_contract";

  ERC20 galtToken;
  SpaceToken spaceToken;
  SpaceLockerRegistry spaceLockerRegistry;

  RSRAFactory rsraFactory;
  FundStorageFactory fundStorageFactory;
  ModifyConfigProposalManagerFactory modifyConfigProposalManagerFactory;
  NewMemberProposalManagerFactory newMemberProposalManagerFactory;

  uint256 commission;

  constructor (
    ERC20 _galtToken,
    SpaceToken _spaceToken,
    SpaceLockerRegistry _spaceLockerRegistry,
    RSRAFactory _rsraFactory,
    FundStorageFactory _fundStorageFactory,
    ModifyConfigProposalManagerFactory _modifyConfigProposalManagerFactory,
    NewMemberProposalManagerFactory _newMemberProposalManagerFactory
  ) public {
    commission = 10 ether;

    galtToken = _galtToken;
    spaceToken = _spaceToken;
    spaceLockerRegistry = _spaceLockerRegistry;

    rsraFactory = _rsraFactory;
    fundStorageFactory = _fundStorageFactory;
    modifyConfigProposalManagerFactory = _modifyConfigProposalManagerFactory;
    newMemberProposalManagerFactory = _newMemberProposalManagerFactory;
  }

  function build(
    bool _isPrivate,
    uint256 _manageWhiteListThreshold,
    uint256 _modifyConfigThreshold,
    uint256 _newMemberThreshold,
    uint256 _expelMemberThreshold,
    uint256 _fineMemberThreshold
  )
    external
    returns (IRSRA, FundStorage, ModifyConfigProposalManager, NewMemberProposalManager)
  {
    galtToken.transferFrom(msg.sender, address(this), commission);

    FundStorage fundStorage = fundStorageFactory.build(
      _isPrivate,
      _manageWhiteListThreshold,
      _modifyConfigThreshold,
      _newMemberThreshold,
      _expelMemberThreshold,
      _fineMemberThreshold
    );
    IRSRA rsra = rsraFactory.build(spaceToken, spaceLockerRegistry, fundStorage);

    ModifyConfigProposalManager modifyConfigProposalManager = modifyConfigProposalManagerFactory.build(rsra, fundStorage);
    NewMemberProposalManager newMemberProposalManager = newMemberProposalManagerFactory.build(rsra, fundStorage);

    // TODO: if is private, then build additional proposal manager
    // TODO: attach roles

    modifyConfigProposalManager.addRoleTo(rsra, RSRA_CONTRACT);
    newMemberProposalManager.addRoleTo(rsra, RSRA_CONTRACT);

    fundStorage.addRoleTo(address(this), fundStorage.CONTRACT_WHITELIST_MANAGER());
    fundStorage.addWhiteListedContract(modifyConfigProposalManager);
    fundStorage.addWhiteListedContract(newMemberProposalManager);
    fundStorage.removeRoleFrom(address(this), fundStorage.CONTRACT_WHITELIST_MANAGER());

    fundStorage.addRoleTo(modifyConfigProposalManager, fundStorage.CONTRACT_CONFIG_MANAGER());

    // TODO: figure out what to do with contract permissions
    emit FundCreated(rsra, fundStorage, modifyConfigProposalManager, newMemberProposalManager);
  }

  function setCommission(uint256 _commission) external onlyOwner {
    commission = _commission;
  }
}
