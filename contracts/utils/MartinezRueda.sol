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

    while (state.eventQueue.tree.inserted != state.eventQueue.tree.removed) {
      SweepEvent.Item sweepEvent = state.eventQueue.pop();
      state.sortedEvents.push(sweepEvent.id);
      // optimization by bboxes for intersection and difference goes here
      if (state.operation == Operation.INTERSECTION && sweepEvent.point[0] > rightbound 
        || (state.operation == Operation.DIFFERENCE && sweepEvent.point[0] > state.subjectBbox[2])) {
        break;
      }
      if (sweepEvent.left) {
        SweepLineRedBlackTree.insert(state.sweepLineTree, state.sweepLineTree.tree.inserted + 1, sweepEvent);
        begin = RedBlackTree.first(state.sweepLineTree.tree);

        if (prev == begin)
          prev = 0;
        else
          prev = RedBlackTree.prev(state.sweepLineTree.tree, prev);

        next = RedBlackTree.next(state.sweepLineTree.tree, next);

        computeFields(sweepEvent, state.sweepLineTree.values[prev], operation);
        if (next != 0 && possibleIntersection(sweepEvent, next.key, eventQueue) == 2) {
          computeFields(sweepEvent, state.sweepLineTree.values[prev], operation);
          computeFields(sweepEvent, next.key, operation);
        }

        if (prev != 0 && possibleIntersection(state.sweepLineTree.values[prev], sweepEvent, eventQueue) == 2) {
          if (prevPrev == begin)
            prevPrev = 0;
          else
            prevPrev = RedBlackTree.prev(state.sweepLineTree.tree, prev);

          computeFields(state.sweepLineTree.values[prev], state.sweepLineTree.values[prevPrev], operation);
          computeFields(sweepEvent, state.sweepLineTree.values[prev], operation);
        }
      } else {
        sweepEvent = state.sweepLineTree.values[sweepEvent.otherEvent];
        next = prev = sweepLineTree.find(sweepEvent);

        if (prev != 0 && next != 0) {
          if (prev != begin)
            prev = RedBlackTree.prev(state.sweepLineTree.tree, prev);
          else
            prev = null;

          next = RedBlackTree.next(state.sweepLineTree.tree, next);
          RedBlackTree.remove(state.sweepLineTree.tree, sweepEvent.id);

          if (next != 0 && prev != 0) {
            possibleIntersection(state.sweepLineTree.values[prev], state.sweepLineTree.values[next], state.eventQueue);
          }
        }
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

  function inResult(SweepEvent.Item storage sweepEvent, Operation operation) private returns(bool) {
    if(sweepEvent.type == SweepEvent.Type.NORMAL) {
      if(operation == Operation.INTERSECTION) {
        return !sweepEvent.otherInOut;
      } else if(operation == Operation.UNION) {
        return sweepEvent.otherInOut;
      } else if(operation == Operation.DIFFERENCE) {
        return (sweepEvent.isSubject && sweepEvent.otherInOut) || (!sweepEvent.isSubject && !sweepEvent.otherInOut);
      } else if(operation == Operation.XOR) {
        return true;
      }
    } else if(sweepEvent.type == SweepEvent.Type.SAME_TRANSITION) {
      return operation == Operation.INTERSECTION || operation == Operation.UNION;
    } else if(sweepEvent.type == SweepEvent.Type.DIFFERENT_TRANSITION) {
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
    if(inter[0][0] != 0 && inter[0][1] != 0) {
      if(inter[1][0] != 0 && inter[1][1] != 0) {
        nintersections = 2;
      } else {
        nintersections = 1;
      }
    }
    if (nintersections == 0) {
      return 0; // no intersection
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
      leftCoincide = true; // linked
    } else if (compareEvents(se1, se2) == 1) {
      events[0] = se2.id;
      events[1] = se1.id;
    } else {
      events[0] = se1.id;
      events[1] = se2.id;
    }

    if (equals(se1.otherEvent.point, se2.otherEvent.point)) {
      rightCoincide = true;
    } else if (compareEvents(se1.otherEvent, se2.otherEvent) == 1) {
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
      se2.type = NON_CONTRIBUTING;
      se1.type = (se2.inOut == se1.inOut) ? SAME_TRANSITION : DIFFERENT_TRANSITION;
  
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
    if (compareEvents(l, se.otherEvent) > 0) {
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

  //function to convert back to regular point form:
  function toPoint(int256[2] p, int256 s, int256[2] d) returns(int256[2])  {
    return [
      p[0] + s * d[0],
      p[1] + s * d[1]
    ];
  }
  /**
   * Finds the magnitude of the cross product of two vectors (if we pretend
   * they're in three dimensions)
   */
  function crossProduct(int256[2] a, int256[2] b) returns(int256) {
    return (a[0] * b[1]) - (a[1] * b[0]);
  }

  /**
 * Finds the dot product of two vectors.
 */
  function dotProduct(int256[2] a, int256[2] b) returns(int256) {
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
        if(!noEndpointTouch) {
          result[0] = toPoint(a1, s, va);
        }
        return;
      }
      if (t == 0 || t == 1) {
        // on an endpoint of line segment b
        if(!noEndpointTouch) {
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
        if(!noEndpointTouch) {
          result[0] = toPoint(a1, smin > 0 ? smin : 0, va);
        }
        return;
      }
  
      if (smax == 0) {
        if(!noEndpointTouch) {
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

  function handleQueuePoints(State storage state) public {
    //    emit LogHandleQueuePoints(state.status.values[0]);

    uint8 i = 0;
    while (state.queue.tree.inserted != state.queue.tree.removed) {
      uint256 id = state.queue.tree.pop();
      int256[2] memory point = state.queue.values[id];
      handleEventPointStage1(state, id, point);
      i += 1;
      if (i >= state.maxHandleQueuePointsPerCall) {
        break;
      }
    }
  }

  function handleEventPointStage1(State storage state, uint256 id, int256[2] memory point) private {
    state.status.sweepline.position = SegmentUtils.Position.BEFORE;
    state.status.sweepline.x = point[0];

    emit LogPoint(point);
    // step 2
    uint256 currentStatusId = state.status.tree.first();
    while (currentStatusId > 0) {
      int256[2][2] storage segment = state.status.values[currentStatusId];

      emit LogSegment(segment);
      // count right-ends
      if (MathUtils.abs(point[0] - segment[1][0]) < EPS && MathUtils.abs(point[1] - segment[1][1]) < EPS) {
        emit LogString("push to Lp");
        state.segmentsLpByQueueKey[id].push(segment);
        // count inner points
      } else {
        // filter left ends
        if (!(MathUtils.abs(point[0] - segment[0][0]) < EPS && MathUtils.abs(point[1] - segment[0][1]) < EPS)) {
          if (MathUtils.abs(VectorUtils.direction(segment[0], segment[1], [point[0], point[1]])) < EPS && VectorUtils.onSegment(segment[0], segment[1], [point[0], point[1]])) {
            emit LogString("push to Cp");
            state.segmentsCpByQueueKey[id].push(segment);
          }
        }
      }
      currentStatusId = state.status.tree.next(currentStatusId);
    }

    emit LogHandleEventPointStage1If(state.segmentsUpIndexesByQueueKey[id].length, state.segmentsLpByQueueKey[id].length, state.segmentsCpByQueueKey[id].length);
    if (state.segmentsUpIndexesByQueueKey[id].length + state.segmentsLpByQueueKey[id].length + state.segmentsCpByQueueKey[id].length > 1) {
      emit LogHandleEventPointStage1OutputInsert(point);
      OutputPoint memory outputPoint;
      outputPoint.point = point;

      state.output.push(outputPoint);
    }

    handleEventPointStage2(state, id, point);

    handleEventPointStage3(state, id, point);

    emit LogString("");
  }

  function handleEventPointStage2(State storage state, uint256 id, int256[2] memory point) private {
    bytes32 segmentHash;
    uint256 newId;

    for (uint j = 0; j < state.segmentsCpByQueueKey[id].length; j++) {
      segmentHash = keccak256(abi.encode(state.segmentsCpByQueueKey[id][j]));
      state.status.tree.remove(state.segmentHashToStatusId[segmentHash]);
      emit LogStatusRemove("Cp", point, state.segmentHashToStatusId[segmentHash], state.status.values[state.segmentHashToStatusId[segmentHash]]);
      delete state.segmentHashToStatusId[segmentHash];

    }

    state.status.sweepline.position = SegmentUtils.Position.AFTER;

    for (uint k = 0; k < state.segmentsUpIndexesByQueueKey[id].length; k++) {
      segmentHash = keccak256(abi.encode(state.segments[state.segmentsUpIndexesByQueueKey[id][k]]));
      if (state.segmentHashToStatusId[segmentHash] == 0) {
        newId = state.status.tree.inserted + 1;

        emit LogStatusInsert("Up", point, state.segments[state.segmentsUpIndexesByQueueKey[id][k]]);

        state.status.insert(newId, state.segments[state.segmentsUpIndexesByQueueKey[id][k]]);
        state.segmentHashToStatusId[segmentHash] = newId;
      }
    }
    for (uint m = 0; m < state.segmentsCpByQueueKey[id].length; m++) {
      segmentHash = keccak256(abi.encode(state.segmentsCpByQueueKey[id][m]));
      if (state.segmentHashToStatusId[segmentHash] == 0) {
        newId = state.status.tree.inserted + 1;

        emit LogStatusInsert("Cp", point, state.segmentsCpByQueueKey[id][m]);

        state.status.insert(newId, state.segmentsCpByQueueKey[id][m]);
        state.segmentHashToStatusId[segmentHash] = newId;
      }
    }
  }

  function handleEventPointStage3(State storage state, uint256 id, int256[2] memory point) private {
    uint256 left;
    uint256 right;
    bytes32 segmentHash;

    if (state.segmentsUpIndexesByQueueKey[id].length == 0 && state.segmentsCpByQueueKey[id].length == 0) {
      emit LogHandleEventPointStage3If(point);
      for (uint i = 0; i < state.segmentsLpByQueueKey[id].length; i++) {
        segmentHash = keccak256(abi.encode(state.segmentsLpByQueueKey[id][i]));
        left = state.status.tree.prev(state.segmentHashToStatusId[segmentHash]);
        right = state.status.tree.next(state.segmentHashToStatusId[segmentHash]);

        if (left != 0 && right != 0) {
          emit LogFindNewEvent("UpLp", state.status.values[left], state.status.values[right]);
          findNewEvent(state, state.status.values[left], state.status.values[right]);
        }

        state.status.tree.remove(state.segmentHashToStatusId[segmentHash]);

        //                emit LogStatusRemove("Lp1.1", point, i, state.segmentsLpByQueueKey[id][i]);
        emit LogStatusRemove("Lp1", point, state.segmentHashToStatusId[segmentHash], state.status.values[state.segmentHashToStatusId[segmentHash]]);
        delete state.segmentHashToStatusId[segmentHash];
      }
    } else {
      int256[2][2] memory UCpmax;
      int256[2][2] memory UCpmin;

      for (uint i = 0; i < state.segmentsUpIndexesByQueueKey[id].length + state.segmentsCpByQueueKey[id].length; i++) {
        if (i < state.segmentsUpIndexesByQueueKey[id].length) {
          //          emit LogSortUcp("Up compare", state.segments[state.segmentsUpIndexesByQueueKey[id][i]], state.status.sweepline.compareSegments(state.segments[state.segmentsUpIndexesByQueueKey[id][i]], UCpmax));
          if ((UCpmax[0][0] == 0 && UCpmax[1][1] == 0) || state.status.sweepline.compareSegments(state.segments[state.segmentsUpIndexesByQueueKey[id][i]], UCpmax) > 0) {
            //            emit LogSortUcp("Set UCpmax", state.segments[state.segmentsUpIndexesByQueueKey[id][i]], 0);
            UCpmax = state.segments[state.segmentsUpIndexesByQueueKey[id][i]];
          }
          if ((UCpmin[0][0] == 0 && UCpmin[1][1] == 0) || state.status.sweepline.compareSegments(state.segments[state.segmentsUpIndexesByQueueKey[id][i]], UCpmin) < 0) {
            //            emit LogSortUcp("Set UCpmin", state.segments[state.segmentsUpIndexesByQueueKey[id][i]], 0);
            UCpmin = state.segments[state.segmentsUpIndexesByQueueKey[id][i]];
          }
        } else if (i - state.segmentsUpIndexesByQueueKey[id].length < state.segmentsCpByQueueKey[id].length) {
          //          emit LogSortUcp("Cp compare", state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length], state.status.sweepline.compareSegments(state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length], UCpmax));
          if ((UCpmax[0][0] == 0 && UCpmax[1][1] == 0) || state.status.sweepline.compareSegments(state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length], UCpmax) > 0) {
            //            emit LogSortUcp("Set UCpmax", state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length], 0);
            UCpmax = state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length];
          }
          if ((UCpmin[0][0] == 0 && UCpmin[1][1] == 0) || state.status.sweepline.compareSegments(state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length], UCpmin) < 0) {
            //            emit LogSortUcp("Set UCpmin", state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length], 0);
            UCpmin = state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length];
          }
        }
      }
      //      emit LogUCp("min", UCpmin);
      //      emit LogUCp("max", UCpmax);

      segmentHash = keccak256(abi.encode(UCpmin));
      left = state.status.tree.prev(state.segmentHashToStatusId[segmentHash]);
      //      left = state.status.tree.items[state.segmentHashToStatusId[segmentHash]].left;

      segmentHash = keccak256(abi.encode(UCpmax));
      right = state.status.tree.next(state.segmentHashToStatusId[segmentHash]);
      //      right = state.status.tree.items[state.segmentHashToStatusId[segmentHash]].right;
      //LogPoint [ 1209607785568, 104532165359706 ]
      emit LogHandleEventPointStage3Else(uint256(state.status.sweepline.position), state.status.sweepline.x, point, UCpmin, UCpmax);
      if (left != 0 && UCpmin[0][0] != 0 && UCpmin[1][1] != 0) {
        emit LogFindNewEvent("left", state.status.values[left], UCpmin);
        findNewEvent(state, state.status.values[left], UCpmin);
      }

      if (right != 0 && UCpmax[0][0] != 0 && UCpmax[1][1] != 0) {
        emit LogFindNewEvent("right", state.status.values[right], UCpmax);
        findNewEvent(state, state.status.values[right], UCpmax);
      }

      for (uint256 p = 0; p < state.segmentsLpByQueueKey[id].length; p++) {
        segmentHash = keccak256(abi.encode(state.segmentsLpByQueueKey[id][p]));
        state.status.tree.remove(state.segmentHashToStatusId[segmentHash]);
        emit LogStatusRemove("Lp2", point, state.segmentHashToStatusId[segmentHash], state.status.values[state.segmentHashToStatusId[segmentHash]]);
      }
    }
    emit LogString("");
  }

  function findNewEvent(State storage state, int256[2][2] memory leftSegment, int256[2][2] memory rightSegment) private {

    int256[2] memory intersectionPoint = SegmentUtils.findSegmentsIntersection(leftSegment, rightSegment);

    if (intersectionPoint[0] != 0 && intersectionPoint[1] != 0) {
      bytes32 pointHash = keccak256(abi.encode(intersectionPoint));
      if (state.pointHashToQueueId[pointHash] == 0) {
        state.output.push(OutputPoint({
          point : intersectionPoint,
          leftSegment : leftSegment,
          rightSegment : rightSegment
          }));

        uint256 queueId = state.queue.tree.inserted + 1;
        state.queue.insert(queueId, intersectionPoint);
        state.pointHashToQueueId[pointHash] = queueId;
        emit LogFindNewEventOutputInsert(intersectionPoint);
      }
    }
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
