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

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./GaltToken.sol";

contract GaltGenesis is Ownable{
  using SafeMath for uint256;

  GaltToken galtToken;

  mapping(address => uint256) public totalPaidByAddress;
  uint256 public totalPaid;
  
  uint256 public openingTime;
  uint256 public closingTime;
  bool public finished;

  event Paid(address account, uint256 value);

  constructor (GaltToken _galtToken) public {
    owner = msg.sender;
    galtToken = _galtToken;
  }
  
  function start(uint256 period) external onlyOwner {
    require(openingTime == 0, "Already started");
    require(galtToken.balanceOf(address(this)) > 0, "GaltGensis require GALT to start");
    
    openingTime = block.timestamp;
    closingTime = openingTime.add(period);
  }
  
  function finish() external {
    require(block.timestamp >= closingTime, "To soon");
    finished = true;
  }
  
  function pay() public payable {
    require(!finished, "Finished");
    require(msg.value > 0, "Ether amount cant be null");

    totalPaidByAddress[msg.sender] = totalPaidByAddress[msg.sender].add(msg.value);
    
    emit Paid(msg.sender, msg.value);
  }

  function () external payable {
    pay();
  }
}
