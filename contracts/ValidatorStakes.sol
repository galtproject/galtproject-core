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

  bytes32 public constant SLASH_MANAGER = 0xfdecbbc9e01d6d45ae3e9272840413865ab6a2a32f8010b272db4c73d146f9bb;

  address claimManager;
  address multiSigWallet;
  ERC20 galtToken;
  Validators validators;
  mapping(address => ValidatorRoles) validatorRoles;


  struct ValidatorRoles {
    mapping(bytes32 => int256) roleStakes;
  }

  modifier onlyClaimManager {
    require(msg.sender == claimManager, "Invalid sender");

    _;
  }

  function initialize(
    Validators _validators,
    ERC20 _galtToken,
    address _claimManager,
    address _multiSigWallet
  )
    public
    isInitializer
  {
    owner = msg.sender;

    claimManager = _claimManager;
    multiSigWallet = _multiSigWallet;
    validators = _validators;
    galtToken = _galtToken;
  }

  function slash(address _validator, bytes32 _role, uint256 _amount) external onlyClaimManager {
    validators.requireHasRole(_validator, _role);

    int256 initialBalance = validatorRoles[_validator].roleStakes[_role];
    int256 finalBalance = validatorRoles[_validator].roleStakes[_role] - int256(_amount);

    // TODO: check validator/role exists
    validatorRoles[_validator].roleStakes[_role] = finalBalance;

    assert(finalBalance < initialBalance);
  }

  function stake(address _validator, bytes32 _role, uint256 _amount) external {
    validators.requireHasRole(_validator, _role);
    galtToken.transferFrom(msg.sender, multiSigWallet, _amount);

    require(_amount > 0, "Expect positive amount");
    int256 initialValue = validatorRoles[_validator].roleStakes[_role];
    validatorRoles[_validator].roleStakes[_role] = initialValue + int256(_amount);
    assert(validatorRoles[_validator].roleStakes[_role] > initialValue);
  }

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
