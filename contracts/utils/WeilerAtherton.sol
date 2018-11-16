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

import "./BentleyOttman.sol";
import "./PolygonUtils.sol";
//import "./SegmentUtils.sol";
//import "./VectorUtils.sol";

library WeilerAtherton {
  using BentleyOttman for BentleyOttman.State;

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
    int256[2] coors;
    bool intersectionPoint;
    bool includedInResult;
  }
  
  struct Polygon {
    mapping(bytes32 => Point) pointsByHash;
    bytes32 startPoint;
    bytes32 currentPointForAddSegment;
    bytes32[] intersectionPoints;
    uint256 handledIntersectionPoints;
  }

  struct State {
    PolygonUtils.CoorsPolygon basePolygonInput;
    PolygonUtils.CoorsPolygon cropPolygonInput;
    Polygon basePolygon;
    Polygon cropPolygon;
    BentleyOttman.State bentleyOttman;
    PolygonUtils.CoorsPolygon[] resultPolygons;
  }

  event LogBentleyOttman(uint256 queueInserted, uint256 queueRemoved, uint256 outputLength);
  event LogAddPoint(int256[2] point, bytes32 pointHash, bytes32 nextPointHash);
  event LogAddSegment(int256[2][2] segment);
  event LogPlacePointBetween(int256[2] placePoint, int256[2] startPoint, int256[2] endPoint);
  event LogPushToResult(int256[2] point);
  
  function init(State storage state) public {
    state.bentleyOttman.init();
  }

  function initAllPolygons(State storage state) public {
    initPolygon(state, state.basePolygonInput, state.basePolygon);
    initPolygon(state, state.cropPolygonInput, state.cropPolygon);
  }
  
  function initPolygon(State storage state, PolygonUtils.CoorsPolygon storage input, Polygon storage polygon) public {
    bytes32 pointHash;
    bytes32 prevPointHash;
    
    for (uint j = 0; j < input.points.length; j++) {
      pointHash = keccak256(abi.encode(input.points[j]));
      polygon.pointsByHash[pointHash].coors = input.points[j];
      if (j == 0) {
        polygon.startPoint = pointHash;
      } else {
        polygon.pointsByHash[prevPointHash].nextPoint = pointHash;
        polygon.pointsByHash[pointHash].prevPoint = prevPointHash;
        emit LogAddPoint(polygon.pointsByHash[prevPointHash].coors, prevPointHash, polygon.pointsByHash[prevPointHash].nextPoint);
      }
      prevPointHash = pointHash;
    }
    
    polygon.pointsByHash[pointHash].nextPoint = polygon.startPoint;
    polygon.pointsByHash[polygon.startPoint].prevPoint = pointHash;
  }

  function addPolygonSegments(State storage state, Polygon storage polygon) public {
    bytes32 currentPoint;
    if(polygon.currentPointForAddSegment == bytes32(0)) {
      currentPoint = polygon.startPoint;
    } else {
      currentPoint = polygon.currentPointForAddSegment;
    } 
    
    //TODO: find max possible iterations count and break on it
    while (true) {
      state.bentleyOttman.addSegment([polygon.pointsByHash[currentPoint].coors, polygon.pointsByHash[polygon.pointsByHash[currentPoint].nextPoint].coors]);
      currentPoint = polygon.pointsByHash[currentPoint].nextPoint;
      emit LogAddSegment([polygon.pointsByHash[currentPoint].coors, polygon.pointsByHash[polygon.pointsByHash[currentPoint].nextPoint].coors]);
      if(currentPoint == polygon.startPoint) {
        break;
      }
    }
  }
  
  function processBentleyOttman(State storage state) public {
    state.bentleyOttman.handleQueuePoints();
    emit LogBentleyOttman(state.bentleyOttman.queue.tree.inserted, state.bentleyOttman.queue.tree.removed, state.bentleyOttman.output.length);
  }

  function isBentleyOttmanFinished(State storage state) public returns(bool) {
    return state.bentleyOttman.queue.tree.inserted == state.bentleyOttman.queue.tree.removed;
  }
  
  function addIntersectedPoints(State storage state) public {
    for (uint j = 0; j < state.bentleyOttman.output.length; j++) {
      BentleyOttman.OutputPoint memory outputPoint = state.bentleyOttman.output[j];
      bytes32 newPointHash = keccak256(abi.encode(outputPoint.point));
      bytes32 findStartPointHash = keccak256(abi.encode(outputPoint.leftSegment[0]));
      bytes32 findEndPointHash = keccak256(abi.encode(outputPoint.leftSegment[1]));
      
      emit LogPlacePointBetween(outputPoint.point, outputPoint.leftSegment[0], outputPoint.leftSegment[1]);
      //LogPlacePointBetween(placePoint: 1203772639856000000,104509898666292000000, startPoint: 1203600978479000000,104531994033605000000, endPoint: 1203772639856000000,104509898666292000000)
      //LogPlacePointBetween(placePoint: 1215271437541000000,104522552657872000000, startPoint: 1212697019801000000,104542980026454000000, endPoint: 1215271437541000000,104522552657872000000)
      bool added = addIntersectedPointsToPolygon(state.basePolygon, outputPoint.point, newPointHash, findStartPointHash, findEndPointHash);
      if(!added) {
        added = addIntersectedPointsToPolygon(state.cropPolygon, outputPoint.point, newPointHash, findStartPointHash, findEndPointHash);
      }
      if(!added) {
        require(false, "Segments of intersection point not found in polygons");
      }
    }
  }
  
  function addIntersectedPointsToPolygon(Polygon storage polygon, int256[2] point, bytes32 pointHash, bytes32 findStartPointHash, bytes32 findEndPointHash) private returns(bool) {
    // is segment points exists in polygon
    if(polygon.pointsByHash[findStartPointHash].nextPoint != bytes32(0) || polygon.pointsByHash[findEndPointHash].nextPoint != bytes32(0)) {
      // write new point coors to polygon by hash
      polygon.pointsByHash[pointHash].coors = point;
      polygon.pointsByHash[pointHash].intersectionPoint = true;
      polygon.intersectionPoints.push(pointHash);

      if(polygon.pointsByHash[findStartPointHash].nextPoint == findEndPointHash) {
        // is end point hash - next of start point hash
        // place point between findStartPointHash and findEndPointHash
        polygon.pointsByHash[findStartPointHash].nextPoint = pointHash;
        polygon.pointsByHash[findEndPointHash].prevPoint = pointHash;
        polygon.pointsByHash[pointHash].prevPoint = findStartPointHash;
        polygon.pointsByHash[pointHash].nextPoint = findEndPointHash;
//        emit LogPlacePointBetween(pointHash, findStartPointHash, findEndPointHash);
      } else if(polygon.pointsByHash[findStartPointHash].prevPoint == findEndPointHash) {
        // is start point hash - next of end point hash(vice versa)
        // place point between findEndPointHash and findStartPointHash
        polygon.pointsByHash[findEndPointHash].nextPoint = pointHash;
        polygon.pointsByHash[findStartPointHash].prevPoint = pointHash;
        polygon.pointsByHash[pointHash].prevPoint = findEndPointHash;
        polygon.pointsByHash[pointHash].nextPoint = findStartPointHash;
//        emit LogPlacePointBetween(pointHash, findEndPointHash, findStartPointHash);
      } else {
        require(false, "Found intersection point cant be placed in polygon");
      }
      return true;
    }
    return false;
  }
  
  function buildResultPolygon(State storage state) public returns(bool) {
    bytes32 curPointHash;
    bytes32 startPointHash;
    
    for (uint j = 0; j < state.basePolygon.intersectionPoints.length; j++) {
      if(!state.basePolygon.pointsByHash[curPointHash].includedInResult) {
        curPointHash = state.basePolygon.intersectionPoints[j];
        startPointHash = curPointHash;
        break;
      }
      if(state.basePolygon.intersectionPoints.length - 1 == j) {
        return false;
      }
    }
    
    bytes32 nextPointHash;
    Direction direction;
    
    // find direction and next point
    if(PolygonUtils.isInsideCoors(state.basePolygon.pointsByHash[state.basePolygon.pointsByHash[curPointHash].nextPoint].coors, state.cropPolygonInput)) {
      nextPointHash = state.basePolygon.pointsByHash[curPointHash].nextPoint;
      direction = Direction.FORWARD;
    } else if(PolygonUtils.isInsideCoors(state.basePolygon.pointsByHash[state.basePolygon.pointsByHash[curPointHash].prevPoint].coors, state.cropPolygonInput)) {
      nextPointHash = state.basePolygon.pointsByHash[curPointHash].prevPoint;
      direction = Direction.BACKWARD;
    } else {
      return;
//      require(false, "Not found adjoining points inside crop polygon");
    }

    PolygonUtils.CoorsPolygon memory newPolygon;
    state.resultPolygons.push(newPolygon);
    
    PolygonUtils.CoorsPolygon storage resultPolygon = state.resultPolygons[state.resultPolygons.length - 1];
    
    bytes32 prevPointHash;
    
    // fill resultPolygon from basePolygon
    while(true) {
      if(state.basePolygon.pointsByHash[curPointHash].intersectionPoint) {
        state.basePolygon.handledIntersectionPoints++;
      } else if(curPointHash == state.basePolygon.startPoint) {
        state.basePolygon.startPoint = nextPointHash;
      }

      emit LogPushToResult(state.basePolygon.pointsByHash[curPointHash].coors);
      resultPolygon.points.push(state.basePolygon.pointsByHash[curPointHash].coors);
      
      if(state.basePolygon.pointsByHash[curPointHash].intersectionPoint && curPointHash != startPointHash) {
        break;
      }
      
      prevPointHash = curPointHash;
      
      if(direction == Direction.FORWARD) {
        curPointHash = state.basePolygon.pointsByHash[curPointHash].nextPoint;
        nextPointHash = state.basePolygon.pointsByHash[curPointHash].nextPoint;
      } else {
        curPointHash = state.basePolygon.pointsByHash[curPointHash].prevPoint;
        nextPointHash = state.basePolygon.pointsByHash[curPointHash].prevPoint;
      }
    }
    
    if(state.cropPolygon.pointsByHash[curPointHash].nextPoint == bytes32(0)) {
      require(false, "Intersection point not found in crop polygon");
    }

    // find direction and next point
    if(PolygonUtils.isInsideCoors(state.cropPolygon.pointsByHash[state.cropPolygon.pointsByHash[curPointHash].nextPoint].coors, state.basePolygonInput) && state.cropPolygon.pointsByHash[curPointHash].nextPoint != prevPointHash) {
      curPointHash = state.cropPolygon.pointsByHash[curPointHash].nextPoint;
      direction = Direction.FORWARD;
    } else if(PolygonUtils.isInsideCoors(state.cropPolygon.pointsByHash[state.cropPolygon.pointsByHash[curPointHash].prevPoint].coors, state.basePolygonInput) && state.cropPolygon.pointsByHash[curPointHash].prevPoint != prevPointHash) {
      curPointHash = state.cropPolygon.pointsByHash[curPointHash].prevPoint;
      direction = Direction.BACKWARD;
    } else {
      require(false, "Not found valid next point in crop polygon");
    }

    // fill resultPolygon from cropPolygon
    while(true) {
      if(state.cropPolygon.pointsByHash[curPointHash].intersectionPoint) {
        state.cropPolygon.handledIntersectionPoints++;
      }

      emit LogPushToResult(state.cropPolygon.pointsByHash[curPointHash].coors);
      resultPolygon.points.push(state.cropPolygon.pointsByHash[curPointHash].coors);

      if(state.cropPolygon.pointsByHash[curPointHash].intersectionPoint) {
        break;
      }

      if(direction == Direction.FORWARD) {
        curPointHash = state.cropPolygon.pointsByHash[curPointHash].nextPoint;
        nextPointHash = state.cropPolygon.pointsByHash[curPointHash].nextPoint;
      } else {
        curPointHash = state.cropPolygon.pointsByHash[curPointHash].prevPoint;
        nextPointHash = state.cropPolygon.pointsByHash[curPointHash].prevPoint;
      }
    }
    
  }
}
