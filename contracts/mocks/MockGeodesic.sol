pragma solidity 0.5.3;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "@galtproject/geodesic/contracts/interfaces/IGeodesic.sol";


interface IGeodesicT {
  function getCalculatedContourArea(uint256[] calldata contour) external view returns (uint256 area);
  function calculateContourArea(uint256[] calldata contour) external returns (uint256 area);
}

contract MockGeodesic is IGeodesicT {
  function calculateContourArea(uint256[] calldata contour) external returns (uint256 area) {
    return contour.length * 1000;
  }

  function getCalculatedContourArea(uint256[] calldata contour) external view returns (uint256 area) {
    return contour.length * 1000;
  }
}
