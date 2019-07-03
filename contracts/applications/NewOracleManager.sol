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


import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/traits/Statusable.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../registries/PGGRegistry.sol";
import "./AbstractApplication.sol";
import "./ArbitratorApprovableApplication.sol";


contract NewOracleManager is ArbitratorApprovableApplication {
  bytes32 public constant CONFIG_MINIMAL_FEE_ETH = bytes32("NO_MINIMAL_FEE_ETH");
  bytes32 public constant CONFIG_MINIMAL_FEE_GALT = bytes32("NO_MINIMAL_FEE_GALT");
  bytes32 public constant CONFIG_PAYMENT_METHOD = bytes32("NO_PAYMENT_METHOD");
  bytes32 public constant CONFIG_M = bytes32("NO_M");
  bytes32 public constant CONFIG_N = bytes32("NO_N");
  bytes32 public constant CONFIG_PREFIX = bytes32("NO");

  struct OracleDetails {
    address addr;
    string name;
    bytes32 position;
    string description;
    bytes32[] descriptionHashes;
    bytes32[] oracleTypes;
  }

  mapping(bytes32 => OracleDetails) oracleDetails;

  constructor() public {}

  function initialize(
    GaltGlobalRegistry _ggr
  )
    public
    isInitializer
  {
    _initialize(_ggr);
  }

  function minimalApplicationFeeEth(address _pgg) internal view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_MINIMAL_FEE_ETH));
  }

  function minimalApplicationFeeGalt(address _pgg) internal view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_MINIMAL_FEE_GALT));
  }

  // arbitrators count required
  function m(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_M));
  }

  // total arbitrators count able to lock the claim
  function n(address _pgg) public view returns (uint256) {
    return uint256(pggConfigValue(_pgg, CONFIG_N));
  }

  function paymentMethod(address _pgg) public view returns (PaymentMethod) {
    return PaymentMethod(uint256(pggConfigValue(_pgg, CONFIG_PAYMENT_METHOD)));
  }

  function submit(
    address _pgg,
    address _oracleAddress,
    string calldata _name,
    bytes32 _position,
    string calldata _description,
    bytes32[] calldata _descriptionHashes,
    bytes32[] calldata _oracleTypes,
    uint256 _applicationFeeInGalt
  )
    external
    payable
  {
    bytes32 id = _generateId(_oracleTypes, _descriptionHashes, _name);

    _submit(id, _pgg, _applicationFeeInGalt);

    OracleDetails storage o = oracleDetails[id];
    o.oracleTypes = _oracleTypes;
    o.descriptionHashes = _descriptionHashes;
    o.description = _description;
    o.name = _name;
    o.position = _position;
    o.addr = _oracleAddress;
  }

  function _generateId(bytes32[] memory _oracleTypes, bytes32[] memory _descriptionHashes, string memory _name) internal returns (bytes32) {
    require(_descriptionHashes.length > 0, "Description hashes required");
    require(_oracleTypes.length > 0, "Oracle Types required");

    return keccak256(
      abi.encodePacked(
        msg.sender,
        _name,
        _descriptionHashes,
        block.number
      )
    );
  }

  function _execute(bytes32 _id) internal {
    OracleDetails storage d = oracleDetails[_id];
    Application storage a = applications[_id];

    pggConfig(a.pgg)
      .getOracles()
      .addOracle(d.addr, d.name, d.position, d.description, d.descriptionHashes, d.oracleTypes);
  }

  // GETTERS

  function getApplicationOracle(
    bytes32 _id
  )
    external
    view
    returns (
      address pgg,
      address addr,
      bytes32 position,
      string memory name,
      string memory description,
      bytes32[] memory descriptionHashes,
      bytes32[] memory oracleTypes
    )
  {
    OracleDetails storage o = oracleDetails[_id];
    Application storage a = applications[_id];

    return (
      a.pgg,
      o.addr,
      o.position,
      o.name,
      o.description,
      o.descriptionHashes,
      o.oracleTypes
    );
  }
}
