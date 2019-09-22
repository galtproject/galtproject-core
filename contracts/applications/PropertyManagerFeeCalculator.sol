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


library PropertyManagerFeeCalculator {
  using SafeMath for uint256;

  uint256 public constant ETH_MULTIPLIER = 1;
  uint256 public constant ETH_DIVISOR = 2000;
  uint256 public constant GALT_MULTIPLIER = 1;
  uint256 public constant GALT_DIVISOR = 200;
  uint256 public constant DECIMALS = 10**18;

  function calculateEthFee(uint256 _area) external view returns (uint256 fee) {

    uint256 area = _area;

    if (area < DECIMALS.mul(1000)) {
      area = DECIMALS.mul(1000);
    }

    return area * ETH_MULTIPLIER / ETH_DIVISOR;
  }

  function calculateGaltFee(uint256 _area) external view returns (uint256 fee) {
    uint256 area = _area;

    if (area < DECIMALS.mul(1000)) {
      area = DECIMALS.mul(1000);
    }

    return area.mul(GALT_MULTIPLIER).div(GALT_DIVISOR);
  }
}
