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


library PropertyManagerFeeCalculator {
  using SafeMath for uint256;

  uint256 public constant ETH_MULTIPLIER = 1;
  uint256 public constant ETH_DIVISOR = 2000;
  uint256 public constant GALT_MULTIPLIER = 1;
  uint256 public constant GALT_DIVISOR = 200;
  uint256 public constant DECIMALS = 10**18;

  function calculateEthFee(uint256 _area) external pure returns (uint256) {

    uint256 area = _area;

    if (area < DECIMALS.mul(1000)) {
      area = DECIMALS.mul(1000);
    }

    return area * ETH_MULTIPLIER / ETH_DIVISOR;
  }

  function calculateGaltFee(uint256 _area) external pure returns (uint256) {
    uint256 area = _area;

    if (area < DECIMALS.mul(1000)) {
      area = DECIMALS.mul(1000);
    }

    return area.mul(GALT_MULTIPLIER).div(GALT_DIVISOR);
  }
}
