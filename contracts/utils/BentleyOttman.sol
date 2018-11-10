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
pragma experimental ABIEncoderV2;

import "../collections/RedBlackTree.sol";
import "../collections/SegmentRedBlackTree.sol";
import "../collections/PointRedBlackTree.sol";
import "./MathUtils.sol";
import "./SegmentUtils.sol";
import "./VectorUtils.sol";

library BentleyOttman {
  int256 internal constant EPS = 1000000000;
  
  using SegmentRedBlackTree for SegmentRedBlackTree.SegmentsTree;
  using PointRedBlackTree for PointRedBlackTree.PointsTree;
  
  enum Stage {
    NONE,
    INIT,
    SEGMENTS_SET,
    QUEUE_INSERT
  }
  
  struct State {
    SegmentRedBlackTree.SegmentsTree status;
    PointRedBlackTree.PointsTree queue;
    PointRedBlackTree.PointsTree output;
    int256[2][2][] segments;
    mapping(uint256 => uint256[]) segmentsIndexesByQueueKey;

    mapping(uint256 => int256[2][2][]) segmentsLpByQueueKey; // segments, for which this is the right end
    mapping(uint256 => int256[2][2][]) segmentsCpByQueueKey; // segments, for which this is an inner point
  }

  event LogHandleQueuePoints(int256[2][2] firstItem);
  
  function init(State storage state) public {
    state.status.init();
    state.queue.init();
    state.output.init();
  }
  
  //This type is only supported in the new experimental ABI encoder. Use "pragma experimental ABIEncoderV2;" to enable the feature.
  function setSegments(State storage state, int256[2][2][] segments) public {
    state.segments = segments;
    for(uint i = 0; i < segments.length; i++) {
      handleSegment(state, i);
    }
  }
  
  function addSegment(State storage state, int256[2][2] segment) public {
    state.segments.push(segment);
    handleSegment(state, state.segments.length - 1);
  }
  
  function getSegment(State storage state, uint256 index) public view returns (int256 [2][2]) {
    return state.segments[index];
  }
  
  function handleSegment(State storage state, uint256 segmentIndex) private {
    int256[2][2] memory segment = state.segments[segmentIndex];
    
    // sort points of segment
    int8 comparePointsResult = PointUtils.comparePoints(segment[0], segment[1]);
    if(comparePointsResult > 0) {
      segment = int256[2][2]([segment[1], segment[0]]);
      state.segments[segmentIndex] = segment;
    }

    uint256 beginId = state.queue.getNewId();
    state.queue.insert(beginId, segment[0]);
    state.segmentsIndexesByQueueKey[beginId].push(segmentIndex);

    uint256 endId = state.queue.getNewId();
    state.queue.insert(endId, segment[1]);
  }
  
  function handleQueuePoints(State storage state) public {
//    emit LogHandleQueuePoints(state.status.values[0]);
    state.status.setSweeplinePosition(SegmentUtils.Position.BEFORE);
    
    while(!state.queue.isEmpty()) {
      (uint256 id, int256[2] memory point) = state.queue.pop();
      handleEventPointStage1(state, id, point);
    }
  }
  
  function handleEventPointStage1(State storage state, uint256 id, int256[2] memory point) private {
    state.status.setSweeplineX(point[0]);

    uint256[] memory Up = state.segmentsIndexesByQueueKey[id]; // segments, for which this is the left end
    
    // step 2
    uint256 currentStatusId = state.status.first();
    while(currentStatusId > 0) {
      int256[2][2] storage segment = state.status.values[currentStatusId];

      // count right-ends
      if (MathUtils.abs(point[0] - segment[1][0]) < EPS && MathUtils.abs(point[1] - segment[1][1]) < EPS) {
        state.segmentsLpByQueueKey[id].push(segment);
        // count inner points
      } else {
        // filter left ends
        if (!(MathUtils.abs(point[0] - segment[0][0]) < EPS && MathUtils.abs(point[1] - segment[0][1]) < EPS)) {
          if (MathUtils.abs(VectorUtils.direction(segment[0], segment[1], [point[0], point[1]])) < EPS && VectorUtils.onSegment(segment[0], segment[1], [point[0], point[1]])) {
            state.segmentsCpByQueueKey[id].push(segment);
          }
        }
      }
    }

    if (state.segmentsIndexesByQueueKey[id].length > 1 || state.segmentsLpByQueueKey[id].length > 1 || state.segmentsCpByQueueKey[id].length > 1) {
      state.output.insert(state.output.getNewId(), point);
    }
  }
}
