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
//pragma experimental ABIEncoderV2;

contract IWETH {
  mapping (address => uint)                       public  balanceOf;
  mapping (address => mapping (address => uint))  public  allowance;
  
  function() external payable;
  
  function deposit() public payable;
  function withdraw(uint wad) public;

  function totalSupply() public view returns (uint);

  function approve(address guy, uint wad) public returns (bool);

  function transfer(address dst, uint wad) public returns (bool);

  function transferFrom(address src, address dst, uint wad) public returns (bool);
}
