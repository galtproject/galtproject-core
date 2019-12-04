/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


import "@openzeppelin/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "@galtproject/geodesic/contracts/interfaces/IGeodesic.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "./ArbitratorProposableApplication.sol";
import "../interfaces/ISpaceToken.sol";


contract ModifySpaceGeoDataManager is ArbitratorProposableApplication {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  bytes32 public constant CONFIG_MINIMAL_FEE_ETH = bytes32("MS_MINIMAL_FEE_ETH");
  bytes32 public constant CONFIG_MINIMAL_FEE_GALT = bytes32("MS_MINIMAL_FEE_GALT");
  bytes32 public constant CONFIG_PAYMENT_METHOD = bytes32("MS_PAYMENT_METHOD");
  bytes32 public constant CONFIG_M = bytes32("MS_M");
  bytes32 public constant CONFIG_N = bytes32("MS_N");
  bytes32 public constant CONFIG_PREFIX = bytes32("MS");

  struct ApplicationDetails {
    bytes32[] attachedDocuments;
    mapping(bytes32 => ProposalDetails) proposalDetails;
  }

  struct ProposalDetails {
    uint256 spaceTokenId;
    bytes32 ledgerIdentifier;
    int256 level;
    uint256 area;
    ISpaceGeoDataRegistry.AreaSource areaSource;
    string description;
    uint256[] contour;
    int256[] heights;
  }

  mapping(uint256 => ApplicationDetails) internal applicationDetails;

  constructor () public {}

  function initialize(
    GaltGlobalRegistry _ggr
  )
    public
    isInitializer
  {
    ggr = _ggr;
  }

  // CONFIG GETTERS

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

  // EXTERNAL

  function submit(
    address payable _pgg,
    bytes32[] calldata _documents,
    uint256 _applicationFeeInGalt
  )
    external
    payable
    returns (uint256)
  {
    uint256 id = nextId();

    ApplicationDetails storage aD = applicationDetails[id];

    aD.attachedDocuments = _documents;

    return id;
  }

  function proposeApproval(
    uint256 _aId,
    string calldata _msg,
    uint256 _spaceTokenId,
    bytes32 _ledgerIdentifier,
    int256 _level,
    uint256 _area,
    ISpaceGeoDataRegistry.AreaSource _areaSource,
    string calldata _description,
    uint256[] calldata _contour,
    int256[] calldata _heights
  )
    external
  {
    ProposalDetails storage pD = _verifyProposeApprovalInputs(
      _aId,
      _msg,
      _spaceTokenId,
      _contour,
      _heights
    );

    pD.spaceTokenId = _spaceTokenId;
    pD.ledgerIdentifier = _ledgerIdentifier;
    pD.level = _level;
    pD.area = _area;
    pD.areaSource = _areaSource;
    pD.description = _description;
    pD.contour = _contour;
    pD.heights = _heights;
  }

  // INTERNAL

  function _verifyProposeApprovalInputs(
    uint256 _aId,
    string memory _msg,
    uint256 _spaceTokenId,
    uint256[] memory _contour,
    int256[] memory _heights
  )
    internal
    returns(ProposalDetails storage pD)
  {
    require(ISpaceToken(ggr.getSpaceTokenAddress()).exists(_spaceTokenId) == true, "Space token doesn't exist");
    require(_contour.length >= 3, "Contour sould have at least 3 vertices");
    require(_contour.length == _heights.length, "Contour length should be equal heights length");

    pD = applicationDetails[_aId].proposalDetails[_proposeApproval(_aId, _msg)];
  }

  function _execute(uint256 _aId, bytes32 _pId) internal {
    ApplicationDetails storage aD = applicationDetails[_aId];
    ProposalDetails storage pD = aD.proposalDetails[_pId];

    uint256 area;
    ISpaceGeoDataRegistry.AreaSource areaSource;
    if (pD.areaSource == ISpaceGeoDataRegistry.AreaSource.USER_INPUT) {
      area = pD.area;
    } else {
      area = IGeodesic(ggr.getGeodesicAddress()).calculateContourArea(pD.contour);
    }

    ISpaceGeoDataRegistry spaceGeoData = ISpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress());
    spaceGeoData.setContour(pD.spaceTokenId, pD.contour);
//    spaceGeoData.setSpaceTokenHeights(pD.spaceTokenId, pD.heights);
//    spaceGeoData.setSpaceTokenLevel(pD.spaceTokenId, pD.level);
//    spaceGeoData.setSpaceTokenArea(pD.spaceTokenId, area, pD.areaSource);
//    spaceGeoData.setSpaceTokenInfo(pD.spaceTokenId, pD.ledgerIdentifier, pD.description);
  }

  function _checkRewardCanBeClaimed(uint256 _aId) internal returns (bool) {
    // TODO: perform check
    return true;
  }

  // GETTERS

  function getApplicationDetails(
    uint256 _aId
  )
    external
    view
    returns (
      bytes32[] memory attachedDocuments
    )
  {
    ApplicationDetails storage aD = applicationDetails[_aId];

    return (
      aD.attachedDocuments
    );
  }

  function getProposalDetails(
    uint256 _aId,
    bytes32 _pId
  )
    external
    view
    returns (
      uint256 spaceTokenId,
      bytes32 ledgerIdentifier,
      int256 level,
      uint256 area,
      ISpaceGeoDataRegistry.AreaSource areaSource,
      string memory description,
      uint256[] memory contour,
      int256[] memory heights
    )
  {
    ProposalDetails storage p = applicationDetails[_aId].proposalDetails[_pId];

    return (
      p.spaceTokenId,
      p.ledgerIdentifier,
      p.level,
      p.area,
      p.areaSource,
      p.description,
      p.contour,
      p.heights
    );
  }
}
