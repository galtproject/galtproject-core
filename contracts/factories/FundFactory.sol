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
import "../fund/RSRA.sol";
import "../SpaceToken.sol";
import "../registries/SpaceLockerRegistry.sol";


contract FundFactory is Ownable {
  event FundCreated(
    address rsra,
    address fundStorage
  );

  ERC20 galtToken;
  SpaceToken spaceToken;
  SpaceLockerRegistry spaceLockerRegistry;

  RSRAFactory rsraFactory;
  FundStorageFactory fundStorageFactory;

  uint256 commission;

  constructor (
    ERC20 _galtToken,
    SpaceToken _spaceToken,
    SpaceLockerRegistry _spaceLockerRegistry,
    RSRAFactory _rsraFactory,
    FundStorageFactory _fundStorageFactory
  ) public {
    commission = 10 ether;

    galtToken = _galtToken;
    spaceToken = _spaceToken;
    spaceLockerRegistry = _spaceLockerRegistry;

    rsraFactory = _rsraFactory;
    fundStorageFactory = _fundStorageFactory;
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
    returns (RSRA, FundStorage)
  {
    galtToken.transferFrom(msg.sender, address(this), commission);

    RSRA rsra = rsraFactory.build(spaceToken, spaceLockerRegistry);
    FundStorage fundStorage = fundStorageFactory.build(
      _isPrivate,
      _manageWhiteListThreshold,
      _modifyConfigThreshold,
      _newMemberThreshold,
      _expelMemberThreshold,
      _fineMemberThreshold
    );

    // TODO: if is private, then build additional proposal manager
    // TODO: attach roles

//    arbitratorMultiSig.removeRoleFrom(address(this), "role_manager");
//    arbitratorVoting.removeRoleFrom(address(this), "role_manager");
//    oracleStakesAccounting.removeRoleFrom(address(this), "role_manager");

    emit FundCreated(rsra, fundStorage);
  }

  function setCommission(uint256 _commission) external onlyOwner {
    commission = _commission;
  }
}
