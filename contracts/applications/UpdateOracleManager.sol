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

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/traits/Statusable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./ArbitratorApprovableApplication.sol";
import "./AbstractApplication.sol";


contract UpdateOracleManager is ArbitratorApprovableApplication {
  bytes32 public constant APPLICATION_TYPE = 0xec6610ed0bf714476800ac10ef0615b9f667f714ca25d80079e41026c60a76ed;

  bytes32 public constant CONFIG_MINIMAL_FEE_ETH = bytes32("UO_MINIMAL_FEE_ETH");
  bytes32 public constant CONFIG_MINIMAL_FEE_GALT = bytes32("UO_MINIMAL_FEE_GALT");
  bytes32 public constant CONFIG_PAYMENT_METHOD = bytes32("UO_PAYMENT_METHOD");
  bytes32 public constant CONFIG_M = bytes32("UO_M");
  bytes32 public constant CONFIG_N = bytes32("UO_N");
  bytes32 public constant CONFIG_PREFIX = bytes32("UO");

  struct OracleDetails {
    address multiSig;
    address addr;
    bytes32 name;
    bytes32 position;
    string description;
    bytes32[] descriptionHashes;
    bytes32[] oracleTypes;
  }

  mapping(bytes32 => OracleDetails) oracleDetails;

  Oracles oracles;

  constructor() public {}

  function initialize(
    GaltGlobalRegistry _ggr,
    address _galtSpaceRewardsAddress
  )
    public
    isInitializer
  {
    _initialize(_ggr, _galtSpaceRewardsAddress);
    oracles = Oracles(ggr.getOraclesAddress());
  }

  function minimalApplicationFeeEth(address _multiSig) internal view returns (uint256) {
    return uint256(applicationConfig(_multiSig, CONFIG_MINIMAL_FEE_ETH));
  }

  function minimalApplicationFeeGalt(address _multiSig) internal view returns (uint256) {
    return uint256(applicationConfig(_multiSig, CONFIG_MINIMAL_FEE_GALT));
  }

  // arbitrators count required
  function m(address _multiSig) public view returns (uint256) {
    return uint256(applicationConfig(_multiSig, CONFIG_M));
  }

  // total arbitrators count able to lock the claim
  function n(address _multiSig) public view returns (uint256) {
    return uint256(applicationConfig(_multiSig, CONFIG_N));
  }

  function paymentMethod(address _multiSig) internal view returns (PaymentMethod) {
    return PaymentMethod(uint256(applicationConfig(_multiSig, CONFIG_PAYMENT_METHOD)));
  }

  function submit(
    address payable _multiSig,
    address _oracleAddress,
    bytes32 _name,
    bytes32 _position,
    string calldata _description,
    bytes32[] calldata _descriptionHashes,
    bytes32[] calldata _oracleTypes,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    returns (bytes32)
  {
    oracles.requireOracleActive(_oracleAddress);
    require(_descriptionHashes.length > 0, "Description hashes required");
    require(_descriptionHashes.length > 0, "Oracle Types required");

    bytes32 id = keccak256(
      abi.encodePacked(
        msg.sender,
        _name,
        _descriptionHashes,
        applicationsArray.length
      )
    );

    OracleDetails memory o;
    o.addr = _oracleAddress;
    o.name = _name;
    o.position = _position;
    o.description = _description;
    o.multiSig = _multiSig;
    o.descriptionHashes = _descriptionHashes;
    o.oracleTypes = _oracleTypes;

    oracleDetails[id] = o;

    return _submit(id, _multiSig, _applicationFeeInGalt);
  }

  function _execute(bytes32 _id) internal {
    OracleDetails storage d = oracleDetails[_id];
    Application storage a = applications[_id];
    oracles.addOracle(a.multiSig, d.addr, d.name, d.position, d.description, d.descriptionHashes, d.oracleTypes);
  }

  // GETTERS

  function getApplicationOracle(
    bytes32 _id
  )
    external
    view
    returns (
      address multiSig,
      address addr,
      bytes32 name,
      bytes32 position,
      bytes32[] memory descriptionHashes,
      bytes32[] memory oracleTypes
    )
  {
    OracleDetails storage o = oracleDetails[_id];
    Application storage a = applications[_id];

    return (
      a.multiSig,
      o.addr,
      o.name,
      o.position,
      o.descriptionHashes,
      o.oracleTypes
    );
  }
}
