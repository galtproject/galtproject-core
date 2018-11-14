pragma solidity 0.4.24;
pragma experimental "v0.5.0";
//pragma experimental ABIEncoderV2;

import "../utils/WeilerAtherton.sol";

contract MockWeilerAtherton {
  using WeilerAtherton for WeilerAtherton.State;

  WeilerAtherton.State private weilerAtherton;
  WeilerAtherton.Input private basePolygon;
  WeilerAtherton.Input private cropPolygon;
  
  constructor() public {
    bentleyOttman.init();
  }
  
  function addPointToBasePolygon(int256[2] point) public {
    basePolygon.points.push(value);
  }

  function addPointToCropPolygon(int256[2] point) public {
    cropPolygon.points.push(value);
  }
  
  function initBasePolygon() public {
    weilerAtherton.initPolygon(basePolygon);
  }

  function initCropPolygon() public {
    weilerAtherton.initPolygon(cropPolygon);
  }

  function addBasePolygonSegments() public {
    weilerAtherton.addPolygonSegments(weilerAtherton.basePolygon);
  }

  function addCropPolygonSegments() public {
    weilerAtherton.addPolygonSegments(weilerAtherton.cropPolygon);
  }
}
