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

import "./MathUtils.sol";
import "./VectorUtils.sol";

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

library SegmentUtils {

  int256 internal constant EPS = 1000000000;
  
  enum Position {
    BEFORE,
    AFTER
  }

  struct Sweepline {
    int256 x;
    Position position;
  }

  function segmentsIntersect(int[2][2] a, int[2][2] b) internal pure returns (bool) {
    int256 d1 = VectorUtils.direction(b[0], b[1], a[0]);
    int256 d2 = VectorUtils.direction(b[0], b[1], a[1]);
    int256 d3 = VectorUtils.direction(a[0], a[1], b[0]);
    int256 d4 = VectorUtils.direction(a[0], a[1], b[1]);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    } else if (d1 == 0 && VectorUtils.onSegment(b[0], b[1], a[0])) {
      return true;
    } else if (d2 == 0 && VectorUtils.onSegment(b[0], b[1], a[1])) {
      return true;
    } else if (d3 == 0 && VectorUtils.onSegment(a[0], a[1], b[0])) {
      return true;
    } else if (d4 == 0 && VectorUtils.onSegment(a[0], a[1], b[1])) {
      return true;
    }
    return false;
  }

  function findSegmentsIntersection(int[2][2] a, int[2][2] b) internal pure returns (int256[2]) {
    //TODO: optimize?
    int xDivide = ((a[0][0] - a[1][0]) * (b[0][1] - b[1][1]) - (a[0][1] - a[1][1]) * (b[0][0] - b[1][0]));
    if (xDivide == 0) {
      return int256[2]([int256(0),0]);
    }

    //TODO: optimize?
    int x = ((a[0][0] * a[1][1] - a[0][1] * a[1][0]) * (b[0][0] - b[1][0]) - (a[0][0] - a[1][0]) * (b[0][0] * b[1][1] - b[0][1] * b[1][0])) /
    xDivide;

    //TODO: optimize?
    int yDivide = ((a[0][0] - a[1][0]) * (b[0][1] - b[1][1]) - (a[0][1] - a[1][1]) * (b[0][0] - b[1][0]));
    if (yDivide == 0) {
      return int256[2]([int256(0),0]);
    }

    //TODO: optimize?
    int y = ((a[0][0] * a[1][1] - a[0][1] * a[1][0]) * (b[0][1] - b[1][1]) - (a[0][1] - a[1][1]) * (b[0][0] * b[1][1] - b[0][1] * b[1][0])) /
    yDivide;

    if (a[0][0] >= a[1][0]) {
      if (!MathUtils.between(a[1][0], x, a[0][0])) {return int256[2]([int256(0),0]);}
    } else {
      if (!MathUtils.between(a[0][0], x, a[1][0])) {return int256[2]([int256(0),0]);}
    }
    if (a[0][1] >= a[1][1]) {
      if (!MathUtils.between(a[1][1], y, a[0][1])) {return int256[2]([int256(0),0]);}
    } else {
      if (!MathUtils.between(a[0][1], y, a[1][1])) {return int256[2]([int256(0),0]);}
    }
    if (b[0][0] >= b[1][0]) {
      if (!MathUtils.between(b[1][0], x, b[0][0])) {return int256[2]([int256(0),0]);}
    } else {
      if (!MathUtils.between(b[0][0], x, b[1][0])) {return int256[2]([int256(0),0]);}
    }
    if (b[0][1] >= b[1][1]) {
      if (!MathUtils.between(b[1][1], y, b[0][1])) {return int256[2]([int256(0),0]);}
    } else {
      if (!MathUtils.between(b[0][1], y, b[1][1])) {return int256[2]([int256(0),0]);}
    }
    return [x, y];
  }

  function isEqual(int[2][2] a, int[2][2] b) internal view returns (bool) {
    //TODO: optimize?
    for (uint i = 0; i < a.length; i++) {
      if (b[i][0] != a[i][0] || b[i][1] != a[i][1]) {
        return false;
      }
    }
    return true;
  }

  function compareSegments(Sweepline storage sweepline, int[2][2] a, int[2][2] b) internal returns (int8) {
    if (isEqual(a, b)) {
      return int8(0);
    }

    int deltaY = getY(a, sweepline.x) - getY(b, sweepline.x);

    if (MathUtils.abs(deltaY) > EPS) {
      return deltaY < 0 ? int8(- 1) : int8(1);
    } else {
      int aSlope = getSlope(a);
      int bSlope = getSlope(b);

      if (aSlope != bSlope) {
        if (sweepline.position == Position.BEFORE) {
          return aSlope > bSlope ? int8(- 1) : int8(1);
        } else {
          return aSlope > bSlope ? int8(1) : int8(- 1);
        }
      }
    }

    if (a[0][0] - b[0][0] != 0) {
      return a[0][0] - b[0][0] < 0 ? int8(- 1) : int8(1);
    }

    if (a[1][0] - b[1][0] != 0) {
      return a[1][0] - b[1][0] < 0 ? int8(- 1) : int8(1);
    }

    return int8(0);
  }

  function getSlope(int[2][2] segment) internal pure returns (int) {
    if (segment[0][0] == segment[1][0]) {
      return (segment[0][1] < segment[1][1]) ? MathUtils.INT256_MAX() : MathUtils.INT256_MIN();
    } else {
      return (segment[1][1] - segment[0][1]) / (segment[1][0] - segment[0][0]);
    }
  }

  function getY(int[2][2] segment, int x) internal returns (int) {
    if (x <= segment[0][0]) {
      return segment[0][1];
    } else if (x >= segment[1][0]) {
      return segment[1][1];
    }

    if ((x - segment[0][0]) > (segment[1][0] - x)) {
      //TODO: optimize?
      int ifac = 1 ether * (x - segment[0][0]) / (segment[1][0] - segment[0][0]);
      return ((segment[0][1] * (1 ether - ifac)) / 1 ether) + ((segment[1][1] * ifac) / 1 ether);
    } else {
      //TODO: optimize?
      int fac = 1 ether * (segment[1][0] - x) / (segment[1][0] - segment[0][0]);
      return ((segment[0][1] * fac) / 1 ether) + ((segment[1][1] * (1 ether - fac)) / 1 ether);
    }
  }
}
