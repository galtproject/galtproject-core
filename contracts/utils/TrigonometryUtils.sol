pragma solidity ^0.4.24;
pragma experimental "v0.5.0";

library TrigonometryUtils {
  uint16 constant ANGLES_COUNT = 16384;
  uint16 constant HIGH_MASK = 8192;
  uint16 constant LOW_MASK = 4096;
  uint constant SIN_MASK_SIZE = 16;
  
  uint constant WIDTH = 4;
  uint constant INTERP_WIDTH = 8;
  uint constant OFFSET = 12 - WIDTH;
  uint constant INTERP_OFFSET = OFFSET - INTERP_WIDTH;

  bytes constant SIN_MASK = "\x00\x00\x0c\x8c\x18\xf9\x25\x28\x30\xfb\x3c\x56\x47\x1c\x51\x33\x5a\x82\x62\xf1\x6a\x6d\x70\xe2\x76\x41\x7a\x7c\x7d\x89\x7f\x61\x7f\xff";

  uint8 constant ENTRY_BYTES = 2;
  
  function sin(uint16 _angle) pure internal returns (int) {
    uint index = getBits(WIDTH, OFFSET, _angle);

    bool quadrantOdd = (_angle & LOW_MASK) == 0;

    if (!quadrantOdd) {
      index = SIN_MASK_SIZE - 1 - index;
    }

    uint x1 = getSinTableElByIndex(index);
    uint x2 = getSinTableElByIndex(index + 1);
    uint approximation = ((x2 - x1) * getBits(INTERP_WIDTH, INTERP_OFFSET, _angle)) / (2 ** INTERP_WIDTH);

    int sinResult = quadrantOdd ? int(x1) + int(approximation) : int(x2) - int(approximation);

    return (_angle & HIGH_MASK) != 0 ? sinResult * -1 : sinResult;
  }

  function cos(uint16 _angle) pure internal returns (int) {
    return sin(_angle > ANGLES_COUNT - LOW_MASK ?  LOW_MASK - ANGLES_COUNT - _angle : _angle + LOW_MASK);
  }
  
  function getBits(uint _w, uint _o, uint _v) pure internal returns (uint) {
    return (_v / (2 ** _o)) & (((2 ** _w)) - 1);
  }

  function getSinTableElByIndex(uint i) pure internal returns (uint16) {
    bytes memory table = SIN_MASK;
    uint offset = (i + 1) * ENTRY_BYTES;
    uint16 trigintValue;
    assembly {
      trigint_value := mload(add(table, offset))
    }

    return trigintValue;
  }
}
