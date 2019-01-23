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

import "@galtproject/math/contracts/MathUtils.sol";
import "../structs/SweepEvent.sol";

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

library SweepEventUtils {

  int256 internal constant EPS = 1000000000;

  function compareEvents(SweepEvent.Store storage store, SweepEvent.Item storage e1, SweepEvent.Item storage e2) internal view returns (int8) {
    // Different x-coordinate
    if (e1.point[0] > e2.point[0])
      return int8(1);
    if (e1.point[0] < e2.point[0])
      return - 1;

    // Different points, but same x-coordinate
    // Event with lower y-coordinate is processed first
    if (e1.point[1] != e2.point[1])
      return e1.point[1] > e2.point[1] ? int8(1) : -1;

    // Special cases:

    // Same coordinates, but one is a left endpoint and the other is
    // a right endpoint. The right endpoint is processed first
    if (e1.left != e2.left)
      return e1.left ? int8(1) : - 1;

    // const p2 = e1.otherEvent.point, p3 = e2.otherEvent.point;
    // const sa = (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    // Same coordinates, both events
    // are left endpoints or right endpoints.
    // not collinear
    if (signedArea(e1.point, store.sweepById[e1.otherEvent].point, store.sweepById[e2.otherEvent].point) != 0) {
      // the event associate to the bottom segment is processed first
      return (!isBelow(store, e1, store.sweepById[e2.otherEvent].point)) ? int8(1) : - 1;
    }

    return (!e1.isSubject && e2.isSubject) ? int8(1) : - 1;
  }

  /**
 * Signed area of the triangle (p0, p1, p2)
 */
  function signedArea(int256[2] p0, int256[2] p1, int256[2] p2) internal pure returns(int256) {
    return (p0[0] - p2[0]) * (p1[1] - p2[1]) - (p1[0] - p2[0]) * (p0[1] - p2[1]);
  }

  function isBelow(SweepEvent.Store storage store, SweepEvent.Item storage self, int256[2] p) internal view returns(bool) {
    int256[2] memory p0 = self.point;
    int256[2] memory p1 = store.sweepById[self.otherEvent].point;
    return self.left
    ? (p0[0] - p[0]) * (p1[1] - p[1]) - (p1[0] - p[0]) * (p0[1] - p[1]) > 0
    : (p1[0] - p[0]) * (p0[1] - p[1]) - (p0[0] - p[0]) * (p1[1] - p[1]) > 0;
  }
  
  function isAbove(SweepEvent.Store storage store, SweepEvent.Item storage self, int256[2] p) internal view returns(bool) {
    return !isBelow(store, self, p);
  }

  function compareSegments(SweepEvent.Store storage store, SweepEvent.Item storage le1, SweepEvent.Item storage le2) internal returns(int8) {
    if (le1.id == le2.id) {
      return 0;
    }

    // Segments are not collinear
    if (signedArea(le1.point, store.sweepById[le1.otherEvent].point, le2.point) != 0 ||
    signedArea(le1.point, store.sweepById[le1.otherEvent].point, store.sweepById[le2.otherEvent].point) != 0) {

      // If they share their left endpoint use the right endpoint to sort
      if (equals(le1.point, le2.point))
        return isBelow(store, le1, store.sweepById[le2.otherEvent].point) ? -1 : int8(1);
      // Different left endpoint: use the left endpoint to sort
      if (le1.point[0] == le2.point[0])
        return le1.point[1] < le2.point[1] ? -1 : int8(1);
      // has the line segment associated to e1 been inserted
      // into S after the line segment associated to e2 ?
      if (compareEvents(store, le1, le2) == 1)
        return isAbove(store, le2, le1.point) ? -1 : int8(1);
      // The line segment associated to e2 has been inserted
      // into S after the line segment associated to e1
      return isBelow(store, le1, le2.point) ? -1 : int8(1);
    }

    if (le1.isSubject == le2.isSubject) {// same polygon
      int256[2] memory p1 = le1.point;
      int256[2] memory p2 = le2.point;

      if (p1[0] == p2[0] && p1[1] == p2[1]/*equals(le1.point, le2.point)*/) {
        p1 = store.sweepById[le1.otherEvent].point;
        p2 = store.sweepById[le2.otherEvent].point;
        if (p1[0] == p2[0] && p1[1] == p2[1]) {
          return 0;
        } else {
          return le1.contourId > le2.contourId ? int8(1) : -1;
        }
      }
    } else {// Segments are collinear, but belong to separate polygons
      return le1.isSubject ? -1 : int8(1);
    }

    return compareEvents(store, le1, le2) == 1 ? int8(1) : -1;
  }

  function equals(int256[2] p1, int256[2] p2) internal pure returns (bool) {
    if (p1[0] == p2[0] && p1[1] == p2[1]) {
      return true;
    }
    return false;
  }

  function isVertical(SweepEvent.Store storage store, SweepEvent.Item storage self) internal view returns(bool) {
    return self.point[0] == store.sweepById[self.otherEvent].point[0];
  }
}
