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

import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/ISpaceToken.sol";
import "./interfaces/ISpaceLocker.sol";
import "./interfaces/ISplitMerge.sol";
import "./interfaces/ISRA.sol";


contract SpaceLocker is ISpaceLocker {
  using ArraySet for ArraySet.AddressSet;

  event ReputationMinted(address sra);
  event ReputationBurned(address sra);
  event TokenBurned(uint256 spaceTokenId);

  address public owner;

  ISpaceToken public spaceToken;
  ISplitMerge public splitMerge;

  uint256 public spaceTokenId;
  uint256 public reputation;
  bool public tokenDeposited;
  bool public tokenBurned;

  ArraySet.AddressSet sras;

  constructor(ISpaceToken _spaceToken, ISplitMerge _splitMerge, address _owner) public {
    owner = _owner;

    spaceToken = _spaceToken;
    splitMerge = _splitMerge;
  }

  modifier onlyOwner() {
    require(isOwner());
    _;
  }

  modifier notBurned() {
    require(tokenBurned == false);
    _;
  }

  function deposit(uint256 _spaceTokenId) external onlyOwner {
    require(!tokenDeposited, "Token already deposited");

    spaceTokenId = _spaceTokenId;
    reputation = splitMerge.getContourArea(_spaceTokenId);
    tokenDeposited = true;

    spaceToken.transferFrom(msg.sender, address(this), _spaceTokenId);
  }

  function withdraw(uint256 _spaceTokenId) external onlyOwner notBurned {
    require(tokenDeposited, "Token not deposited");
    require(sras.size() == 0, "SRAs counter not 0");

    spaceTokenId = 0;
    reputation = 0;
    tokenDeposited = false;

    spaceToken.safeTransferFrom(address(this), msg.sender, _spaceTokenId);
  }

  function approveMint(ISRA _sra) external onlyOwner notBurned {
    require(!sras.has(address(_sra)), "Already minted to this SRA");
    require(_sra.ping() == bytes32("pong"), "Handshake failed");

    sras.add(address(_sra));
  }

  function burn(ISRA _sra) external onlyOwner {
    require(sras.has(address(_sra)), "Not minted to the SRA");
    require(_sra.balanceOf(msg.sender) == 0, "Reputation not completely burned");

    sras.remove(address(_sra));
  }

  /*
   * @dev Burn token in case when it is stuck due some SRA misbehaviour
   * @param _spaceTokenIdHash keccak256 hash of the token ID to prevent accidental token burn
   */
  function burnToken(bytes32 _spaceTokenIdHash) external onlyOwner notBurned {
    require(keccak256(abi.encode(spaceTokenId)) == _spaceTokenIdHash, "Hash doesn't match");

    spaceToken.burn(spaceTokenId);
    tokenBurned = true;

    emit TokenBurned(spaceTokenId);
  }

  // GETTERS

  function isMinted(address _sra) external returns (bool) {
    return sras.has(_sra);
  }

  function getSras() external returns (address[] memory) {
    return sras.elements();
  }

  function getSrasCount() external returns (uint256) {
    return sras.size();
  }

  function isOwner() public view returns (bool) {
    return msg.sender == owner;
  }
}
