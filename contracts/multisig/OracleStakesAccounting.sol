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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../Oracles.sol";
import "./ArbitratorVoting.sol";
import "./ArbitratorsMultiSig.sol";


contract OracleStakesAccounting is Permissionable {
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

  string public constant ROLE_SLASH_MANAGER = "slash_manager";

  address slashManager;
  ArbitratorsMultiSig public multiSigWallet;
  ArbitratorVoting public voting;
  IERC20 public galtToken;
  Oracles public oracles;
  mapping(address => OracleTypes) oracleTypes;


  struct OracleTypes {
    int256 totalStakes;
    mapping(bytes32 => int256) oracleTypeStakes;
  }

  modifier onlySlashManager {
    requireRole(msg.sender, ROLE_SLASH_MANAGER);

    _;
  }

  constructor(
    Oracles _oracles,
    IERC20 _galtToken,
    ArbitratorsMultiSig _multiSigWallet
  )
    public
  {
    oracles = _oracles;
    galtToken = _galtToken;
    multiSigWallet = _multiSigWallet;
  }

  function setVotingAddress(ArbitratorVoting _voting) external onlyRole(ROLE_ROLE_MANAGER) {
    voting = _voting;
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
    require(oracles.isOracleTypeAssigned(_oracle, _oracleType), "Some oracle types doesn't match");

    int256 initialOracleTypeStake = oracleTypes[_oracle].oracleTypeStakes[_oracleType];
    int256 initialOracleTotalStake = oracleTypes[_oracle].totalStakes;
    int256 finalOracleTypeStake = oracleTypes[_oracle].oracleTypeStakes[_oracleType] - int256(_amount);
    int256 finalOracleTotalStake = oracleTypes[_oracle].totalStakes - int256(_amount);

    assert(finalOracleTotalStake < initialOracleTotalStake);
    assert(finalOracleTypeStake < initialOracleTypeStake);

    oracleTypes[_oracle].totalStakes = finalOracleTotalStake;
    oracleTypes[_oracle].oracleTypeStakes[_oracleType] = finalOracleTypeStake;

    oracles.onOracleStakeChanged(address(multiSigWallet), _oracle, _oracleType, finalOracleTypeStake);
    voting.onOracleStakeChanged(_oracle, uint256(finalOracleTotalStake));

    emit OracleStakeSlash(_oracle, _oracleType, _amount, finalOracleTypeStake, finalOracleTotalStake);
  }

  function stake(address _oracle, bytes32 _oracleType, uint256 _amount) external {
    oracles.requireOracleActiveWithAssignedOracleType(_oracle, _oracleType);
    galtToken.transferFrom(msg.sender, address(multiSigWallet), _amount);

    require(_amount > 0, "Expect positive amount");

    int256 initialTotalStakes = oracleTypes[_oracle].totalStakes;
    int256 initialRoleStake = oracleTypes[_oracle].oracleTypeStakes[_oracleType];
    int256 finalRoleStake = initialRoleStake + int256(_amount);
    int256 finalTotalStakes = initialTotalStakes + int256(_amount);

    assert(finalTotalStakes > initialTotalStakes);
    assert(finalRoleStake > initialRoleStake);

    oracleTypes[_oracle].totalStakes = finalTotalStakes;
    oracleTypes[_oracle].oracleTypeStakes[_oracleType] = finalRoleStake;

    oracles.onOracleStakeChanged(address(multiSigWallet), _oracle, _oracleType, finalRoleStake);
    voting.onOracleStakeChanged(_oracle, uint256(finalTotalStakes));

    emit OracleStakeDeposit(_oracle, _oracleType, _amount, finalRoleStake, finalTotalStakes);
  }

  function balanceOf(address _oracle) external view returns (int256) {
    return oracleTypes[_oracle].totalStakes;
  }

  function stakeOf(address _oracle, bytes32 _oracleType) external view returns (int256) {
    return oracleTypes[_oracle].oracleTypeStakes[_oracleType];
  }
}
