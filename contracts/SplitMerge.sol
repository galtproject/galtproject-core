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
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/drafts/Counters.sol";
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "./interfaces/ISpaceSplitOperation.sol";
import "./interfaces/ISpaceSplitOperationFactory.sol";
import "./factories/SpaceSplitOperationFactory.sol";
import "./utils/ArrayUtils.sol";
import "./interfaces/ISpaceToken.sol";
import "./registries/SpaceGeoDataRegistry.sol";
import "./registries/GaltGlobalRegistry.sol";


contract SplitMerge is OwnableAndInitializable {
  event SplitOperationStart(uint256 indexed spaceTokenId, address splitOperation);
  event NewSplitSpaceToken(uint256 id);

  GaltGlobalRegistry internal ggr;

  mapping(address => bool) public activeSplitOperations;
  mapping(uint256 => address[]) public tokenIdToSplitOperations;
  address[] public allSplitOperations;

  modifier onlySpaceTokenOwner(uint256 _spaceTokenId) {
    address ownerOfToken = spaceToken().ownerOf(_spaceTokenId);

    require(
    /* solium-disable-next-line */
      ownerOfToken == msg.sender ||
      spaceToken().isApprovedForAll(ownerOfToken, msg.sender) ||
      spaceToken().getApproved(_spaceTokenId) == msg.sender,
      "This action not permitted");
    _;
  }

  function initialize(GaltGlobalRegistry _ggr) public isInitializer {
    ggr = _ggr;
  }

   // TODO: add SpaceSplitOperationFactory for migrations between versions
  function startSplitOperation(uint256 _spaceTokenId, uint256[] calldata _clippingContour)
    external
    onlySpaceTokenOwner(_spaceTokenId)
    returns (address)
  {
    SpaceGeoDataRegistry _reg = SpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress());

    require(
      _reg.getSpaceTokenAreaSource(_spaceTokenId) == ISpaceGeoDataRegistry.AreaSource.CONTRACT,
      "Split available only for contract calculated token's area"
    );

    address spaceTokenOwner = spaceToken().ownerOf(_spaceTokenId);

    address newSplitOperationAddress = SpaceSplitOperationFactory(ggr.getSpaceSplitOperationFactoryAddress())
      .build(_spaceTokenId, _clippingContour);

    activeSplitOperations[newSplitOperationAddress] = true;
    tokenIdToSplitOperations[_spaceTokenId].push(newSplitOperationAddress);
    allSplitOperations.push(newSplitOperationAddress);

    spaceToken().transferFrom(spaceTokenOwner, newSplitOperationAddress, _spaceTokenId);
    ISpaceSplitOperation(newSplitOperationAddress).init();

    emit SplitOperationStart(_spaceTokenId, newSplitOperationAddress);
    return newSplitOperationAddress;
  }

  function calculateTokenArea(uint256 _spaceTokenId) public returns (uint256) {
    SpaceGeoDataRegistry reg = SpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress());
    return IGeodesic(ggr.getGeodesicAddress()).calculateContourArea(reg.getSpaceTokenContour(_spaceTokenId));
  }

  function finishSplitOperation(uint256 _spaceTokenId) external {
    require(tokenIdToSplitOperations[_spaceTokenId].length > 0, "Split operations for this token not exists");
    address splitOperationAddress = tokenIdToSplitOperations[_spaceTokenId][tokenIdToSplitOperations[_spaceTokenId].length - 1];
    require(activeSplitOperations[splitOperationAddress], "Method should be called for active SpaceSplitOperation contract");

    ISpaceSplitOperation splitOperation = ISpaceSplitOperation(splitOperationAddress);
    SpaceGeoDataRegistry reg = SpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress());

    (uint256[] memory subjectContourOutput, address subjectTokenOwner, uint256 resultContoursLength) = splitOperation.getFinishInfo();

    reg.setSpaceTokenContour(_spaceTokenId, subjectContourOutput);

    int256[] memory currentHeights = reg.getSpaceTokenHeights(_spaceTokenId);
    int256 minHeight = currentHeights[0];

    int256[] memory subjectPackageHeights = new int256[](subjectContourOutput.length);
    for (uint i = 0; i < subjectContourOutput.length; i++) {
      if (i + 1 > currentHeights.length) {
        subjectPackageHeights[i] = minHeight;
      } else {
        if (subjectPackageHeights[i] < minHeight) {
          minHeight = currentHeights[i];
        }
        subjectPackageHeights[i] = currentHeights[i];
      }
    }

    reg.setSpaceTokenHeights(_spaceTokenId, subjectPackageHeights);

    spaceToken().transferFrom(splitOperationAddress, subjectTokenOwner, _spaceTokenId);
    int256 originalLevel = reg.getSpaceTokenLevel(_spaceTokenId);

    for (uint256 j = 0; j < resultContoursLength; j++) {
      uint256 newPackageId = spaceToken().mint(subjectTokenOwner);

      reg.setSpaceTokenContour(newPackageId, splitOperation.getResultContour(j));
      reg.setSpaceTokenArea(newPackageId, calculateTokenArea(newPackageId), ISpaceGeoDataRegistry.AreaSource.CONTRACT);

      int256[] memory newTokenHeights = new int256[](reg.getSpaceTokenVertexCount(newPackageId));

      uint256 len = reg.getSpaceTokenVertexCount(newPackageId);
      for (uint256 k = 0; k < len; k++) {
        newTokenHeights[k] = minHeight;
      }
      reg.setSpaceTokenHeights(newPackageId, newTokenHeights);
      reg.setSpaceTokenLevel(newPackageId, originalLevel);

      emit NewSplitSpaceToken(newPackageId);
    }

    reg.setSpaceTokenArea(_spaceTokenId, calculateTokenArea(_spaceTokenId), ISpaceGeoDataRegistry.AreaSource.CONTRACT);

    activeSplitOperations[splitOperationAddress] = false;
  }

  function cancelSplitPackage(uint256 _spaceTokenId) external {
    address splitOperationAddress = tokenIdToSplitOperations[_spaceTokenId][tokenIdToSplitOperations[_spaceTokenId].length - 1];
    require(activeSplitOperations[splitOperationAddress], "Method should be called from active SpaceSplitOperation contract");
    require(tokenIdToSplitOperations[_spaceTokenId].length > 0, "Split operations for this token not exists");

    ISpaceSplitOperation splitOperation = ISpaceSplitOperation(splitOperationAddress);
    require(splitOperation.subjectTokenOwner() == msg.sender, "This action not permitted");
    spaceToken().transferFrom(splitOperationAddress, splitOperation.subjectTokenOwner(), _spaceTokenId);
    activeSplitOperations[splitOperationAddress] = false;
  }

  function mergeSpaceToken(
    uint256 _sourceSpaceTokenId,
    uint256 _destinationSpaceTokenId,
    uint256[] calldata _destinationSpaceContour
  )
    external
    onlySpaceTokenOwner(_sourceSpaceTokenId)
    onlySpaceTokenOwner(_destinationSpaceTokenId)
  {
    SpaceGeoDataRegistry reg = SpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress());
    require(
      reg.getSpaceTokenAreaSource(_sourceSpaceTokenId) == ISpaceGeoDataRegistry.AreaSource.CONTRACT,
      "Merge available only for contract calculated token's area"
    );
    require(
      reg.getSpaceTokenAreaSource(_destinationSpaceTokenId) == ISpaceGeoDataRegistry.AreaSource.CONTRACT,
      "Merge available only for contract calculated token's area"
    );
    require(
      reg.getSpaceTokenLevel(_sourceSpaceTokenId) == reg.getSpaceTokenLevel(_destinationSpaceTokenId),
      "Space tokens levels should be equal"
    );
    checkMergeContours(
      reg.getSpaceTokenContour(_sourceSpaceTokenId),
      reg.getSpaceTokenContour(_destinationSpaceTokenId),
      _destinationSpaceContour
    );

    reg.setSpaceTokenContour(_destinationSpaceTokenId, _destinationSpaceContour);

    int256[] memory sourcePackageHeights = reg.getSpaceTokenHeights(_sourceSpaceTokenId);
    int256[] memory destinationPackageHeights = reg.getSpaceTokenHeights(_destinationSpaceTokenId);
    int256[] memory packageHeights = new int256[](_destinationSpaceContour.length);
    uint256 len = _destinationSpaceContour.length;
    for (uint256 i = 0; i < len; i++) {
      if (i + 1 > sourcePackageHeights.length) {
        packageHeights[i] = destinationPackageHeights[i - sourcePackageHeights.length];
      } else {
        packageHeights[i] = sourcePackageHeights[i];
      }
    }
    reg.setSpaceTokenHeights(_destinationSpaceTokenId, packageHeights);
    reg.setSpaceTokenArea(
      _destinationSpaceTokenId,
      calculateTokenArea(_destinationSpaceTokenId),
      ISpaceGeoDataRegistry.AreaSource.CONTRACT
    );

    reg.deleteSpaceTokenGeoData(_sourceSpaceTokenId);

    spaceToken().burn(_sourceSpaceTokenId);
  }

  function checkMergeContours(
    uint256[] memory sourceContour,
    uint256[] memory mergeContour,
    uint256[] memory resultContour
  )
    public
  {
    for (uint i = 0; i < sourceContour.length; i++) {
      for (uint j = 0; j < mergeContour.length; j++) {
        if (sourceContour[i] == mergeContour[j] && sourceContour[i] != 0) {
          sourceContour[i] = 0;
          mergeContour[j] = 0;
        }
      }
    }

    uint256[] memory checkResultContour = new uint256[](resultContour.length);
    for (uint i = 0; i < resultContour.length; i++) {
      checkResultContour[i] = resultContour[i];
    }

    for (uint i = 0; i < sourceContour.length + mergeContour.length; i++) {
      uint256 el = 0;
      if (i < sourceContour.length) {
        if (sourceContour[i] != 0) {
          el = sourceContour[i];
        }
      } else if (mergeContour[i - sourceContour.length] != 0) {
        el = mergeContour[i - sourceContour.length];
      }

      if (el != 0) {
        int index = ArrayUtils.uintFind(checkResultContour, el);
        require(index != - 1, "Unique element not exists in result contour");
        checkResultContour[uint(index)] = 0;
      }
    }
  }

  function getCurrentSplitOperation(uint256 _spaceTokenId) external returns (address) {
    return tokenIdToSplitOperations[_spaceTokenId][tokenIdToSplitOperations[_spaceTokenId].length - 1];
  }

  function getSplitOperationsCount(uint256 _spaceTokenId) external returns (uint256) {
    return tokenIdToSplitOperations[_spaceTokenId].length;
  }

  function spaceToken() internal view returns (ISpaceToken) {
    return ISpaceToken(ggr.getSpaceTokenAddress());
  }
}
