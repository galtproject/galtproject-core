pragma solidity ^0.4.24;
pragma experimental "v0.5.0";

import "./MathUtils.sol";

library TrigonometryUtils {
  int constant PI = 3141592653589793300;

  function getSinOfRad(int256 x) internal returns (int256) {
    int q;
    int s = 0;
    int N = 100;
    int n;
    q = x;
    for (n = 1; n <= N; n++) {
      s += q;

      q *= ((- 1) * x * x) / ((2 * n) * (2 * n + 1) * 1 ether);
      q /= 1 ether;
      if (q == 0) {
        return s;
      }
    }
    return s;
  }

  function getSinOfDegree(int256 degree) internal returns (int256) {
    int q;
    int s = 0;
    int N = 100;
    int n;

    int x = degree * (PI / 180) / 1 ether;
    q = x;

    for (n = 1; n <= N; n++) {
      s += q;

      q *= ((- 1) * x * x) / ((2 * n) * (2 * n + 1) * 1 ether);
      q /= 1 ether;
      if (q == 0) {
        return s;
      }
    }
    return s;
  }
}
