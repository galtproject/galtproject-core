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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./PGGConfig.sol";
import "./interfaces/IPGGOracleStakeAccounting.sol";
import "../interfaces/IStakeTracker.sol";
import "../Checkpointable.sol";


contract PGGOracleStakeAccounting is IPGGOracleStakeAccounting, Checkpointable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  event OracleStakeDeposit(
    address indexed oracle,
    bytes32 indexed oracleType,
    uint256 amount,
    int256 finalOracleTypeStake,
    int256 finalOracleTotalStake
  );

  event OracleStakeSlash(
    address indexed oracle,
    bytes32 indexed oracleType,
    uint256 amount,
    int256 finalOracleTypeStake,
    int256 finalOracleTotalStake
  );

  struct OracleTypes {
    int256 totalStakes;
    uint256 totalStakesPositive;
    mapping(bytes32 => int256) oracleTypeStakes;
    mapping(bytes32 => uint256) oracleTypeStakesPositive;
  }

  bytes32 public constant ROLE_ORACLE_STAKE_SLASHER = bytes32("ORACLE_STAKE_SLASHER");
  // represents 0x0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
  int256 public constant INT256_UPPER_LIMIT = 7237005577332262213973186563042994240829374041602535252466099000494570602495;

  IPGGConfig pggConfig;
  mapping(address => OracleTypes) oracleDetails;

  int256 internal totalStake;
  uint256 internal totalStakePositive;

  modifier onlySlashManager {
    require(
      pggConfig.ggr().getACL().hasRole(msg.sender, ROLE_ORACLE_STAKE_SLASHER),
      "Only ORACLE_STAKE_SLASHER role allowed"
    );

    _;
  }

  constructor(
    IPGGConfig _pggConfig
  )
    public
  {
    pggConfig = _pggConfig;
  }

  function slash(address _oracle, bytes32 _oracleType, uint256 _amount) external onlySlashManager {
    _slash(_oracle, _oracleType, _amount);
  }

  function slashMultiple(
    address[] calldata _oracles,
    bytes32[] calldata _oracleTypes,
    uint256[] calldata _amounts
  )
    external
    onlySlashManager
  {
    assert(_oracles.length == _oracleTypes.length);
    assert(_oracleTypes.length == _amounts.length);

    for (uint256 i = 0; i < _oracles.length; i++) {
      _slash(_oracles[i], _oracleTypes[i], _amounts[i]);
    }
  }

  function _slash(address _oracle, bytes32 _oracleType, uint256 _amount) internal {
    require(oracles().isOracleTypeAssigned(_oracle, _oracleType), "Some oracle types doesn't match");

    int256 initialOracleTypeStake = oracleDetails[_oracle].oracleTypeStakes[_oracleType];
    int256 initialOracleTotalStake = oracleDetails[_oracle].totalStakes;
    int256 totalStakeBefore = totalStake;

    int256 finalOracleTypeStake = oracleDetails[_oracle].oracleTypeStakes[_oracleType] - int256(_amount);
    int256 finalOracleTotalStake = oracleDetails[_oracle].totalStakes - int256(_amount);
    int256 totalStakeAfter = totalStakeBefore - int256(_amount);

    assert(finalOracleTotalStake <= initialOracleTotalStake);
    assert(finalOracleTypeStake <= initialOracleTypeStake);
    assert(totalStakeAfter <= totalStakeBefore);

    oracleDetails[_oracle].totalStakes = finalOracleTotalStake;
    oracleDetails[_oracle].oracleTypeStakes[_oracleType] = finalOracleTypeStake;
    totalStake = totalStakeAfter;

    _updatePositiveValues(oracleDetails[_oracle], _oracleType, finalOracleTypeStake, finalOracleTotalStake, totalStakeAfter);
    _updateCheckpoints(_oracle);

    pggConfig.getOracleStakeVoting().onOracleStakeChanged(_oracle, oracleDetails[_oracle].totalStakesPositive);
    IStakeTracker(pggConfig.ggr().getStakeTrackerAddress()).onChange(address(pggConfig), totalStakePositive);

    emit OracleStakeSlash(_oracle, _oracleType, _amount, finalOracleTypeStake, finalOracleTotalStake);
  }

  function stake(address _oracle, bytes32 _oracleType, uint256 _amount) external {
    oracles().requireOracleActiveWithAssignedOracleType(_oracle, _oracleType);
    address multiSig = address(pggConfig.getMultiSig());
    galtToken().transferFrom(msg.sender, multiSig, _amount);

    require(_amount > 0, "Expect positive amount");

    int256 oracleTypeStakeBefore = oracleDetails[_oracle].oracleTypeStakes[_oracleType];
    int256 oracleStakeBefore = oracleDetails[_oracle].totalStakes;
    int256 totalStakeBefore = totalStake;

    int256 oracleTypeStakeAfter = oracleTypeStakeBefore + int256(_amount);
    int256 oracleStakeAfter = oracleStakeBefore + int256(_amount);
    int256 totalStakeAfter = totalStakeBefore + int256(_amount);

    assert(oracleTypeStakeAfter >= oracleTypeStakeBefore);
    assert(oracleStakeAfter >= oracleStakeBefore);
    assert(totalStakeAfter >= totalStakeBefore);

    oracleDetails[_oracle].totalStakes = oracleStakeAfter;
    oracleDetails[_oracle].oracleTypeStakes[_oracleType] = oracleTypeStakeAfter;
    totalStake = totalStakeAfter;

    _updatePositiveValues(oracleDetails[_oracle], _oracleType, oracleTypeStakeAfter, oracleStakeAfter, totalStakeAfter);
    _updateCheckpoints(_oracle);

    pggConfig.getOracleStakeVoting().onOracleStakeChanged(_oracle, oracleDetails[_oracle].totalStakesPositive);
    IStakeTracker(pggConfig.ggr().getStakeTrackerAddress()).onChange(address(pggConfig), totalStakePositive);

    emit OracleStakeDeposit(_oracle, _oracleType, _amount, oracleTypeStakeAfter, oracleStakeAfter);
  }

  function _updateCheckpoints(address _oracle) internal {
    _updateValueAtNow(_cachedBalances[_oracle], oracleDetails[_oracle].totalStakesPositive);
    _updateValueAtNow(_cachedTotalSupply, totalStakePositive);
  }

  function _updatePositiveValues(
    OracleTypes storage _oracle,
    bytes32 _oracleType,
    int256 _oracleTypeStakeAfter,
    int256 _oracleStakeAfter,
    int256 _totalStakeAfter
  )
    internal
  {
    require(_oracleTypeStakeAfter <= INT256_UPPER_LIMIT, "INT256_UPPER_LIMIT overflow/underflow");
    require(_oracleStakeAfter <= INT256_UPPER_LIMIT, "INT256_UPPER_LIMIT overflow/underflow");
    require(_totalStakeAfter <= INT256_UPPER_LIMIT, "INT256_UPPER_LIMIT overflow/underflow");

    if (_oracleTypeStakeAfter >= 0) {
      _oracle.oracleTypeStakesPositive[_oracleType] = uint256(bytes32(_oracleTypeStakeAfter));
    } else {
      _oracle.oracleTypeStakesPositive[_oracleType] = 0;
    }

    if (_oracleStakeAfter >= 0) {
      _oracle.totalStakesPositive = uint256(bytes32(_oracleStakeAfter));
    } else {
      _oracle.totalStakesPositive = 0;
    }

    if (_totalStakeAfter >= 0) {
      totalStakePositive = uint256(bytes32(_totalStakeAfter));
    } else {
      totalStakePositive = 0;
    }
  }

  function oracles() internal view returns (IPGGOracles) {
    return pggConfig.getOracles();
  }

  function galtToken() internal view returns (IERC20) {
    return pggConfig.ggr().getGaltToken();
  }

  // GETTERS

  function oracleTypeMinimalStakeKey(bytes32 _oracleType) public pure returns (bytes32) {
    return keccak256(abi.encode("ORACLE_TYPE_MINIMAL_STAKE", _oracleType));
  }

  function oracleTypeMinimalStake(bytes32 _oracleType) public view returns (uint256) {
    return uint256(pggConfig.applicationConfig(oracleTypeMinimalStakeKey(_oracleType)));
  }

  function isOracleStakeActive(address _oracle, bytes32 _oracleType) external view returns (bool) {
    int256 required = int256(oracleTypeMinimalStake(_oracleType));

    // The role has not properly set up yet
    if (required == 0) {
      return false;
    }

    int256 current = oracleDetails[_oracle].oracleTypeStakes[_oracleType];

    return current >= required;
  }

  function balanceOf(address _oracle) external view returns (int256) {
    return oracleDetails[_oracle].totalStakes;
  }

  function typeStakeOf(address _oracle, bytes32 _oracleType) external view returns (int256) {
    return oracleDetails[_oracle].oracleTypeStakes[_oracleType];
  }

  function totalSupply() external view returns (int256) {
    return totalStake;
  }

  function positiveTotalSupply() external view returns (uint256) {
    return totalStakePositive;
  }

  function positiveBalanceOf(address _oracle) external view returns (uint256) {
    return oracleDetails[_oracle].totalStakesPositive;
  }

  function positiveTypeStakeOf(address _oracle, bytes32 _oracleType) external view returns (uint256) {
    return oracleDetails[_oracle].oracleTypeStakesPositive[_oracleType];
  }

  function balanceOfAt(address _oracle, uint256 _blockNumber) external view returns (uint256) {
    return _balanceOfAt(_oracle, _blockNumber);
  }

  function totalSupplyAt(uint256 _blockNumber) external view returns (uint256) {
    return _totalSupplyAt(_blockNumber);
  }
}
