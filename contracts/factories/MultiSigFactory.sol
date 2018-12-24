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
import "../Oracles.sol";
import "../GaltToken.sol";
import "../SpaceReputationAccounting.sol";
import "../registries/MultiSigRegistry.sol";
import "./ArbitratorsMultiSigFactory.sol";
import "./ArbitratorVotingFactory.sol";
import "./OracleStakesAccountingFactory.sol";
import "../ClaimManager.sol";


contract MultiSigFactory is Ownable {
  event MultiSigCreated(
    address arbitratorMultiSig,
    address arbitratorVoting,
    address oracleStakesAccounting
  );

  MultiSigRegistry multiSigRegistry;
  ClaimManager claimManager;

  GaltToken galtToken;
  Oracles oracles;
  SpaceReputationAccounting spaceReputationAccounting;

  ArbitratorsMultiSigFactory arbitratorMultiSigFactory;
  ArbitratorVotingFactory arbitratorVotingFactory;
  OracleStakesAccountingFactory oracleStakesAccountingFactory;

  uint256 commission;

  constructor (
    MultiSigRegistry _multiSigRegistry,
    GaltToken _galtToken,
    Oracles _oracles,
    ClaimManager _claimManager,
    SpaceReputationAccounting _spaceReputationAccounting,
    ArbitratorsMultiSigFactory _arbitratorMultiSigFactory,
    ArbitratorVotingFactory _arbitratorVotingFactory,
    OracleStakesAccountingFactory _oracleStakesAccountingFactory
  ) public {
    commission = 10 ether;

    multiSigRegistry = _multiSigRegistry;
    galtToken = _galtToken;
    oracles = _oracles;
    claimManager = _claimManager;
    spaceReputationAccounting = _spaceReputationAccounting;

    arbitratorMultiSigFactory = _arbitratorMultiSigFactory;
    arbitratorVotingFactory = _arbitratorVotingFactory;
    oracleStakesAccountingFactory = _oracleStakesAccountingFactory;
  }

  function build(
    address[] _initialOwners,
    uint256 _multiSigRequired
  )
    external
    returns (ArbitratorsMultiSig, ArbitratorVoting, OracleStakesAccounting)
  {
    galtToken.transferFrom(msg.sender, address(this), commission);

    ArbitratorsMultiSig arbitratorMultiSig = arbitratorMultiSigFactory.build(_initialOwners, _multiSigRequired);
    OracleStakesAccounting oracleStakesAccounting = oracleStakesAccountingFactory.build(oracles, galtToken, arbitratorMultiSig);
    ArbitratorVoting arbitratorVoting = arbitratorVotingFactory.build(
      arbitratorMultiSig,
      spaceReputationAccounting,
      oracleStakesAccounting
    );

    arbitratorMultiSig.addRoleTo(arbitratorVoting, arbitratorMultiSig.ROLE_ARBITRATOR_MANAGER());
    arbitratorMultiSig.addRoleTo(claimManager, arbitratorMultiSig.ROLE_PROPOSER());
    oracleStakesAccounting.addRoleTo(claimManager, oracleStakesAccounting.ROLE_SLASH_MANAGER());
    arbitratorVoting.addRoleTo(oracleStakesAccounting, arbitratorVoting.ORACLE_STAKES_NOTIFIER());
    arbitratorVoting.addRoleTo(spaceReputationAccounting, arbitratorVoting.SPACE_REPUTATION_NOTIFIER());
    oracles.addOracleNotifierRoleTo(oracleStakesAccounting);

    oracleStakesAccounting.setVotingAddress(arbitratorVoting);

    multiSigRegistry.addMultiSig(arbitratorMultiSig, arbitratorVoting, oracleStakesAccounting);

    arbitratorMultiSig.removeRoleFrom(address(this), "role_manager");
    arbitratorVoting.removeRoleFrom(address(this), "role_manager");
    oracleStakesAccounting.removeRoleFrom(address(this), "role_manager");

    emit MultiSigCreated(arbitratorMultiSig, arbitratorVoting, oracleStakesAccounting);
  }

  function setCommission(uint256 _commission) external onlyOwner {
    commission = _commission;
  }
}
