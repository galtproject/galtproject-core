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

import "./MartinezRueda.sol";
import "./PolygonUtils.sol";
//import "./SegmentUtils.sol";
//import "./VectorUtils.sol";

library WeilerAtherton {
  using MartinezRueda for MartinezRueda.State;

  // TODO: use stages
  enum Stage {
    NONE,
    INIT,
    SEGMENTS_SET,
    QUEUE_INSERT
  }

  enum Direction {
    FORWARD,
    BACKWARD
  }

  //TODO: check for only unique points
  struct Point {
    bytes32 nextPoint;
    bytes32 prevPoint;
    //    int256[2] latLon;
    bool intersectionPoint;
    bool includedInResult;
  }

  struct Polygon {
    mapping(bytes32 => Point) pointByHash;
    bytes32 startPoint;
    bytes32 currentPointForAddSegment;
    bytes32[] intersectionPoints;
    uint256 handledIntersectionPoints;
    bool segmentsAdded;
  }

  struct State {
    Polygon subjectPolygon;
    Polygon clippingPolygon;
    MartinezRueda.State martinezRueda;
    mapping(bytes32 => int256[2]) latLonByHash;
    //    mapping(bytes32 => bool) processedResultPoint;
    PolygonUtils.CoorsPolygon[] resultPolygons;
    PolygonUtils.CoorsPolygon subjectPolygonOutput;
  }

  event LogAddPoint(int256[2] point, bytes32 pointHash, bytes32 nextPointHash);
  event LogAddSegment(int256[2][2] segment);
  event LogPlacePointBetween(string ifCase, int256[2] placePoint, int256[2] startPoint, int256[2] endPoint);
  event LogPushToResult(int256[2] point);
  event LogSetNextPoint(int256[2] curPoint, bool isIntersection, int256[2] nextPoint);
  event LogIncludeIntersectionInResult(string polygon, int256[2] point, uint256 handledPoints);

  function initWeilerAtherton(State storage state) public {
    state.martinezRueda.initMartinezRueda();
  }

  function initAllPolygons(State storage state) public {
    initPolygon(state, state.martinezRueda.subject, state.subjectPolygon);
    initPolygon(state, state.martinezRueda.clipping, state.clippingPolygon);
  }

  function initPolygon(State storage state, PolygonUtils.CoorsPolygon storage input, Polygon storage polygon) public {
    bytes32 pointHash;
    bytes32 prevPointHash;

    for (uint j = 0; j < input.points.length; j++) {
      pointHash = keccak256(abi.encode(input.points[j]));
      state.latLonByHash[pointHash] = input.points[j];
      if (j == 0) {
        polygon.startPoint = pointHash;
      } else {
        polygon.pointByHash[prevPointHash].nextPoint = pointHash;
        polygon.pointByHash[pointHash].prevPoint = prevPointHash;
        //        emit LogAddPoint(polygon.pointByHash[prevPointHash].latLon, prevPointHash, polygon.pointByHash[prevPointHash].nextPoint);
      }
      prevPointHash = pointHash;
    }

    polygon.pointByHash[pointHash].nextPoint = polygon.startPoint;
    polygon.pointByHash[polygon.startPoint].prevPoint = pointHash;
  }

  function prepareSubjectPolygon(State storage state) public {
    state.martinezRueda.processSubjectPolygon();
    state.subjectPolygon.segmentsAdded = true;
  }

  function prepareClippingPolygon(State storage state) public {
    state.martinezRueda.processClippingPolygon();
    state.clippingPolygon.segmentsAdded = true;
  }

  function processMartinezRueda(State storage state) public {
    if (!state.martinezRueda.subdivideSegmentsOver) {
      state.martinezRueda.subdivideSegments();
    } else if (state.martinezRueda.resultEvents.length == 0) {
      state.martinezRueda.orderEvents();
    } else {
      require(false, "Martinez Rueda already finished");
    }
  }

  function isMartinezRuedaFinished(State storage state) public view returns (bool) {
    return state.martinezRueda.subdivideSegmentsOver && state.martinezRueda.resultEvents.length != 0;
  }

  event LogPoint(string name, int256[2] latLon);
  event LogMartinezRuedaResult(uint256 eventsLength);
  event LogFailed(string reason);

  function addIntersectedPoints(State storage state) public {
    require(isMartinezRuedaFinished(state), "Martinez Rueda not finished");

    bytes32 newPointHash;
    //    SweepEvent.Item memory sweepEvent;

    emit LogMartinezRuedaResult(state.martinezRueda.resultEvents.length);

    for (uint j = 0; j < state.martinezRueda.resultEvents.length; j++) {
      //      sweepEvent = state.martinezRueda.store.sweepById[state.martinezRueda.resultEvents[j]];

      newPointHash = keccak256(abi.encode(state.martinezRueda.store.sweepById[state.martinezRueda.resultEvents[j]].point));

      /* solium-disable-next-line */
      if (state.subjectPolygon.pointByHash[newPointHash].intersectionPoint
      || state.subjectPolygon.pointByHash[newPointHash].nextPoint != bytes32(0)
      || state.subjectPolygon.pointByHash[newPointHash].prevPoint != bytes32(0)
      || state.clippingPolygon.pointByHash[newPointHash].nextPoint != bytes32(0)
      || state.clippingPolygon.pointByHash[newPointHash].prevPoint != bytes32(0)) {
        continue;
      }

//      emit LogPoint("newPointHash", state.martinezRueda.store.sweepById[state.martinezRueda.resultEvents[j]].point);
      // TODO: reject if point on more then one segment in one polygon  
      if (addIntersectedPointsToPolygon(state, state.subjectPolygon, state.martinezRueda.store.sweepById[state.martinezRueda.resultEvents[j]].point, newPointHash)) {
        if (!addIntersectedPointsToPolygon(state, state.clippingPolygon, state.martinezRueda.store.sweepById[state.martinezRueda.resultEvents[j]].point, newPointHash)) {
          emit LogFailed("Intersected point of subject polygon not found in clipping polygon");
          require(false, "Intersected point of subject polygon not found in clipping polygon");
        }
      } else {
//        emit LogFailed("Intersected point cant placed to subject polygon");
        require(false, "Intersected point cant placed to subject polygon");
      }
    }
  }

  function addIntersectedPointsToPolygon(State storage state, Polygon storage polygon, int256[2] point, bytes32 pointHash) private returns (bool) {
    // is segment points exists in polygon

    bytes32 pointToReplace;
    bytes32 currentPoint = polygon.startPoint;
    while (true) {
      emit LogPlacePointBetween("log", point, state.latLonByHash[currentPoint], state.latLonByHash[polygon.pointByHash[currentPoint].nextPoint]);
      if (SegmentUtils.pointOnSegment(point, state.latLonByHash[currentPoint], state.latLonByHash[polygon.pointByHash[currentPoint].nextPoint])) {
        pointToReplace = polygon.pointByHash[currentPoint].nextPoint;

        emit LogPlacePointBetween("", point, state.latLonByHash[currentPoint], state.latLonByHash[polygon.pointByHash[currentPoint].nextPoint]);

        polygon.pointByHash[pointToReplace].prevPoint = pointHash;
        polygon.pointByHash[currentPoint].nextPoint = pointHash;
        polygon.pointByHash[pointHash].prevPoint = currentPoint;
        polygon.pointByHash[pointHash].nextPoint = pointToReplace;

        polygon.pointByHash[pointHash].intersectionPoint = true;
        polygon.intersectionPoints.push(pointHash);

        if (state.latLonByHash[pointHash][0] == 0 && state.latLonByHash[pointHash][1] == 0) {
          state.latLonByHash[pointHash] = point;
        }
        return true;
      }
      currentPoint = polygon.pointByHash[currentPoint].nextPoint;
      if (currentPoint == polygon.startPoint) {
        break;
      }
    }

    return false;
//    emit LogFailed("Found intersection point cant be placed in polygon");
//    require(false, "Found intersection point cant be placed in polygon");
  }

  //  function initResultPolygon() {
  //    
  //  }
  //  
  event LogInsideCoors(int256[2] point, bool intersectionPoint);
  event LogPolygonCoors(int256[2] point);

  function buildResultPolygon(State storage state) public returns (bool) {
    bytes32 curPointHash;
    bytes32 startPointHash;

    for (uint j = 0; j < state.subjectPolygon.intersectionPoints.length; j++) {
      if (!state.subjectPolygon.pointByHash[state.subjectPolygon.intersectionPoints[j]].includedInResult && !state.clippingPolygon.pointByHash[state.subjectPolygon.intersectionPoints[j]].includedInResult) {
        curPointHash = state.subjectPolygon.intersectionPoints[j];
        startPointHash = curPointHash;
        emit LogPoint("startPointHash", state.latLonByHash[startPointHash]);
        break;
      }
      if (state.subjectPolygon.intersectionPoints.length - 1 == j) {
        return false;
      }
    }

    bytes32 nextPointHash;
    Direction subjectDirection;

    // find direction and next point
    //TODO: need to add OR intersection point?

    //    for(uint i = 0; i < state.martinezRueda.clipping.points.length; i++){
    //      emit LogPolygonCoors(state.martinezRueda.clipping.points[i]);
    //    }

    if (PolygonUtils.isInsideCoors(state.latLonByHash[state.subjectPolygon.pointByHash[curPointHash].nextPoint], state.martinezRueda.clipping)) {
      nextPointHash = state.subjectPolygon.pointByHash[curPointHash].nextPoint;
      subjectDirection = Direction.FORWARD;
    } else if (PolygonUtils.isInsideCoors(state.latLonByHash[state.subjectPolygon.pointByHash[curPointHash].prevPoint], state.martinezRueda.clipping)) {
      nextPointHash = state.subjectPolygon.pointByHash[curPointHash].prevPoint;
      subjectDirection = Direction.BACKWARD;
    } else {
      if (state.clippingPolygon.pointByHash[state.subjectPolygon.pointByHash[curPointHash].nextPoint].intersectionPoint) {
        nextPointHash = state.subjectPolygon.pointByHash[curPointHash].nextPoint;
        subjectDirection = Direction.FORWARD;
      } else if (state.clippingPolygon.pointByHash[state.subjectPolygon.pointByHash[curPointHash].prevPoint].intersectionPoint) {
        nextPointHash = state.subjectPolygon.pointByHash[curPointHash].prevPoint;
        subjectDirection = Direction.BACKWARD;
      } else {
        //      emit LogFailed("Not found adjoining points inside clipping polygon");
        //      return;
        require(false, "Not found adjoining points inside clipping polygon");
      }
    }


    //    PolygonUtils.CoorsPolygon memory newPolygon;
    state.resultPolygons.length++;

    PolygonUtils.CoorsPolygon storage resultPolygon = state.resultPolygons[state.resultPolygons.length - 1];

    bytes32 prevPointHash;

    // fill resultPolygon from subjectPolygon
    while (true) {
      if (state.subjectPolygon.pointByHash[curPointHash].intersectionPoint) {
        require(!state.subjectPolygon.pointByHash[curPointHash].includedInResult, "subjectPolygon intersectionPoint already included");
        state.subjectPolygon.handledIntersectionPoints++;
        emit LogIncludeIntersectionInResult("subject", state.latLonByHash[curPointHash], state.subjectPolygon.handledIntersectionPoints);
//        if (state.subjectPolygon.pointByHash[curPointHash].includedInResult) {
//          emit LogFailed("subjectPolygon intersectionPoint already included");
//          return;
//        }
        state.subjectPolygon.pointByHash[curPointHash].includedInResult = true;
      } else if (curPointHash == state.subjectPolygon.startPoint) {
        state.subjectPolygon.startPoint = nextPointHash;
      }

      emit LogPushToResult(state.latLonByHash[curPointHash]);
      resultPolygon.points.push(state.latLonByHash[curPointHash]);

      if (state.subjectPolygon.pointByHash[curPointHash].intersectionPoint && curPointHash != startPointHash) {
        break;
      }

      prevPointHash = curPointHash;

      if (subjectDirection == Direction.FORWARD) {
        curPointHash = state.subjectPolygon.pointByHash[curPointHash].nextPoint;
        nextPointHash = state.subjectPolygon.pointByHash[curPointHash].nextPoint;
      } else {
        curPointHash = state.subjectPolygon.pointByHash[curPointHash].prevPoint;
        nextPointHash = state.subjectPolygon.pointByHash[curPointHash].prevPoint;
      }
    }

    if (state.clippingPolygon.pointByHash[curPointHash].nextPoint == bytes32(0)) {
      require(false, "Intersection point not found in clipping polygon");
    }

    Direction clippingDirection;
    //    
    //    emit LogPoint("prevPointHash", state.latLonByHash[prevPointHash]);
    //    emit LogPoint("curPointHash", state.latLonByHash[curPointHash]);
    //    emit LogInsideCoors(state.latLonByHash[state.clippingPolygon.pointByHash[curPointHash].nextPoint], state.subjectPolygon.pointByHash[state.clippingPolygon.pointByHash[curPointHash].nextPoint].intersectionPoint);
    //    emit LogInsideCoors(state.latLonByHash[state.clippingPolygon.pointByHash[curPointHash].prevPoint], state.subjectPolygon.pointByHash[state.clippingPolygon.pointByHash[curPointHash].prevPoint].intersectionPoint);

    //    for(uint i = 0; i < state.martinezRueda.subject.points.length; i++){
    //      emit LogPolygonCoors(state.martinezRueda.subject.points[i]);
    //    }

    // find direction and next point
    //TODO: need to add OR intersection point?
    if (state.clippingPolygon.pointByHash[curPointHash].nextPoint != prevPointHash//!state.subjectPolygon.pointByHash[state.clippingPolygon.pointByHash[curPointHash].nextPoint].includedInResult && 
    && (state.subjectPolygon.pointByHash[state.clippingPolygon.pointByHash[curPointHash].nextPoint].intersectionPoint || PolygonUtils.isInsideCoors(state.latLonByHash[state.clippingPolygon.pointByHash[curPointHash].nextPoint], state.martinezRueda.subject))) {
      nextPointHash = state.clippingPolygon.pointByHash[curPointHash].nextPoint;
      clippingDirection = Direction.FORWARD;
    } else if (state.clippingPolygon.pointByHash[curPointHash].prevPoint != prevPointHash//!state.subjectPolygon.pointByHash[state.clippingPolygon.pointByHash[curPointHash].prevPoint].includedInResult && 
    && (state.subjectPolygon.pointByHash[state.clippingPolygon.pointByHash[curPointHash].prevPoint].intersectionPoint || PolygonUtils.isInsideCoors(state.latLonByHash[state.clippingPolygon.pointByHash[curPointHash].prevPoint], state.martinezRueda.subject))) {
      nextPointHash = state.clippingPolygon.pointByHash[curPointHash].prevPoint;
      clippingDirection = Direction.BACKWARD;
    } else {
      emit LogFailed("Not found valid next point in clipping polygon");
      return;
      require(false, "Not found valid next point in clipping polygon");
    }

    // fill resultPolygon from clippingPolygon and change subjectPolygon to be clippingped
    while (true) {
      if (subjectDirection == Direction.FORWARD) {
        state.subjectPolygon.pointByHash[curPointHash].prevPoint = nextPointHash;
        state.subjectPolygon.pointByHash[nextPointHash].nextPoint = curPointHash;
      } else {
        state.subjectPolygon.pointByHash[curPointHash].nextPoint = nextPointHash;
        state.subjectPolygon.pointByHash[nextPointHash].prevPoint = curPointHash;
      }

      if (state.clippingPolygon.pointByHash[curPointHash].intersectionPoint) {
        require(state.subjectPolygon.pointByHash[curPointHash].intersectionPoint, "Self intersected clipping polygons not supported");
        require(!state.clippingPolygon.pointByHash[curPointHash].includedInResult, "clippingPolygon current intersectionPoint already included");
        
        state.clippingPolygon.handledIntersectionPoints++;
        state.clippingPolygon.pointByHash[curPointHash].includedInResult = true;
        emit LogIncludeIntersectionInResult("clipping cur", state.latLonByHash[curPointHash], state.clippingPolygon.handledIntersectionPoints);
      }

      if (state.clippingPolygon.pointByHash[nextPointHash].intersectionPoint) {
        require(state.subjectPolygon.pointByHash[nextPointHash].intersectionPoint, "Self intersected clipping polygons not supported");
        
        if (PointUtils.isEqual(state.latLonByHash[nextPointHash], resultPolygon.points[0])) {
          require(!state.clippingPolygon.pointByHash[nextPointHash].includedInResult, "clippingPolygon next intersectionPoint already included");
          
          state.clippingPolygon.handledIntersectionPoints++;
          state.clippingPolygon.pointByHash[nextPointHash].includedInResult = true;
          emit LogIncludeIntersectionInResult("clipping next", state.latLonByHash[nextPointHash], state.clippingPolygon.handledIntersectionPoints);
          //successful finish
          return true;
        } else {
          emit LogFailed("End point of result polygon not equals to start point");
          return;
          require(false, "End point of result polygon not equals to start point");
        }
      }
      emit LogSetNextPoint(state.latLonByHash[curPointHash], state.clippingPolygon.pointByHash[curPointHash].intersectionPoint, state.latLonByHash[nextPointHash]);

      emit LogPushToResult(state.latLonByHash[nextPointHash]);
      resultPolygon.points.push(state.latLonByHash[nextPointHash]);

      curPointHash = nextPointHash;

      if (clippingDirection == Direction.FORWARD) {
        nextPointHash = state.clippingPolygon.pointByHash[curPointHash].nextPoint;
      } else {
        nextPointHash = state.clippingPolygon.pointByHash[curPointHash].prevPoint;
      }
    }
  }

  //  function pointHashCanBeAddToPolygon(State storage state, bytes32 prevPointHash, bytes32 actualPointHash, Polygon storage prevPolygon, Polygon storage actualPolygon, PolygonUtils.CoorsPolygon storage prevLatLonPolygon) private returns(bool) {
  //    return !prevPolygon.pointByHash[actualPointHash].includedInResult && actualPointHash != prevPointHash
  //        && (prevPolygon.pointByHash[actualPointHash].intersectionPoint || PolygonUtils.isInsideCoors(state.latLonByHash[actualPointHash], prevLatLonPolygon));
  //  }

  function buildSubjectPolygonOutput(State storage state) public returns (bool) {
    require(state.subjectPolygonOutput.points.length == 0, "subjectPolygonOutput already build");
    require(state.subjectPolygon.handledIntersectionPoints == state.subjectPolygon.intersectionPoints.length, "Not all subjectPolygon intersectionPoints handled");
    require(state.clippingPolygon.handledIntersectionPoints == state.clippingPolygon.intersectionPoints.length, "Not all clippingPolygon intersectionPoints handled");

    bytes32 currentPoint = state.subjectPolygon.startPoint;
    while (true) {
      emit LogPushToResult(state.latLonByHash[currentPoint]);
      state.subjectPolygonOutput.points.push(state.latLonByHash[currentPoint]);
      currentPoint = state.subjectPolygon.pointByHash[currentPoint].nextPoint;
      if (currentPoint == state.subjectPolygon.startPoint) {
        break;
      }
    }
  }
}
