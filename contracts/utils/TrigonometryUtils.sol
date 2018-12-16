pragma solidity ^0.4.24;
pragma experimental "v0.5.0";

import "./MathUtils.sol";

library TrigonometryUtils {
  int constant PI = 3141592653589793300;
  
  function getSinOfRad(int256 x) internal returns(int256) {
    int q;
    int s = 0;
    int N = 100;
    //Индексная переменная:
    int n;
    q = x;
    //Вычисление синуса:
    for(n = 1; n <= N; n++){
      s += q;
      
      q *= ((-1) * x * x) / ((2 * n) * (2 * n + 1) * 1 ether);
      q /= 1 ether;
      if(q == 0) {
        return s;
      }
    }
    //Результат:
    return s;
  }

  function getSinOfAngle(int256 x) internal returns(int256) {
    int q;
    int s = 0;
    int N = 100;
    //Индексная переменная:
    int n;
    q = x * PI / 180;
    //Вычисление синуса:
    for(n = 1; n <= N; n++){
      s += q;

      q *= ((-1) * x * x) / ((2 * n) * (2 * n + 1) * 1 ether);
      q /= 1 ether;
      if(q == 0) {
        return s;
      }
    }
    //Результат:
    return s / 1 ether;
  }
}
