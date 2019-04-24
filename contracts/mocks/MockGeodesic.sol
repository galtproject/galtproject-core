pragma solidity 0.5.7;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";


contract MockGeodesic {
  function calculateContourArea(uint256[] calldata contour) external returns (uint256 area) {
    return contour.length * 1000 ether;
  }

  function getContourArea(uint256[] calldata contour) external view returns (uint256 area) {
    return contour.length * 1000 ether;
  }
}
