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
    mapping(bytes32 => Point) polygonPointByHash;
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
        polygon.polygonPointByHash[prevPointHash].nextPoint = pointHash;
        polygon.polygonPointByHash[pointHash].prevPoint = prevPointHash;
        //        emit LogAddPoint(polygon.polygonPointByHash[prevPointHash].latLon, prevPointHash, polygon.polygonPointByHash[prevPointHash].nextPoint);
      }
      prevPointHash = pointHash;
    }

    polygon.polygonPointByHash[pointHash].nextPoint = polygon.startPoint;
    polygon.polygonPointByHash[polygon.startPoint].prevPoint = pointHash;
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
      
      if (state.basePolygon.polygonPointByHash[newPointHash].intersectionPoint) {
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
//          require(false, "Intersected point of base polygon not found in crop polygon");
        }
      } else {
          emit LogFailed("Segments of intersection point not found in polygons");
//        require(false, "Segments of intersection point not found in polygons");
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
      if(SegmentUtils.pointOnSegment(point, state.latLonByHash[currentPoint], state.latLonByHash[polygon.polygonPointByHash[currentPoint].nextPoint])) {
        pointToReplace = polygon.polygonPointByHash[currentPoint].nextPoint;

        emit LogPlacePointBetween("", point, state.latLonByHash[currentPoint], state.latLonByHash[polygon.polygonPointByHash[currentPoint].nextPoint]);
        
        polygon.polygonPointByHash[pointToReplace].prevPoint = pointHash;
        polygon.polygonPointByHash[currentPoint].nextPoint = pointHash;
        polygon.polygonPointByHash[pointHash].prevPoint = currentPoint;
        polygon.polygonPointByHash[pointHash].nextPoint = pointToReplace;

        polygon.polygonPointByHash[pointHash].intersectionPoint = true;
        polygon.intersectionPoints.push(pointHash);
        return true;
      }
      currentPoint = polygon.polygonPointByHash[currentPoint].nextPoint;
      if (currentPoint == polygon.startPoint) {
        break;
      }
    }
    
    emit LogFailed("Found intersection point cant be placed in polygon");
    require(false, "Found intersection point cant be placed in polygon");
    
//    if (polygon.polygonPointByHash[findStartPointHash].nextPoint != bytes32(0) || polygon.polygonPointByHash[findEndPointHash].nextPoint != bytes32(0)) {
//      // write new point coors to polygon by hash
//      polygon.polygonPointByHash[pointHash].intersectionPoint = true;
//      polygon.intersectionPoints.push(pointHash);
//      bytes32 pointToReplace;
//
//      emit LogPoint("polygon.polygonPointByHash[findStartPointHash].nextPoint", state.latLonByHash[polygon.polygonPointByHash[findStartPointHash].nextPoint]);
//      emit LogPoint("polygon.polygonPointByHash[findStartPointHash].prevPoint", state.latLonByHash[polygon.polygonPointByHash[findStartPointHash].prevPoint]);
//      
//      if (polygon.polygonPointByHash[findStartPointHash].nextPoint == findEndPointHash) {
//        emit LogPlacePointBetween("1", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        // is end point hash - next of start point hash
//        // place point between findStartPointHash and findEndPointHash
//        polygon.polygonPointByHash[findStartPointHash].nextPoint = pointHash;
//        polygon.polygonPointByHash[findEndPointHash].prevPoint = pointHash;
//        polygon.polygonPointByHash[pointHash].prevPoint = findStartPointHash;
//        polygon.polygonPointByHash[pointHash].nextPoint = findEndPointHash;
//        //        emit LogPlacePointBetween(pointHash, findStartPointHash, findEndPointHash);
//      } else if (polygon.polygonPointByHash[findStartPointHash].prevPoint == findEndPointHash) {
//        emit LogPlacePointBetween("2", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        // is start point hash - next of end point hash(vice versa)
//        // place point between findEndPointHash and findStartPointHash
//        polygon.polygonPointByHash[findEndPointHash].nextPoint = pointHash;
//        polygon.polygonPointByHash[findStartPointHash].prevPoint = pointHash;
//        polygon.polygonPointByHash[pointHash].prevPoint = findEndPointHash;
//        polygon.polygonPointByHash[pointHash].nextPoint = findStartPointHash;
//      } else if (polygon.polygonPointByHash[polygon.polygonPointByHash[findStartPointHash].nextPoint].intersectionPoint && 
//        SegmentUtils.pointOnSegment(point, state.latLonByHash[findStartPointHash], state.latLonByHash[polygon.polygonPointByHash[findStartPointHash].nextPoint]))
//      {
//        emit LogPlacePointBetween("3", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        pointToReplace = polygon.polygonPointByHash[findStartPointHash].nextPoint;
//
//        polygon.polygonPointByHash[pointToReplace].prevPoint = pointHash;
//        polygon.polygonPointByHash[findStartPointHash].nextPoint = pointHash;
//        polygon.polygonPointByHash[pointHash].prevPoint = findStartPointHash;
//        polygon.polygonPointByHash[pointHash].nextPoint = pointToReplace;
//
//      } else if (polygon.polygonPointByHash[polygon.polygonPointByHash[findStartPointHash].prevPoint].intersectionPoint && 
//        SegmentUtils.pointOnSegment(point, state.latLonByHash[findStartPointHash], state.latLonByHash[polygon.polygonPointByHash[findStartPointHash].prevPoint]))
//      {
//        emit LogPlacePointBetween("4", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        pointToReplace = polygon.polygonPointByHash[findStartPointHash].prevPoint;
//
//        polygon.polygonPointByHash[pointToReplace].nextPoint = pointHash;
//        polygon.polygonPointByHash[findStartPointHash].prevPoint = pointHash;
//        polygon.polygonPointByHash[pointHash].nextPoint = findStartPointHash;
//        polygon.polygonPointByHash[pointHash].prevPoint = pointToReplace;
//
//      } else if (polygon.polygonPointByHash[polygon.polygonPointByHash[findEndPointHash].nextPoint].intersectionPoint && 
//        SegmentUtils.pointOnSegment(point, state.latLonByHash[findEndPointHash], state.latLonByHash[polygon.polygonPointByHash[findEndPointHash].nextPoint]))
//      {
//        emit LogPlacePointBetween("5", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        pointToReplace = polygon.polygonPointByHash[findEndPointHash].nextPoint;
//
//        polygon.polygonPointByHash[pointToReplace].prevPoint = pointHash;
//        polygon.polygonPointByHash[findEndPointHash].nextPoint = pointHash;
//        polygon.polygonPointByHash[pointHash].prevPoint = findStartPointHash;
//        polygon.polygonPointByHash[pointHash].nextPoint = pointToReplace;
//
//      } else if (polygon.polygonPointByHash[polygon.polygonPointByHash[findEndPointHash].prevPoint].intersectionPoint && 
//        SegmentUtils.pointOnSegment(point, state.latLonByHash[findEndPointHash], state.latLonByHash[polygon.polygonPointByHash[findEndPointHash].prevPoint]))
//      {
//        emit LogPlacePointBetween("6", point, state.latLonByHash[findStartPointHash], state.latLonByHash[findEndPointHash]);
//        pointToReplace = polygon.polygonPointByHash[findEndPointHash].prevPoint;
//
//        polygon.polygonPointByHash[pointToReplace].nextPoint = pointHash;
//        polygon.polygonPointByHash[findEndPointHash].prevPoint = pointHash;
//        polygon.polygonPointByHash[pointHash].nextPoint = findEndPointHash;
//        polygon.polygonPointByHash[pointHash].prevPoint = pointToReplace;
//
//      } else {
//        emit LogFailed("Found intersection point cant be placed in polygon");
////        emit LogPlacePointBetween(point, polygon.polygonPointByHash[polygon.polygonPointByHash[findStartPointHash].nextPoint].latLon, polygon.polygonPointByHash[polygon.polygonPointByHash[findStartPointHash].prevPoint].latLon);
////        emit LogPlacePointBetween(point, polygon.polygonPointByHash[polygon.polygonPointByHash[findEndPointHash].nextPoint].latLon, polygon.polygonPointByHash[polygon.polygonPointByHash[findEndPointHash].prevPoint].latLon);
////        require(false, "Found intersection point cant be placed in polygon");
//      }
//      return true;
//    }
//    return false;
  }

  function buildResultPolygon(State storage state) public returns (bool) {
    bytes32 curPointHash;
    bytes32 startPointHash;

    for (uint j = 0; j < state.basePolygon.intersectionPoints.length; j++) {
      if (!state.basePolygon.polygonPointByHash[curPointHash].includedInResult) {
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
    if (PolygonUtils.isInsideCoors(state.latLonByHash[state.basePolygon.polygonPointByHash[curPointHash].nextPoint], state.martinezRueda.clipping)) {
      nextPointHash = state.basePolygon.polygonPointByHash[curPointHash].nextPoint;
      baseDirection = Direction.FORWARD;
    } else if (PolygonUtils.isInsideCoors(state.latLonByHash[state.basePolygon.polygonPointByHash[curPointHash].prevPoint], state.martinezRueda.clipping)) {
      nextPointHash = state.basePolygon.polygonPointByHash[curPointHash].prevPoint;
      baseDirection = Direction.BACKWARD;
    } else {
      require(false, "Not found adjoining points inside crop polygon");
    }

    PolygonUtils.CoorsPolygon memory newPolygon;
    state.resultPolygons.push(newPolygon);

    PolygonUtils.CoorsPolygon storage resultPolygon = state.resultPolygons[state.resultPolygons.length - 1];

    bytes32 prevPointHash;

    // fill resultPolygon from basePolygon
    while (true) {
      if (state.basePolygon.polygonPointByHash[curPointHash].intersectionPoint) {
        require(!state.basePolygon.polygonPointByHash[curPointHash].includedInResult, "basePolygon intersectionPoint already included");
        state.basePolygon.handledIntersectionPoints++;
        state.basePolygon.polygonPointByHash[curPointHash].includedInResult = true;
        emit LogIncludeIntersectionInResult("base", state.latLonByHash[curPointHash], state.basePolygon.handledIntersectionPoints);
      } else if (curPointHash == state.basePolygon.startPoint) {
        state.basePolygon.startPoint = nextPointHash;
      }

      emit LogPushToResult(state.latLonByHash[curPointHash]);
      resultPolygon.points.push(state.latLonByHash[curPointHash]);

      if (state.basePolygon.polygonPointByHash[curPointHash].intersectionPoint && curPointHash != startPointHash) {
        break;
      }

      prevPointHash = curPointHash;

      if (baseDirection == Direction.FORWARD) {
        curPointHash = state.basePolygon.polygonPointByHash[curPointHash].nextPoint;
        nextPointHash = state.basePolygon.polygonPointByHash[curPointHash].nextPoint;
      } else {
        curPointHash = state.basePolygon.polygonPointByHash[curPointHash].prevPoint;
        nextPointHash = state.basePolygon.polygonPointByHash[curPointHash].prevPoint;
      }
    }

    if (state.cropPolygon.polygonPointByHash[curPointHash].nextPoint == bytes32(0)) {
      require(false, "Intersection point not found in crop polygon");
    }

    Direction cropDirection;

    // find direction and next point
    //TODO: need to add OR intersection point?
    if (PolygonUtils.isInsideCoors(state.latLonByHash[state.cropPolygon.polygonPointByHash[curPointHash].nextPoint], state.martinezRueda.subject) && state.cropPolygon.polygonPointByHash[curPointHash].nextPoint != prevPointHash) {
      nextPointHash = state.cropPolygon.polygonPointByHash[curPointHash].nextPoint;
      cropDirection = Direction.FORWARD;
    } else if (PolygonUtils.isInsideCoors(state.latLonByHash[state.cropPolygon.polygonPointByHash[curPointHash].prevPoint], state.martinezRueda.subject) && state.cropPolygon.polygonPointByHash[curPointHash].prevPoint != prevPointHash) {
      nextPointHash = state.cropPolygon.polygonPointByHash[curPointHash].prevPoint;
      cropDirection = Direction.BACKWARD;
    } else {
      require(false, "Not found valid next point in crop polygon");
    }

    // fill resultPolygon from cropPolygon and change basePolygon to be cropped
    while (true) {
      if (baseDirection == Direction.FORWARD) {
        state.basePolygon.polygonPointByHash[curPointHash].prevPoint = nextPointHash;
        state.basePolygon.polygonPointByHash[nextPointHash].nextPoint = curPointHash;
      } else {
        state.basePolygon.polygonPointByHash[curPointHash].nextPoint = nextPointHash;
        state.basePolygon.polygonPointByHash[nextPointHash].prevPoint = curPointHash;
      }

      if (state.cropPolygon.polygonPointByHash[curPointHash].intersectionPoint) {
        state.cropPolygon.handledIntersectionPoints++;
        require(!state.cropPolygon.polygonPointByHash[curPointHash].includedInResult, "cropPolygon current intersectionPoint already included");
        state.cropPolygon.polygonPointByHash[curPointHash].includedInResult = true;
        emit LogIncludeIntersectionInResult("crop cur", state.latLonByHash[curPointHash], state.cropPolygon.handledIntersectionPoints);
      }

      if (state.cropPolygon.polygonPointByHash[nextPointHash].intersectionPoint) {
        if (PointUtils.isEqual(state.latLonByHash[nextPointHash], resultPolygon.points[0])) {
          state.cropPolygon.handledIntersectionPoints++;
          require(!state.cropPolygon.polygonPointByHash[nextPointHash].includedInResult, "cropPolygon next intersectionPoint already included");
          state.cropPolygon.polygonPointByHash[nextPointHash].includedInResult = true;
          emit LogIncludeIntersectionInResult("crop next", state.latLonByHash[nextPointHash], state.cropPolygon.handledIntersectionPoints);
          //successful finish
          return true;
        } else {
          require(false, "End point of result polygon not equals to start point");
        }
      }
      emit LogSetNextPoint(state.latLonByHash[curPointHash], state.cropPolygon.polygonPointByHash[curPointHash].intersectionPoint, state.latLonByHash[nextPointHash]);

      emit LogPushToResult(state.latLonByHash[nextPointHash]);
      resultPolygon.points.push(state.latLonByHash[nextPointHash]);

      curPointHash = nextPointHash;

      if (cropDirection == Direction.FORWARD) {
        nextPointHash = state.cropPolygon.polygonPointByHash[curPointHash].nextPoint;
      } else {
        nextPointHash = state.cropPolygon.polygonPointByHash[curPointHash].prevPoint;
      }
    }
  }

  function buildBasePolygonOutput(State storage state) public returns (bool) {
    require(state.basePolygonOutput.points.length == 0, "basePolygonOutput already build");
    require(state.basePolygon.handledIntersectionPoints == state.basePolygon.intersectionPoints.length, "Not all basePolygon intersectionPoints handled");
    require(state.cropPolygon.handledIntersectionPoints == state.cropPolygon.intersectionPoints.length, "Not all cropPolygon intersectionPoints handled");

    bytes32 currentPoint = state.basePolygon.startPoint;
    while (true) {
      emit LogPushToResult(state.latLonByHash[currentPoint]);
      state.basePolygonOutput.points.push(state.latLonByHash[currentPoint]);
      currentPoint = state.basePolygon.polygonPointByHash[currentPoint].nextPoint;
      if (currentPoint == state.basePolygon.startPoint) {
        break;
      }
    }
  }
}
