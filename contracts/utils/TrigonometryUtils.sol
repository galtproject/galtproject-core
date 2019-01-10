pragma solidity ^0.4.24;
pragma experimental "v0.5.0";

import "./MathUtils.sol";

library TrigonometryUtils {
  int constant PI = 3141592653589793300;
  int constant ONEQTR_PI = 785398163397448300;
  int constant THRQTR_PI = 2356194490192345000;

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

  function atanh(int256 x) internal returns (int256 output) {
    output = MathUtils.logE(((1 ether + x) * 1 ether) / (1 ether - x)) / 2;
    //    output = int256(MathUtils.fpDiv(uint256(MathUtils.ln(uint256(((1 ether + x) * 1 ether)/(1 ether - x)))), 2 ether));
  }

  function cosh(int256 radians) internal returns (int256) {
    //var y = Math.exp(x);
    //  return (y + 1 / y) / 2;
    return (MathUtils.exp(radians) + MathUtils.exp(- radians)) / 2;
  }

  function sinh(int256 radians) internal returns (int256) {
    //var y = Math.exp(x);
    //  return (y - 1 / y) / 2;
    return (MathUtils.exp(radians) - MathUtils.exp(- radians)) / 2;
  }

  function asinh(int256 radians) internal returns (int256) {
    return 0;
  }

  event TLogVar(string v, int a);

  function tan(int256 radians) internal returns (int256) {
    return (sin(radians) * 1 ether) / cos(radians);
  }

  function atan(int256 x) internal returns (int256) {
    int a = 0;
    // 1st term
    int sum = 0;
    int n = 50;

    // special cases
    if (x == 1)
      return PI / 4;
    if (x == - 1)
      return - PI / 4;

    if (n > 0) {
      if ((x < -1 ether) || (x > 1 ether)) {
        // constant term
        if (x > 1)
          sum = PI / 2;
        else
          sum = -PI / 2;
        // initial value of a
        a = -(1 ether ** 2) / x;
        for (int j = 1; j <= n; j++) {
          sum += a;
          a *= -1 * ((2 * j - 1) * 1 ether ** 2) / ((2 * j + 1) * ((x * x) / 1 ether));
          a /= 1 ether;
          // next term from last
        }
      } else {// -1 < x < 1
        // constant term
        sum = 0;
        // initial value of a
        a = x;
        for (int j = 1; j <= n; j++) {
          sum += a;
          a *= -1 * (2 * j - 1) * ((x * x) / 1 ether) / (2 * j + 1);
          a /= 1 ether;
          // next term from last
        }
      }
      //      r_err = a;// max. error = 1st term not taken for alternating series
    }
    return sum;
  }

  event AtanLog(string s, int256 v);
  
  function atan2(int256 y, int256 x) internal returns (int256) {
    emit AtanLog("input", (y * 1 ether) / x);
    int u = atan((y * 1 ether) / x);
    emit AtanLog("output", u);
    if (x < 0) { // 2nd, 3rd quadrant
      if (u > 0) // will go to 3rd quadrant
        u -= PI;
      else
        u += PI;
    }
    return u;
  }

  function sin(int256 radians) internal returns (int256) {
    return getSinOfRad(radians);
  }

  function cos(int256 radians) internal returns (int256) {
    return getSinOfRad(radians + (PI / 2));
  }
}
