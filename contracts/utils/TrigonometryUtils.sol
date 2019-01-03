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
  
  event Atanh(string v, int a);
  function atanh(int256 x) internal returns (int256 output) {
    emit Atanh("input", x);
    output = log(((1 ether + x) * 1 ether)/(1 ether - x)) / 2 ether;
    emit Atanh("output", output);
  }
  
  event Log(string v, int a);
  function log(int256 x) internal returns (int256) {
    emit Log("input", x);
    int LOG = 0;
    while (x >= 1500000) {
      LOG = LOG + 405465;
      x = x * 2 / 3;
    }
    
    x = x - 1000000;
    int y = x;
    int i = 1;
    
    while (i < 10) {
      LOG = LOG + (y / i);
      i = i + 1;
      y = y * x / 1000000;
      LOG = LOG - (y / i);
      i = i + 1;
      y = y * x / 1000000;
    }
    emit Log("output", LOG);
    return LOG;
  }
  function cosh(int256 radians) internal returns (int256) {
    return 0;
  }
  function sinh(int256 radians) internal returns (int256) {
    return 0;
  }
  function asinh(int256 radians) internal returns (int256) {
    return 0;
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
