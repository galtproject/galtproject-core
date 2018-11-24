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
import "./collections/ArraySet.sol";
import "./Oracles.sol";
import "./utils/Initializable.sol";


contract OracleStakesAccounting is Permissionable, Initializable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  string public constant ROLE_SLASH_MANAGER = "slash_manager";

  address slashManager;
  address multiSigWallet;
  ERC20 galtToken;
  Oracles oracles;
  mapping(address => OracleTypes) oracleTypes;


  struct OracleTypes {
    mapping(bytes32 => int256) oracleTypeStakes;
  }

  modifier onlySlashManager {
    requireRole(msg.sender, ROLE_SLASH_MANAGER);

    _;
  }

  function initialize(
    Oracles _oracles,
    ERC20 _galtToken,
    address _multiSigWallet
  )
    public
    isInitializer
  {
    multiSigWallet = _multiSigWallet;
    oracles = _oracles;
    galtToken = _galtToken;
  }

  function slash(address _oracle, bytes32 _oracleType, uint256 _amount) external onlySlashManager {
    _slash(_oracle, _oracleType, _amount);
  }

  function slash(address[] _oracles, bytes32[] _oracleTypes, uint256[] _amounts) external onlySlashManager {
    assert(_oracles.length == _oracleTypes.length);
    assert(_oracleTypes.length == _amounts.length);

    for (uint256 i = 0; i < _oracles.length; i++) {
      _slash(_oracles[i], _oracleTypes[i], _amounts[i]);
    }
  }

  function _slash(address _oracle, bytes32 _oracleType, uint256 _amount) internal {
    require(oracles.isOracleTypeAssigned(_oracle, _oracleType), "Some oracle types doesn't match");

    int256 initialBalance = oracleTypes[_oracle].oracleTypeStakes[_oracleType];
    int256 finalBalance = oracleTypes[_oracle].oracleTypeStakes[_oracleType] - int256(_amount);

    oracleTypes[_oracle].oracleTypeStakes[_oracleType] = finalBalance;

    assert(finalBalance < initialBalance);

    oracles.onOracleStakeChanged(_oracle, _oracleType, finalBalance);
  }

  function stake(address _oracle, bytes32 _oracleType, uint256 _amount) external {
    oracles.requireOracleActiveWithAssignedOracleType(_oracle, _oracleType);
    galtToken.transferFrom(msg.sender, multiSigWallet, _amount);

    require(_amount > 0, "Expect positive amount");
    int256 initialValue = oracleTypes[_oracle].oracleTypeStakes[_oracleType];
    int256 finalValue = initialValue + int256(_amount);
    oracleTypes[_oracle].oracleTypeStakes[_oracleType] = finalValue;
    assert(oracleTypes[_oracle].oracleTypeStakes[_oracleType] > initialValue);

    oracles.onOracleStakeChanged(_oracle, _oracleType, finalValue);
  }

  function stakeOf(address _oracle, bytes32 _oracleType) external view returns (int256) {
    return oracleTypes[_oracle].oracleTypeStakes[_oracleType];
  }
}
