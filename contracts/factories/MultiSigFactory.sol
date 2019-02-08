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
  event BuildMultiSigFirstStep(
    bytes32 groupId,
    address arbitratorMultiSig,
    address arbitratorVoting,
    address oracleStakesAccounting
  );

  event BuildMultiSigSecondStep(
    address arbitratorStakeAccounting
  );

  enum Step {
    FIRST,
    SECOND,
    DONE
  }

  struct MultiSigContractGroup {
    address creator;
    Step nextStep;
    ArbitratorsMultiSig arbitratorMultiSig;
    ArbitratorVoting arbitratorVoting;
    ArbitratorStakeAccounting arbitratorStakeAccounting;
    OracleStakesAccounting oracleStakesAccounting;
  }

  MultiSigRegistry multiSigRegistry;
  ClaimManager claimManager;

  IERC20 galtToken;
  Oracles oracles;
  SpaceReputationAccounting spaceReputationAccounting;

  ArbitratorsMultiSigFactory arbitratorMultiSigFactory;
  ArbitratorVotingFactory arbitratorVotingFactory;
  ArbitratorStakeAccountingFactory arbitratorStakeAccountingFactory;
  OracleStakesAccountingFactory oracleStakesAccountingFactory;

  mapping(bytes32 => MultiSigContractGroup) public multiSigContractGroups;

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

  function buildFirstStep(
    address[] calldata _initialOwners,
    uint256 _multiSigRequired
  )
    external
    returns (bytes32 groupId)
  {
    galtToken.transferFrom(msg.sender, address(this), commission);

    groupId = keccak256(abi.encode(block.timestamp, _multiSigRequired, msg.sender));

    ArbitratorsMultiSig arbitratorMultiSig = arbitratorMultiSigFactory.build(_initialOwners, _multiSigRequired);
    OracleStakesAccounting oracleStakesAccounting = oracleStakesAccountingFactory.build(oracles, galtToken, arbitratorMultiSig);
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

    MultiSigContractGroup storage g = multiSigContractGroups[groupId];

    require(g.nextStep == Step.FIRST);

    g.creator = msg.sender;
    g.arbitratorMultiSig = arbitratorMultiSig;
    g.arbitratorVoting = arbitratorVoting;
    g.oracleStakesAccounting = oracleStakesAccounting;
    g.nextStep = Step.SECOND;

    emit BuildMultiSigFirstStep(groupId, address(arbitratorMultiSig), address(arbitratorVoting), address(oracleStakesAccounting));
  }

  function buildSecondStep(
    bytes32 _groupId,
    uint256 _periodLength
  )
    external
  {
    MultiSigContractGroup storage g = multiSigContractGroups[_groupId];
    require(g.nextStep == Step.SECOND, "SECOND step required");
    require(g.creator == msg.sender, "Only the initial allowed to continue build process");

    ArbitratorStakeAccounting arbitratorStakeAccounting = arbitratorStakeAccountingFactory.build(galtToken, g.arbitratorMultiSig, _periodLength);
    arbitratorStakeAccounting.addRoleTo(address(claimManager), arbitratorStakeAccounting.ROLE_SLASH_MANAGER());
    g.arbitratorStakeAccounting = arbitratorStakeAccounting;

    g.arbitratorMultiSig.initialize(
      address(g.arbitratorVoting),
      address(g.oracleStakesAccounting),
      arbitratorStakeAccounting
    );

    // Revoke role management permissions from this factory address
    arbitratorStakeAccounting.removeRoleFrom(address(this), "role_manager");
    g.arbitratorMultiSig.removeRoleFrom(address(this), "role_manager");
    g.arbitratorVoting.removeRoleFrom(address(this), "role_manager");
    g.oracleStakesAccounting.removeRoleFrom(address(this), "role_manager");

    multiSigRegistry.addMultiSig(g.arbitratorMultiSig, g.arbitratorVoting, arbitratorStakeAccounting, g.oracleStakesAccounting);

    emit BuildMultiSigSecondStep(address(arbitratorStakeAccounting));
  }

  function setCommission(uint256 _commission) external onlyOwner {
    commission = _commission;
  }
}
