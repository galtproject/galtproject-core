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
//import "./MathUtils.sol";
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
  
  struct Input {
    int256[2][] points;
  }
  
  //TODO: check for only unique points
  struct Point {
    bytes32 nextPoint;
    int256[2] coors;
  }
  
  struct Polygon {
    mapping(bytes32 => Point) pointsByHash;
    bytes32 startPoint;
    bytes32 currentPointForAddSegment;
  }

  struct State {
    Polygon basePolygon;
    Polygon cropPolygon;
    BentleyOttman.State bentleyOttman;
  }
  
  function init(State storage state) {
    state.bentleyOttman.init();
  }

  function initAllPolygons(State storage state, Input storage basePolygonInput, Input storage cropPolygonInput) public {
    initPolygon(basePolygonInput, state.basePolygon);
    initPolygon(cropPolygonInput, state.cropPolygon);
  }
  
  function initPolygon(State storage state, Input storage input, Polygon storage polygon) public {
    bytes32 pointHash;
    bytes32 prevPointHash;
    
    for (uint j = 0; j < input.points.length; j++) {
      pointHash = keccak256(abi.encode(input.points[j]));
      polygon.pointsByHash[pointHash].coors = input.points[j];
      if (j == 0) {
        polygon.startPoint = pointHash;
      } else {
        polygon.pointsByHash[prevPointHash].nextPoint = pointHash;
      }
      prevPointHash = pointHash;
    }
  }

  function addPolygonSegments(State storage state, Polygon storage polygon) public {
    bytes32 currentPoint;
    if(polygon.currentPointForAddSegment == bytes32(0)) {
      currentPoint = polygon.startPoint;
    } else {
      currentPoint = polygon.currentPointForAddSegment;
    } 
    
    while (polygon.pointsByHash[currentPoint].nextPoint != bytes32(0)) {
      state.bentleyOttman.addSegment([polygon.pointsByHash[currentPoint].coors, polygon.pointsByHash[polygon.pointsByHash[currentPoint].nextPoint].coors]);
      currentPoint = polygon.pointsByHash[polygon.pointsByHash[currentPoint].nextPoint].nextPoint;
    }
  }
}
