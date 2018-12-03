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
    Polygon basePolygon;
    Polygon cropPolygon;
    MartinezRueda.State martinezRueda;
    mapping(bytes32 => int256[2]) latLonByHash;
//    mapping(bytes32 => bool) processedResultPoint;
    PolygonUtils.CoorsPolygon[] resultPolygons;
    PolygonUtils.CoorsPolygon basePolygonOutput;
  }

  event LogBentleyOttmanOutput(int256[2] point);
  event LogBentleyOttman(uint256 queueInserted, uint256 queueRemoved, uint256 outputLength);
  event LogAddPoint(int256[2] point, bytes32 pointHash, bytes32 nextPointHash);
  event LogAddSegment(int256[2][2] segment);
  event LogPlacePointBetween(string ifCase, int256[2] placePoint, int256[2] startPoint, int256[2] endPoint);
  event LogPushToResult(int256[2] point);
  event LogSetNextPoint(int256[2] curPoint, bool isIntersection, int256[2] nextPoint);
  event LogIncludeIntersectionInResult(string polygon, int256[2] point, uint256 handledPoints);

  function initWeilerAtherton(State storage state) internal {
    state.martinezRueda.initMartinezRueda();
  }

  function initAllPolygons(State storage state) public {
    initPolygon(state, state.martinezRueda.subject, state.basePolygon);
    initPolygon(state, state.martinezRueda.clipping, state.cropPolygon);
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
  
  function prepareBasePolygon(State storage state) public {
    state.martinezRueda.processSubjectPolygon();
  }

  function prepareCropPolygon(State storage state) public {
    state.martinezRueda.processClippingPolygon();
  }

  function processMartinezRueda(State storage state) public {
    if(!state.martinezRueda.subdivideSegmentsOver) {
      state.martinezRueda.subdivideSegments();
    } else if(state.martinezRueda.resultEvents.length == 0) {
      state.martinezRueda.orderEvents();
    } else {
      require(false, "Martinez Rueda already finished");
    }
    //    emit LogBentleyOttman(state.bentleyOttman.queue.tree.inserted, state.bentleyOttman.queue.tree.removed, state.bentleyOttman.output.length);
  }

  function isMartinezRuedaFinished(State storage state) public returns (bool) {
    return state.martinezRueda.subdivideSegmentsOver && state.martinezRueda.resultEvents.length != 0;
  }

  event LogPoint(string name, int256[2] latLon);
  event LogMartinezRuedaResult(uint256 eventsLength);
  event LogFailed(string reason);
  
  function addIntersectedPoints(State storage state) public {
    require(isMartinezRuedaFinished(state), "Martinez Rueda not finished");

    bytes32 newPointHash;
    bytes32 leftStartPointHash;
    bytes32 leftEndPointHash;
    bytes32 rightStartPointHash;
    bytes32 rightEndPointHash;
    SweepEvent.Item memory sweepEvent;

    emit LogMartinezRuedaResult(state.martinezRueda.resultEvents.length);
    
    for (uint j = 0; j < state.martinezRueda.resultEvents.length; j++) {
      sweepEvent = state.martinezRueda.store.sweepById[state.martinezRueda.resultEvents[j]];

      newPointHash = keccak256(abi.encode(sweepEvent.point));
      emit LogPoint("newPointHash", sweepEvent.point);
      
      if (state.basePolygon.pointByHash[newPointHash].intersectionPoint 
          || state.basePolygon.pointByHash[newPointHash].nextPoint != bytes32(0)
          || state.basePolygon.pointByHash[newPointHash].prevPoint != bytes32(0)
          || state.cropPolygon.pointByHash[newPointHash].nextPoint != bytes32(0)
          || state.cropPolygon.pointByHash[newPointHash].prevPoint != bytes32(0)) {
        continue;
      }

//      leftStartPointHash = state.martinezRueda.intersectionPointToSegments[newPointHash][0];
//      leftEndPointHash = state.martinezRueda.intersectionPointToSegments[newPointHash][1];
//      rightStartPointHash = state.martinezRueda.intersectionPointToSegments[newPointHash][2];
//      rightEndPointHash = state.martinezRueda.intersectionPointToSegments[newPointHash][3];
//
//      emit LogPoint("leftStartPointHash", state.latLonByHash[leftStartPointHash]);
//      emit LogPoint("leftEndPointHash", state.latLonByHash[leftEndPointHash]);
//      emit LogPoint("rightStartPointHash", state.latLonByHash[rightStartPointHash]);
//      emit LogPoint("rightEndPointHash", state.latLonByHash[rightEndPointHash]);

      if (addIntersectedPointsToPolygon(state, state.basePolygon, sweepEvent.point, newPointHash)) {
        if (!addIntersectedPointsToPolygon(state, state.cropPolygon, sweepEvent.point, newPointHash)) {
          emit LogFailed("Intersected point of base polygon not found in crop polygon");
          require(false, "Intersected point of base polygon not found in crop polygon");
        }
      } else {
          emit LogFailed("Segments of intersection point not found in polygons");
        require(false, "Segments of intersection point not found in polygons");
      }

//      state.processedResultPoint[newPointHash] = true;
//      emit LogPlacePointBetween(outputPoint.point, outputPoint.leftSegment[0], outputPoint.leftSegment[1]);
//      emit LogPlacePointBetween(outputPoint.point, outputPoint.rightSegment[0], outputPoint.rightSegment[1]);
    }
  }

  function addIntersectedPointsToPolygon(State storage state, Polygon storage polygon, int256[2] point, bytes32 pointHash) private returns (bool) {
    // is segment points exists in polygon

    bytes32 pointToReplace;
    bytes32 currentPoint = polygon.startPoint;
    while (true) {
      if(SegmentUtils.pointOnSegment(point, state.latLonByHash[currentPoint], state.latLonByHash[polygon.pointByHash[currentPoint].nextPoint])) {
        pointToReplace = polygon.pointByHash[currentPoint].nextPoint;

        emit LogPlacePointBetween("", point, state.latLonByHash[currentPoint], state.latLonByHash[polygon.pointByHash[currentPoint].nextPoint]);
        
        polygon.pointByHash[pointToReplace].prevPoint = pointHash;
        polygon.pointByHash[currentPoint].nextPoint = pointHash;
        polygon.pointByHash[pointHash].prevPoint = currentPoint;
        polygon.pointByHash[pointHash].nextPoint = pointToReplace;

        polygon.pointByHash[pointHash].intersectionPoint = true;
        polygon.intersectionPoints.push(pointHash);
        
        if(state.latLonByHash[pointHash][0] == 0 && state.latLonByHash[pointHash][1] == 0) {
          state.latLonByHash[pointHash] = point;
        }
        return true;
      }
      currentPoint = polygon.pointByHash[currentPoint].nextPoint;
      if (currentPoint == polygon.startPoint) {
        break;
      }
    }
    
    emit LogFailed("Found intersection point cant be placed in polygon");
    require(false, "Found intersection point cant be placed in polygon");
    
//    if (polygon.pointByHash[findStartPointHash].nextPoint != bytes32(0) || polygon.pointByHash[findEndPointHash].nextPoint != bytes32(0)) {
//      // write new point coors to polygon by hash
//      polygon.pointByHash[pointHash].intersectionPoint = true;
//      polygon.intersectionPoints.push(pointHash);
//      bytes32 pointToReplace;
//
//      emit LogPoint("polygon.pointByHash[findStartPointHash].nextPoint", state.latLonByHash[polygon.pointByHash[findStartPointHash].nextPoint]);
//      emit LogPoint("polygon.pointByHash[findStartPointHash].prevPoint", state.latLonByHash[polygon.pointByHash[findStartPointHash].prevPoint]);
//      
//      if (polygon.pointByHash[findStartPointHash].nextPoint == findEndPointHash) {
//        emit LogPlacePointBetween("1", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        // is end point hash - next of start point hash
//        // place point between findStartPointHash and findEndPointHash
//        polygon.pointByHash[findStartPointHash].nextPoint = pointHash;
//        polygon.pointByHash[findEndPointHash].prevPoint = pointHash;
//        polygon.pointByHash[pointHash].prevPoint = findStartPointHash;
//        polygon.pointByHash[pointHash].nextPoint = findEndPointHash;
//        //        emit LogPlacePointBetween(pointHash, findStartPointHash, findEndPointHash);
//      } else if (polygon.pointByHash[findStartPointHash].prevPoint == findEndPointHash) {
//        emit LogPlacePointBetween("2", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        // is start point hash - next of end point hash(vice versa)
//        // place point between findEndPointHash and findStartPointHash
//        polygon.pointByHash[findEndPointHash].nextPoint = pointHash;
//        polygon.pointByHash[findStartPointHash].prevPoint = pointHash;
//        polygon.pointByHash[pointHash].prevPoint = findEndPointHash;
//        polygon.pointByHash[pointHash].nextPoint = findStartPointHash;
//      } else if (polygon.pointByHash[polygon.pointByHash[findStartPointHash].nextPoint].intersectionPoint && 
//        SegmentUtils.pointOnSegment(point, state.latLonByHash[findStartPointHash], state.latLonByHash[polygon.pointByHash[findStartPointHash].nextPoint]))
//      {
//        emit LogPlacePointBetween("3", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        pointToReplace = polygon.pointByHash[findStartPointHash].nextPoint;
//
//        polygon.pointByHash[pointToReplace].prevPoint = pointHash;
//        polygon.pointByHash[findStartPointHash].nextPoint = pointHash;
//        polygon.pointByHash[pointHash].prevPoint = findStartPointHash;
//        polygon.pointByHash[pointHash].nextPoint = pointToReplace;
//
//      } else if (polygon.pointByHash[polygon.pointByHash[findStartPointHash].prevPoint].intersectionPoint && 
//        SegmentUtils.pointOnSegment(point, state.latLonByHash[findStartPointHash], state.latLonByHash[polygon.pointByHash[findStartPointHash].prevPoint]))
//      {
//        emit LogPlacePointBetween("4", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        pointToReplace = polygon.pointByHash[findStartPointHash].prevPoint;
//
//        polygon.pointByHash[pointToReplace].nextPoint = pointHash;
//        polygon.pointByHash[findStartPointHash].prevPoint = pointHash;
//        polygon.pointByHash[pointHash].nextPoint = findStartPointHash;
//        polygon.pointByHash[pointHash].prevPoint = pointToReplace;
//
//      } else if (polygon.pointByHash[polygon.pointByHash[findEndPointHash].nextPoint].intersectionPoint && 
//        SegmentUtils.pointOnSegment(point, state.latLonByHash[findEndPointHash], state.latLonByHash[polygon.pointByHash[findEndPointHash].nextPoint]))
//      {
//        emit LogPlacePointBetween("5", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        pointToReplace = polygon.pointByHash[findEndPointHash].nextPoint;
//
//        polygon.pointByHash[pointToReplace].prevPoint = pointHash;
//        polygon.pointByHash[findEndPointHash].nextPoint = pointHash;
//        polygon.pointByHash[pointHash].prevPoint = findStartPointHash;
//        polygon.pointByHash[pointHash].nextPoint = pointToReplace;
//
//      } else if (polygon.pointByHash[polygon.pointByHash[findEndPointHash].prevPoint].intersectionPoint && 
//        SegmentUtils.pointOnSegment(point, state.latLonByHash[findEndPointHash], state.latLonByHash[polygon.pointByHash[findEndPointHash].prevPoint]))
//      {
//        emit LogPlacePointBetween("6", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        pointToReplace = polygon.pointByHash[findEndPointHash].prevPoint;
//
//        polygon.pointByHash[pointToReplace].nextPoint = pointHash;
//        polygon.pointByHash[findEndPointHash].prevPoint = pointHash;
//        polygon.pointByHash[pointHash].nextPoint = findEndPointHash;
//        polygon.pointByHash[pointHash].prevPoint = pointToReplace;
//
//      } else {
//        emit LogFailed("Found intersection point cant be placed in polygon");
////        emit LogPlacePointBetween(point, polygon.pointByHash[polygon.pointByHash[findStartPointHash].nextPoint].latLon, polygon.pointByHash[polygon.pointByHash[findStartPointHash].prevPoint].latLon);
////        emit LogPlacePointBetween(point, polygon.pointByHash[polygon.pointByHash[findEndPointHash].nextPoint].latLon, polygon.pointByHash[polygon.pointByHash[findEndPointHash].prevPoint].latLon);
////        require(false, "Found intersection point cant be placed in polygon");
//      }
//      return true;
//    }
//    return false;
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

    for (uint j = 0; j < state.basePolygon.intersectionPoints.length; j++) {
      if (!state.basePolygon.pointByHash[curPointHash].includedInResult) {
        curPointHash = state.basePolygon.intersectionPoints[j];
        startPointHash = curPointHash;
        break;
      }
      if (state.basePolygon.intersectionPoints.length - 1 == j) {
        return false;
      }
    }

    bytes32 nextPointHash;
    Direction baseDirection;

    // find direction and next point
    //TODO: need to add OR intersection point?

    for(uint i = 0; i < state.martinezRueda.clipping.points.length; i++){
      emit LogPolygonCoors(state.martinezRueda.clipping.points[i]);
    }
    
    if (state.cropPolygon.pointByHash[state.basePolygon.pointByHash[curPointHash].nextPoint].intersectionPoint 
        || PolygonUtils.isInsideCoors(state.latLonByHash[state.basePolygon.pointByHash[curPointHash].nextPoint], state.martinezRueda.clipping)) {
      nextPointHash = state.basePolygon.pointByHash[curPointHash].nextPoint;
      baseDirection = Direction.FORWARD;
    } else if (state.cropPolygon.pointByHash[state.basePolygon.pointByHash[curPointHash].prevPoint].intersectionPoint 
        || PolygonUtils.isInsideCoors(state.latLonByHash[state.basePolygon.pointByHash[curPointHash].prevPoint], state.martinezRueda.clipping)) {
      nextPointHash = state.basePolygon.pointByHash[curPointHash].prevPoint;
      baseDirection = Direction.BACKWARD;
    } else {
//      emit LogFailed("Not found adjoining points inside crop polygon");
//      return;
      require(false, "Not found adjoining points inside crop polygon");
    }

//    PolygonUtils.CoorsPolygon memory newPolygon;
    state.resultPolygons.length++;

    PolygonUtils.CoorsPolygon storage resultPolygon = state.resultPolygons[state.resultPolygons.length - 1];

    bytes32 prevPointHash;

    // fill resultPolygon from basePolygon
    while (true) {
      if (state.basePolygon.pointByHash[curPointHash].intersectionPoint) {
        require(!state.basePolygon.pointByHash[curPointHash].includedInResult, "basePolygon intersectionPoint already included");
        state.basePolygon.handledIntersectionPoints++;
        state.basePolygon.pointByHash[curPointHash].includedInResult = true;
        emit LogIncludeIntersectionInResult("base", state.latLonByHash[curPointHash], state.basePolygon.handledIntersectionPoints);
      } else if (curPointHash == state.basePolygon.startPoint) {
        state.basePolygon.startPoint = nextPointHash;
      }

      emit LogPushToResult(state.latLonByHash[curPointHash]);
      resultPolygon.points.push(state.latLonByHash[curPointHash]);

      if (state.basePolygon.pointByHash[curPointHash].intersectionPoint && curPointHash != startPointHash) {
        break;
      }

      prevPointHash = curPointHash;

      if (baseDirection == Direction.FORWARD) {
        curPointHash = state.basePolygon.pointByHash[curPointHash].nextPoint;
        nextPointHash = state.basePolygon.pointByHash[curPointHash].nextPoint;
      } else {
        curPointHash = state.basePolygon.pointByHash[curPointHash].prevPoint;
        nextPointHash = state.basePolygon.pointByHash[curPointHash].prevPoint;
      }
    }

    if (state.cropPolygon.pointByHash[curPointHash].nextPoint == bytes32(0)) {
      require(false, "Intersection point not found in crop polygon");
    }

    Direction cropDirection;
    
    emit LogPoint("prevPointHash", state.latLonByHash[prevPointHash]);
    emit LogPoint("curPointHash", state.latLonByHash[curPointHash]);
    emit LogInsideCoors(state.latLonByHash[state.cropPolygon.pointByHash[curPointHash].nextPoint], state.basePolygon.pointByHash[state.cropPolygon.pointByHash[curPointHash].nextPoint].intersectionPoint);
    emit LogInsideCoors(state.latLonByHash[state.cropPolygon.pointByHash[curPointHash].prevPoint], state.basePolygon.pointByHash[state.cropPolygon.pointByHash[curPointHash].prevPoint].intersectionPoint);
    
    for(uint i = 0; i < state.martinezRueda.subject.points.length; i++){
      emit LogPolygonCoors(state.martinezRueda.subject.points[i]);
    }
    
    // find direction and next point
    //TODO: need to add OR intersection point?
    if (state.cropPolygon.pointByHash[curPointHash].nextPoint != prevPointHash//!state.basePolygon.pointByHash[state.cropPolygon.pointByHash[curPointHash].nextPoint].includedInResult && 
        && (state.basePolygon.pointByHash[state.cropPolygon.pointByHash[curPointHash].nextPoint].intersectionPoint || PolygonUtils.isInsideCoors(state.latLonByHash[state.cropPolygon.pointByHash[curPointHash].nextPoint], state.martinezRueda.subject))) {
      nextPointHash = state.cropPolygon.pointByHash[curPointHash].nextPoint;
      cropDirection = Direction.FORWARD;
    } else if (state.cropPolygon.pointByHash[curPointHash].prevPoint != prevPointHash//!state.basePolygon.pointByHash[state.cropPolygon.pointByHash[curPointHash].prevPoint].includedInResult && 
        && (state.basePolygon.pointByHash[state.cropPolygon.pointByHash[curPointHash].prevPoint].intersectionPoint || PolygonUtils.isInsideCoors(state.latLonByHash[state.cropPolygon.pointByHash[curPointHash].prevPoint], state.martinezRueda.subject))) {
      nextPointHash = state.cropPolygon.pointByHash[curPointHash].prevPoint;
      cropDirection = Direction.BACKWARD;
    } else {
      emit LogFailed("Not found valid next point in crop polygon");
      return;
      require(false, "Not found valid next point in crop polygon");
    }

    // fill resultPolygon from cropPolygon and change basePolygon to be cropped
    while (true) {
      if (baseDirection == Direction.FORWARD) {
        state.basePolygon.pointByHash[curPointHash].prevPoint = nextPointHash;
        state.basePolygon.pointByHash[nextPointHash].nextPoint = curPointHash;
      } else {
        state.basePolygon.pointByHash[curPointHash].nextPoint = nextPointHash;
        state.basePolygon.pointByHash[nextPointHash].prevPoint = curPointHash;
      }

      if (state.cropPolygon.pointByHash[curPointHash].intersectionPoint) {
        state.cropPolygon.handledIntersectionPoints++;
        require(!state.cropPolygon.pointByHash[curPointHash].includedInResult, "cropPolygon current intersectionPoint already included");
        state.cropPolygon.pointByHash[curPointHash].includedInResult = true;
        emit LogIncludeIntersectionInResult("crop cur", state.latLonByHash[curPointHash], state.cropPolygon.handledIntersectionPoints);
      }

      if (state.cropPolygon.pointByHash[nextPointHash].intersectionPoint) {
        if (PointUtils.isEqual(state.latLonByHash[nextPointHash], resultPolygon.points[0])) {
          state.cropPolygon.handledIntersectionPoints++;
          require(!state.cropPolygon.pointByHash[nextPointHash].includedInResult, "cropPolygon next intersectionPoint already included");
          state.cropPolygon.pointByHash[nextPointHash].includedInResult = true;
          emit LogIncludeIntersectionInResult("crop next", state.latLonByHash[nextPointHash], state.cropPolygon.handledIntersectionPoints);
          //successful finish
          return true;
        } else {
          require(false, "End point of result polygon not equals to start point");
        }
      }
      emit LogSetNextPoint(state.latLonByHash[curPointHash], state.cropPolygon.pointByHash[curPointHash].intersectionPoint, state.latLonByHash[nextPointHash]);

      emit LogPushToResult(state.latLonByHash[nextPointHash]);
      resultPolygon.points.push(state.latLonByHash[nextPointHash]);

      curPointHash = nextPointHash;

      if (cropDirection == Direction.FORWARD) {
        nextPointHash = state.cropPolygon.pointByHash[curPointHash].nextPoint;
      } else {
        nextPointHash = state.cropPolygon.pointByHash[curPointHash].prevPoint;
      }
    }
  }
  
//  function pointHashCanBeAddToPolygon(State storage state, bytes32 prevPointHash, bytes32 actualPointHash, Polygon storage prevPolygon, Polygon storage actualPolygon, PolygonUtils.CoorsPolygon storage prevLatLonPolygon) private returns(bool) {
//    return !prevPolygon.pointByHash[actualPointHash].includedInResult && actualPointHash != prevPointHash
//        && (prevPolygon.pointByHash[actualPointHash].intersectionPoint || PolygonUtils.isInsideCoors(state.latLonByHash[actualPointHash], prevLatLonPolygon));
//  }

  function buildBasePolygonOutput(State storage state) public returns (bool) {
    require(state.basePolygonOutput.points.length == 0, "basePolygonOutput already build");
    require(state.basePolygon.handledIntersectionPoints == state.basePolygon.intersectionPoints.length, "Not all basePolygon intersectionPoints handled");
    require(state.cropPolygon.handledIntersectionPoints == state.cropPolygon.intersectionPoints.length, "Not all cropPolygon intersectionPoints handled");

    bytes32 currentPoint = state.basePolygon.startPoint;
    while (true) {
      emit LogPushToResult(state.latLonByHash[currentPoint]);
      state.basePolygonOutput.points.push(state.latLonByHash[currentPoint]);
      currentPoint = state.basePolygon.pointByHash[currentPoint].nextPoint;
      if (currentPoint == state.basePolygon.startPoint) {
        break;
      }
    }
  }
}
