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

pragma solidity 0.5.7;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./GovernanceConfig.sol";
import "./interfaces/IGovernanceOracleStakeAccounting.sol";
import "../interfaces/IStakeTracker.sol";


contract GovernanceOracleStakeAccounting is IGovernanceOracleStakeAccounting, Permissionable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  event OracleStakeDeposit(
    address oracle,
    bytes32 oracleType,
    uint256 amount,
    int256 finalOracleTypeStake,
    int256 finalOracleTotalStake
  );

  event OracleStakeSlash(
    address oracle,
    bytes32 oracleType,
    uint256 amount,
    int256 finalOracleTypeStake,
    int256 finalOracleTotalStake
  );

  bytes32 public constant ROLE_ORACLE_STAKE_SLASHER = bytes32("ORACLE_STAKE_SLASHER");

  GovernanceConfig governanceConfig;
  mapping(address => OracleTypes) oracleTypes;

  struct OracleTypes {
    int256 totalStakes;
    mapping(bytes32 => int256) oracleTypeStakes;
  }

  modifier onlySlashManager {
    require(
      governanceConfig.ggr().getACL().hasRole(msg.sender, ROLE_ORACLE_STAKE_SLASHER),
      "Only ORACLE_STAKE_SLASHER role allowed"
    );

    _;
  }

  constructor(
    GovernanceConfig _governanceConfig
  )
    public
  {
    governanceConfig = _governanceConfig;
  }

  function slash(address _oracle, bytes32 _oracleType, uint256 _amount) external onlySlashManager {
    _slash(_oracle, _oracleType, _amount);
  }

  function slashMultiple(address[] calldata _oracles, bytes32[] calldata _oracleTypes, uint256[] calldata _amounts) external onlySlashManager {
    assert(_oracles.length == _oracleTypes.length);
    assert(_oracleTypes.length == _amounts.length);

    for (uint256 i = 0; i < _oracles.length; i++) {
      _slash(_oracles[i], _oracleTypes[i], _amounts[i]);
    }
  }

  function _slash(address _oracle, bytes32 _oracleType, uint256 _amount) internal {
    require(oracles().isOracleTypeAssigned(_oracle, _oracleType), "Some oracle types doesn't match");

    int256 initialOracleTypeStake = oracleTypes[_oracle].oracleTypeStakes[_oracleType];
    int256 initialOracleTotalStake = oracleTypes[_oracle].totalStakes;
    int256 finalOracleTypeStake = oracleTypes[_oracle].oracleTypeStakes[_oracleType] - int256(_amount);
    int256 finalOracleTotalStake = oracleTypes[_oracle].totalStakes - int256(_amount);

    assert(finalOracleTotalStake < initialOracleTotalStake);
    assert(finalOracleTypeStake < initialOracleTypeStake);

    oracleTypes[_oracle].totalStakes = finalOracleTotalStake;
    oracleTypes[_oracle].oracleTypeStakes[_oracleType] = finalOracleTypeStake;

    governanceConfig.getOracleStakeVoting().onOracleStakeChanged(_oracle, uint256(finalOracleTotalStake));
    IStakeTracker(governanceConfig.ggr().getStakeTrackerAddress()).onSlash(
      address(governanceConfig.getMultiSig()),
      _amount
    );

    emit OracleStakeSlash(_oracle, _oracleType, _amount, finalOracleTypeStake, finalOracleTotalStake);
  }

  function stake(address _oracle, bytes32 _oracleType, uint256 _amount) external {
    oracles().requireOracleActiveWithAssignedOracleType(_oracle, _oracleType);
    address multiSig = address(governanceConfig.getMultiSig());
    galtToken().transferFrom(msg.sender, multiSig, _amount);

    require(_amount > 0, "Expect positive amount");

    int256 initialTotalStakes = oracleTypes[_oracle].totalStakes;
    int256 initialRoleStake = oracleTypes[_oracle].oracleTypeStakes[_oracleType];
    int256 finalRoleStake = initialRoleStake + int256(_amount);
    int256 finalTotalStakes = initialTotalStakes + int256(_amount);

    assert(finalTotalStakes > initialTotalStakes);
    assert(finalRoleStake > initialRoleStake);

    oracleTypes[_oracle].totalStakes = finalTotalStakes;
    oracleTypes[_oracle].oracleTypeStakes[_oracleType] = finalRoleStake;

    governanceConfig.getOracleStakeVoting().onOracleStakeChanged(_oracle, uint256(finalTotalStakes));
    IStakeTracker(governanceConfig.ggr().getStakeTrackerAddress()).onStake(multiSig, _amount);

    emit OracleStakeDeposit(_oracle, _oracleType, _amount, finalRoleStake, finalTotalStakes);
  }

  function oracles() internal view returns (IGovernanceOracles) {
    return governanceConfig.getOracles();
  }

  function galtToken() internal view returns (IERC20) {
    return governanceConfig.ggr().getGaltToken();
  }

  // GETTERS

  function oracleTypeMinimalStakeKey(bytes32 _oracleType) public pure returns (bytes32) {
    return keccak256(abi.encode("ORACLE_TYPE_MINIMAL_STAKE", _oracleType));
  }

  function oracleTypeMinimalStake(bytes32 _oracleType) public view returns (uint256) {
    return uint256(governanceConfig.applicationConfig(oracleTypeMinimalStakeKey(_oracleType)));
  }

  function isOracleStakeActive(address _oracle, bytes32 _oracleType) external view returns (bool) {
    int256 required = int256(oracleTypeMinimalStake(_oracleType));

    // The role has not properly set up yet
    if (required == 0) {
      return false;
    }

    int256 current = oracleTypes[_oracle].oracleTypeStakes[_oracleType];

    return current >= required;
  }

  function balanceOf(address _oracle) external view returns (int256) {
    return oracleTypes[_oracle].totalStakes;
  }

  function stakeOf(address _oracle, bytes32 _oracleType) external view returns (int256) {
    return oracleTypes[_oracle].oracleTypeStakes[_oracleType];
  }
}
