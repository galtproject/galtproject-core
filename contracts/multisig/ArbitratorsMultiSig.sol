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

import "../vendor/MultiSigWallet/MultiSigWallet.sol";
import "../traits/Permissionable.sol";

contract ArbitratorsMultiSig is MultiSigWallet, Permissionable {
  event NewAuditorsSet(address[] auditors, uint256 required, uint256 total);

  string public constant ROLE_PROPOSER = "proposer";
  string public constant ROLE_ARBITRATOR_MANAGER = "arbitrator_manager";

  address public arbitratorVoting;
  address public oracleStakesAccounting;
  bool initialized;

  modifier forbidden() {
    assert(false);
    _;
  }

  constructor(
    address[] _initialOwners,
    uint256 _required
  )
    public
    MultiSigWallet(_initialOwners, _required)
  {
  }

  function addOwner(address owner) public forbidden {}
  function removeOwner(address owner) public forbidden {}
  function replaceOwner(address owner, address newOwner) public forbidden {}
  function changeRequirement(uint _required) public forbidden {}

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

  /**
   * @dev Set a new arbitrators list with (N-of-M multisig)
   * @param m required number of signatures
   * @param n number of validators to slice for a new list
   * @param descArbitrators list of all arbitrators from voting
   */
  function setArbitrators(
    uint256 m,
    uint256 n,
    address[] descArbitrators
  )
    external
    onlyRole(ROLE_ARBITRATOR_MANAGER)
  {
    require(descArbitrators.length >= n, "Arbitrators array size less than required");
    required = m;

    delete owners;

    for (uint8 i = 0; i < n; i++) {
      address o = descArbitrators[i];

      isOwner[o] = true;
      owners.push(o);
      emit OwnerAddition(o);
    }
    emit NewAuditorsSet(owners, m, n);
  }

  function initialize(
    address _arbitratorVoting,
    address _oracleStakesAccounting
  )
    external
  {
    require(initialized == false, "Already initialized");

    arbitratorVoting = _arbitratorVoting;
    oracleStakesAccounting = _oracleStakesAccounting;
    initialized = true;
  }

  // GETTERS
  function getArbitrators() public view returns (address[]) {
    return owners;
  }
}
