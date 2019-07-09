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

import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "@galtproject/multisig/contracts/MultiSigWallet.sol";
import "./PGGArbitratorStakeAccounting.sol";
import "./PGGConfig.sol";
import "./interfaces/IPGGMultiSig.sol";


contract PGGMultiSig is IPGGMultiSig, MultiSigWallet {
  event NewOwners(address[] auditors, uint256 required, uint256 total);
  event RevokeOwners();
  event GaltRunningTotalIncrease(
    uint256 periodId,
    uint256 runningTotalBefore,
    uint256 runningTotalAfter,
    uint256 totalArbitratorStakes,
    uint256 amount
  );

  bytes32 public constant PGG_ROLE_MULTI_SIG_PROPOSER = bytes32("PGG_MULTI_SIG_PROPOSER");

  bytes32 public constant ROLE_ARBITRATOR_MANAGER = bytes32("arbitrator_manager");
  bytes32 public constant ROLE_REVOKE_MANAGER = bytes32("revoke_manager");

  PGGConfig public pggConfig;

  bool internal initialized;

  mapping(uint256 => uint256) internal _periodRunningTotal;

  modifier forbidden() {
    assert(false);
    _;
  }

  modifier onlyInternalRole(bytes32 _role) {
    require(
      pggConfig.hasInternalRole(_role, msg.sender),
      "Invalid internal PGG role"
    );

    _;
  }

  modifier onlyPggMultiSigProposer() {
    require(
      pggConfig.ggr().getACL().hasRole(msg.sender, PGG_ROLE_MULTI_SIG_PROPOSER),
      "Only PGG_MULTI_SIG_PROPOSER global ACL role allowed"
    );

    _;
  }

  constructor(
    address[] memory _initialOwners,
    uint256 _required,
    PGGConfig _pggConfig
  )
    public
    MultiSigWallet(_initialOwners, _required)
  {
    pggConfig = _pggConfig;
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
  function proposeTransaction(address destination, uint value, bytes calldata data)
    external
    onlyPggMultiSigProposer
    returns (uint transactionId)
  {
    transactionId = addTransaction(destination, value, data);
  }

  /**
   * @dev Set a new arbitrators list with (N-of-M multisig)
   * @param descArbitrators list of all arbitrators from voting
   */
  function setArbitrators(
    address[] calldata descArbitrators
  )
    external
    onlyInternalRole(ROLE_ARBITRATOR_MANAGER)
  {
    uint256 m = pggConfig.m();
    uint256 n = pggConfig.n();

    require(descArbitrators.length >= 3, "List should be L >= 3");

    // If the pushed array is smaller than even `m`, assign both `m` and `n` its size
    if (m > descArbitrators.length) {
      m = descArbitrators.length;
      n = descArbitrators.length;
    }

    require(descArbitrators.length <= n, "Arbitrators array size greater than required");
    required = m;

    delete owners;

    for (uint256 i = 0; i < descArbitrators.length; i++) {
      address o = descArbitrators[i];

      isOwner[o] = true;
      owners.push(o);
    }

    emit NewOwners(owners, m, n);
  }

  function revokeArbitrators()
    external
    onlyInternalRole(ROLE_REVOKE_MANAGER)
  {
    delete owners;

    emit RevokeOwners();
  }

  /* solium-disable-next-line */
  function external_call(address destination, uint value, uint dataLength, bytes memory data) private returns (bool) {
    if (destination == pggConfig.ggr().getGaltTokenAddress()) {
      checkGaltLimits(data);
    }

    bool result;
    assembly {
      let x := mload(0x40)   // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
      let d := add(data, 32) // First 32 bytes are the padded length of data, so exclude that
      result := call(
      sub(gas, 34710),   // 34710 is the value that solidity is currently emitting
      // It includes callGas (700) + callVeryLow (3, to pay for SUB) + callValueTransferGas (9000) +
      // callNewAccountGas (25000, in case the destination address does not exist and needs creating)
      destination,
      value,
      d,
      dataLength,        // Size of the input (in bytes) - this is what fixes the padding problem
      x,
      0                  // Output is ignored, therefore the output size is zero
      )
    }
    return result;
  }

  function checkGaltLimits(bytes memory data) internal {
    uint256 galtValue;

    assembly {
      let code := mload(add(data, 0x20))
      code := and(code, 0xffffffff00000000000000000000000000000000000000000000000000000000)

      switch code
      // transfer(address,uint256)
      case 0xa9059cbb00000000000000000000000000000000000000000000000000000000 {
        galtValue := mload(add(data, 0x44))
      }
      default {
        // Methods other than transfer are prohibited for GALT contract
        revert(0, 0)
      }
    }

    if (galtValue == 0) {
      return;
    }

    (uint256 currentPeriodId, uint256 totalStakes) = pggConfig.getArbitratorStakes().getCurrentPeriodAndTotalSupply();

    uint256 runningTotalBefore = _periodRunningTotal[currentPeriodId];
    uint256 runningTotalAfter = _periodRunningTotal[currentPeriodId] + galtValue;
    assert(runningTotalAfter > runningTotalBefore);

    require(runningTotalAfter <= totalStakes, "Arbitrator expenses running total exceeds their total stakes");

    _periodRunningTotal[currentPeriodId] = runningTotalAfter;

    emit GaltRunningTotalIncrease(
      currentPeriodId,
      runningTotalBefore,
      runningTotalAfter,
      totalStakes,
      galtValue
    );
  }

  function checkGaltLimitsExternal(bytes calldata data) external {
    checkGaltLimits(data);
  }

  // GETTERS
  function getArbitrators() public view returns (address[] memory) {
    return owners;
  }
}
