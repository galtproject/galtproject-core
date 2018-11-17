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

library BentleyOttman {
  int256 internal constant EPS = 1000000000;

  using RedBlackTree for RedBlackTree.Tree;
  using SegmentRedBlackTree for SegmentRedBlackTree.SegmentsTree;
  using PointRedBlackTree for PointRedBlackTree.PointsTree;

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

  struct State {
    uint8 maxHandleQueuePointsPerCall;

    SegmentRedBlackTree.SegmentsTree status;
    PointRedBlackTree.PointsTree queue;
    OutputPoint[] output;
    int256[2][2][] segments;
    mapping(uint256 => uint256[]) segmentsUpIndexesByQueueKey; // segments, for which this is the left end

    mapping(uint256 => int256[2][2][]) segmentsLpByQueueKey; // segments, for which this is the right end
    mapping(uint256 => int256[2][2][]) segmentsCpByQueueKey; // segments, for which this is an inner point

    mapping(bytes32 => uint256) segmentHashToStatusId;
    mapping(bytes32 => uint256) pointHashToQueueId;
  }

  event LogPoint(int256[2] point);
  event LogSegment(int256[2][2] segment);
  event LogString(string s);
  event LogUpPush(int256[2] point, int256[2][2] segment);
  event LogSegmentSort(int256[2][2] segment);
  event LogStatusInsert(string name, int256[2] point, int256[2][2] segment);
  event LogStatusRemove(string name, int256[2] point, uint256 id, int256[2][2] segment);
  event LogFindNewEvent(int256[2][2] leftSegment, int256[2][2] rightSegment);
  event LogFindNewEventOutputInsert(int256[2] point);
  event LogHandleEventPointStage1If(uint256 UpLength, uint256 LpLength, uint256 CpLength);
  event LogHandleEventPointStage1OutputInsert(int256[2] point);
  event LogHandleEventPointStage3If(int256[2] point);
  event LogHandleEventPointStage3Else(int256[2] point, int256[2][2] UCpmin, int256[2][2] UCpmax);

  function init(State storage state) public {
    state.status.init();
    state.queue.init();

    //transaction reverted on maxHandleQueuePointsPerCall = 16 
    state.maxHandleQueuePointsPerCall = 6;
  }

  //This type is only supported in the new experimental ABI encoder. Use "pragma experimental ABIEncoderV2;" to enable the feature.
  //  function setSegments(State storage state, int256[2][2][] segments) public {
  //    state.segments = segments;
  //    for (uint i = 0; i < segments.length; i++) {
  //      emit LogSegment(state.segments[i]);
  //      handleSegment(state, i);
  //    }
  //  }

  function addSegment(State storage state, int256[2][2] segment) public {
    state.segments.push(segment);
    //    emit LogSegment(segment);
    //    emit LogSegment(state.segments[state.segments.length - 1]);
    handleSegment(state, state.segments.length - 1);
  }

  function getSegment(State storage state, uint256 index) public view returns (int256[2][2]) {
    return state.segments[index];
  }

  function handleSegment(State storage state, uint256 segmentIndex) private {
    int256[2][2] memory segment = state.segments[segmentIndex];

    // sort points of segment
    if (PointUtils.comparePoints(segment[0], segment[1]) > 0) {
      segment = int256[2][2]([segment[1], segment[0]]);
      state.segments[segmentIndex] = segment;
//      emit LogSegmentSort(segment);
    }
    
    bytes32 pointHash = keccak256(abi.encode(segment[0]));

    uint256 pointId;
    if(state.pointHashToQueueId[pointHash] == 0) {
      pointId = state.queue.tree.inserted + 1;
      state.pointHashToQueueId[pointHash] = pointId;
      state.queue.insert(pointId, segment[0]);
    } else {
      pointId = state.pointHashToQueueId[pointHash];
    }

    state.segmentsUpIndexesByQueueKey[pointId].push(segmentIndex);
//    emit LogUpPush(segment[0], segment);

    pointHash = keccak256(abi.encode(segment[1]));
    if(state.pointHashToQueueId[pointHash] == 0) {
      pointId = state.queue.tree.inserted + 1;
      state.pointHashToQueueId[pointHash] = pointId;
      state.queue.insert(pointId, segment[1]);
    }
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

//    emit LogPoint(point);
    // step 2
    uint256 currentStatusId = state.status.tree.first();
    while (currentStatusId > 0) {
      int256[2][2] storage segment = state.status.values[currentStatusId];

//      emit LogSegment(segment);
      // count right-ends
      if (MathUtils.abs(point[0] - segment[1][0]) < EPS && MathUtils.abs(point[1] - segment[1][1]) < EPS) {
//        emit LogString("push to Lp");
        state.segmentsLpByQueueKey[id].push(segment);
        // count inner points
      } else {
        // filter left ends
        if (!(MathUtils.abs(point[0] - segment[0][0]) < EPS && MathUtils.abs(point[1] - segment[0][1]) < EPS)) {
          if (MathUtils.abs(VectorUtils.direction(segment[0], segment[1], [point[0], point[1]])) < EPS && VectorUtils.onSegment(segment[0], segment[1], [point[0], point[1]])) {
//            emit LogString("push to Cp");
            state.segmentsCpByQueueKey[id].push(segment);
          }
        }
      }
      currentStatusId = state.status.tree.next(currentStatusId);
    }

//    emit LogHandleEventPointStage1If(state.segmentsUpIndexesByQueueKey[id].length, state.segmentsLpByQueueKey[id].length, state.segmentsCpByQueueKey[id].length);
    if (state.segmentsUpIndexesByQueueKey[id].length + state.segmentsLpByQueueKey[id].length + state.segmentsCpByQueueKey[id].length > 1) {
//      emit LogHandleEventPointStage1OutputInsert(point);
      OutputPoint memory outputPoint;
      outputPoint.point = point;
      
      state.output.push(outputPoint);
    }

    handleEventPointStage2(state, id, point);

    handleEventPointStage3(state, id, point);

//    emit LogString("");
  }

  function handleEventPointStage2(State storage state, uint256 id, int256[2] memory point) private {
    bytes32 segmentHash;
    uint256 newId;

    for (uint j = 0; j < state.segmentsCpByQueueKey[id].length; j++) {
      segmentHash = keccak256(abi.encode(state.segmentsCpByQueueKey[id][j]));
      state.status.tree.remove(state.segmentHashToStatusId[segmentHash]);
      delete state.segmentHashToStatusId[segmentHash];

      //      emit LogStatusRemove("Cp", point, state.segmentHashToStatusId[segmentHash], state.status.values[state.segmentHashToStatusId[segmentHash]]);
    }

    state.status.sweepline.position = SegmentUtils.Position.AFTER;

    for (uint k = 0; k < state.segmentsUpIndexesByQueueKey[id].length; k++) {
      segmentHash = keccak256(abi.encode(state.segments[state.segmentsUpIndexesByQueueKey[id][k]]));
      if (state.segmentHashToStatusId[segmentHash] == 0) {
        newId = state.status.tree.inserted + 1;

        //        emit LogStatusInsert("Up", point, state.segments[state.segmentsUpIndexesByQueueKey[id][k]]);

        state.status.insert(newId, state.segments[state.segmentsUpIndexesByQueueKey[id][k]]);
        state.segmentHashToStatusId[segmentHash] = newId;
      }
    }
    for (uint m = 0; m < state.segmentsCpByQueueKey[id].length; m++) {
      segmentHash = keccak256(abi.encode(state.segmentsCpByQueueKey[id][m]));
      if (state.segmentHashToStatusId[segmentHash] == 0) {
        newId = state.status.tree.inserted + 1;

        //        emit LogStatusInsert("Cp", point, state.segmentsCpByQueueKey[id][m]);

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
//      emit LogHandleEventPointStage3If(point);
      for (uint i = 0; i < state.segmentsLpByQueueKey[id].length; i++) {
        segmentHash = keccak256(abi.encode(state.segmentsLpByQueueKey[id][i]));
        left = state.status.tree.prev(state.segmentHashToStatusId[segmentHash]);
        right = state.status.tree.next(state.segmentHashToStatusId[segmentHash]);

        if (left != 0 && right != 0) {
          findNewEvent(state, state.status.values[left], state.status.values[right]);
        }

        state.status.tree.remove(state.segmentHashToStatusId[segmentHash]);

        //        emit LogStatusRemove("Lp1.1", point, i, state.segmentsLpByQueueKey[id][i]);
        //        emit LogStatusRemove("Lp1.2", point, state.segmentHashToStatusId[segmentHash], state.status.values[state.segmentHashToStatusId[segmentHash]]);
        delete state.segmentHashToStatusId[segmentHash];
      }
    } else {
      int256[2][2] memory UCpmax;
      int256[2][2] memory UCpmin;

      for (uint i = 0; i < state.segmentsUpIndexesByQueueKey[id].length + state.segmentsCpByQueueKey[id].length; i++) {
        if (i < state.segmentsUpIndexesByQueueKey[id].length) {
          if ((UCpmax[0][0] == 0 && UCpmax[1][1] == 0) || SegmentUtils.compareSegments(state.status.sweepline, state.segments[state.segmentsUpIndexesByQueueKey[id][i]], UCpmax) > 1) {
            UCpmax = state.segments[state.segmentsUpIndexesByQueueKey[id][i]];
          }
          if ((UCpmin[0][0] == 0 && UCpmin[1][1] == 0) || SegmentUtils.compareSegments(state.status.sweepline, state.segments[state.segmentsUpIndexesByQueueKey[id][i]], UCpmin) < 1) {
            UCpmin = state.segments[state.segmentsUpIndexesByQueueKey[id][i]];
          }
        } else if (i - state.segmentsUpIndexesByQueueKey[id].length < state.segmentsCpByQueueKey[id].length) {
          if ((UCpmax[0][0] == 0 && UCpmax[1][1] == 0) || SegmentUtils.compareSegments(state.status.sweepline, state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length], UCpmax) > 1) {
            UCpmax = state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length];
          }
          if ((UCpmin[0][0] == 0 && UCpmin[1][1] == 0) || SegmentUtils.compareSegments(state.status.sweepline, state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length], UCpmin) < 1) {
            UCpmin = state.segmentsCpByQueueKey[id][i - state.segmentsUpIndexesByQueueKey[id].length];
          }
        }
      }
//      emit LogHandleEventPointStage3Else(point, UCpmin, UCpmax);

      segmentHash = keccak256(abi.encode(UCpmin));
      left = state.segmentHashToStatusId[segmentHash];
      left = state.status.tree.prev(left);

      segmentHash = keccak256(abi.encode(UCpmax));
      right = state.segmentHashToStatusId[segmentHash];
      right = state.status.tree.next(right);

      if (left != 0 && UCpmin[0][0] != 0 && UCpmin[1][1] != 0) {
        findNewEvent(state, state.status.values[left], UCpmin);
      }

      if (right != 0 && UCpmax[0][0] != 0 && UCpmax[1][1] != 0) {
        findNewEvent(state, state.status.values[right], UCpmax);
      }

      for (uint256 p = 0; p < state.segmentsLpByQueueKey[id].length; p++) {
        segmentHash = keccak256(abi.encode(state.segmentsLpByQueueKey[id][p]));
        state.status.tree.remove(state.segmentHashToStatusId[segmentHash]);
        //        emit LogStatusRemove("Lp2", point, state.segmentHashToStatusId[segmentHash], state.status.values[state.segmentHashToStatusId[segmentHash]]);
      }
    }
  }

  function findNewEvent(State storage state, int256[2][2] memory leftSegment, int256[2][2] memory rightSegment) private {
//    emit LogFindNewEvent(leftSegment, rightSegment);

    int256[2] memory intersectionPoint = SegmentUtils.findSegmentsIntersection(leftSegment, rightSegment);

    if (intersectionPoint[0] != 0 && intersectionPoint[1] != 0) {
      bytes32 pointHash = keccak256(abi.encode(intersectionPoint));
      if (state.pointHashToQueueId[pointHash] == 0) {
        state.output.push(OutputPoint({
          point: intersectionPoint,
          leftSegment: leftSegment,
          rightSegment: rightSegment
        }));

        uint256 queueId = state.queue.tree.inserted + 1;
        state.queue.insert(queueId, intersectionPoint);
        state.pointHashToQueueId[pointHash] = queueId;
//        emit LogFindNewEventOutputInsert(intersectionPoint);
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
