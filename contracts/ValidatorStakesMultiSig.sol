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

import "./vendor/MultiSigWallet/MultiSigWallet.sol";
import "openzeppelin-solidity/contracts/ownership/rbac/RBAC.sol";

contract ValidatorStakesMultiSig is MultiSigWallet, RBAC {
  event NewAuditorsSet(address[] auditors, uint256 required, uint256 total);

  string public constant ROLE_MANAGER = "role_manager";
  string public constant ROLE_PROPOSER = "proposer";
  string public constant ROLE_AUDITORS_MANAGER = "auditors_manager";

  modifier onlyRole(string _role) {
    require(hasRole(msg.sender, _role), "Invalid role");

    _;
  }

  constructor(
    address _roleManager,
    address[] _initialOwners,
    uint256 _required
  )
    public
    MultiSigWallet(_initialOwners, _required)
  {
    super.addRole(_roleManager, ROLE_MANAGER);
  }

  /*
   * @dev ROLE_AUTO_PROPOSER role could propose any transaction such as
   * funds transfer or external method invocation.
   *
   * @param destination Transaction target address.
   * @param value Transaction ether value.
   * @param data Transaction data payload.
   * @return Returns transaction ID.
   */
  function proposeTransaction(address destination, uint value, bytes data)
    external
    onlyRole(ROLE_PROPOSER)
    returns (uint transactionId)
  {
    transactionId = addTransaction(destination, value, data);
  }

  function setOwners(
    uint256 n,
    uint256 m,
    address[] descAuditors
  )
    external
    onlyRole(ROLE_AUDITORS_MANAGER)
  {
    require(descAuditors.length > m, "Auditors array size less than required");
    required = n;

    emit Size(owners.length);
    delete owners;
    emit Size(owners.length);
//    owners = descAuditors;
    emit NewAuditorsSet(descAuditors, n, m);

    for (uint8 i = 0; i < m; i++) {
      owners.push(descAuditors[i]);
    }
    emit Size(owners.length);
    emit NewAuditorsSet(owners, n, m);
  }
  event Size(uint256);

  function addRoleTo(
    address _operator,
    string _role
  )
    external
    onlyRole(ROLE_MANAGER)
  {
    super.addRole(_operator, _role);
  }

  function removeRoleFrom(
    address _operator,
    string _role
  )
    external
    onlyRole(ROLE_MANAGER)
  {
    super.removeRole(_operator, _role);
  }
}
