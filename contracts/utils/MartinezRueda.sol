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

pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../collections/RedBlackTree.sol";
import "../collections/SegmentRedBlackTree.sol";
import "../collections/PointRedBlackTree.sol";
import "./MathUtils.sol";
import "./SegmentUtils.sol";
import "./VectorUtils.sol";
import "./PolygonUtils.sol";
import "../collections/SweepQueueRedBlackTree.sol";

library MartinezRueda {
  int256 internal constant EPS = 1000000000;

  using RedBlackTree for RedBlackTree.Tree;
  using SegmentRedBlackTree for SegmentRedBlackTree.SegmentsTree;
  using PointRedBlackTree for PointRedBlackTree.PointsTree;
  using SegmentUtils for SegmentUtils.Sweepline;

  // TODO: use stages
  enum Stage {
    NONE,
    INIT,
    SEGMENTS_SET,
    QUEUE_INSERT
  }

  struct OutputPoint {
    int256[2] point;
    int256[2][2] leftSegment;
    int256[2][2] rightSegment;
  }

  enum Operation {
    INTERSECTION,
    DIFFERENCE,
    UNION,
    XOR
  }

  struct State {

    uint8 maxHandleQueuePointsPerCall;

    PolygonUtils.CoorsPolygon subject;
    PolygonUtils.CoorsPolygon clipping;

    int256[4] subjectBbox;
    int256[4] clippingBbox;

    SweepEvent.QueueTree eventQueue;
    SweepEvent.LineTree sweepLineTree;
    uint256[] sortedEvents;
    uint256[] resultEvents;

    Operation operation;

    PointRedBlackTree.PointsTree queue;
    OutputPoint[] output;
    int256[2][2][] segments;
    mapping(uint256 => uint256[]) segmentsUpIndexesByQueueKey; // segments, for which this is the left end

    mapping(uint256 => int256[2][2][]) segmentsLpByQueueKey; // segments, for which this is the right end
    mapping(uint256 => int256[2][2][]) segmentsCpByQueueKey; // segments, for which this is an inner point

    mapping(bytes32 => uint256) segmentHashToStatusId;
    mapping(bytes32 => uint256) pointHashToQueueId;
  }

  function initMartinezRueda(State storage state) internal {
    //transaction reverted on maxHandleQueuePointsPerCall = 16 
    state.maxHandleQueuePointsPerCall = 6;

    state.subjectBbox = [MathUtils.INT256_MAX(), MathUtils.INT256_MAX(), MathUtils.INT256_MIN(), MathUtils.INT256_MIN()];
    state.clippingBbox = [MathUtils.INT256_MAX(), MathUtils.INT256_MAX(), MathUtils.INT256_MIN(), MathUtils.INT256_MIN()];
  }

  function processPolygon(State storage state, PolygonUtils.CoorsPolygon storage contourOrHole, bool isSubject, uint8 contourId, int256[4] storage bbox, bool isExteriorRing) {
    int256[2] memory p1;
    int256[2] memory p2;

    SweepEvent.Item memory e1;

    for (uint i = 0; i < contourOrHole.points.length; i++) {
      p1 = contourOrHole.points[i];

      if (i == contourOrHole.points.length - 1) {
        p2 = contourOrHole.points[0];
      } else {
        p2 = contourOrHole.points[i + 1];
      }

      if (p1[0] == p2[0] && p1[1] == p2[1]) {
        continue;
        // skip collapsed edges, or it breaks
      }

      SweepEvent.Item memory e1;
      e1.id = state.eventQueue.tree.inserted + 1;
      e1.point = p1;
      e1.isSubject = isSubject;

      SweepEvent.Item memory e2;
      e2.id = state.eventQueue.tree.inserted + 2;
      e2.point = p2;
      e2.isSubject = isSubject;

      e1.otherEvent = e2.id;
      e2.otherEvent = e1.id;

      e1.contourId = contourId;
      e2.contourId = contourId;

      if (!isExteriorRing) {
        e1.isExteriorRing = false;
        e2.isExteriorRing = false;
      }

      if (SweepEventUtils.compareEvents(state.eventQueue, e1, e2) > 0) {
        e2.left = true;
      } else {
        e1.left = true;
      }

      bbox[0] = MathUtils.minInt(bbox[0], p1[0]);
      bbox[1] = MathUtils.minInt(bbox[1], p1[1]);
      bbox[2] = MathUtils.maxInt(bbox[2], p1[0]);
      bbox[3] = MathUtils.maxInt(bbox[3], p1[1]);

      // Pushing it so the queue is sorted from left to right,
      // with object on the left having the highest priority.
      SweepQueueRedBlackTree.insert(state.eventQueue, e1.id, e1);
      SweepQueueRedBlackTree.insert(state.eventQueue, e2.id, e2);
    }
  }

  function processAllPolygons(State storage state) {
    processPolygon(state, state.subject, true, 1, state.subjectBbox, true);
    processPolygon(state, state.clipping, false, 2, state.clippingBbox, true);
  }

  function subdivideSegments(State storage state) {
    int256 rightbound = MathUtils.minInt(state.subjectBbox[2], state.clippingBbox[2]);

    uint256 prev;
    uint256 prevPrev;
    uint256 next;
    uint256 begin;

    uint8 i = 0;

    while (state.eventQueue.tree.inserted != state.eventQueue.tree.removed) {
      SweepEvent.Item sweepEvent = state.eventQueue.pop();
      state.sortedEvents.push(sweepEvent.id);
      // optimization by bboxes for intersection and difference goes here
      if (state.operation == Operation.INTERSECTION && sweepEvent.point[0] > rightbound
      || (state.operation == Operation.DIFFERENCE && sweepEvent.point[0] > state.subjectBbox[2])) {
        break;
      }
      if (sweepEvent.left) {
        prev = state.sweepLineTree.tree.inserted + 1;
        next = state.sweepLineTree.tree.inserted + 1;

        SweepLineRedBlackTree.insert(state.sweepLineTree, state.sweepLineTree.tree.inserted + 1, sweepEvent);
        begin = RedBlackTree.first(state.sweepLineTree.tree);

        if (prev == begin)
          prev = 0;
        else
          prev = RedBlackTree.prev(state.sweepLineTree.tree, prev);

        next = RedBlackTree.next(state.sweepLineTree.tree, next);

        computeFields(sweepEvent, state.sweepLineTree.values[prev], operation);
        if (next != 0 && possibleIntersection(state, sweepEvent, state.sweepLineTree.values[next]) == 2) {
          computeFields(sweepEvent, state.sweepLineTree.values[prev], operation);
          computeFields(sweepEvent, next.key, operation);
        }

        if (prev != 0 && possibleIntersection(state, state.sweepLineTree.values[prev], sweepEvent) == 2) {
          if (prevPrev == begin)
            prevPrev = 0;
          else
            prevPrev = RedBlackTree.prev(state.sweepLineTree.tree, prev);

          computeFields(state.sweepLineTree.values[prev], state.sweepLineTree.values[prevPrev], operation);
          computeFields(sweepEvent, state.sweepLineTree.values[prev], operation);
        }
      } else {
        sweepEvent = state.sweepLineTree.values[sweepEvent.otherEvent];
        next = sweepEvent.id;
        prev = sweepEvent.id;

        if (prev != 0 && next != 0) {
          if (prev != begin)
            prev = RedBlackTree.prev(state.sweepLineTree.tree, prev);
          else
            prev = 0;

          next = RedBlackTree.next(state.sweepLineTree.tree, next);
          RedBlackTree.remove(state.sweepLineTree.tree, sweepEvent.id);

          if (next != 0 && prev != 0) {
            possibleIntersection(state, state.sweepLineTree.values[prev], state.sweepLineTree.values[next]);
          }
        }
      }

      i += 1;
      if (i >= state.maxHandleQueuePointsPerCall) {
        break;
      }
    }
  }

  function computeFields(SweepEvent.Item storage sweepEvent, SweepEvent.Item storage prev, Operation operation) {
    // compute inOut and otherInOut fields
    if (prev.id == 0) {
      sweepEvent.inOut = false;
      sweepEvent.otherInOut = true;

      // previous line segment in sweepline belongs to the same polygon
    } else {
      if (sweepEvent.isSubject == prev.isSubject) {
        sweepEvent.inOut = !prev.inOut;
        sweepEvent.otherInOut = prev.otherInOut;

        // previous line segment in sweepline belongs to the clipping polygon
      } else {
        sweepEvent.inOut = !prev.otherInOut;
        sweepEvent.otherInOut = prev.isVertical() ? !prev.inOut : prev.inOut;
      }

      // compute prevInResult field
      if (prev.id != 0) {
        sweepEvent.prevInResult = (!inResult(prev, operation) || prev.isVertical())
        ? prev.prevInResult : prev;
      }
    }

    // check if the line segment belongs to the Boolean operation
    sweepEvent.inResult = inResult(sweepEvent, operation);
  }

  function inResult(SweepEvent.Item storage sweepEvent, Operation operation) private returns (bool) {
    if (sweepEvent.type == SweepEvent.Type.NORMAL) {
      if (operation == Operation.INTERSECTION) {
        return !sweepEvent.otherInOut;
      } else if (operation == Operation.UNION) {
        return sweepEvent.otherInOut;
      } else if (operation == Operation.DIFFERENCE) {
        return (sweepEvent.isSubject && sweepEvent.otherInOut) || (!sweepEvent.isSubject && !sweepEvent.otherInOut);
      } else if (operation == Operation.XOR) {
        return true;
      }
    } else if (sweepEvent.type == SweepEvent.Type.SAME_TRANSITION) {
      return operation == Operation.INTERSECTION || operation == Operation.UNION;
    } else if (sweepEvent.type == SweepEvent.Type.DIFFERENT_TRANSITION) {
      return operation == Operation.DIFFERENCE;
    } else {
      return false;
    }
    return false;
  }

  function possibleIntersection(State storage state, SweepEvent.Item storage se1, SweepEvent.Item storage se2) {
    // that disallows self-intersecting polygons,
    // did cost us half a day, so I'll leave it
    // out of respect
    // if (se1.isSubject == se2.isSubject) return;
    int256[2][2] inter = segmentIntersection(
      se1.point, state.eventQueue.values[se1.otherEvent].point,
      se2.point, state.eventQueue.values[se2.otherEvent].point
    );

    uint256 nintersections;
    if (inter[0][0] != 0 && inter[0][1] != 0) {
      if (inter[1][0] != 0 && inter[1][1] != 0) {
        nintersections = 2;
      } else {
        nintersections = 1;
      }
    }
    if (nintersections == 0) {
      return 0;
      // no intersection
    }

    // the line segments intersect at an endpoint of both line segments
    if ((nintersections == 1) && (equals(se1.point, se2.point)
    || equals(state.eventQueue.values[se1.otherEvent].point, state.eventQueue.values[se2.otherEvent].point))) {
      return 0;
    }

    if (nintersections == 2 && se1.isSubject == se2.isSubject) {
      return 0;
    }

    // The line segments associated to se1 and se2 intersect
    if (nintersections == 1) {
      // if the intersection point is not an endpoint of se1
      if (!equals(se1.point, inter[0]) && !equals(state.eventQueue.values[se1.otherEvent].point, inter[0])) {
        divideSegment(state, se1.id, inter[0]);
      }
      // if the intersection point is not an endpoint of se2
      if (!equals(se2.point, inter[0]) && !equals(state.eventQueue.values[se2.otherEvent].point, inter[0])) {
        divideSegment(state, se2.id, inter[0]);
      }
      return 1;
    }

    // The line segments associated to se1 and se2 overlap
    uint256[4] events;
    bool leftCoincide = false;
    bool rightCoincide = false;

    if (equals(se1.point, se2.point)) {
      leftCoincide = true;
      // linked
    } else if (SweepEventUtils.compareEvents(state.eventQueue, se1, se2) == 1) {
      events[0] = se2.id;
      events[1] = se1.id;
    } else {
      events[0] = se1.id;
      events[1] = se2.id;
    }

    if (equals(se1.otherEvent.point, se2.otherEvent.point)) {
      rightCoincide = true;
    } else if (SweepEventUtils.compareEvents(state.eventQueue, state.eventQueue.values[se1.otherEvent], state.eventQueue.values[se2.otherEvent]) == 1) {
      if (leftCoincide) {
        events[0] = se2.otherEvent;
        events[1] = se1.otherEvent;
      } else {
        events[2] = se2.otherEvent;
        events[3] = se1.otherEvent;
      }
    } else {
      if (leftCoincide) {
        events[0] = se1.otherEvent;
        events[1] = se2.otherEvent;
      } else {
        events[2] = se1.otherEvent;
        events[3] = se2.otherEvent;
      }
    }

    if ((leftCoincide && rightCoincide) || leftCoincide) {
      // both line segments are equal or share the left endpoint
      se2.type = SweepEvent.Type.NON_CONTRIBUTING;
      se1.type = (se2.inOut == se1.inOut) ? SweepEvent.Type.SAME_TRANSITION : SweepEvent.Type.DIFFERENT_TRANSITION;

      if (leftCoincide && !rightCoincide) {
        // honestly no idea, but changing events selection from [2, 1]
        // to [0, 1] fixes the overlapping self-intersecting polygons issue
        divideSegment(state, state.eventQueue.values[events[1]].otherEvent, state.eventQueue.values[events[0]].point);
      }
      return 2;
    }

    // the line segments share the right endpoint
    if (rightCoincide) {
      divideSegment(state, events[0], state.eventQueue.values[events[1]].point);
      return 3;
    }

    // no line segment includes totally the other one
    if (events[0] != events[3].otherEvent) {
      divideSegment(state, events[0], state.eventQueue.values[events[1]].point);
      divideSegment(state, events[1], state.eventQueue.values[events[2]].point);
      return 3;
    }

    // one line segment includes the other one
    divideSegment(state, events[0], events[1].point, eventQueue);
    divideSegment(state, state.eventQueue.values[events[3]].otherEvent, state.eventQueue.values[events[2]].point);

    return 3;
  }

  function divideSegment(State storage state, uint256 seId, int256[2] p) {
    SweepEvent.Item storage se = state.eventQueue.values[seId];

    SweepEvent.Item memory r;
    r.id = state.eventQueue.tree.inserted + 1;
    r.point = p;
    r.otherEvent = se.id;
    r.isSubject = se.isSubject;
    r.contourId = se.contourId;

    SweepEvent.Item memory l;
    l.id = state.eventQueue.tree.inserted + 2;
    l.point = p;
    l.left = true;
    l.otherEvent = se.otherEvent;
    l.isSubject = se.isSubject;
    l.contourId = se.contourId;

    /* eslint-disable no-console */
    if (equals(se.point, se.otherEvent.point)) {
      require(false, "Possibly collapsed segment");
      //      console.warn('what is that, a collapsed segment?', se);
    }
    /* eslint-enable no-console */

    // avoid a rounding error. The left event would be processed after the right event
    if (SweepEventUtils.compareEvents(state.eventQueue, l, state.eventQueue.values[se.otherEvent]) > 0) {
      state.eventQueue.values[se.otherEvent].left = true;
      l.left = false;
    }

    // avoid a rounding error. The left event would be processed after the right event
    // if (compareEvents(se, r) > 0) {}

    state.eventQueue.values[se.otherEvent].otherEvent = l.id;
    se.otherEvent = r.id;

    SweepQueueRedBlackTree.insert(state.eventQueue, r.id, r);
    SweepQueueRedBlackTree.insert(state.eventQueue, l.id, l);
  }

  function equals(int256[2] p1, int256[2] p2) returns (bool) {
    if (p1[0] == p2[0] && p1[1] == p2[1]) {
      return true;
    }
    return false;
  }

  //function to convert back to regular point form:
  function toPoint(int256[2] p, int256 s, int256[2] d) returns (int256[2])  {
    return [
    p[0] + s * d[0],
    p[1] + s * d[1]
    ];
  }
  /**
   * Finds the magnitude of the cross product of two vectors (if we pretend
   * they're in three dimensions)
   */
  function crossProduct(int256[2] a, int256[2] b) returns (int256) {
    return (a[0] * b[1]) - (a[1] * b[0]);
  }

  /**
 * Finds the dot product of two vectors.
 */
  function dotProduct(int256[2] a, int256[2] b) returns (int256) {
    return (a[0] * b[0]) + (a[1] * b[1]);
  }

  /**
   * Finds the intersection (if any) between two line segments a and b, given the
   * line segments' end points a1, a2 and b1, b2.
   *
   * This algorithm is based on Schneider and Eberly.
   * http://www.cimec.org.ar/~ncalvo/Schneider_Eberly.pdf
   * Page 244.
   *
   * noEndpointTouch whether to skip single touchpoints (meaning connected segments) as intersections
   * @returns {Array.<Array.<Number>>|Null} If the lines intersect, the point of
   * intersection. If they overlap, the two end points of the overlapping segment.
   * Otherwise, null.
   */
  function segmentIntersection(int256[2] a1, int256[2] a2, int256[2] b1, int256[2] b2, bool noEndpointTouch) returns (int256[2][2] result) {
    // The algorithm expects our lines in the form P + sd, where P is a point,
    // s is on the interval [0, 1], and d is a vector.
    // We are passed two points. P can be the first point of each pair. The
    // vector, then, could be thought of as the distance (in x and y components)
    // from the first point to the second point.
    // So first, let's make our vectors:
    int256[2] va = [a2[0] - a1[0], a2[1] - a1[1]];
    int256[2] vb = [b2[0] - b1[0], b2[1] - b1[1]];

    // The rest is pretty much a straight port of the algorithm.
    int256[2] e = [b1[0] - a1[0], b1[1] - a1[1]];
    int256 kross = crossProduct(va, vb);
    int256 sqrKross = kross * kross;
    int256 sqrLenA = dotProduct(va, va);
    //const sqrLenB  = dotProduct(vb, vb);

    // Check for line intersection. This works because of the properties of the
    // cross product -- specifically, two vectors are parallel if and only if the
    // cross product is the 0 vector. The full calculation involves relative error
    // to account for possible very small line segments. See Schneider & Eberly
    // for details.
    if (sqrKross > 0/* EPS * sqrLenB * sqLenA */) {
      // If they're not parallel, then (because these are line segments) they
      // still might not actually intersect. This code checks that the
      // intersection point of the lines is actually on both line segments.
      int256 s = crossProduct(e, vb) / kross;
      if (s < 0 || s > 1) {
        // not on line segment a
        return;
      }
      int256 t = crossProduct(e, va) / kross;
      if (t < 0 || t > 1) {
        // not on line segment b
        return;
      }
      if (s == 0 || s == 1) {
        // on an endpoint of line segment a
        if (!noEndpointTouch) {
          result[0] = toPoint(a1, s, va);
        }
        return;
      }
      if (t == 0 || t == 1) {
        // on an endpoint of line segment b
        if (!noEndpointTouch) {
          result[0] = toPoint(b1, t, vb);
        }
        return;
      }
      result[0] = [toPoint(a1, s, va)];
      return;
    }

    // If we've reached this point, then the lines are either parallel or the
    // same, but the segments could overlap partially or fully, or not at all.
    // So we need to find the overlap, if any. To do that, we can use e, which is
    // the (vector) difference between the two initial points. If this is parallel
    // with the line itself, then the two lines are the same line, and there will
    // be overlap.
    //const sqrLenE = dotProduct(e, e);
    kross = crossProduct(e, va);
    sqrKross = kross * kross;

    if (sqrKross > 0 /* EPS * sqLenB * sqLenE */) {
      // Lines are just parallel, not the same. No overlap.
      return;
    }

    int256 sa = dotProduct(va, e) / sqrLenA;
    int256 sb = sa + dotProduct(va, vb) / sqrLenA;
    int256 smin = MathUtils.minInt(sa, sb);
    int256 smax = MathUtils.maxInt(sa, sb);

    // this is, essentially, the FindIntersection acting on floats from
    // Schneider & Eberly, just inlined into this function.
    if (smin <= 1 && smax >= 0) {

      // overlap on an end point
      if (smin == 1) {
        if (!noEndpointTouch) {
          result[0] = toPoint(a1, smin > 0 ? smin : 0, va);
        }
        return;
      }

      if (smax == 0) {
        if (!noEndpointTouch) {
          result[0] = toPoint(a1, smax < 1 ? smax : 1, va);
        }
        return;
      }

      if (noEndpointTouch && smin == 0 && smax == 1) {
        return;
      }

      // There's overlap on a segment -- two points of intersection. Return both.
      return [
        toPoint(a1, smin > 0 ? smin : 0, va),
        toPoint(a1, smax < 1 ? smax : 1, va)
      ];
    }

    return;
  }

  function orderEvents(State storage state) {
    //    let sweepEvent, i, len, tmp;
    SweepEvent.Item sweepEvent;
    for (i = 0; i < sortedEvents.length; i++) {
      sweepEvent = state.eventQueue.values[state.sortedEvents[i]];
      if ((sweepEvent.left && sweepEvent.inResult) || (!sweepEvent.left && sweepEvent.otherEvent.inResult)) {
        state.resultEvents.push(sweepEvent.id);
      }
    }
    // Due to overlapping edges the resultEvents array can be not wholly sorted
    bool sorted = false;
    while (!sorted) {
      sorted = true;
      for (i = 0; i < resultEvents.length; i++) {
        if ((i + 1) < len &&
        compareEvents(resultEvents[i], resultEvents[i + 1]) == 1) {
          tmp = state.resultEvents[i];
          resultEvents[i] = resultEvents[i + 1];
          resultEvents[i + 1] = tmp;
          sorted = false;
        }
      }
    }
    for (i = 0; i < state.resultEvents.length; i++) {
      sweepEvent = state.resultEvents[i];
      sweepEvent.pos = i;
    }

    // imagine, the right sweepEvent is found in the beginning of the queue,
    // when his left counterpart is not marked yet
    for (i = 0; i < resultEvents.length; i++) {
      sweepEvent = resultEvents[i];
      if (!sweepEvent.left) {
        tmp = sweepEvent.pos;
        sweepEvent.pos = sweepEvent.otherEvent.pos;
        sweepEvent.otherEvent.pos = tmp;
      }
    }

    return resultEvents;
  }


  /**
   * @param  {Number} pos
   * @param  {Array.<SweepEvent>} resultEvents
   * @param  {Object>}    processed
   * @return {Number}
   */
  function nextPos(pos, resultEvents, processed, origIndex) {
    let p, p1;
    let newPos = pos + 1;
  const length = resultEvents.length;

  p = resultEvents[pos].point;

  if (newPos < length)
  p1 = resultEvents[newPos].point;

  // while in range and not the current one by value
  while (newPos < length && p1[0] == = p[0] && p1[1] == = p[1]) {
  if (!processed[newPos]) {
  return newPos;
  } else {
  newPos++;
  }
  p1 = resultEvents[newPos].point;
  }

    newPos = pos - 1;

    while (processed[newPos] && newPos >= origIndex) {
    newPos--;
    }
  return newPos;
  }


  function connectEdges(State storage state) {
    const resultEvents = orderEvents(state);

    // "false"-filled array
    const processed = {};
    const result = [];
    let sweepEvent;

    for (uint i = 0; i < resultEvents.length; i++) {
    if (processed[i]) continue;
    const contour = [[]];

    if (!resultEvents[i].isExteriorRing) {
    if (operation == = DIFFERENCE && !resultEvents[i].isSubject && result.length == = 0) {
    result.push(contour);
    } else if (result.length == = 0) {
    result.push([[contour]]);
    } else {
    result[result.length - 1].push(contour[0]);
    }
    } else if (operation == = DIFFERENCE && !resultEvents[i].isSubject && result.length > 1) {
    result[result.length - 1].push(contour[0]);
    } else {
    result.push(contour);
    }

    const ringId = result.length - 1;
    let pos = i;

    const initial = resultEvents[i].point;
    contour[0].push(initial);

    while (pos >= i) {
    sweepEvent = resultEvents[pos];
    processed[pos] = true;

    if (sweepEvent.left) {
    sweepEvent.resultInOut = false;
    sweepEvent.contourId = ringId;
    } else {
    sweepEvent.otherEvent.resultInOut = true;
    sweepEvent.otherEvent.contourId = ringId;
    }

    pos = sweepEvent.pos;
    processed[pos] = true;
    contour[0].push(resultEvents[pos].point);
    pos = nextPos(pos, resultEvents, processed, i);
    }

    pos = pos == = - 1 ? i : pos;

    sweepEvent = resultEvents[pos];
    processed[pos] = processed[sweepEvent.pos] = true;
    sweepEvent.otherEvent.resultInOut = true;
    sweepEvent.otherEvent.contourId = ringId;
    }

    // Handle if the result is a polygon (eg not multipoly)
    // Commented it again, let's see what do we mean by that
    // if (result.length === 1) result = result[0];
  return result;
  }


  function isQueuePointsOver(State storage state) public returns (bool) {
    return state.queue.isEmpty();
  }

  function getOutputLength(State storage state) public returns (uint256) {
    return state.output.length;
  }

  function getOutputPoint(State storage state, uint256 index) public returns (int256[2]) {
    return state.output[index].point;
  }
}
