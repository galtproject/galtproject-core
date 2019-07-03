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

import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "./interfaces/ISpaceToken.sol";
import "./interfaces/ISpaceLocker.sol";
import "./interfaces/ILocker.sol";
import "./registries/interfaces/ISpaceGeoDataRegistry.sol";
import "./reputation/interfaces/IRA.sol";
import "./registries/GaltGlobalRegistry.sol";


contract SpaceLocker is ILocker, ISpaceLocker {
  using ArraySet for ArraySet.AddressSet;

  event ReputationMint(address indexed sra);
  event ReputationBurn(address indexed sra);
  event Deposit(uint256 reputation);
  event Withdrawal(uint256 reputation);
  event TokenBurned(uint256 spaceTokenId);

  address public owner;

  GaltGlobalRegistry public ggr;

  uint256 public spaceTokenId;
  uint256 public reputation;
  bool public tokenDeposited;
  bool public tokenBurned;

  ArraySet.AddressSet internal sras;

  constructor(GaltGlobalRegistry _ggr, address _owner) public {
    owner = _owner;

    ggr = _ggr;
  }

  modifier onlyOwner() {
    require(isOwner(), "Not the locker owner");
    _;
  }

  modifier notBurned() {
    require(tokenBurned == false, "Token has already burned");
    _;
  }

  function deposit(uint256 _spaceTokenId) external onlyOwner {
    require(!tokenDeposited, "Token already deposited");

    spaceTokenId = _spaceTokenId;
    reputation = ISpaceGeoDataRegistry(ggr.getSpaceGeoDataRegistryAddress()).getSpaceTokenArea(_spaceTokenId);
    tokenDeposited = true;

    ggr.getSpaceToken().transferFrom(msg.sender, address(this), _spaceTokenId);

    emit Deposit(reputation);
  }

  function withdraw(uint256 _spaceTokenId) external onlyOwner notBurned {
    require(tokenDeposited, "Token not deposited");
    require(sras.size() == 0, "RAs counter not 0");

    spaceTokenId = 0;
    reputation = 0;
    tokenDeposited = false;

    ggr.getSpaceToken().safeTransferFrom(address(this), msg.sender, _spaceTokenId);

    emit Withdrawal(reputation);
  }

  function approveMint(IRA _sra) external onlyOwner notBurned {
    require(!sras.has(address(_sra)), "Already minted to this RA");
    require(_sra.ping() == bytes32("pong"), "Handshake failed");

    sras.add(address(_sra));

    emit ReputationMint(address(_sra));
  }

  function burn(IRA _sra) external onlyOwner {
    require(sras.has(address(_sra)), "Not minted to the RA");
    require(_sra.balanceOf(msg.sender) == 0, "Reputation not completely burned");

    sras.remove(address(_sra));

    emit ReputationBurn(address(_sra));
  }

  /*
   * @dev Burn token in case when it is stuck due some SRA misbehaviour
   * @param _spaceTokenIdHash keccak256 hash of the token ID to prevent accidental token burn
   */
  function burnToken(bytes32 _spaceTokenIdHash) external onlyOwner notBurned {
    require(keccak256(abi.encode(spaceTokenId)) == _spaceTokenIdHash, "Hash doesn't match");

    ISpaceToken(ggr.getSpaceTokenAddress()).burn(spaceTokenId);
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

  function getTokenInfo()
    public
    view
    returns (
      address _owner,
      uint256 _spaceTokenId,
      uint256 _reputation,
      bool _tokenDeposited,
      bool _tokenBurned
    )
  {
    return (
      owner,
      spaceTokenId,
      reputation,
      tokenDeposited,
      tokenBurned
    );
  }
}
