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

import "./SpaceToken.sol";
import "./SplitMerge.sol";


contract SpaceLocker {
  address public owner;

  SpaceToken public spaceToken;
  SplitMerge public splitMerge;

  uint256 public spaceTokenId;
  uint256 public reputation;
  bool public tokenDeposited;

  constructor(SpaceToken _spaceToken, SplitMerge _splitMerge, address _owner) public {
    owner = _owner;

    spaceToken = _spaceToken;
    splitMerge = _splitMerge;
  }

  modifier onlyOwner() {
    require(isOwner());
    _;
  }

  function deposit(uint256 _spaceTokenId) external onlyOwner {
    require(!tokenDeposited, "Token already deposited");

    spaceTokenId = _spaceTokenId;
    reputation = splitMerge.getContourArea(_spaceTokenId);
    tokenDeposited = true;

    spaceToken.transferFrom(msg.sender, address(this), _spaceTokenId);
  }

  function withdraw(uint256 _spaceTokenId) external onlyOwner {
    require(tokenDeposited, "Token not deposited");

    spaceTokenId = 0;
    reputation = 0;
    tokenDeposited = false;

    spaceToken.safeTransferFrom(address(this), msg.sender, _spaceTokenId);
  }

  function isOwner() public view returns(bool) {
    return msg.sender == owner;
  }
}
