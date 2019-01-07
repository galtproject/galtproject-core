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
  
  function degreeToRad(int256 degree) internal returns (int256) {
    return degree * (PI / 180) / 1 ether;
  }
  
  function radToDegree(int256 radians) internal returns (int256) {
    return radians * (180 / PI) * 1 ether;
  }
  //  0.0033
  //128.128
  event Atanh(string v, int a);
  function atanh(int256 x) internal returns (int256 output) {
    emit Atanh("input", x);
    output = MathUtils.logE(((1 ether + x) * 1 ether)/(1 ether - x)) / 2;
//    output = int256(MathUtils.fpDiv(uint256(MathUtils.ln(uint256(((1 ether + x) * 1 ether)/(1 ether - x)))), 2 ether));
    emit Atanh("output", output);
  }

  function cosh(int256 radians) internal returns (int256) {
    return 0;
  }
  function sinh(int256 radians) internal returns (int256) {
    return (MathUtils.exp(radians) - MathUtils.exp(-radians)) / 2;
  }
  function asinh(int256 radians) internal returns (int256) {
    return (MathUtils.exp(radians) - MathUtils.exp(-radians)) / 2;
  }
  function tan(int256 radians) internal returns (int256) {
    return (sin(radians) * 1 ether) / cos(radians);
  }
  function atan(int256 radians) internal returns (int256) {
    return 0;
  }
  function atan2(int256 radians1, int256 radians2) internal returns (int256) {
    return 0;
  }
  function sin(int256 radians) internal returns (int256) {
    return getSinOfRad(radians);
  }
  function cos(int256 radians) internal returns (int256) {
    return getSinOfRad(radians + (PI / 2));
  }
}
