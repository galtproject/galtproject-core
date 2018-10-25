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
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/rbac/RBAC.sol";
import "./Validators.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./collections/ArraySet.sol";
import "zos-lib/contracts/migrations/Initializable.sol";


contract ValidatorStakes is Ownable, RBAC, Initializable {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  string public constant ROLE_SLASH_MANAGER = "slash_manager";

  address slashManager;
  address multiSigWallet;
  ERC20 galtToken;
  Validators validators;
  mapping(address => ValidatorRoles) validatorRoles;


  struct ValidatorRoles {
    mapping(bytes32 => int256) roleStakes;
  }

  modifier onlySlashManager {
    require(hasRole(msg.sender, ROLE_SLASH_MANAGER), "Invalid sender");

    _;
  }

  function initialize(
    Validators _validators,
    ERC20 _galtToken,
    address _multiSigWallet
  )
    public
    isInitializer
  {
    owner = msg.sender;

    multiSigWallet = _multiSigWallet;
    validators = _validators;
    galtToken = _galtToken;
  }

  function slash(address _validator, bytes32 _role, uint256 _amount) external onlySlashManager {
    _slash(_validator, _role, _amount);
  }

  function slash(address[] _validators, bytes32[] _roles, uint256[] _amounts) external onlySlashManager {
    assert(_validators.length == _roles.length);
    assert(_roles.length == _amounts.length);

    for (uint256 i = 0; i < _validators.length; i++) {
      _slash(_validators[i], _roles[i], _amounts[i]);
    }
  }

  function _slash(address _validator, bytes32 _role, uint256 _amount) internal {
    require(validators.isValidatorRoleAssigned(_validator, _role), "Some roles doesn't match");

    int256 initialBalance = validatorRoles[_validator].roleStakes[_role];
    int256 finalBalance = validatorRoles[_validator].roleStakes[_role] - int256(_amount);

    validatorRoles[_validator].roleStakes[_role] = finalBalance;

    assert(finalBalance < initialBalance);

    validators.onStakeChanged(_validator, _role, finalBalance);
  }

  function stake(address _validator, bytes32 _role, uint256 _amount) external {
    validators.requireValidatorActiveWithAssignedRole(_validator, _role);
    galtToken.transferFrom(msg.sender, multiSigWallet, _amount);

    require(_amount > 0, "Expect positive amount");
    int256 initialValue = validatorRoles[_validator].roleStakes[_role];
    int256 finalValue = initialValue + int256(_amount);
    validatorRoles[_validator].roleStakes[_role] = finalValue;
    assert(validatorRoles[_validator].roleStakes[_role] > initialValue);

    validators.onStakeChanged(_validator, _role, finalValue);
  }
  event FailedCheck(address _v, bytes32 _r, bool _hhas);

  function stakeOf(address _validator, bytes32 _role) external view returns (int256) {
    return validatorRoles[_validator].roleStakes[_role];
  }

  function addRoleTo(address _operator, string _role) external onlyOwner {
    super.addRole(_operator, _role);
  }

  function removeRoleFrom(address _operator, string _role) external onlyOwner {
    super.removeRole(_operator, _role);
  }
}
