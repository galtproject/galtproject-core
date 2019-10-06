/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../interfaces/ISpaceToken.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "../registries/GaltGlobalRegistry.sol";
import "./AbstractPropertyManager.sol";


library AbstractPropertyManagerLib {
  using SafeMath for uint256;

  function rejectApplicationHelper(
    AbstractPropertyManager.Application storage _a,
    string calldata _message
  )
    external
  {
    require(
      _a.status == AbstractPropertyManager.ApplicationStatus.PENDING,
      "Application status should be PENDING");

    uint256 len = _a.assignedOracleTypes.length;

    for (uint256 i = 0; i < len; i++) {
      bytes32 currentOracleType = _a.assignedOracleTypes[i];
      if (_a.validationStatus[currentOracleType] == AbstractPropertyManager.ValidationStatus.PENDING) {
        revert("One of the oracle type has PENDING status");
      }
    }

    bytes32 senderOracleType = _a.addressOracleTypes[msg.sender];
    _a.oracleTypeMessages[senderOracleType] = _message;
  }

  function mintToken(
    GaltGlobalRegistry _ggr,
    AbstractPropertyManager.Application storage _a,
    address _to
  )
    external
  {
    ISpaceGeoDataRegistry spaceGeoData = ISpaceGeoDataRegistry(_ggr.getSpaceGeoDataRegistryAddress());

    uint256 spaceTokenId = ISpaceToken(_ggr.getSpaceTokenAddress()).mint(_to);

    _a.spaceTokenId = spaceTokenId;
    AbstractPropertyManager.Details storage d = _a.details;

    spaceGeoData.setSpaceTokenType(spaceTokenId, d.spaceTokenType);
    spaceGeoData.setSpaceTokenHumanAddress(spaceTokenId, d.humanAddress);
    spaceGeoData.setSpaceTokenArea(spaceTokenId, d.area, d.areaSource);
    spaceGeoData.setSpaceTokenLedgerIdentifier(spaceTokenId, d.ledgerIdentifier);
    spaceGeoData.setSpaceTokenDataLink(spaceTokenId, d.dataLink);
  }

  function updateGeoData(
    GaltGlobalRegistry _ggr,
    AbstractPropertyManager.Application storage _a,
    address _to
  )
    external
  {
    ISpaceGeoDataRegistry spaceGeoData = ISpaceGeoDataRegistry(_ggr.getSpaceGeoDataRegistryAddress());

    AbstractPropertyManager.Details storage d = _a.details;
    uint256 spaceTokenId = _a.spaceTokenId;

    spaceGeoData.setSpaceTokenHumanAddress(spaceTokenId, d.humanAddress);
    spaceGeoData.setSpaceTokenArea(spaceTokenId, d.area, d.areaSource);
    spaceGeoData.setSpaceTokenLedgerIdentifier(spaceTokenId, d.ledgerIdentifier);
    spaceGeoData.setSpaceTokenDataLink(spaceTokenId, d.dataLink);
  }
}
