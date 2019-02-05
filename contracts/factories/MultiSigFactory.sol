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
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../Oracles.sol";
import "../SpaceReputationAccounting.sol";
import "../registries/MultiSigRegistry.sol";
import "../applications/ClaimManager.sol";
import "./ArbitratorsMultiSigFactory.sol";
import "./ArbitratorVotingFactory.sol";
import "./ArbitratorStakeAccountingFactory.sol";
import "./OracleStakesAccountingFactory.sol";


contract MultiSigFactory is Ownable {
  event MultiSigCreated(
    address arbitratorMultiSig,
    address arbitratorVoting,
    address oracleStakesAccounting
  );

  MultiSigRegistry multiSigRegistry;
  ClaimManager claimManager;

  IERC20 galtToken;
  Oracles oracles;
  SpaceReputationAccounting spaceReputationAccounting;

  ArbitratorsMultiSigFactory arbitratorMultiSigFactory;
  ArbitratorVotingFactory arbitratorVotingFactory;
  ArbitratorStakeAccountingFactory arbitratorStakeAccountingFactory;
  OracleStakesAccountingFactory oracleStakesAccountingFactory;

  uint256 commission;

  constructor (
    MultiSigRegistry _multiSigRegistry,
    IERC20 _galtToken,
    Oracles _oracles,
    ClaimManager _claimManager,
    SpaceReputationAccounting _spaceReputationAccounting,
    ArbitratorsMultiSigFactory _arbitratorMultiSigFactory,
    ArbitratorVotingFactory _arbitratorVotingFactory,
    ArbitratorStakeAccountingFactory _arbitratorStakeAccountingFactory,
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
    arbitratorStakeAccountingFactory = _arbitratorStakeAccountingFactory;
    oracleStakesAccountingFactory = _oracleStakesAccountingFactory;
  }

  function build(
    address[] calldata _initialOwners,
    uint256 _multiSigRequired,
    uint256 _periodLength
  )
    external
    returns (ArbitratorsMultiSig, ArbitratorVoting, OracleStakesAccounting)
  {
    galtToken.transferFrom(msg.sender, address(this), commission);

    ArbitratorsMultiSig arbitratorMultiSig = arbitratorMultiSigFactory.build(_initialOwners, _multiSigRequired);
    OracleStakesAccounting oracleStakesAccounting = oracleStakesAccountingFactory.build(oracles, galtToken, arbitratorMultiSig);
    ArbitratorStakeAccounting arbitratorStakeAccounting = arbitratorStakeAccountingFactory.build(galtToken, arbitratorMultiSig, _periodLength);
    ArbitratorVoting arbitratorVoting = arbitratorVotingFactory.build(
      arbitratorMultiSig,
      spaceReputationAccounting,
      oracleStakesAccounting
    );

    arbitratorMultiSig.addRoleTo(address(arbitratorVoting), arbitratorMultiSig.ROLE_ARBITRATOR_MANAGER());
    arbitratorMultiSig.addRoleTo(address(claimManager), arbitratorMultiSig.ROLE_PROPOSER());
    oracleStakesAccounting.addRoleTo(address(claimManager), oracleStakesAccounting.ROLE_SLASH_MANAGER());
    arbitratorVoting.addRoleTo(address(oracleStakesAccounting), arbitratorVoting.ORACLE_STAKES_NOTIFIER());
    arbitratorVoting.addRoleTo(address(spaceReputationAccounting), arbitratorVoting.SPACE_REPUTATION_NOTIFIER());
    oracles.addOracleNotifierRoleTo(address(oracleStakesAccounting));

    oracleStakesAccounting.setVotingAddress(arbitratorVoting);

    multiSigRegistry.addMultiSig(arbitratorMultiSig, arbitratorVoting, arbitratorStakeAccounting, oracleStakesAccounting);

    arbitratorMultiSig.removeRoleFrom(address(this), "role_manager");
    arbitratorVoting.removeRoleFrom(address(this), "role_manager");
    oracleStakesAccounting.removeRoleFrom(address(this), "role_manager");

    emit MultiSigCreated(address(arbitratorMultiSig), address(arbitratorVoting), address(oracleStakesAccounting));
  }

  function setCommission(uint256 _commission) external onlyOwner {
    commission = _commission;
  }
}
