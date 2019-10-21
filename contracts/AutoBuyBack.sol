/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;


interface IDEX {
  function ethToGalt(uint256 _minReturn) external payable returns (uint256);
}


contract AutoBuyBack {
  event Swap(address indexed sender, uint256 ethBalance, uint256 galtBalance);

  IDEX public dex;
  uint256 public minReturn;

  constructor(address _dexAddress, uint256 _minReturn) public {
    dex = IDEX(_dexAddress);
  }

  function swap() external {
    uint256 ethBalance = address(this).balance;

    uint256 galtBalance = dex.ethToGalt.value(ethBalance)(minReturn);

    emit Swap(msg.sender, ethBalance, galtBalance);
  }

  function() external payable {
  }
}
