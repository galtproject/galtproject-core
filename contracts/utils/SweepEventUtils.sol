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
import "../structs/SweepEvent.sol";

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

library SweepEventUtils {

  int256 internal constant EPS = 1000000000;

  function compareEvents(SweepEvent.Item storage e1, SweepEvent.Item storage e2, SweepEvent.Tree storage tree) internal pure returns (int8) {
    // Different x-coordinate
    if (e1.point[0] > e2.point[0])
      return 1;
    if (e1.point[0] < e2.point[0])
      return - 1;

    // Different points, but same x-coordinate
    // Event with lower y-coordinate is processed first
    if (e1.point[1] != e2.point[1])
      return e1.point[1] > e2.point[1] ? 1 : - 1;

    // Special cases:

    // Same coordinates, but one is a left endpoint and the other is
    // a right endpoint. The right endpoint is processed first
    if (e1.left != e2.left)
      return e1.left ? 1 : - 1;

    // const p2 = e1.otherEvent.point, p3 = e2.otherEvent.point;
    // const sa = (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    // Same coordinates, both events
    // are left endpoints or right endpoints.
    // not collinear
    if (signedArea(e1.point, tree.values[e1.otherEvent].point, tree.values[e2.otherEvent].point) != 0) {
      // the event associate to the bottom segment is processed first
      return (!isBelow(e1, tree, tree.values[e2.otherEvent].point)) ? 1 : - 1;
    }

    return (!e1.isSubject && e2.isSubject) ? 1 : - 1;
  }

  /**
 * Signed area of the triangle (p0, p1, p2)
 */
  function signedArea(int256[2] p0, int256[2] p1, int256[2] p2) {
    return (p0[0] - p2[0]) * (p1[1] - p2[1]) - (p1[0] - p2[0]) * (p0[1] - p2[1]);
  }

  function isBelow(SweepEvent.Item storage self, SweepEvent.Tree storage tree, int256[2] p) {
    int256[2] p0 = self.point;
    int256[2] p1 = tree.values[self.otherEvent].point;
    return self.left
    ? (p0[0] - p[0]) * (p1[1] - p[1]) - (p1[0] - p[0]) * (p0[1] - p[1]) > 0
    : (p1[0] - p[0]) * (p0[1] - p[1]) - (p0[0] - p[0]) * (p1[1] - p[1]) > 0;
  }

  function compareSegments(SweepEvent.Item storage le1, SweepEvent.Item storage le2, SweepEvent.Tree storage tree) {
    if (le1.id == le2.id) {
      return 0;
    }

    // Segments are not collinear
    if (signedArea(le1.point, tree.values[le1.otherEvent].point, le2.point) != 0 ||
    signedArea(le1.point, tree.values[le1.otherEvent].point, tree.values[le2.otherEvent].point) != 0) {

      // If they share their left endpoint use the right endpoint to sort
      if (equals(le1.point, le2.point))
        return isBelow(le1, tree, tree.values[le2.otherEvent].point) ? - 1 : 1;
      // Different left endpoint: use the left endpoint to sort
      if (le1.point[0] == le2.point[0])
        return le1.point[1] < le2.point[1] ? - 1 : 1;
      // has the line segment associated to e1 been inserted
      // into S after the line segment associated to e2 ?
      if (compareEvents(le1, le2) == 1)
        return le2.isAbove(le1.point) ? - 1 : 1;
      // The line segment associated to e2 has been inserted
      // into S after the line segment associated to e1
      return isBelow(le1, tree, le2.point) ? - 1 : 1;
    }

    if (le1.isSubject == le2.isSubject) {// same polygon
      int256[2] p1 = le1.point;
      int256[2] p2 = le2.point;

      if (p1[0] == p2[0] && p1[1] == p2[1]/*equals(le1.point, le2.point)*/) {
        p1 = tree.values[le1.otherEvent].point;
        p2 = tree.values[le2.otherEvent].point;
        if (p1[0] == p2[0] && p1[1] == p2[1]) {
          return 0;
        } else {
          return le1.contourId > le2.contourId ? 1 : - 1;
        }
      }
    } else {// Segments are collinear, but belong to separate polygons
      return le1.isSubject ? - 1 : 1;
    }

    return compareEvents(le1, le2, tree) == 1 ? 1 : - 1;
  }
}
