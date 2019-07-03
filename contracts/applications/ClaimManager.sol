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


import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../pgg/PGGOracleStakeAccounting.sol";
import "../pgg/PGGMultiSig.sol";
import "../registries/PGGRegistry.sol";
import "./AbstractApplication.sol";
import "./ArbitratorProposableApplication.sol";


contract ClaimManager is ArbitratorProposableApplication {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  // `bytes4(keccak256('transfer(address,uint256)'))`
  bytes4 public constant ERC20_TRANSFER_SIGNATURE = 0xa9059cbb;

  bytes32 public constant CONFIG_MINIMAL_FEE_ETH = bytes32("CM_MINIMAL_FEE_ETH");
  bytes32 public constant CONFIG_MINIMAL_FEE_GALT = bytes32("CM_MINIMAL_FEE_GALT");
  bytes32 public constant CONFIG_PAYMENT_METHOD = bytes32("CM_PAYMENT_METHOD");
  bytes32 public constant CONFIG_M = bytes32("CM_M");
  bytes32 public constant CONFIG_N = bytes32("CM_N");
  bytes32 public constant CONFIG_PREFIX = bytes32("CM");

  struct ApplicationDetails {
    address beneficiary;
    uint256 amount;
    uint256 multiSigTransactionId;

    mapping(bytes32 => ProposalDetails) proposalDetails;
    bytes32[] attachedDocuments;
  }

  struct ProposalDetails {
    uint256 amount;
    address[] oracles;
    bytes32[] oracleTypes;
    uint256[] oracleFines;
    address[] arbitrators;
    uint256[] arbitratorFines;
  }

  mapping(bytes32 => ApplicationDetails) internal applicationDetails;

  constructor () public {}

  function initialize(
    GaltGlobalRegistry _ggr
  )
    public
    isInitializer
  {
    ggr = _ggr;
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

  /**
   * @dev Submit a new claim.
   *
   * @param _pgg to submit a claim
   * @param _beneficiary for refund
   * @param _amount of claim
   * @param _documents with details
   * @param _applicationFeeInGalt or 0 for ETH payment method
   * @return new claim id
   */
  function submit(
    address payable _pgg,
    address _beneficiary,
    uint256 _amount,
    bytes32[] calldata _documents,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    returns (bytes32)
  {
    bytes32 id = _submit(_pgg, _applicationFeeInGalt);

    ApplicationDetails storage aD = applicationDetails[id];

    aD.amount = _amount;
    aD.beneficiary = _beneficiary;
    aD.attachedDocuments = _documents;

    return id;
  }

  /**
   * @dev Arbitrator makes approve proposal
   * @param _cId Application ID
   */
  function proposeApproval(
    bytes32 _cId,
    string calldata _msg,
    uint256 _amount,
    address[] calldata _oracles,
    bytes32[] calldata _oracleTypes,
    uint256[] calldata _oracleFines,
    address[] calldata _arbitrators,
    uint256[] calldata _arbitratorFines
  )
    external
  {
    ProposalDetails storage pD = verifyProposeApprovalInputs(
      _cId,
      _msg,
      _oracles,
      _oracleTypes,
      _oracleFines,
      _arbitrators,
      _arbitratorFines
    );

    pD.amount = _amount;
    pD.arbitrators = _arbitrators;
    pD.arbitratorFines = _arbitratorFines;
    pD.oracleFines = _oracleFines;
    pD.oracleTypes = _oracleTypes;
    pD.oracles = _oracles;
  }

  function verifyProposeApprovalInputs(
    bytes32 _cId,
    string memory _msg,
    address[] memory _oracles,
    bytes32[] memory _oracleTypes,
    uint256[] memory _oracleFines,
    address[] memory _arbitrators,
    uint256[] memory _arbitratorFines
  )
    internal
    returns(ProposalDetails storage pD)
  {
    require(_oracles.length == _oracleTypes.length, "Oracle/OracleType arrays should be equal");
    require(_oracleTypes.length == _oracleFines.length, "OracleType/Fine arrays should be equal");
    require(_arbitrators.length == _arbitratorFines.length, "Arbitrator list/fines arrays should be equal");
    require(_oracles.length > 0 || _arbitratorFines.length > 0, "Either oracles or arbitrators should be fined");
    verifyOraclesAreValid(_cId, _oracles, _oracleTypes);

    pD = applicationDetails[_cId].proposalDetails[_proposeApproval(_cId, _msg)];
  }

  function verifyOraclesAreValid(bytes32 _cId, address[] memory _oracles, bytes32[] memory _oracleTypes) internal {
    Application storage c = applications[_cId];

    require(
      pggConfig(c.pgg)
        .getOracles()
        .oraclesHasTypesAssigned(_oracles, _oracleTypes),
      "Some oracle types are invalid"
    );
  }

  function _execute(bytes32 _aId, bytes32 _pId) internal {
    ApplicationDetails storage aD = applicationDetails[_aId];
    ProposalDetails storage pD = aD.proposalDetails[_pId];

    IPGGConfig cfg = pggConfig(applications[_aId].pgg);

    cfg
      .getOracleStakes()
      .slashMultiple(pD.oracles, pD.oracleTypes, pD.oracleFines);

    cfg
      .getArbitratorStakes()
      .slashMultiple(pD.arbitrators, pD.arbitratorFines);

    aD.multiSigTransactionId = cfg.getMultiSig().proposeTransaction(
      address(ggr.getGaltToken()),
      0x0,
      abi.encodeWithSelector(ERC20_TRANSFER_SIGNATURE, aD.beneficiary, pD.amount)
    );
  }

  function _checkRewardCanBeClaimed(bytes32 _aId) internal returns (bool) {
    Application storage a = applications[_aId];
    ApplicationDetails storage aD = applicationDetails[_aId];
    (, , , bool executed) = pggConfig(a.pgg).getMultiSig().transactions(aD.multiSigTransactionId);
    return executed;
  }

  /** GETTERS **/
  function getApplicationDetails(
    bytes32 _aId
  )
    external
    view
    returns (
      address beneficiary,
      uint256 amount,
      uint256 multiSigTransactionId
    )
  {
    ApplicationDetails storage aD = applicationDetails[_aId];

    return (
      aD.beneficiary,
      aD.amount,
      aD.multiSigTransactionId
    );
  }

  function getProposalDetails(
    bytes32 _cId,
    bytes32 _pId
  )
    external
    view
    returns (
      address[] memory oracles,
      bytes32[] memory oracleTypes,
      uint256[] memory oracleFines,
      address[] memory arbitrators,
      uint256[] memory arbitratorFines
    )
  {
    ProposalDetails storage p = applicationDetails[_cId].proposalDetails[_pId];

    return (
      p.oracles,
      p.oracleTypes,
      p.oracleFines,
      p.arbitrators,
      p.arbitratorFines
    );
  }
}
