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

contract AuditorsWallet is MultiSigWallet, RBAC {
  string public constant ROLE_AUTO_PROPOSER = "auto-proposer";

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
    onlyRole(ROLE_AUTO_PROPOSER)
    returns (uint transactionId)
  {
    transactionId = addTransaction(destination, value, data);
  }

  function addRoleTo(
    address _operator,
    string _role
  )
    public
    onlyWallet
  {
    super.addRole(_operator, _role);
  }

  function removeRoleFrom(
    address _operator,
    string _role
  )
    public
    onlyWallet
  {
    super.removeRole(_operator, _role);
  }
}
